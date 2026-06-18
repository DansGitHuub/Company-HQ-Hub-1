import { pool } from "../db";

export async function runChangeOrdersMigration() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_change_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id VARCHAR(36) NOT NULL,
      customer_id VARCHAR(36),
      source_estimate_id UUID,
      co_number VARCHAR(20) NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'draft',
      approval_type VARCHAR(30),
      signature_data TEXT,
      approved_by_name TEXT,
      approved_at TIMESTAMP,
      subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
      tax_rate NUMERIC(5,4) DEFAULT 0,
      tax_amount NUMERIC(12,2) DEFAULT 0,
      total NUMERIC(12,2) NOT NULL DEFAULT 0,
      notes TEXT,
      internal_notes TEXT,
      photos JSONB DEFAULT '[]',
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_change_order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      change_order_id UUID NOT NULL REFERENCES job_change_orders(id) ON DELETE CASCADE,
      item_type VARCHAR(30) NOT NULL DEFAULT 'labor',
      description TEXT NOT NULL,
      quantity NUMERIC(10,3) DEFAULT 1,
      unit VARCHAR(30),
      unit_price NUMERIC(12,2) DEFAULT 0,
      amount NUMERIC(12,2) DEFAULT 0,
      catalog_item_id UUID,
      sort_order INTEGER DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_change_orders_job_id ON job_change_orders(job_id);
    CREATE INDEX IF NOT EXISTS idx_change_order_items_co_id ON job_change_order_items(change_order_id);
  `);

  // Sequence for CO numbers
  await pool.query(`
    CREATE SEQUENCE IF NOT EXISTS co_number_seq START 1
  `);

  console.log("[migration] job_change_orders + job_change_order_items tables ready");
}
