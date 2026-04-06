import { pool } from "../db";

export async function runMaterialsCatalogColumnsMigration() {
  await pool.query(`
    ALTER TABLE materials
      ADD COLUMN IF NOT EXISTS class VARCHAR(50),
      ADD COLUMN IF NOT EXISTS cost NUMERIC(10,2),
      ADD COLUMN IF NOT EXISTS markup NUMERIC(5,2),
      ADD COLUMN IF NOT EXISTS taxable BOOLEAN DEFAULT false
  `);
  console.log("[migration] Materials catalog columns ready (class, cost, markup, taxable)");
}
