import { pool } from "../db";

export async function runGpsPingsIndexMigration(): Promise<void> {
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_gps_pings_recorded_at
      ON gps_pings (recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_gps_pings_user_recorded
      ON gps_pings (user_id, recorded_at DESC);
  `);
  console.log("[migration] gps_pings indexes ready");
}
