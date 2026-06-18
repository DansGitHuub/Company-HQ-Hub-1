import { pool } from "../db";

export async function runCloseoutMigration() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_closeouts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id VARCHAR(36) NOT NULL UNIQUE,
      status VARCHAR(30) NOT NULL DEFAULT 'draft',
      final_scope_confirmed BOOLEAN DEFAULT false,
      final_scope_notes TEXT,
      materials_used_confirmed BOOLEAN DEFAULT false,
      materials_notes TEXT,
      remaining_issues TEXT,
      warranty_terms TEXT,
      warranty_duration_months INTEGER DEFAULT 12,
      customer_notes TEXT,
      internal_notes TEXT,
      final_photos JSONB DEFAULT '[]',
      customer_satisfaction INTEGER CHECK (customer_satisfaction BETWEEN 1 AND 5),
      ready_for_invoice BOOLEAN NOT NULL DEFAULT false,
      invoice_created BOOLEAN NOT NULL DEFAULT false,
      review_requested BOOLEAN NOT NULL DEFAULT false,
      review_requested_at TIMESTAMP,
      follow_up_task_id VARCHAR(36),
      manager_approved_by VARCHAR(36),
      manager_approved_at TIMESTAMP,
      submitted_by VARCHAR(36),
      submitted_at TIMESTAMP,
      approved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_job_closeouts_job_id ON job_closeouts(job_id);
  `);

  console.log("[migration] job_closeouts table ready");
}
