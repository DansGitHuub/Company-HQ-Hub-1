import { pool } from "../db";

export async function runWave4Migration() {
  const client = await pool.connect();
  try {
    // ── CompanyCam webhook event log ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS companycam_webhook_events (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type    TEXT        NOT NULL,
        success       BOOLEAN     NOT NULL DEFAULT FALSE,
        error_message TEXT,
        received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cc_webhook_events_received_at
        ON companycam_webhook_events(received_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cc_webhook_events_success
        ON companycam_webhook_events(success, received_at DESC)
    `);

    // ── Customer duplicate dismissals ─────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_duplicate_dismissals (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id_a UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        customer_id_b UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        dismissed_by  VARCHAR,
        dismissed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(customer_id_a, customer_id_b)
      )
    `);

    console.log("[migration] Wave 4: companycam_webhook_events + customer_duplicate_dismissals ready");
  } catch (err) {
    throw err;
  } finally {
    client.release();
  }
}
