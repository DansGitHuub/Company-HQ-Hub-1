import { pool } from "./db";

export async function runActivityLogMigration() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(36) REFERENCES users(id),
        event_type VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        link VARCHAR(500),
        seen_by JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC)`);
    console.log("[migration] Activity log table ready");
  } finally {
    client.release();
  }
}
