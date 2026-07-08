import { pool } from "../db";

export async function runCustomerSatisfactionMigration() {
  try {
    await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_satisfaction_rating INTEGER`);
    await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_satisfaction_feedback TEXT`);
    await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_satisfaction_at TIMESTAMPTZ`);
    console.log("[migration] jobs.customer_satisfaction columns ready");
  } catch (err: any) {
    console.error("[migration] customer_satisfaction failed:", err.message);
  }
}
