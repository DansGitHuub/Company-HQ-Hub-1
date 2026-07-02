import { pool } from "../db";

export async function runCloseoutCleanupMigration() {
  // Previous version dropped these columns — now we add them back permanently.
  await pool.query(`ALTER TABLE job_closeouts ADD COLUMN IF NOT EXISTS final_photos        JSONB     DEFAULT '[]'`);
  await pool.query(`ALTER TABLE job_closeouts ADD COLUMN IF NOT EXISTS invoice_created     BOOLEAN   NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE job_closeouts ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMP`);
  await pool.query(`ALTER TABLE job_closeouts ADD COLUMN IF NOT EXISTS follow_up_task_id   VARCHAR(36)`);
  console.log("[migration] job_closeouts columns restored (final_photos, invoice_created, review_requested_at, follow_up_task_id)");
}
