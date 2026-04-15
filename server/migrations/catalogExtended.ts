import { pool } from "../db";

export async function runCatalogExtendedMigration() {
  // New columns on materials table
  await pool.query(`
    ALTER TABLE materials
      ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,4) DEFAULT 0.0825,
      ADD COLUMN IF NOT EXISTS overhead_override NUMERIC(5,4),
      ADD COLUMN IF NOT EXISTS profit_margin_override NUMERIC(5,4),
      ADD COLUMN IF NOT EXISTS price_last_updated TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_used TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS retired BOOLEAN NOT NULL DEFAULT false
  `);

  // class_pricing_defaults table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS class_pricing_defaults (
      id SERIAL PRIMARY KEY,
      class_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      overhead_pct NUMERIC(5,4) NOT NULL DEFAULT 0.15,
      profit_margin_pct NUMERIC(5,4) NOT NULL DEFAULT 0.20,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (class_id, year)
    )
  `);

  // Seed 2026 defaults for all 4 classes
  await pool.query(`
    INSERT INTO class_pricing_defaults (class_id, year, overhead_pct, profit_margin_pct)
    VALUES
      (1, 2026, 0.15, 0.20),
      (2, 2026, 0.15, 0.20),
      (3, 2026, 0.15, 0.20),
      (4, 2026, 0.15, 0.20)
    ON CONFLICT (class_id, year) DO NOTHING
  `);

  console.log("[migration] Materials catalog columns ready (tax_rate, overhead_override, profit_margin_override, retired) + class_pricing_defaults seeded");
}
