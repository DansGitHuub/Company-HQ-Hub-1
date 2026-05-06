import { pool } from "../db";

export async function runCompanyCamPhotosPhase2Migration() {
  const client = await pool.connect();
  try {
    await client.query(
      `ALTER TABLE companycam_photos ADD COLUMN IF NOT EXISTS description_override TEXT`
    );
    await client.query(
      `ALTER TABLE companycam_photos ADD COLUMN IF NOT EXISTS description_source TEXT`
    );
    await client.query(
      `ALTER TABLE companycam_photos ADD COLUMN IF NOT EXISTS hidden_on_estimate BOOLEAN NOT NULL DEFAULT FALSE`
    );
    console.log("[migration] companycam_photos Phase 2 columns ready (description_override, description_source, hidden_on_estimate)");
  } catch (err) {
    throw err;
  } finally {
    client.release();
  }
}
