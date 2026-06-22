import { pool } from "../db";

export async function runBuilderFormSubmissionsMigration() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS builder_form_submissions (
        id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        form_id varchar(36) NOT NULL REFERENCES builder_forms(id) ON DELETE CASCADE,
        submitted_by varchar(36) REFERENCES users(id),
        submitter_name text,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        status text NOT NULL DEFAULT 'submitted',
        reviewed_by varchar(36) REFERENCES users(id),
        review_notes text,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_builder_form_submissions_form_id
        ON builder_form_submissions(form_id);
      CREATE INDEX IF NOT EXISTS idx_builder_form_submissions_submitted_by
        ON builder_form_submissions(submitted_by);
    `);
    console.log("[migration] builder_form_submissions table ready");

    await client.query(`
      DROP TABLE IF EXISTS form_submissions CASCADE;
      DROP TABLE IF EXISTS form_templates CASCADE;
      DROP TABLE IF EXISTS form_folders CASCADE;
      DROP TABLE IF EXISTS custom_forms CASCADE;
    `);
    console.log("[migration] Legacy custom_forms tables dropped");
  } catch (err: any) {
    console.error("[migration] builderFormSubmissions migration error:", err.message);
  } finally {
    client.release();
  }
}
