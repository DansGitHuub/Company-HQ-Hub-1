import { pool } from "../db";

export async function runWarrantyMigration() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_warranties (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id VARCHAR(36) NOT NULL,
      customer_id VARCHAR(36),
      property_id VARCHAR(36),
      closeout_id UUID,
      title TEXT NOT NULL,
      description TEXT,
      warranty_type VARCHAR(30) DEFAULT 'workmanship',
      duration_months INTEGER NOT NULL DEFAULT 12,
      start_date DATE,
      end_date DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      terms TEXT,
      notes TEXT,
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS warranty_claims (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      warranty_id UUID NOT NULL REFERENCES job_warranties(id) ON DELETE CASCADE,
      job_id VARCHAR(36),
      customer_id VARCHAR(36),
      claim_number VARCHAR(20) UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      reported_by TEXT,
      reported_at TIMESTAMP DEFAULT NOW(),
      status VARCHAR(30) NOT NULL DEFAULT 'open',
      priority VARCHAR(20) DEFAULT 'normal',
      resolution TEXT,
      resolved_at TIMESTAMP,
      resolved_by VARCHAR(36),
      service_job_id VARCHAR(36),
      photos JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_job_warranties_job_id ON job_warranties(job_id);
    CREATE INDEX IF NOT EXISTS idx_job_warranties_customer_id ON job_warranties(customer_id);
    CREATE INDEX IF NOT EXISTS idx_warranty_claims_warranty_id ON warranty_claims(warranty_id);
  `);

  await pool.query(`
    CREATE SEQUENCE IF NOT EXISTS claim_number_seq START 1
  `);

  console.log("[migration] job_warranties + warranty_claims tables ready");
}
