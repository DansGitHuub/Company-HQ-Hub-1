import { pool } from "./db";

export async function runDocumentMigration() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        file_name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        file_type TEXT,
        file_size_kb INTEGER,
        category TEXT NOT NULL DEFAULT 'other',
        uploaded_by_user_id VARCHAR(36) REFERENCES users(id),
        home_entity_type TEXT NOT NULL,
        home_entity_id TEXT NOT NULL,
        description TEXT,
        is_template BOOLEAN NOT NULL DEFAULT false,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS document_links (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id VARCHAR(36) NOT NULL REFERENCES documents(id),
        linked_entity_type TEXT NOT NULL,
        linked_entity_id TEXT NOT NULL,
        linked_by_user_id VARCHAR(36) REFERENCES users(id),
        linked_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS onboarding_form_submissions (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        form_type TEXT NOT NULL,
        employee_id VARCHAR(36) REFERENCES employees(id),
        submitted_by_user_id VARCHAR(36) REFERENCES users(id),
        submission_data JSONB DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft',
        pdf_document_id VARCHAR(36),
        submitted_at TIMESTAMP,
        reviewed_by_user_id VARCHAR(36) REFERENCES users(id),
        reviewed_at TIMESTAMP,
        review_notes TEXT,
        assigned_by_user_id VARCHAR(36) REFERENCES users(id),
        assigned_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(home_entity_type, home_entity_id);
      CREATE INDEX IF NOT EXISTS idx_document_links_document ON document_links(document_id);
      CREATE INDEX IF NOT EXISTS idx_document_links_entity ON document_links(linked_entity_type, linked_entity_id);
      CREATE INDEX IF NOT EXISTS idx_form_submissions_employee ON onboarding_form_submissions(employee_id);
      CREATE INDEX IF NOT EXISTS idx_form_submissions_type ON onboarding_form_submissions(form_type);
    `);
    console.log("[migration] Documents system tables ready");
  } catch (error) {
    console.error("[migration] Documents system migration error:", error);
  } finally {
    client.release();
  }
}
