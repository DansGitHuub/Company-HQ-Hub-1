import { pool } from "../db";

export async function runCrewTimeTrackingMigration(): Promise<void> {
  try {
    await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS safety_notes text`);
    await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS restrictions_notes text`);
    await pool.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_flagged boolean NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS flag_reason text`);
    await pool.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clocked_in_by_user_id varchar(36)`);
    console.log("[migration] crew time-tracking columns ready");
  } catch (err: any) {
    console.error("[migration] crewTimeTracking:", err.message);
  }
}
