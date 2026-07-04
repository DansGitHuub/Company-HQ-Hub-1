import { pool } from "../db";

export async function runAuditLogMigration() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type VARCHAR(50) NOT NULL,
      actor_user_id VARCHAR(36) REFERENCES users(id),
      actor_name VARCHAR(255),
      target_user_id VARCHAR(36) REFERENCES users(id),
      target_label VARCHAR(255),
      description TEXT NOT NULL,
      old_value JSONB,
      new_value JSONB,
      ip_address VARCHAR(64),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id ON audit_log(actor_user_id);
  `);

  console.log("[migration] audit_log table ready");
}
