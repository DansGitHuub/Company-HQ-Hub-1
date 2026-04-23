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
    // Ensure clock_in / clock_out are TIMESTAMPTZ even if the table was created
    // previously with TIMESTAMP WITHOUT TIME ZONE.
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'time_entries'
            AND column_name = 'clock_in'
            AND data_type = 'timestamp without time zone'
        ) THEN
          ALTER TABLE time_entries
            ALTER COLUMN clock_in   TYPE TIMESTAMPTZ USING clock_in   AT TIME ZONE 'UTC',
            ALTER COLUMN clock_out  TYPE TIMESTAMPTZ USING clock_out  AT TIME ZONE 'UTC',
            ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
        END IF;
      END $$;
    `);
    // ── Auto-clockout reminder columns ────────────────────────────────────────
    await pool.query(`
      ALTER TABLE time_entries
        ADD COLUMN IF NOT EXISTS auto_clocked_out BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;
    `);

    console.log("[migration] Time tracking tables ready");
  } catch (err: any) {
    console.error("[migration] Time tracking migration error:", err.message);
  }
}
