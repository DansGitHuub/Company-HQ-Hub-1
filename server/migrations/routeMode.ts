import { pool } from "../db";

export async function runRouteModeMigration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── job_assignments: route ordering ──────────────────────────────────────
    await client.query(`
      ALTER TABLE job_assignments
        ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_job_assignments_route
        ON job_assignments(employee_id, scheduled_date, sort_order)
    `);

    // ── worksheet_sessions: skip tracking ────────────────────────────────────
    await client.query(`
      ALTER TABLE worksheet_sessions
        ADD COLUMN IF NOT EXISTS skip_reason TEXT
    `);

    await client.query(`
      ALTER TABLE worksheet_sessions
        ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMPTZ
    `);

    // ── route_days: per-employee daily route state ────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS route_days (
        id            VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
        employee_id   VARCHAR(36)  NOT NULL REFERENCES users(id),
        date          DATE         NOT NULL,
        weather       TEXT[]       DEFAULT '{}',
        started_at    TIMESTAMPTZ,
        completed_at  TIMESTAMPTZ,
        summary_notes TEXT,
        status        TEXT         NOT NULL DEFAULT 'in_progress',
        created_at    TIMESTAMPTZ  DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  DEFAULT NOW(),
        UNIQUE (employee_id, date)
      )
    `);

    await client.query("COMMIT");
    console.log("[migration] Route mode tables ready");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
