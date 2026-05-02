import { pool } from "../db";

export async function runEstimatingPhaseE2PolishMigration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE estimate_line_items
        ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES class_codes(id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_estimate_line_items_class_id
        ON estimate_line_items(class_id)
    `);

    await client.query("COMMIT");
    console.log("[migration] estimate_line_items class_id column ready");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
