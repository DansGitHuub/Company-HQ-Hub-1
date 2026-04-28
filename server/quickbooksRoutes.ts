// Production QB credentials active
import express, { Express } from "express";
import crypto from "crypto";
import { pool } from "./db";
import {
  getTokens,
  runFullSync,
  syncCustomersPublic,
  syncInvoicesPublic,
  syncPaymentsPublic,
  syncItemsPublic,
  exportTimeEntriesToQBO,
} from "./quickbooksSync";

async function migrate() {
  // Core token store (single row per realm)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quickbooks_tokens (
      id           SERIAL PRIMARY KEY,
      realm_id     VARCHAR(50) NOT NULL UNIQUE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      token_expiry TIMESTAMPTZ NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Sync activity log
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quickbooks_sync_log (
      id             SERIAL PRIMARY KEY,
      entity_type    VARCHAR(50) NOT NULL,
      direction      VARCHAR(20) NOT NULL,
      records_synced INT NOT NULL DEFAULT 0,
      errors         TEXT,
      status         VARCHAR(20) NOT NULL DEFAULT 'running',
      started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at   TIMESTAMPTZ
    )
  `);

  // QB columns on customers
  await pool.query(
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS qb_customer_id VARCHAR(50)`,
  );
  await pool.query(
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS qb_synced_at  TIMESTAMPTZ`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_customers_qb_id ON customers(qb_customer_id)`,
  );

  // QB columns on invoices
  await pool.query(
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qb_invoice_id VARCHAR(50)`,
  );
  await pool.query(
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qb_synced_at  TIMESTAMPTZ`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_invoices_qb_id ON invoices(qb_invoice_id)`,
  );

  // QB time-export columns on time_entries
  await pool.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS qbo_exported_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS qbo_time_activity_id TEXT`);
  await pool.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS qbo_export_error TEXT`);

  // QB employee mapping on users
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS qbo_employee_id TEXT`);

  console.log("[migration] quickbooks tables ready");
}

// Resolve credentials — accept either the short name (QB_CLIENT_ID) or the
// legacy long name (QUICKBOOKS_CLIENT_ID), so both dev and prod configs work.
function qbClientId() {
  return process.env.QB_CLIENT_ID || process.env.QUICKBOOKS_CLIENT_ID || "";
}
function qbClientSecret() {
  return (
    process.env.QB_CLIENT_SECRET || process.env.QUICKBOOKS_CLIENT_SECRET || ""
  );
}
const QB_REDIRECT_URI = "https://companyhq.app/api/auth/quickbooks/callback";

export async function registerQuickBooksRoutes(app: Express, requireAuth: any) {
  await migrate();

  // ── GET /api/quickbooks/config — check if credentials are configured ───────
  app.get("/api/quickbooks/config", requireAuth, (_req, res) => {
    res.json({ configured: !!(qbClientId() && qbClientSecret()) });
  });

  // ── GET /api/quickbooks/auth — start OAuth flow ────────────────────────────
  app.get("/api/quickbooks/auth", requireAuth, async (req, res) => {
    if (!qbClientId() || !qbClientSecret()) {
      console.error("[QB auth] QB_CLIENT_ID / QB_CLIENT_SECRET not set");
      return res.redirect("/admin?tab=quickbooks&qb=not-configured");
    }
    try {
      const { default: OAuthClient } = await import("intuit-oauth");
      const client = new OAuthClient({
        clientId: qbClientId(),
        clientSecret: qbClientSecret(),
        environment: "production",
        redirectUri: QB_REDIRECT_URI,
      });
      const authUri = client.authorizeUri({
        scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
        state: "qb-connect",
      });
      res.redirect(authUri);
    } catch (err: any) {
      console.error("[QB auth]", err.message);
      res.redirect("/admin?tab=quickbooks&qb=error");
    }
  });

  // ── GET /api/auth/quickbooks/callback — OAuth callback ────────────────────
  app.get("/api/auth/quickbooks/callback", async (req, res) => {
    if (!qbClientId() || !qbClientSecret()) {
      return res.redirect("/admin?tab=quickbooks&qb=not-configured");
    }
    try {
      const { default: OAuthClient } = await import("intuit-oauth");
      const client = new OAuthClient({
        clientId: qbClientId(),
        clientSecret: qbClientSecret(),
        environment: "production",
        redirectUri: QB_REDIRECT_URI,
      });

      const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const tokenResponse = await client.createToken(fullUrl);
      const token = tokenResponse.getJson();
      const realmId = (req.query.realmId as string) || token.realmId;

      if (!realmId || !token.access_token) {
        throw new Error("Missing realmId or access_token in callback");
      }

      const expiry = new Date(Date.now() + (token.expires_in ?? 3600) * 1000);

      await pool.query(
        `INSERT INTO quickbooks_tokens (realm_id, access_token, refresh_token, token_expiry)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (realm_id) DO UPDATE
           SET access_token=$2, refresh_token=$3, token_expiry=$4, updated_at=NOW()`,
        [realmId, token.access_token, token.refresh_token, expiry],
      );

      console.log(`[QB] Connected realm ${realmId}`);
      res.redirect("/admin?tab=quickbooks&qb=connected");
    } catch (err: any) {
      console.error("[QB callback]", err.message);
      res.redirect("/admin?tab=quickbooks&qb=error");
    }
  });

  // ── GET /api/quickbooks/status ─────────────────────────────────────────────
  app.get("/api/quickbooks/status", requireAuth, async (req, res) => {
    try {
      const tok = await getTokens();
      if (!tok) return res.json({ connected: false });

      // Latest sync entry
      const { rows: logs } = await pool.query(
        `SELECT * FROM quickbooks_sync_log
         WHERE status IN ('success','partial')
         ORDER BY completed_at DESC NULLS LAST LIMIT 1`,
      );

      res.json({
        connected: true,
        realm_id: tok.realm_id,
        token_expiry: tok.token_expiry,
        last_sync: logs[0]?.completed_at ?? null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/quickbooks/disconnect ───────────────────────────────────────
  app.post("/api/quickbooks/disconnect", requireAuth, async (req, res) => {
    try {
      await pool.query("DELETE FROM quickbooks_tokens");
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/quickbooks/webhook ──────────────────────────────────────────
  // Public endpoint — no auth guard. QuickBooks sends events here.
  // Raw body is captured globally via the verify option on express.json()
  // in index.ts, so req.rawBody is always available.
  app.post("/api/quickbooks/webhook", (req, res) => {
    const secret = process.env.QUICKBOOKS_WEBHOOK_TOKEN;
    const signature = req.headers["intuit-signature"] as string | undefined;

    if (!secret || !signature) {
      console.warn(
        "[QB webhook] Missing secret or intuit-signature header — rejecting",
      );
      return res.status(401).end();
    }

    const rawBody = req.rawBody as Buffer | undefined;
    if (!rawBody || !rawBody.length) {
      console.warn("[QB webhook] Empty raw body — rejecting");
      return res.status(401).end();
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    if (signature !== expected) {
      console.warn("[QB webhook] Signature mismatch — rejecting");
      return res.status(401).end();
    }

    // Signature valid — return 200 immediately, sync in background
    res.status(200).end();

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      console.error("[QB webhook] Could not parse payload JSON");
      return;
    }

    const eventNotifications: any[] = payload?.eventNotifications ?? [];
    const entityTypes = new Set<string>();

    for (const notification of eventNotifications) {
      const entities: any[] = notification?.dataChangeEvent?.entities ?? [];
      for (const entity of entities) {
        if (entity?.name) {
          entityTypes.add(entity.name);
          console.log(
            `[QB webhook] Event: ${entity.name} id=${entity.id} op=${entity.operation}`,
          );
        }
      }
    }

    if (entityTypes.has("Customer")) {
      console.log("[QB webhook] Firing syncCustomers (fire-and-forget)");
      syncCustomersPublic().catch((e) =>
        console.error("[QB webhook] syncCustomers error:", e.message),
      );
    }
    if (entityTypes.has("Invoice")) {
      console.log("[QB webhook] Firing syncInvoices (fire-and-forget)");
      syncInvoicesPublic().catch((e) =>
        console.error("[QB webhook] syncInvoices error:", e.message),
      );
    }
    if (entityTypes.has("Payment")) {
      console.log("[QB webhook] Firing syncPayments (fire-and-forget)");
      syncPaymentsPublic().catch((e) =>
        console.error("[QB webhook] syncPayments error:", e.message),
      );
    }
  });

  // ── POST /api/quickbooks/sync ──────────────────────────────────────────────
  app.post("/api/quickbooks/sync", requireAuth, async (req, res) => {
    try {
      const results = await runFullSync();
      res.json({ ok: true, results });
    } catch (err: any) {
      console.error("[QB sync]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/quickbooks/sync/logs ─────────────────────────────────────────
  app.get("/api/quickbooks/sync/logs", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM quickbooks_sync_log ORDER BY started_at DESC LIMIT 50`,
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -- POST /api/quickbooks/sync/items -----------------------------------------
  app.post("/api/quickbooks/sync/items", requireAuth, async (req, res) => {
    try {
      const result = await syncItemsPublic();
      res.json({ ok: true, result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -- GET /api/quickbooks/items ------------------------------------------------
  app.get("/api/quickbooks/items", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT qb_item_id, name, full_name, type, description, unit_price,
                income_account_name, parent_name, active
         FROM qb_items ORDER BY full_name ASC`
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -- GET /api/quickbooks/catalog-mapping -----------------------------------------
  // Returns all active materials with their current QB item mapping
  app.get("/api/quickbooks/catalog-mapping", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          m.id,
          m.name,
          m.sku,
          m.class,
          m.status,
          m.qb_item_id,
          qi.full_name AS qb_item_name,
          qi.type AS qb_item_type
        FROM materials m
        LEFT JOIN qb_items qi ON qi.qb_item_id = m.qb_item_id
        WHERE m.status != 'Deleted'
        ORDER BY m.class NULLS LAST, m.name ASC
      `);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -- PATCH /api/quickbooks/catalog-mapping/:id ------------------------------------
  // Updates the QB item mapping for a single material
  app.patch("/api/quickbooks/catalog-mapping/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { qb_item_id } = req.body;
      await pool.query(
        `UPDATE materials SET qb_item_id = $1, updated_at = NOW() WHERE id = $2`,
        [qb_item_id || null, id]
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/quickbooks/export-time/entries ───────────────────────────────
  // Returns paginated completed time entries for the QB export review screen
  app.get("/api/quickbooks/export-time/entries", requireAuth, async (req, res) => {
    try {
      const {
        dateFrom, dateTo,
        userId,
        status, // "pending" | "exported" | "error" | "all"
        page = "1",
        limit = "50",
      } = req.query as Record<string, string>;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
      const offset = (pageNum - 1) * limitNum;

      const params: any[] = [];
      const conditions: string[] = ["te.clock_out IS NOT NULL"];

      if (dateFrom) { params.push(dateFrom); conditions.push(`te.clock_in >= $${params.length}::timestamptz`); }
      if (dateTo)   { params.push(dateTo + "T23:59:59"); conditions.push(`te.clock_in <= $${params.length}::timestamptz`); }
      if (userId)   { params.push(userId); conditions.push(`te.user_id = $${params.length}`); }

      if (status === "pending")  conditions.push("te.qbo_exported_at IS NULL AND (te.qbo_export_error IS NULL OR te.qbo_export_error = '')");
      if (status === "exported") conditions.push("te.qbo_exported_at IS NOT NULL");
      if (status === "error")    conditions.push("te.qbo_export_error IS NOT NULL AND te.qbo_export_error != '' AND te.qbo_exported_at IS NULL");

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const q = `
        SELECT
          te.id, te.clock_in, te.clock_out, te.duration_minutes,
          te.entry_type, te.work_area_name,
          te.qbo_exported_at, te.qbo_time_activity_id, te.qbo_export_error,
          u.id AS user_id,
          COALESCE(u.first_name || ' ' || u.last_name, u.username) AS employee_name,
          COALESCE(j.title, j.client) AS job_title,
          j.id AS job_id
        FROM time_entries te
        JOIN users u ON u.id = te.user_id
        LEFT JOIN jobs j ON j.id = te.job_id
        ${where}
        ORDER BY te.clock_in DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      const countQ = `
        SELECT COUNT(*) FROM time_entries te
        JOIN users u ON u.id = te.user_id
        LEFT JOIN jobs j ON j.id = te.job_id
        ${where}
      `;

      const [entryRes, countRes] = await Promise.all([
        pool.query(q, [...params, limitNum, offset]),
        pool.query(countQ, params),
      ]);

      const totalCount = parseInt(countRes.rows[0].count, 10);
      res.json({
        entries: entryRes.rows,
        page: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalCount,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/quickbooks/export-time ──────────────────────────────────────
  app.post("/api/quickbooks/export-time", requireAuth, async (req, res) => {
    try {
      const { entryIds } = req.body;
      if (!Array.isArray(entryIds) || entryIds.length === 0) {
        return res.status(400).json({ error: "entryIds array is required" });
      }
      const result = await exportTimeEntriesToQBO(entryIds.map(Number));
      res.json(result);
    } catch (err: any) {
      const status = err.message === "QuickBooks not connected" ? 503 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  // ── GET /api/quickbooks/employees ─────────────────────────────────────────
  // Returns QB Employee list + our local users with their mapping
  app.get("/api/quickbooks/employees", requireAuth, async (req, res) => {
    try {
      // Local users
      const { rows: localUsers } = await pool.query(
        `SELECT id, username, first_name, last_name, email, role, qbo_employee_id
         FROM users WHERE role NOT IN ('Customer') ORDER BY first_name, last_name, username`
      );

      // QB Employees (best-effort — return empty if not connected)
      let qbEmployees: any[] = [];
      try {
        const tok = await getTokens();
        if (tok) {
          const { default: OAuthClient } = await import("intuit-oauth");
          const client = new OAuthClient({
            clientId: process.env.QB_CLIENT_ID || process.env.QUICKBOOKS_CLIENT_ID || "",
            clientSecret: process.env.QB_CLIENT_SECRET || process.env.QUICKBOOKS_CLIENT_SECRET || "",
            environment: "production",
            redirectUri: QB_REDIRECT_URI,
          });
          client.setToken({ access_token: tok.access_token, refresh_token: tok.refresh_token, realmId: tok.realm_id });
          const isExpired = new Date(tok.token_expiry) <= new Date(Date.now() + 60000);
          const validTok = isExpired ? (await client.refresh()).getJson() : tok;
          const qbAccessToken = isExpired ? validTok.access_token : tok.access_token;

          const empUrl = `https://quickbooks.api.intuit.com/v3/company/${tok.realm_id}/query?query=${encodeURIComponent("SELECT * FROM Employee WHERE Active = true MAXRESULTS 200")}&minorversion=65`;
          const empRes = await fetch(empUrl, {
            headers: { Authorization: `Bearer ${qbAccessToken}`, Accept: "application/json" },
          });
          if (empRes.ok) {
            const data = await empRes.json();
            qbEmployees = data?.QueryResponse?.Employee ?? [];
          }
        }
      } catch (qbErr: any) {
        console.warn("[QB employees] Could not fetch QB employees:", qbErr.message);
      }

      // Count pending (not exported, not error) entries per user
      const { rows: pendingCounts } = await pool.query(
        `SELECT user_id, COUNT(*)::int AS pending_count
         FROM time_entries
         WHERE clock_out IS NOT NULL AND qbo_exported_at IS NULL
           AND (qbo_export_error IS NULL OR qbo_export_error = '')
         GROUP BY user_id`
      );
      const pendingByUser = new Map(pendingCounts.map((r: any) => [r.user_id, r.pending_count]));

      res.json({
        localUsers: localUsers.map((u: any) => ({
          ...u,
          pendingCount: pendingByUser.get(u.id) ?? 0,
        })),
        qbEmployees: qbEmployees.map((e: any) => ({
          id: e.Id,
          displayName: e.DisplayName,
          givenName: e.GivenName ?? "",
          familyName: e.FamilyName ?? "",
          active: e.Active !== false,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/quickbooks/employees/:userId ───────────────────────────────
  app.patch("/api/quickbooks/employees/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { qboEmployeeId } = req.body;
      await pool.query(
        `UPDATE users SET qbo_employee_id = $1 WHERE id = $2`,
        [qboEmployeeId || null, userId]
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

}
