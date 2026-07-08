import { pool } from "../db";

export async function runSkippedWorkNotesMigration() {
  try {
    await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS skipped_work_notes TEXT`);
    console.log("[migration] jobs.skipped_work_notes column ready");
  } catch (err: any) {
    console.error("[migration] skipped_work_notes failed:", err.message);
  }
}
