import { pool } from "../db";

export async function runCloseoutCleanupMigration() {
  await pool.query(`
    ALTER TABLE job_closeouts
      DROP COLUMN IF EXISTS final_photos,
      DROP COLUMN IF EXISTS invoice_created,
      DROP COLUMN IF EXISTS review_requested_at,
      DROP COLUMN IF EXISTS follow_up_task_id
  `);
  console.log("[migration] job_closeouts speculative columns removed (final_photos, invoice_created, review_requested_at, follow_up_task_id)");
}
