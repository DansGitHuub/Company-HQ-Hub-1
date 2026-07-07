import { pool } from "../db";

export async function runWorkOrderProgressMigration() {
  try {
    await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS closeout_ready_at TIMESTAMP`);
    console.log("[workOrderProgress] migration OK");
  } catch (err: any) {
    console.error("[workOrderProgress] migration error:", err.message);
  }
}
