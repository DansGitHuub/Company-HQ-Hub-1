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
      return res.redirect("/settings?qb=not-configured&tab=quickbooks");
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
      res.redirect("/settings?qb=error&tab=quickbooks");
    }
  });

  // ── GET /api/auth/quickbooks/callback — OAuth callback ────────────────────
  app.get("/api/auth/quickbooks/callback", async (req, res) => {
    if (!qbClientId() || !qbClientSecret()) {
      return res.redirect("/settings?qb=not-configured&tab=quickbooks");
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
      res.redirect("/settings?qb=connected&tab=quickbooks");
    } catch (err: any) {
      console.error("[QB callback]", err.message);
      res.redirect("/settings?qb=error&tab=quickbooks");
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
}
