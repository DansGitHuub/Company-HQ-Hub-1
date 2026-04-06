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

  console.log("[Migration] estimates table ready + sales_estimates + estimate_work_areas columns added");
}
