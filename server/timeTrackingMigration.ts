import { pool } from "./db";

export async function runTimeTrackingMigration() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS time_entries (
        id          varchar(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id     varchar(36)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        job_id      varchar(36)  REFERENCES jobs(id) ON DELETE SET NULL,
        clock_in    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        clock_out   TIMESTAMPTZ,
        duration_minutes INTEGER,
        entry_type  VARCHAR(20)  NOT NULL DEFAULT 'billable',
        notes       TEXT,
        created_at  TIMESTAMPTZ  DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_time_entries_user_id  ON time_entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in ON time_entries(clock_in);

      CREATE TABLE IF NOT EXISTS gps_pings (
        id             varchar(36)     PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id        varchar(36)     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        time_entry_id  varchar(36)     REFERENCES time_entries(id) ON DELETE CASCADE,
        lat            DOUBLE PRECISION NOT NULL,
        lng            DOUBLE PRECISION NOT NULL,
        accuracy       REAL,
        recorded_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_gps_pings_time_entry_id ON gps_pings(time_entry_id);
      CREATE INDEX IF NOT EXISTS idx_gps_pings_user_id       ON gps_pings(user_id);
    `);
    console.log("[migration] Time tracking tables ready");
  } catch (err: any) {
    console.error("[migration] Time tracking migration error:", err.message);
  }
}
