import { pool } from "../db";

export async function runMaintenanceRoutesMigration() {
  // Table 1: route definitions — cadence, season window, crew assignment
  await pool.query(`
    CREATE TABLE IF NOT EXISTS maintenance_routes (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name             TEXT NOT NULL,
      description      TEXT,
      assigned_crew_id VARCHAR(36),
      cadence          TEXT NOT NULL DEFAULT 'weekly',
      interval_days    INTEGER,
      days_of_week     TEXT[],
      season_start     TEXT,
      season_end       TEXT,
      is_active        BOOLEAN NOT NULL DEFAULT true,
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log("[migration] maintenance_routes table ready");

  // Table 2: ordered stops — FK to the existing properties table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS maintenance_route_stops (
      id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_id                  UUID NOT NULL REFERENCES maintenance_routes(id) ON DELETE CASCADE,
      property_id               UUID REFERENCES properties(id) ON DELETE SET NULL,
      sequence_order            INTEGER NOT NULL DEFAULT 0,
      expected_duration_minutes INTEGER,
      service_notes             TEXT,
      expected_services         TEXT,
      created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log("[migration] maintenance_route_stops table ready");

  // Table 3: generated occurrences — created empty now; auto-generation is Stage 2
  await pool.query(`
    CREATE TABLE IF NOT EXISTS maintenance_route_visits (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_id             UUID NOT NULL REFERENCES maintenance_routes(id) ON DELETE CASCADE,
      visit_date           DATE NOT NULL,
      assigned_crew_id     VARCHAR(36),
      status               TEXT NOT NULL DEFAULT 'scheduled',
      job_id               TEXT,
      worksheet_session_id TEXT,
      notes                TEXT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log("[migration] maintenance_route_visits table ready");

  // Additive: unique constraint enables ON CONFLICT DO NOTHING deduplication
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'mrv_route_date_unique'
      ) THEN
        ALTER TABLE maintenance_route_visits
          ADD CONSTRAINT mrv_route_date_unique UNIQUE (route_id, visit_date);
      END IF;
    END $$
  `);
  console.log("[migration] maintenance_route_visits unique constraint ready");

  // ── Stage 3: completion capture columns (additive only) ───────────────────
  await pool.query(`ALTER TABLE maintenance_route_visits ADD COLUMN IF NOT EXISTS completed_at           TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE maintenance_route_visits ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER`);
  await pool.query(`ALTER TABLE maintenance_route_visits ADD COLUMN IF NOT EXISTS stops_completed         INTEGER`);
  await pool.query(`ALTER TABLE maintenance_route_visits ADD COLUMN IF NOT EXISTS stops_total             INTEGER`);
  console.log("[migration] maintenance_route_visits stage-3 columns ready");

  // ── Stage 3: per-stop completion table ────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS maintenance_route_visit_stops (
      id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
      visit_id      UUID    NOT NULL REFERENCES maintenance_route_visits(id) ON DELETE CASCADE,
      route_stop_id UUID    REFERENCES maintenance_route_stops(id) ON DELETE SET NULL,
      property_id   UUID    REFERENCES properties(id) ON DELETE SET NULL,
      completed     BOOLEAN NOT NULL DEFAULT false,
      notes         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS mrvs_visit_stop_unique
      ON maintenance_route_visit_stops (visit_id, route_stop_id)
      WHERE route_stop_id IS NOT NULL
  `);
  console.log("[migration] maintenance_route_visit_stops table ready");
}
