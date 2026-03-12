import { pool } from "./db";

export async function runSuggestionsMigration() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_suggestions (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id VARCHAR(36) NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'received',
        admin_note TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("[migration] Customer suggestions table ready");
  } catch (err) {
    console.error("[migration] Customer suggestions migration error:", err);
  } finally {
    client.release();
  }
}
