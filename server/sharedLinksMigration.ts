import { pool } from "./db";

export async function runSharedLinksMigration() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS shared_links (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        token VARCHAR(64) NOT NULL UNIQUE,
        document_type TEXT NOT NULL,
        document_id TEXT NOT NULL,
        document_name TEXT NOT NULL,
        document_url TEXT,
        created_by VARCHAR(36) NOT NULL REFERENCES users(id),
        created_by_name TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        password_hash TEXT,
        note TEXT,
        view_count INTEGER NOT NULL DEFAULT 0,
        is_revoked BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS shared_link_access_logs (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        shared_link_id VARCHAR(36) NOT NULL REFERENCES shared_links(id),
        accessed_at TIMESTAMP DEFAULT NOW(),
        ip_address TEXT,
        user_agent TEXT
      );
    `);
    console.log("[migration] Shared links tables ready");
  } catch (err: any) {
    console.error("[migration] Shared links migration error:", err.message);
  } finally {
    client.release();
  }
}
