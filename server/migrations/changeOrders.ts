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
      catalog_item_id INTEGER REFERENCES catalog_items(id),
      markup_pct NUMERIC(5,2),
      sort_order INTEGER DEFAULT 0
    )
  `);

  // Fix up databases created before catalog_item_id was corrected to INTEGER
  // (it was originally mis-typed as UUID, which can never match catalog_items.id).
  // The old uuid values were never valid catalog links (catalog IDs have always
  // been integers), so USING NULL discards them in place without dropping the
  // column; the foreign key is then added as its own guarded step.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'job_change_order_items' AND column_name = 'catalog_item_id' AND data_type = 'uuid'
      ) THEN
        ALTER TABLE job_change_order_items ALTER COLUMN catalog_item_id TYPE INTEGER USING NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'job_change_order_items' AND column_name = 'markup_pct'
      ) THEN
        ALTER TABLE job_change_order_items ADD COLUMN markup_pct NUMERIC(5,2);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'job_change_order_items' AND constraint_name = 'job_change_order_items_catalog_item_id_fkey'
      ) THEN
        ALTER TABLE job_change_order_items
          ADD CONSTRAINT job_change_order_items_catalog_item_id_fkey
          FOREIGN KEY (catalog_item_id) REFERENCES catalog_items(id);
      END IF;
    END $$;
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
