import { db } from "./db";
import { sql } from "drizzle-orm";

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
  console.log("[Migration] estimates table ready");
}
