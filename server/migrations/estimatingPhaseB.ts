import { pool } from "../db";

export async function runEstimatingPhaseBMigration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── class_pricing_defaults → class_codes FK ───────────────────────────────
    // Idempotent: only adds the constraint if it does not already exist.
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'class_pricing_defaults_class_id_fkey'
        ) THEN
          ALTER TABLE class_pricing_defaults
            ADD CONSTRAINT class_pricing_defaults_class_id_fkey
            FOREIGN KEY (class_id) REFERENCES class_codes(id);
        END IF;
      END $$
    `);

    await client.query("COMMIT");
    console.log("[migration] Estimating Phase B tables ready");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
