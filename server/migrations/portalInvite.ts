import { pool } from "../db";

export async function runPortalInviteMigration() {
  await pool.query(`
    ALTER TABLE job_applications
      ADD COLUMN IF NOT EXISTS customer_id VARCHAR(36);
  `);
  console.log("[migration] job_applications.customer_id column ready (portal invites)");
}
