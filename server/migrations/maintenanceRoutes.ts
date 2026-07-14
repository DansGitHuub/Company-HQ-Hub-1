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
}
