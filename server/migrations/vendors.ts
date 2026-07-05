import { pool } from "../db";

export async function runVendorsMigration() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vendors (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      category TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log("[migration] Vendors table ready");
}
