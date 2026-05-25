import { pool } from "../db";

export async function runCompanyCamWave3Migration() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE companycam_projects
        ADD COLUMN IF NOT EXISTS recon_dismissed BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await client.query(`
      ALTER TABLE companycam_projects
        ADD COLUMN IF NOT EXISTS synced_from_api_at TIMESTAMPTZ
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cc_projects_recon
        ON companycam_projects(customer_id, recon_dismissed, archived)
    `);
    console.log("[migration] CompanyCam Wave 3: recon_dismissed + synced_from_api_at ready");
  } catch (err) {
    throw err;
  } finally {
    client.release();
  }
}
