import { pool } from "../db";

export async function runWorksheetChecklistMigration(): Promise<void> {
  try {
    await pool.query(`ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS checklist_work_order_changed boolean NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS checklist_work_order_note text`);
    await pool.query(`ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS checklist_materials_needed boolean NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS checklist_materials_note text`);
    await pool.query(`ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS checklist_change_order_needed boolean NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS checklist_change_order_note text`);
    await pool.query(`ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS checklist_issue_reported boolean NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS checklist_issue_note text`);
    console.log("[migration] worksheet checklist columns ready");
  } catch (err: any) {
    console.error("[migration] worksheetChecklist:", err.message);
  }
}
