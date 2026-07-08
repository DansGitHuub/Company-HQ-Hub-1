import { pool } from "../db";

export async function runCrewNotesCustomerVisibleMigration() {
  try {
    await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS crew_notes_customer_visible TEXT`);
    console.log("[migration] jobs.crew_notes_customer_visible column ready");
  } catch (err: any) {
    console.error("[migration] crew_notes_customer_visible failed:", err.message);
  }
}
