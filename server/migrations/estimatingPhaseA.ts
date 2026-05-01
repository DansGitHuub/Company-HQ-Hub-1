import { pool } from "../db";

export async function runEstimatingPhaseAMigration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── class_codes: canonical cost-class registry ────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS class_codes (
        id         INTEGER      PRIMARY KEY,
        name       VARCHAR(50)  NOT NULL UNIQUE,
        label      TEXT         NOT NULL,
        sort_order INTEGER      NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // Seed the four canonical classes — idempotent via ON CONFLICT DO NOTHING
    await client.query(`
      INSERT INTO class_codes (id, name, label, sort_order) VALUES
        (1, 'Labor',          'Labor',          1),
        (2, 'Equipment',      'Equipment',      2),
        (3, 'Materials',      'Materials',      3),
        (4, 'Subcontracting', 'Subcontracting', 4)
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query("COMMIT");
    console.log("[migration] Estimating Phase A tables ready");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
