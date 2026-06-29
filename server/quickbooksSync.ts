import { pool } from "./db";

const QB_BASE_URL = "https://quickbooks.api.intuit.com/v3/company";
const QB_MINOR_VER = "minorversion=65";

// ── In-process auth-failure flag (Finding 18 / approach 1c) ──────────────────
// Set when refresh returns invalid_grant; cleared on successful OAuth callback.
let qbAuthFailed = false;
export function getQbAuthFailed(): boolean { return qbAuthFailed; }
export function clearQbAuthFailed(): void { qbAuthFailed = false; }

// ── In-flight refresh deduplication ──────────────────────────────────────────
// Two concurrent callers share one refresh promise so the rotated
// refresh_token is never raced and overwritten by a stale one.
let refreshInFlight: Promise<any> | null = null;

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
  // Single atomic upsert — also clears needs_reauth and last_error on every
  // successful save so a re-authorized connection immediately reflects healthy.
  await pool.query(
    `INSERT INTO quickbooks_tokens (realm_id, access_token, refresh_token, token_expiry)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (realm_id) DO UPDATE
       SET access_token   = EXCLUDED.access_token,
           refresh_token  = EXCLUDED.refresh_token,
           token_expiry   = EXCLUDED.token_expiry,
           updated_at     = NOW(),
           needs_reauth   = false,
           last_error     = NULL`,
    [tokens.realm_id, tokens.access_token, tokens.refresh_token, tokens.token_expiry]
  );
}

async function refreshAccessToken(tok: any): Promise<any> {
  try {
    // ── Acquire a pooled connection for the advisory-lock transaction ─────────
    const conn = await pool.connect();
    try {
      await conn.query("BEGIN");

      // Cross-process advisory lock: only one instance can rotate this realm's
      // refresh_token at a time.  pg_advisory_xact_lock is released automatically
      // when the transaction commits or rolls back.
      await conn.query(
        `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`,
        [`qb-refresh:${tok.realm_id}`]
      );

      // Re-read post-lock state — a concurrent instance may have already rotated.
      const { rows } = await conn.query(
        `SELECT access_token, refresh_token, token_expiry
         FROM quickbooks_tokens WHERE realm_id=$1`,
        [tok.realm_id]
      );

      if (rows.length === 0) {
        await conn.query("ROLLBACK");
        throw new Error("QuickBooks tokens not found");
      }

      const dbTok = rows[0];

      // If the DB already has a fresh token (another instance just refreshed),
      // skip without calling Intuit and return the DB values.
      if (new Date(dbTok.token_expiry) > new Date(Date.now() + 5 * 60 * 1000)) {
        await conn.query("COMMIT");
        console.log("[QB] Refresh skipped, DB has fresh token from concurrent rotation");
        return {
          ...tok,
          access_token:  dbTok.access_token,
          refresh_token: dbTok.refresh_token,
          token_expiry:  dbTok.token_expiry,
        };
      }

      // Use the LOCKED DB token values — not the stale in-memory tok passed in.
      // @ts-ignore — intuit-oauth has no bundled type declarations
      const { default: OAuthClient } = await import("intuit-oauth");
      const qbClient = new OAuthClient({
        clientId:     process.env.QB_CLIENT_ID || process.env.QUICKBOOKS_CLIENT_ID!,
        clientSecret: process.env.QB_CLIENT_SECRET || process.env.QUICKBOOKS_CLIENT_SECRET!,
        environment:  "production",
        redirectUri:  "https://companyhq.app/api/auth/quickbooks/callback",
      });
      qbClient.setToken({
        access_token:  dbTok.access_token,
        refresh_token: dbTok.refresh_token,
        token_type:    "bearer",
        realmId:       tok.realm_id,
      });

      // Disable the SDK's built-in ECONNRESET/ETIMEDOUT retry so a stalled
      // network request that Intuit already processed server-side cannot replay
      // the now-invalid refresh_token on a second attempt.  retryConfig is a
      // static class property with no constructor-time override surface, so we
      // patch shouldRetry on this instance only.
      (qbClient as any).shouldRetry = () => false;

      // Race the SDK refresh against a hard 12-second wall-clock timeout.
      // If the TCP connection stalls (Intuit slow / network drop), we fail fast,
      // mark needs_reauth, and surface a clear error rather than hanging for the
      // SDK's full 30-second axios default plus retry delays.
      const refreshPromise = ((qbClient as any).refreshUsingToken(dbTok.refresh_token) as Promise<any>).then((r: any) => r?.getJson());
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('QB refresh timeout 12s')), 12000)
      );
      let newTok: any;
      try {
        newTok = await Promise.race([refreshPromise, timeoutPromise]);
      } catch (raceErr: any) {
        const raceMsg: string = raceErr?.message ?? String(raceErr);
        const isStall =
          raceMsg.includes('QB refresh timeout 12s') ||
          raceErr?.code === 'ECONNRESET' ||
          raceErr?.code === 'ETIMEDOUT' ||
          raceErr?.code === 'ENOTFOUND' ||
          (raceErr?.isAxiosError === true && !raceErr?.response);
        if (isStall) {
          const stallMsg = 'Refresh stalled at Intuit; reauth required';
          qbAuthFailed = true;
          pool.query(
            `UPDATE quickbooks_tokens SET needs_reauth=true, last_error=$1 WHERE realm_id=$2`,
            [stallMsg, tok.realm_id]
          ).catch(() => {});
          console.error(
            `[QB] Refresh timeout or network error - connection marked needs_reauth for realm_id=${tok.realm_id}`
          );
          throw new Error(stallMsg);
        }
        throw raceErr;
      }

      // Bail if Intuit's response is missing either token — persisting a null
      // refresh_token would sever the connection permanently.
      if (!newTok.access_token || !newTok.refresh_token) {
        // COMMIT to release the advisory lock without persisting bad data.
        await conn.query("COMMIT");
        const errMsg = "Refresh response missing access_token or refresh_token";
        qbAuthFailed = true;
        pool.query(
          `UPDATE quickbooks_tokens SET needs_reauth=true, last_error=$1 WHERE realm_id=$2`,
          [errMsg, tok.realm_id]
        ).catch(() => {});
        throw new Error(errMsg);
      }

      const expiry = new Date(Date.now() + (newTok.expires_in ?? 3600) * 1000);

      // Persist inside the same transaction while the advisory lock is still held.
      await conn.query(
        `UPDATE quickbooks_tokens
         SET access_token=$1, refresh_token=$2, token_expiry=$3,
             needs_reauth=false, last_error=NULL
         WHERE realm_id=$4`,
        [newTok.access_token, newTok.refresh_token, expiry, tok.realm_id]
      );

      await conn.query("COMMIT");
      qbAuthFailed = false;
      console.log("[QB] Refresh rotated under advisory lock for realm_id=" + tok.realm_id);
      return {
        ...tok,
        access_token:  newTok.access_token,
        refresh_token: newTok.refresh_token,
        token_expiry:  expiry,
      };

    } catch (innerErr) {
      // ROLLBACK is a no-op if we already COMMITted (e.g. the missing-token path).
      await conn.query("ROLLBACK").catch(() => {});
      throw innerErr;
    } finally {
      conn.release();
    }
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    if (/invalid_grant|refresh token is invalid|unauthorized_client|token_revoked/i.test(msg)) {
      qbAuthFailed = true;
      // Persist the failure to the DB so /api/quickbooks/status reflects it
      // even after a server restart (when in-memory qbAuthFailed is reset).
      await pool.query(
        `UPDATE quickbooks_tokens SET needs_reauth=true, last_error=$1 WHERE realm_id=$2`,
        [msg, tok.realm_id]
      ).catch(() => {});
      console.error("[QB] Refresh token invalid — reauthorization required:", msg);
    }
    throw err;
  }
}

export async function getValidToken() {
  let tok = await getTokens();
  if (!tok) throw new Error("QuickBooks not connected");
  // 5-minute staleness window — refresh before the access_token actually expires
  // so callers always receive a token with meaningful remaining lifetime.
  if (new Date(tok.token_expiry) <= new Date(Date.now() + 5 * 60 * 1000)) {
    // Deduplicate: concurrent callers share one refresh promise so the rotated
    // refresh_token is never raced.
    if (!refreshInFlight) {
      refreshInFlight = refreshAccessToken(tok).finally(() => {
        refreshInFlight = null;
      });
    }
    tok = await refreshInFlight;
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
    // Access token expired mid-step — route through getValidToken() so the
    // refreshInFlight deduplication gate is respected.  Calling
    // refreshAccessToken(tok) directly here was the source of the race: if
    // the proactive 30-min refresh was already rotating the token, a second
    // concurrent call with the old tok would try to reuse the now-invalidated
    // refresh_token and receive "invalid_grant".
    console.log("[QB] 401 mid-request — re-fetching valid token via dedup gate");
    const fresh = await getValidToken();
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
    // Same dedup-gate fix as qbGet — avoid racing refreshAccessToken(tok) when
    // the proactive refresh loop may already be rotating the refresh_token.
    console.log("[QB] 401 mid-POST — re-fetching valid token via dedup gate");
    const fresh = await getValidToken();
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
  console.log(`[QB sync v2 LIVE] syncCustomers entered at ${new Date().toISOString()}`);
  const logId = await startLog("customers", "bidirectional");
  let synced = 0;
  const errs: string[] = [];

  try {
    // Fetch active QB customers (used for PULL: importing QB→local)
    console.log('[Phase 1f] qbAll fetch limit=1000');
    const activeData    = await qbQuery(tok, "SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000");
    const qbActive: any[] = activeData?.QueryResponse?.Customer ?? [];

    // Also fetch inactive/archived QB customers — needed so our lookup maps can
    // match local customers whose QB counterpart was archived (e.g. Matt Hollingsworth).
    // These are NOT imported into our local DB (PULL only uses active records).
    console.log('[Phase 1f] qbAll fetch limit=1000');
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
    const { rows: localCustomers } = await pool.query(`
      SELECT c.*, ce.email
      FROM customers c
      LEFT JOIN LATERAL (
        SELECT email
        FROM customer_emails
        WHERE customer_id = c.id
        ORDER BY is_primary DESC NULLS LAST, created_at ASC
        LIMIT 1
      ) ce ON true
      WHERE c.qb_customer_id IS NULL AND c.is_active = true
        AND (c.qb_sync_skip IS NULL OR c.qb_sync_skip = false)
      LIMIT 500
    `);

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
          // 401 mid-loop: route through dedup gate for the same reason as qbGet/qbPost
          if (createRes.status === 401) {
            console.log("[QB] 401 mid-customer-create — re-fetching valid token via dedup gate");
            tok = await getValidToken();
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
                console.log(`[QB sync] 6240 recovery start: nameKey='${displayName.toLowerCase().trim()}', qbAll.length=${qbAll.length}`);
                // ── Step 1: in-memory DisplayName map ──────────────────────────
                const nameKey = displayName.toLowerCase().trim();
                const inMemory = qbByDisplayName.get(nameKey);
                if (inMemory?.Id) {
                  qbId = inMemory.Id;
                  console.log(`[QB sync] Linked '${displayName}' via in-memory ${inMemory.Active === false ? "inactive" : "active"} map`);
                } else {
                  // ── Step 2: live DisplayName query (no Active filter — catches any state) ──
                  // A single unrestricted query is more reliable than two separate
                  // Active=true / Active=false queries which can miss when QB's combined-
                  // condition logic returns unexpected empty results.
                  const safeName = displayName.replace(/'/g, "\\'");
                  const nameRes = await qbQuery(tok, `SELECT * FROM Customer WHERE DisplayName = '${safeName}' MAXRESULTS 1`);
                  const nameHit = nameRes?.QueryResponse?.Customer?.[0];
                  if (nameHit?.Id) {
                    qbId = nameHit.Id;
                    const stateLabel = nameHit.Active === false ? "inactive" : "active";
                    console.log(`[QB sync] Linked '${displayName}' to ${stateLabel} QB customer ${nameHit.Id} via DisplayName live query (not reactivating)`);
                  } else {
                      // ── Step 2b: case-insensitive scan of in-memory qbAll ──
                      // Catches pagination misses (beyond MAXRESULTS 1000) and case
                      // mismatches that fool the exact-string live query.
                      const lcKey = displayName.toLowerCase().trim();
                      const ciMatches = qbAll.filter((c: any) => (c.DisplayName ?? "").toLowerCase().trim() === lcKey);
                      if (ciMatches.length === 1) {
                        qbId = ciMatches[0].Id;
                        const stateLabel = ciMatches[0].Active === false ? "inactive" : "active";
                        console.log(`[QB sync] Linked '${displayName}' to ${stateLabel} QB customer ${qbId} via case-insensitive qbAll scan (qbAll size=${qbAll.length})`);
                      } else if (ciMatches.length > 1) {
                        console.warn(`[QB sync] Ambiguous: ${ciMatches.length} QB customers match nameKey='${lcKey}' — skipping auto-link, falling through to email lookup`);
                      }

                      if (!qbId) {
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
                            // ── Step 5: GivenName+FamilyName direct-QB fallback ──
                            const nameParts5 = displayName.trim().split(/\s+/);
                            if (nameParts5.length >= 2 && !qbId) {
                              const givenName5  = nameParts5[0];
                              const familyName5 = nameParts5.slice(1).join(" ");
                              const safeGiven5  = givenName5.replace(/'/g, "\\'");
                              const safeFamily5 = familyName5.replace(/'/g, "\\'");
                              const step5Res = await qbQuery(tok, `SELECT * FROM Customer WHERE GivenName = '${safeGiven5}' AND FamilyName = '${safeFamily5}' MAXRESULTS 50`);
                              const step5Hits: any[] = step5Res?.QueryResponse?.Customer ?? [];
                              if (step5Hits.length === 1) {
                                const candidate5 = step5Hits[0].Id;
                                const { rows: dup5 } = await pool.query(
                                  "SELECT id FROM customers WHERE qb_customer_id = $1 AND id != $2 LIMIT 1",
                                  [candidate5, lc.id]
                                );
                                if (dup5.length > 0) {
                                  console.log(`[Phase 1g Step 5] dup-link skipped: local ${lc.id} would link to QB ${candidate5} but local ${dup5[0].id} already owns it`);
                                  await pool.query(
                                    "UPDATE customers SET qb_sync_skip = true, qb_sync_skip_reason = $1 WHERE id = $2",
                                    [`QB ID ${candidate5} already owned by local ${dup5[0].id} — merge duplicate customer records to resolve`, lc.id]
                                  );
                                } else {
                                  qbId = candidate5;
                                  console.log(`[Phase 1f Step 5] Linked '${displayName}' to QB customer ${qbId} via GivenName='${givenName5}' FamilyName='${familyName5}'`);
                                }
                              } else {
                                console.log(`[Phase 1f Step 5] miss: ${givenName5} ${familyName5} (${step5Hits.length} results)`);
                              }
                            }
                            if (!qbId) {
                              // ── Step 4: give up — log full QB error payload ───
                              const detail = `push customer '${displayName}' (email=${email || "none"}): 6240 duplicate — name+email+givenFamily lookups all missed. Full QB error: ${JSON.stringify(errBody)}`;
                              errs.push(detail);
                              console.error(`[QB sync] ${detail}`);
                              await pool.query(
                                "UPDATE customers SET qb_sync_skip = true, qb_sync_skip_reason = $1 WHERE id = $2",
                                ["6240 duplicate — all name/email/givenFamily lookups missed", lc.id]
                              );
                            }
                          }
                        }
                      } else {
                        // No email on local record — try Step 5 GivenName+FamilyName fallback
                        const nameParts5 = displayName.trim().split(/\s+/);
                        if (nameParts5.length >= 2 && !qbId) {
                          const givenName5  = nameParts5[0];
                          const familyName5 = nameParts5.slice(1).join(" ");
                          const safeGiven5  = givenName5.replace(/'/g, "\\'");
                          const safeFamily5 = familyName5.replace(/'/g, "\\'");
                          const step5Res = await qbQuery(tok, `SELECT * FROM Customer WHERE GivenName = '${safeGiven5}' AND FamilyName = '${safeFamily5}' MAXRESULTS 50`);
                          const step5Hits: any[] = step5Res?.QueryResponse?.Customer ?? [];
                          if (step5Hits.length === 1) {
                            const candidate5 = step5Hits[0].Id;
                            const { rows: dup5 } = await pool.query(
                              "SELECT id FROM customers WHERE qb_customer_id = $1 AND id != $2 LIMIT 1",
                              [candidate5, lc.id]
                            );
                            if (dup5.length > 0) {
                              console.log(`[Phase 1g Step 5] dup-link skipped: local ${lc.id} would link to QB ${candidate5} but local ${dup5[0].id} already owns it`);
                              await pool.query(
                                "UPDATE customers SET qb_sync_skip = true, qb_sync_skip_reason = $1 WHERE id = $2",
                                [`QB ID ${candidate5} already owned by local ${dup5[0].id} — merge duplicate customer records to resolve`, lc.id]
                              );
                            } else {
                              qbId = candidate5;
                              console.log(`[Phase 1f Step 5] Linked '${displayName}' to QB customer ${qbId} via GivenName='${givenName5}' FamilyName='${familyName5}' (no-email path)`);
                            }
                          } else {
                            console.log(`[Phase 1f Step 5] miss: ${givenName5} ${familyName5} (${step5Hits.length} results)`);
                          }
                        }
                        if (!qbId) {
                          // No email and Step 5 missed — give up
                          const detail = `push customer '${displayName}' (no email): 6240 duplicate — DisplayName+givenFamily lookups all missed. Full QB error: ${JSON.stringify(errBody)}`;
                          errs.push(detail);
                          console.error(`[QB sync] ${detail}`);
                          await pool.query(
                            "UPDATE customers SET qb_sync_skip = true, qb_sync_skip_reason = $1 WHERE id = $2",
                            ["6240 duplicate (no email) — all DisplayName/givenFamily lookups missed", lc.id]
                          );
                        }
                      }
                      } // end if (!qbId) — Step 3 complete
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
// ── QB invoice payload builder ────────────────────────────────────────────────
/**
 * Build the QuickBooks Invoice body for a PUSH.
 *
 * When invoice_line_items exist each line maps to a QB SalesItemLineDetail:
 *   Description  → item.description
 *   Qty          → item.quantity
 *   UnitPrice    → item.unit_price
 *   Amount       → item.amount  (qty × unit_price, pre-calculated)
 *
 * A negative-amount "Discount" line is appended when inv.discount_amount > 0.
 *
 * Falls back to a single summary line (original behaviour) when no line items
 * are stored, so invoices created before this change still sync cleanly.
 *
 * Callers must still strip read-only QB fields before posting — the existing
 * strip block in syncInvoices handles this unchanged.
 *
 * @param inv            Full invoice DB row (must include qb_customer_id)
 * @param lineItems      Rows from invoice_line_items for this invoice
 * @param qbServiceItemId  Fallback QB Item.Id used as ItemRef for every line
 */
export function buildQbInvoiceBody(
  inv: any,
  lineItems: any[],
  qbServiceItemId: string
): any {
  let qbLines: any[];

  if (lineItems.length > 0) {
    // ── Per-line-item detail ───────────────────────────────────────────────
    qbLines = lineItems
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((item) => ({
        Amount:      parseFloat(item.amount    ?? 0),
        Description: item.description || "",
        DetailType:  "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef:   { value: qbServiceItemId },
          UnitPrice: parseFloat(item.unit_price ?? 0),
          Qty:       parseFloat(item.quantity   ?? 1),
        },
      }));

    // Append a discount line when a header-level discount is present
    const discountAmt = parseFloat(inv.discount_amount ?? 0);
    if (discountAmt > 0) {
      qbLines.push({
        Amount:      -discountAmt,
        Description: "Discount",
        DetailType:  "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef:   { value: qbServiceItemId },
          UnitPrice: -discountAmt,
          Qty:       1,
        },
      });
    }

    console.log(
      `[QB payload] Invoice ${inv.invoice_number}: ${qbLines.length} QB line(s)` +
      ` (${lineItems.length} item line(s)${discountAmt > 0 ? " + 1 discount line" : ""})`
    );
  } else {
    // ── Fallback: single summary line (original behaviour) ─────────────────
    const subtotal = parseFloat(inv.subtotal ?? inv.total ?? 0);
    qbLines = [
      {
        Amount:      subtotal,
        Description: `Invoice ${inv.invoice_number}`,
        DetailType:  "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef:   { value: qbServiceItemId },
          UnitPrice: subtotal,
          Qty:       1,
        },
      },
    ];
    console.log(
      `[QB payload] Invoice ${inv.invoice_number}: no line items — single summary line (subtotal ${subtotal})`
    );
  }

  const body: any = {
    DocNumber:   inv.invoice_number,
    CustomerRef: { value: inv.qb_customer_id },
    TxnDate:     new Date(inv.issued_date ?? Date.now()).toISOString().slice(0, 10),
    Line:        qbLines,
  };

  if (inv.due_date) body.DueDate      = new Date(inv.due_date).toISOString().slice(0, 10);
  if (inv.notes)    body.CustomerMemo = { value: inv.notes };

  return body;
}

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
      let lastQbPayload: any = null;
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

        // Fetch per-line-item detail for this invoice
        const { rows: invLineItems } = await pool.query(
          `SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY sort_order ASC, id ASC`,
          [li.id]
        );
        const qbBody: any = buildQbInvoiceBody(li, invLineItems, qbServiceItemId);

        // Strip QB read-only fields that cause 'invalid or unsupported property' rejections
        for (const k of ["TotalTax", "Balance", "TotalAmt", "MetaData", "SyncToken", "Id",
                          "HomeBalance", "HomeTotalAmt", "EmailStatus", "PrintStatus", "BillEmail"]) {
          delete qbBody[k];
        }
        if (Array.isArray(qbBody.Line)) {
          for (const line of qbBody.Line) {
            for (const k of ["Id", "SyncToken", "MetaData", "LinkedTxn"]) {
              delete line[k];
            }
            delete line.Taxable;
          }
        }
        delete qbBody.TxnTaxDetail;
        console.log('[Phase 1i] stripped read-only fields + Line.Taxable + TxnTaxDetail before QB POST');

        lastQbPayload = qbBody;
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
              if (txt.includes('"code":"2380"')) {
              console.log(`[Phase 1l] Invoice ${li.invoice_number} (QB id ${newId}) synced to QB but not emailed via QB — no customer email on file. Use SendGrid for delivery.`);
            } else {
              errs.push(`send invoice ${li.invoice_number} (QB id ${newId}): ${sendRes.status} ${txt}`);
            }
            } else {
              console.log(`[QB sync] Invoice ${li.invoice_number} created and sent via QB (id ${newId})`);
            }
          } catch (sendErr: any) {
            errs.push(`send invoice ${li.invoice_number}: ${sendErr.message}`);
          }
        }
      } catch (e: any) {
        if (/2010|ValidationFault|"code":"2010"/.test(e.message)) {
          console.error('[Phase 1i F23 2010 payload]', JSON.stringify(lastQbPayload, (k, v) => typeof v === 'bigint' ? v.toString() : v));
          console.error('[Phase 1g F23 2010 qb-error]', e?.message ?? String(e));
        }
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
            // Defensive is_active guard: skip updating invoices whose customer
            // has been archived — avoids applying QB payment data to records
            // that belong to a soft-deleted customer.
            const { rows } = await pool.query(
              `SELECT inv.id, inv.status, inv.total
               FROM invoices inv
               INNER JOIN customers c ON c.id = inv.customer_id AND c.is_active = true
               WHERE inv.qb_invoice_id = $1`,
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
  console.log('[Phase 1f LIVE]');
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
