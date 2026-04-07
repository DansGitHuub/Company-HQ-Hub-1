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
  await saveTokens({
    realm_id: tok.realm_id,
    access_token: newTok.access_token,
    refresh_token: newTok.refresh_token ?? tok.refresh_token,
    token_expiry: expiry,
  });
  return { ...tok, access_token: newTok.access_token, token_expiry: expiry };
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
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tok.access_token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`QB GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function qbPost(tok: any, path: string, body: any) {
  const url = `${QB_BASE_URL}/${tok.realm_id}/${path}?${QB_MINOR_VER}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tok.access_token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
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
    // Fetch all QB customers
    const data = await qbQuery(tok, "SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000");
    const qbCustomers: any[] = data?.QueryResponse?.Customer ?? [];

    // Build lookup: QB Id → QB customer
    const qbById = new Map(qbCustomers.map((c: any) => [c.Id, c]));
    // Build lookup: email → QB customer
    const qbByEmail = new Map(
      qbCustomers
        .filter((c: any) => c.PrimaryEmailAddr?.Address)
        .map((c: any) => [c.PrimaryEmailAddr.Address.toLowerCase(), c])
    );

    // ── PUSH: Local customers without qb_customer_id ──────────────────────────
    const { rows: localCustomers } = await pool.query(
      "SELECT * FROM customers WHERE qb_customer_id IS NULL AND is_active = true LIMIT 500"
    );

    for (const lc of localCustomers) {
      try {
        // Try to match by email
        const email = (lc.email ?? "").toLowerCase();
        let matched = email ? qbByEmail.get(email) : null;

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

          const created = await qbPost(tok, "customer", qbBody);
          const newId = created?.Customer?.Id;
          if (newId) {
            await pool.query(
              "UPDATE customers SET qb_customer_id=$1, qb_synced_at=NOW() WHERE id=$2",
              [newId, lc.id]
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
    const data = await qbQuery(tok, "SELECT * FROM Invoice MAXRESULTS 500");
    const qbInvoices: any[] = data?.QueryResponse?.Invoice ?? [];
    const qbByDocNum = new Map(
      qbInvoices
        .filter((i: any) => i.DocNumber)
        .map((i: any) => [i.DocNumber, i])
    );

    // ── PUSH: Local invoices with status='sent' not yet in QB ─────────────────
    const { rows: localInvoices } = await pool.query(`
      SELECT inv.*, c.qb_customer_id
      FROM invoices inv
      LEFT JOIN customers c ON c.id = inv.customer_id
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
              SalesItemLineDetail: {
                ItemRef: { value: "1", name: "Services" },
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

// ── Master sync entry ─────────────────────────────────────────────────────────
export async function runFullSync() {
  const tok = await getValidToken();
  const results = { customers: { synced: 0, errors: [] as string[] }, invoices: { synced: 0, errors: [] as string[] }, payments: { synced: 0, errors: [] as string[] } };
  results.customers = await syncCustomers(tok);
  results.invoices  = await syncInvoices(tok);
  results.payments  = await syncPayments(tok);
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
