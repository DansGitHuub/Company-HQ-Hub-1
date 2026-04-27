import { pool } from "../db";

export async function runPortalInviteUserMigration() {
  await pool.query(`
    ALTER TABLE job_applications
      ADD COLUMN IF NOT EXISTS user_id VARCHAR(36);
  `);
  console.log("[migration] job_applications.user_id column ready (crew portal invites)");
}
