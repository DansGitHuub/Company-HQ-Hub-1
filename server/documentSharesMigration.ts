import { pool } from "./db";

export async function runDocumentSharesMigration() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_shares (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id VARCHAR(36) NOT NULL REFERENCES documents(id),
        module TEXT NOT NULL,
        record_id VARCHAR(36),
        shared_by_user_id VARCHAR(36) REFERENCES users(id),
        shared_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_document_shares_document_id ON document_shares(document_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_document_shares_module ON document_shares(module);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_document_shares_module_record ON document_shares(module, record_id);`);
    console.log("[migration] document_shares table ready");
  } finally {
    client.release();
  }
}
