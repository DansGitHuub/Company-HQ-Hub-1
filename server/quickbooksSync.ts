import { pool } from "./db";

const QB_BASE_URL = "https://quickbooks.api.intuit.com/v3/company";
const QB_MINOR_VER = "minorversion=65";

// ── Token helpers ─────────────────────────────────────────────────────────────
export async function getTokens() {
  const { rows } = await pool.query(
    "SELECT * FROM quickbooks_tokens ORDER BY updated_at DESC LIMIT 1"
  );
  return rows[0] ?? null;
}

async function saveTokens(tokens: {
  realm_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: Date;
}) {
  await pool.query(
    `INSERT INTO quickbooks_tokens (realm_id, access_token, refresh_token, token_expiry)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [tokens.realm_id, tokens.access_token, tokens.refresh_token, tokens.token_expiry]
  );
  await pool.query(
    `UPDATE quickbooks_tokens SET access_token=$1, refresh_token=$2, token_expiry=$3, updated_at=NOW()
     WHERE realm_id=$4`,
    [tokens.access_token, tokens.refresh_token, tokens.token_expiry, tokens.realm_id]
  );
}

async function refreshAccessToken(tok: any): Promise<any> {
  const { default: OAuthClient } = await import("intuit-oauth");
  const client = new OAuthClient({
    clientId: process.env.QUICKBOOKS_CLIENT_ID!,
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
    environment: "production",
    redirectUri: "https://companyhq.app/api/auth/quickbooks/callback",
  });
  client.setToken({
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    token_type: "bearer",
    realmId: tok.realm_id,
  });
  const resp = await client.refresh();
  const newTok = resp.getJson();
  const expiry = new Date(Date.now() + (newTok.expires_in ?? 3600) * 1000);
  const newRefreshToken = newTok.refresh_token ?? tok.refresh_token;
  // Persist BOTH the new access_token and the rotated refresh_token to DB
  // before returning — Intuit revokes the old refresh_token within hours.
  await saveTokens({
    realm_id: tok.realm_id,
    access_token: newTok.access_token,
    refresh_token: newRefreshToken,
    token_expiry: expiry,
  });
  // Return the fully updated token including the new refresh_token so callers
  // that hold a reference to this object don't use the revoked one.
  return { ...tok, access_token: newTok.access_token, refresh_token: newRefreshToken, token_expiry: expiry };
}

async function getValidToken() {
  let tok = await getTokens();
  if (!tok) throw new Error("QuickBooks not connected");
  if (new Date(tok.token_expiry) <= new Date(Date.now() + 60000)) {
    tok = await refreshAccessToken(tok);
  }
  return tok;
}

// ── QB API helper ─────────────────────────────────────────────────────────────
async function qbGet(tok: any, path: string) {
  const url = `${QB_BASE_URL}/${tok.realm_id}/${path}&${QB_MINOR_VER}`;
  const doGet = (t: any) =>
    fetch(url, { headers: { Authorization: `Bearer ${t.access_token}`, Accept: "application/json" } });
  let res = await doGet(tok);
  if (res.status === 401) {
    // Access token expired mid-step — refresh once and retry immediately
    const fresh = await refreshAccessToken(tok);
    res = await doGet(fresh);
  }
  if (!res.ok) throw new Error(`QB GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function qbPost(tok: any, path: string, body: any) {
  const url = `${QB_BASE_URL}/${tok.realm_id}/${path}?${QB_MINOR_VER}`;
  const doPost = (t: any) =>
    fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t.access_token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  let res = await doPost(tok);
  if (res.status === 401) {
    const fresh = await refreshAccessToken(tok);
    res = await doPost(fresh);
  }
  if (!res.ok) throw new Error(`QB POST ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function qbQuery(tok: any, query: string) {
  return qbGet(tok, `query?query=${encodeURIComponent(query)}`);
}

// ── Logging ───────────────────────────────────────────────────────────────────
async function startLog(entityType: string, direction: string): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO quickbooks_sync_log (entity_type, direction, records_synced, status)
     VALUES ($1, $2, 0, 'running') RETURNING id`,
    [entityType, direction]
  );
  return rows[0].id;
}

async function finishLog(id: number, synced: number, status: string, errors?: string) {
  await pool.query(
    `UPDATE quickbooks_sync_log SET records_synced=$1, status=$2, errors=$3, completed_at=NOW()
     WHERE id=$4`,
    [synced, status, errors ?? null, id]
  );
}

// ── Customer sync ─────────────────────────────────────────────────────────────
async function syncCustomers(tok: any) {
  const logId = await startLog("customers", "bidirectional");
  let synced = 0;
  const errs: string[] = [];

  try {
    // Fetch active QB customers (used for PULL: importing QB→local)
    const activeData    = await qbQuery(tok, "SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000");
    const qbActive: any[] = activeData?.QueryResponse?.Customer ?? [];

    // Also fetch inactive/archived QB customers — needed so our lookup maps can
    // match local customers whose QB counterpart was archived (e.g. Matt Hollingsworth).
    // These are NOT imported into our local DB (PULL only uses active records).
    const inactiveData    = await qbQuery(tok, "SELECT * FROM Customer WHERE Active = false MAXRESULTS 1000");
    const qbInactive: any[] = inactiveData?.QueryResponse?.Customer ?? [];

    // All QB customers (active + inactive) — for lookup only
    const qbAll = [...qbActive, ...qbInactive];

    // Keep the active-only list for the PULL section below
    const qbCustomers = qbActive;

    // Build lookup: QB Id → QB customer (all, for linking inactive matches)
    const qbById = new Map(qbAll.map((c: any) => [c.Id, c]));
    // Build lookup: email → QB customer (active takes precedence over inactive)
    const qbByEmail = new Map(
      [...qbInactive, ...qbActive]               // active overwrites inactive on same email
        .filter((c: any) => c.PrimaryEmailAddr?.Address)
        .map((c: any) => [c.PrimaryEmailAddr.Address.toLowerCase(), c])
    );
    // Build lookup: DisplayName → QB customer (active takes precedence over inactive)
    const qbByDisplayName = new Map(
      [...qbInactive, ...qbActive]               // active overwrites inactive on same name
        .map((c: any) => [c.DisplayName?.toLowerCase().trim(), c])
    );

    // ── PUSH: Local customers without qb_customer_id ──────────────────────────
    const { rows: localCustomers } = await pool.query(
      "SELECT * FROM customers WHERE qb_customer_id IS NULL AND is_active = true LIMIT 500"
    );

    for (const lc of localCustomers) {
      try {
        // Try to match by email first, then by DisplayName (proactive — avoids 6240 errors)
        const email = (lc.email ?? "").toLowerCase();
        const displayNameKey = (
          lc.company_name ||
          `${lc.first_name ?? ""} ${lc.last_name ?? ""}`.trim() ||
          "Unknown"
        ).toLowerCase().trim();
        let matched = (email ? qbByEmail.get(email) : null) ?? qbByDisplayName.get(displayNameKey) ?? null;

        if (matched) {
          // Link existing QB customer
          await pool.query(
            "UPDATE customers SET qb_customer_id=$1, qb_synced_at=NOW() WHERE id=$2",
            [matched.Id, lc.id]
          );
          synced++;
        } else {
          // Create in QB
          const displayName =
            lc.company_name ||
            `${lc.first_name ?? ""} ${lc.last_name ?? ""}`.trim() ||
            "Unknown";

          const qbBody: any = {
            DisplayName: displayName,
            GivenName: lc.first_name ?? "",
            FamilyName: lc.last_name ?? "",
          };
          if (lc.email)           qbBody.PrimaryEmailAddr = { Address: lc.email };
          if (lc.phone)           qbBody.PrimaryPhone = { FreeFormNumber: lc.phone };
          if (lc.billing_address) {
            qbBody.BillAddr = {
              Line1: lc.billing_address,
              City: lc.billing_city ?? "",
              CountrySubDivisionCode: lc.billing_state ?? "",
              PostalCode: lc.billing_zip ?? "",
              Country: "US",
            };
          }

          // Use raw fetch so we can inspect the response body before throwing.
          // This path bypasses qbPost intentionally (we need to read the error body
          // before deciding whether it is a 6240 duplicate vs a real failure).
          const createUrl = `${QB_BASE_URL}/${tok.realm_id}/customer?${QB_MINOR_VER}`;
          const doCreateFetch = (t: any) =>
            fetch(createUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${t.access_token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify(qbBody),
            });
          let createRes = await doCreateFetch(tok);
          // 401 mid-loop: refresh once and retry before any other response handling
          if (createRes.status === 401) {
            tok = await refreshAccessToken(tok);
            createRes = await doCreateFetch(tok);
          }

          let qbId: string | null = null;

          if (createRes.ok) {
            const created = await createRes.json();
            qbId = created?.Customer?.Id ?? null;
          } else {
            const errBody = await createRes.json().catch(() => ({}));
            const faultCode = errBody?.Fault?.Error?.[0]?.code;

            if (String(faultCode) === "6240") {
              // QB rejected creation as a duplicate.  Resolution order:
              //   1. Check in-memory DisplayName map (active + inactive from initial fetch)
              //   2. Live QB query by DisplayName — active, then inactive
              //   3. Live QB query by PrimaryEmailAddr.Address — active, then inactive
              //   4. Give up: log the full QB error JSON so the admin can investigate
              // Link-only in all cases — do NOT reactivate inactive QB customers.
              console.log(`[QB sync] 6240 duplicate for '${displayName}' — running name + email lookups`);
              try {
                // ── Step 1: in-memory DisplayName map ──────────────────────────
                const nameKey = displayName.toLowerCase().trim();
                const inMemory = qbByDisplayName.get(nameKey);
                if (inMemory?.Id) {
                  qbId = inMemory.Id;
                  console.log(`[QB sync] Linked '${displayName}' via in-memory ${inMemory.Active === false ? "inactive" : "active"} map`);
                } else {
                  // ── Step 2: live DisplayName query (active then inactive) ───
                  const safeName = displayName.replace(/'/g, "\\'");
                  const activeNameRes  = await qbQuery(tok, `SELECT * FROM Customer WHERE DisplayName = '${safeName}' AND Active = true`);
                  const activeNameHit  = activeNameRes?.QueryResponse?.Customer?.[0];
                  if (activeNameHit?.Id) {
                    qbId = activeNameHit.Id;
                    console.log(`[QB sync] Linked '${displayName}' via active DisplayName live query`);
                  } else {
                    const inactiveNameRes = await qbQuery(tok, `SELECT * FROM Customer WHERE DisplayName = '${safeName}' AND Active = false`);
                    const inactiveNameHit = inactiveNameRes?.QueryResponse?.Customer?.[0];
                    if (inactiveNameHit?.Id) {
                      qbId = inactiveNameHit.Id;
                      console.log(`[QB sync] Linked '${displayName}' to archived QB customer ${inactiveNameHit.Id} via DisplayName (not reactivating)`);
                    } else {
                      // ── Step 3: live email query (active then inactive) ─────
                      const email = (lc.email ?? "").trim();
                      if (email) {
                        const safeEmail = email.replace(/'/g, "\\'");
                        const activeEmailRes  = await qbQuery(tok, `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${safeEmail}' AND Active = true`);
                        const activeEmailHit  = activeEmailRes?.QueryResponse?.Customer?.[0];
                        if (activeEmailHit?.Id) {
                          qbId = activeEmailHit.Id;
                          console.log(`[QB sync] Linked '${displayName}' to QB customer ${activeEmailHit.Id} (DisplayName='${activeEmailHit.DisplayName}') via active email match`);
                        } else {
                          const inactiveEmailRes = await qbQuery(tok, `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${safeEmail}' AND Active = false`);
                          const inactiveEmailHit = inactiveEmailRes?.QueryResponse?.Customer?.[0];
                          if (inactiveEmailHit?.Id) {
                            qbId = inactiveEmailHit.Id;
                            console.log(`[QB sync] Linked '${displayName}' to archived QB customer ${inactiveEmailHit.Id} (DisplayName='${inactiveEmailHit.DisplayName}') via inactive email match (not reactivating)`);
                          } else {
                            // ── Step 4: give up — log full QB error payload ───
                            const detail = `push customer '${displayName}' (email=${email || "none"}): 6240 duplicate — name+email lookups all missed. Full QB error: ${JSON.stringify(errBody)}`;
                            errs.push(detail);
                            console.error(`[QB sync] ${detail}`);
                          }
                        }
                      } else {
                        // No email on local record — can't do email lookup
                        const detail = `push customer '${displayName}' (no email): 6240 duplicate — DisplayName lookups all missed. Full QB error: ${JSON.stringify(errBody)}`;
                        errs.push(detail);
                        console.error(`[QB sync] ${detail}`);
                      }
                    }
                  }
                }
              } catch (lookupErr: any) {
                errs.push(`push customer '${displayName}': 6240 lookup chain failed — ${lookupErr.message}`);
              }
            } else {
              throw new Error(`QB POST customer: ${createRes.status} ${JSON.stringify(errBody)}`);
            }
          }

          if (qbId) {
            await pool.query(
              "UPDATE customers SET qb_customer_id=$1, qb_synced_at=NOW() WHERE id=$2",
              [qbId, lc.id]
            );
            synced++;
          }
        }
      } catch (e: any) {
        errs.push(`push customer ${lc.id}: ${e.message}`);
      }
    }

    // ── PULL: QB customers not linked locally ─────────────────────────────────
    const { rows: linkedIds } = await pool.query(
      "SELECT qb_customer_id FROM customers WHERE qb_customer_id IS NOT NULL"
    );
    const localLinked = new Set(linkedIds.map((r: any) => r.qb_customer_id));

    for (const qc of qbCustomers) {
      if (localLinked.has(qc.Id)) continue;
      try {
        const email = qc.PrimaryEmailAddr?.Address ?? null;
        const firstName = qc.GivenName ?? "";
        const lastName = qc.FamilyName ?? qc.DisplayName ?? "";
        const company = (qc.CompanyName || qc.DisplayName) ?? null;

        await pool.query(
          `INSERT INTO customers
             (first_name, last_name, company_name, billing_address, billing_city,
              billing_state, billing_zip, qb_customer_id, qb_synced_at, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),true)
           ON CONFLICT DO NOTHING`,
          [
            firstName, lastName, company,
            qc.BillAddr?.Line1 ?? null,
            qc.BillAddr?.City ?? null,
            qc.BillAddr?.CountrySubDivisionCode ?? null,
            qc.BillAddr?.PostalCode ?? null,
            qc.Id,
          ]
        );
        synced++;
      } catch (e: any) {
        errs.push(`pull customer ${qc.Id}: ${e.message}`);
      }
    }

    await finishLog(logId, synced, errs.length ? "partial" : "success", errs.join("; ") || undefined);
  } catch (e: any) {
    await finishLog(logId, synced, "error", e.message);
    throw e;
  }
  return { synced, errors: errs };
}

// ── Invoice sync ──────────────────────────────────────────────────────────────
async function syncInvoices(tok: any) {
  const logId = await startLog("invoices", "bidirectional");
  let synced = 0;
  const errs: string[] = [];

  try {
    // Look up a valid QB Service item to use as the line ItemRef
    let qbServiceItemId = "1";
    try {
      const itemData = await qbQuery(tok, "SELECT * FROM Item WHERE Type = 'Service' MAXRESULTS 1");
      const firstItem = itemData?.QueryResponse?.Item?.[0];
      if (firstItem?.Id) qbServiceItemId = firstItem.Id;
    } catch (itemErr: any) {
      console.warn("[QB sync] Could not fetch service item — falling back to id '1':", itemErr.message);
    }

    const data = await qbQuery(tok, "SELECT * FROM Invoice MAXRESULTS 500");
    const qbInvoices: any[] = data?.QueryResponse?.Invoice ?? [];
    const qbByDocNum = new Map(
      qbInvoices
        .filter((i: any) => i.DocNumber)
        .map((i: any) => [i.DocNumber, i])
    );

    // ── PUSH: Local invoices with status='sent' not yet in QB ─────────────────
    // INNER JOIN + is_active guard: skip invoices whose customer has been
    // archived — they have no active QB counterpart and cause the sync to
    // iterate endlessly without ever succeeding.
    const { rows: localInvoices } = await pool.query(`
      SELECT inv.*, c.qb_customer_id
      FROM invoices inv
      INNER JOIN customers c ON c.id = inv.customer_id AND c.is_active = true
      WHERE inv.qb_invoice_id IS NULL
        AND inv.status = 'sent'
      LIMIT 200
    `);

    for (const li of localInvoices) {
      try {
        // Try to match by invoice number
        const matched = qbByDocNum.get(li.invoice_number);
        if (matched) {
          await pool.query(
            "UPDATE invoices SET qb_invoice_id=$1, qb_synced_at=NOW() WHERE id=$2",
            [matched.Id, li.id]
          );
          synced++;
          continue;
        }

        if (!li.qb_customer_id) {
          errs.push(`skip invoice ${li.invoice_number}: customer not synced to QB`);
          continue;
        }

        const qbBody: any = {
          DocNumber: li.invoice_number,
          CustomerRef: { value: li.qb_customer_id },
          TxnDate: li.issued_date ?? new Date().toISOString().slice(0, 10),
          DueDate: li.due_date ?? undefined,
          Line: [
            {
              Amount: parseFloat(li.subtotal ?? li.total ?? 0),
              DetailType: "SalesItemLineDetail",
          Taxable: li.taxable ?? true,
              SalesItemLineDetail: {
                ItemRef: { value: qbServiceItemId },
                UnitPrice: parseFloat(li.subtotal ?? li.total ?? 0),
                Qty: 1,
              },
            },
          ],
          TxnTaxDetail: {
            TotalTax: parseFloat(li.tax_amount ?? 0),
          },
        };
        if (li.notes) qbBody.CustomerMemo = { value: li.notes };

        const created = await qbPost(tok, "invoice", qbBody);
        const newId = created?.Invoice?.Id;
        if (newId) {
          await pool.query(
            "UPDATE invoices SET qb_invoice_id=$1, qb_synced_at=NOW() WHERE id=$2",
            [newId, li.id]
          );
          synced++;

          // Send the invoice via QB so the customer receives a payment-link email
          try {
            const sendUrl = `${QB_BASE_URL}/${tok.realm_id}/invoice/${newId}/send?${QB_MINOR_VER}`;
            const sendRes = await fetch(sendUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${tok.access_token}`,
                Accept: "application/json",
                "Content-Type": "application/octet-stream",
              },
              body: "",
            });
            if (!sendRes.ok) {
              const txt = await sendRes.text();
              errs.push(`send invoice ${li.invoice_number} (QB id ${newId}): ${sendRes.status} ${txt}`);
            } else {
              console.log(`[QB sync] Invoice ${li.invoice_number} created and sent via QB (id ${newId})`);
            }
          } catch (sendErr: any) {
            errs.push(`send invoice ${li.invoice_number}: ${sendErr.message}`);
          }
        }
      } catch (e: any) {
        errs.push(`push invoice ${li.invoice_number}: ${e.message}`);
      }
    }

    // ── PULL: QB invoice statuses → local ─────────────────────────────────────
    const { rows: linked } = await pool.query(
      "SELECT id, qb_invoice_id, status FROM invoices WHERE qb_invoice_id IS NOT NULL"
    );
    const linkedMap = new Map(linked.map((r: any) => [r.qb_invoice_id, r]));

    for (const qi of qbInvoices) {
      const local = linkedMap.get(qi.Id);
      if (!local) continue;
      try {
        const balance = parseFloat(qi.Balance ?? 0);
        const total = parseFloat(qi.TotalAmt ?? 0);
        if (balance === 0 && total > 0 && !["paid", "cancelled"].includes(local.status)) {
          await pool.query(
            "UPDATE invoices SET status='paid', amount_paid=$1, balance_due=0, paid_at=NOW(), qb_synced_at=NOW(), updated_at=NOW() WHERE id=$2",
            [total, local.id]
          );
          synced++;
        }
      } catch (e: any) {
        errs.push(`pull invoice status ${qi.Id}: ${e.message}`);
      }
    }

    await finishLog(logId, synced, errs.length ? "partial" : "success", errs.join("; ") || undefined);
  } catch (e: any) {
    await finishLog(logId, synced, "error", e.message);
    throw e;
  }
  return { synced, errors: errs };
}

// ── Payment sync (pull only) ──────────────────────────────────────────────────
async function syncPayments(tok: any) {
  const logId = await startLog("payments", "pull");
  let synced = 0;
  const errs: string[] = [];

  try {
    const data = await qbQuery(
      tok,
      "SELECT * FROM Payment WHERE TxnDate >= '2024-01-01' MAXRESULTS 500"
    );
    const qbPayments: any[] = data?.QueryResponse?.Payment ?? [];

    for (const qp of qbPayments) {
      try {
        const lines: any[] = qp.Line ?? [];
        for (const line of lines) {
          const linkedTxns = line.LinkedTxn ?? [];
          for (const txn of linkedTxns) {
            if (txn.TxnType !== "Invoice") continue;
            const { rows } = await pool.query(
              "SELECT id, status, total FROM invoices WHERE qb_invoice_id=$1",
              [txn.TxnId]
            );
            if (!rows[0]) continue;
            const inv = rows[0];
            if (["paid", "cancelled"].includes(inv.status)) continue;
            const paidAmt = parseFloat(qp.TotalAmt ?? 0);
            await pool.query(
              `UPDATE invoices SET
                 amount_paid = LEAST(total, COALESCE(amount_paid,0) + $1),
                 balance_due = GREATEST(0, total - LEAST(total, COALESCE(amount_paid,0) + $1)),
                 status = CASE WHEN LEAST(total, COALESCE(amount_paid,0) + $1) >= total THEN 'paid' ELSE status END,
                 paid_at = CASE WHEN LEAST(total, COALESCE(amount_paid,0) + $1) >= total THEN NOW() ELSE paid_at END,
                 qb_synced_at = NOW(), updated_at = NOW()
               WHERE id = $2`,
              [paidAmt, inv.id]
            );
            synced++;
          }
        }
      } catch (e: any) {
        errs.push(`payment ${qp.Id}: ${e.message}`);
      }
    }

    await finishLog(logId, synced, errs.length ? "partial" : "success", errs.join("; ") || undefined);
  } catch (e: any) {
    await finishLog(logId, synced, "error", e.message);
    throw e;
  }
  return { synced, errors: errs };
}

// -- Items sync (QB -> local) -------------------------------------------------
async function syncItemsFromQB(tok: any) {
  const logId = await startLog("qb_items", "pull");
  let synced = 0;
  const errs: string[] = [];

  try {
    const data = await qbQuery(tok, "SELECT * FROM Item MAXRESULTS 1000");
    const items: any[] = data?.QueryResponse?.Item ?? [];

    for (const item of items) {
      try {
        await pool.query(
          `INSERT INTO qb_items (
            qb_item_id, name, full_name, type, description,
            unit_price, income_account_ref, income_account_name,
            expense_account_ref, expense_account_name,
            parent_ref, parent_name, active, synced_at, raw_data
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),$14)
          ON CONFLICT (qb_item_id) DO UPDATE SET
            name               = EXCLUDED.name,
            full_name          = EXCLUDED.full_name,
            type               = EXCLUDED.type,
            description        = EXCLUDED.description,
            unit_price         = EXCLUDED.unit_price,
            income_account_ref  = EXCLUDED.income_account_ref,
            income_account_name = EXCLUDED.income_account_name,
            expense_account_ref  = EXCLUDED.expense_account_ref,
            expense_account_name = EXCLUDED.expense_account_name,
            parent_ref         = EXCLUDED.parent_ref,
            parent_name        = EXCLUDED.parent_name,
            active             = EXCLUDED.active,
            synced_at          = NOW(),
            raw_data           = EXCLUDED.raw_data`,
          [
            item.Id,
            item.Name,
            item.FullyQualifiedName ?? item.Name,
            item.Type ?? null,
            item.Description ?? null,
            item.UnitPrice ?? null,
            item.IncomeAccountRef?.value ?? null,
            item.IncomeAccountRef?.name ?? null,
            item.ExpenseAccountRef?.value ?? null,
            item.ExpenseAccountRef?.name ?? null,
            item.ParentRef?.value ?? null,
            item.ParentRef?.name ?? null,
            item.Active !== false,
            JSON.stringify(item),
          ]
        );
        synced++;
      } catch (itemErr: any) {
        errs.push(`Item ${item.Id} (${item.Name}): ${itemErr.message}`);
      }
    }

    await finishLog(logId, synced, errs.length ? "partial" : "success", errs.length ? errs.join("; ") : undefined);
  } catch (e: any) {
    await finishLog(logId, synced, "error", e.message);
    throw e;
  }

  return { synced, errors: errs };
}

// ── Time Activity export ───────────────────────────────────────────────────────
export async function exportTimeEntriesToQBO(entryIds: number[]): Promise<{
  exported: number;
  failed: number;
  errors: string[];
}> {
  if (!entryIds.length) return { exported: 0, failed: 0, errors: [] };

  let tok: any;
  try {
    tok = await getValidToken();
  } catch (e: any) {
    throw new Error("QuickBooks not connected");
  }

  // Look up a service item to use as ItemRef (same pattern as invoices)
  let serviceItemId = "1";
  try {
    const itemData = await qbQuery(tok, "SELECT * FROM Item WHERE Type = 'Service' MAXRESULTS 1");
    const firstItem = itemData?.QueryResponse?.Item?.[0];
    if (firstItem?.Id) serviceItemId = firstItem.Id;
  } catch (e: any) {
    console.warn("[QB time export] Could not fetch service item:", e.message);
  }

  // Fetch entries with user + job info — skip already exported
  const { rows: entries } = await pool.query(
    `SELECT
       te.id, te.clock_in, te.clock_out, te.duration_minutes,
       te.work_area_name, te.entry_type, te.notes,
       te.qbo_exported_at,
       u.id AS user_id, u.qbo_employee_id,
       COALESCE(j.title, j.client) AS job_title,
       c.qb_customer_id
     FROM time_entries te
     JOIN users u ON u.id = te.user_id
     LEFT JOIN jobs j ON j.id = te.job_id
     LEFT JOIN customers c ON c.id = j.customer_id
     WHERE te.id = ANY($1::int[])
       AND te.clock_out IS NOT NULL
       AND te.qbo_exported_at IS NULL`,
    [entryIds]
  );

  let exported = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    if (!entry.qbo_employee_id) {
      await pool.query(
        `UPDATE time_entries SET qbo_export_error=$1 WHERE id=$2`,
        [`Employee not mapped to a QB Employee (user ${entry.user_id})`, entry.id]
      );
      failed++;
      errors.push(`Entry ${entry.id}: employee not mapped to QB`);
      continue;
    }

    const totalMins = Number(entry.duration_minutes ?? 0);
    const hours = Math.floor(totalMins / 60);
    const minutes = totalMins % 60;
    const txnDate = new Date(entry.clock_in).toISOString().split("T")[0];
    const description = [entry.job_title, entry.work_area_name]
      .filter(Boolean)
      .join(" — ") || entry.entry_type || "Time Entry";

    const payload: any = {
      TxnDate: txnDate,
      NameOf: "Employee",
      EmployeeRef: { value: entry.qbo_employee_id },
      ItemRef: { value: serviceItemId },
      Hours: hours,
      Minutes: minutes,
      Description: description,
      BillableStatus: entry.entry_type === "billable" ? "Billable" : "NotBillable",
    };
    if (entry.qb_customer_id) {
      payload.CustomerRef = { value: entry.qb_customer_id };
    }

    try {
      const result = await qbPost(tok, "timeactivity", payload);
      const activityId = result?.TimeActivity?.Id ?? null;
      await pool.query(
        `UPDATE time_entries
         SET qbo_exported_at=NOW(), qbo_time_activity_id=$1, qbo_export_error=NULL
         WHERE id=$2`,
        [activityId, entry.id]
      );
      exported++;
    } catch (e: any) {
      const errMsg = e.message ?? "Unknown error";
      await pool.query(
        `UPDATE time_entries SET qbo_export_error=$1 WHERE id=$2`,
        [errMsg.slice(0, 500), entry.id]
      );
      failed++;
      errors.push(`Entry ${entry.id}: ${errMsg}`);
    }
  }

  return { exported, failed, errors };
}

// ── Master sync entry ─────────────────────────────────────────────────────────
export async function runFullSync() {
  const results = { items: { synced: 0, errors: [] as string[] }, customers: { synced: 0, errors: [] as string[] }, invoices: { synced: 0, errors: [] as string[] }, payments: { synced: 0, errors: [] as string[] } };
  // Re-fetch the latest token from DB before every step so that a refresh_token
  // rotation that happened during a prior step is picked up rather than using
  // a stale in-memory token with a revoked refresh_token.
  results.items     = await syncItemsFromQB(await getValidToken());
  results.customers = await syncCustomers(await getValidToken());
  results.invoices  = await syncInvoices(await getValidToken());
  results.payments  = await syncPayments(await getValidToken());
  return results;
}

// ── Public per-entity sync wrappers (used by webhook) ────────────────────────
export async function syncCustomersPublic() {
  const tok = await getValidToken();
  return syncCustomers(tok);
}

export async function syncInvoicesPublic() {
  const tok = await getValidToken();
  return syncInvoices(tok);
}

export async function syncPaymentsPublic() {
  const tok = await getValidToken();
  return syncPayments(tok);
}

export async function syncItemsPublic() {
  const tok = await getValidToken();
  return syncItemsFromQB(tok);
}
