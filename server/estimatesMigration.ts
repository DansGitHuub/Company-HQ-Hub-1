import { db } from "./db";
import { sql } from "drizzle-orm";
import { pool } from "./db";

export async function runEstimatesMigration() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS estimates (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      client_name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'New Lead',
      estimated_value INTEGER DEFAULT 0,
      description TEXT,
      property_address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      notes TEXT,
      source TEXT DEFAULT 'manual',
      work_request_id VARCHAR(36),
      assigned_to VARCHAR(36) REFERENCES users(id),
      customer_id VARCHAR(36) REFERENCES users(id),
      follow_up_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Add presentation_style column to sales_estimates if not exists
  await pool.query(`
    ALTER TABLE sales_estimates
      ADD COLUMN IF NOT EXISTS presentation_style VARCHAR(50) DEFAULT 'simple'
  `);

  // Add portal columns to sales_estimates
  await pool.query(`
    ALTER TABLE sales_estimates
      ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS signature_data TEXT
  `);

  // Add category, area_description, photo_url columns to estimate_work_areas if not exists
  await pool.query(`
    ALTER TABLE estimate_work_areas
      ADD COLUMN IF NOT EXISTS category VARCHAR(255),
      ADD COLUMN IF NOT EXISTS area_description TEXT,
      ADD COLUMN IF NOT EXISTS photo_url TEXT
  `);

  // Add new date columns to estimates table
  await pool.query(`
    ALTER TABLE estimates
      ADD COLUMN IF NOT EXISTS issue_date TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS sent_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP
  `);

  // Add signature columns to estimates (added to Drizzle schema but never migrated to DB)
  // Without these columns Drizzle's SELECT * generates an invalid query → 500 on /api/pipeline-estimates
  await pool.query(`
    ALTER TABLE estimates
      ADD COLUMN IF NOT EXISTS signature_data    TEXT,
      ADD COLUMN IF NOT EXISTS signature_type    TEXT,
      ADD COLUMN IF NOT EXISTS signer_name       TEXT,
      ADD COLUMN IF NOT EXISTS signer_initials   TEXT,
      ADD COLUMN IF NOT EXISTS signer_ip         TEXT,
      ADD COLUMN IF NOT EXISTS signed_at         TIMESTAMP,
      ADD COLUMN IF NOT EXISTS signed_document_url TEXT
  `);

  // Create estimate_items table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS estimate_items (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      estimate_id VARCHAR(36) NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      material_id VARCHAR(36),
      description TEXT NOT NULL,
      quantity NUMERIC(10,2) DEFAULT 1,
      unit_price NUMERIC(10,2) DEFAULT 0,
      total NUMERIC(10,2) DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Phase 2: consultation chain link
  await pool.query(`
    ALTER TABLE sales_estimates
      ADD COLUMN IF NOT EXISTS consultation_id UUID
  `);

  console.log("[Migration] estimates table ready + sales_estimates + estimate_work_areas columns added + estimate date fields + estimate_items table");
}
