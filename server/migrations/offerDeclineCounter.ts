import { pool } from "../db";

export async function runOfferDeclineCounterMigration() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE candidates
        ADD COLUMN IF NOT EXISTS offer_declined_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS offer_decline_reason TEXT,
        ADD COLUMN IF NOT EXISTS offer_counter_note TEXT,
        ADD COLUMN IF NOT EXISTS offer_counter_submitted_at TIMESTAMP;
    `);
    console.log("[migration] candidates offer decline/counter columns ready");
  } catch (err: any) {
    console.error("[migration] offerDeclineCounter migration error:", err.message);
  } finally {
    client.release();
  }
}
