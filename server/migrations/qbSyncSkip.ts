import { pool } from "../db";

export async function runQbSyncSkipMigration(): Promise<void> {
  await pool.query(`
    ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS qb_sync_skip         boolean   DEFAULT false,
      ADD COLUMN IF NOT EXISTS qb_sync_skip_reason  text
  `);
  console.log("[migration] customers qb_sync_skip columns ready");
}
