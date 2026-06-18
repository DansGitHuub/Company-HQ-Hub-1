import { pool } from "./db";

export async function runJobPacketGateMigration() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_packet_bypasses (
      id SERIAL PRIMARY KEY,
      job_id VARCHAR(36) NOT NULL,
      gate_item VARCHAR(100) NOT NULL,
      bypassed_by VARCHAR(36) NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(job_id, gate_item)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_job_packet_bypasses_job_id
      ON job_packet_bypasses(job_id)
  `);

  console.log("[migration] job_packet_bypasses table ready");
}
