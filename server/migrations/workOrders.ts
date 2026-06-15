import { pool } from "../db";

export async function runWorkOrdersMigration() {
  // ── Core table ─────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id              SERIAL PRIMARY KEY,
      job_id          VARCHAR(36),
      title           TEXT NOT NULL,
      description     TEXT,
      status          TEXT NOT NULL DEFAULT 'draft',
      scheduled_date  DATE,
      office_notes    TEXT,
      assigned_crew   JSONB DEFAULT '[]',
      created_by      TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── V2 columns (additive) ──────────────────────────────────────────────────
  const v2Cols = [
    `ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS wo_type TEXT NOT NULL DEFAULT 'maintenance'`,
    `ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS service_type_id INTEGER`,
    `ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS crew_leader_id VARCHAR(36)`,
    `ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS estimated_duration TEXT`,
    `ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS property_notes TEXT`,
    `ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS site_access_notes TEXT`,
    `ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS customer_name TEXT`,
    `ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS customer_address TEXT`,
    `ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS customer_phone TEXT`,
    `ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS contract_value DECIMAL(10,2)`,
    `ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS estimated_completion_date DATE`,
    `ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS companycam_project_id TEXT`,
  ];
  for (const sql of v2Cols) {
    try { await pool.query(sql); } catch (_) {}
  }

  // Fix column types — in older prod DBs these were created as INTEGER.
  // Cast all FK-like columns to TEXT so UUID/varchar joins work unconditionally.
  const typeFixCols = [
    `ALTER TABLE work_orders ALTER COLUMN job_id TYPE TEXT USING job_id::text`,
    `ALTER TABLE work_orders ALTER COLUMN crew_leader_id TYPE TEXT USING crew_leader_id::text`,
    `ALTER TABLE work_orders ALTER COLUMN service_type_id TYPE TEXT USING service_type_id::text`,
  ];
  for (const sql of typeFixCols) {
    try { await pool.query(sql); } catch (_) {}
  }

  // ── Legacy steps (keep backward compat) ────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_order_steps (
      id              SERIAL PRIMARY KEY,
      work_order_id   INTEGER REFERENCES work_orders(id) ON DELETE CASCADE,
      step_number     INTEGER NOT NULL DEFAULT 1,
      title           TEXT NOT NULL,
      description     TEXT,
      requires_photo  BOOLEAN DEFAULT false,
      is_complete     BOOLEAN DEFAULT false,
      completed_by    TEXT,
      completed_at    TIMESTAMPTZ,
      completion_note TEXT,
      photos          JSONB DEFAULT '[]',
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Materials (add area_id) ────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_order_materials (
      id              SERIAL PRIMARY KEY,
      work_order_id   INTEGER REFERENCES work_orders(id) ON DELETE CASCADE,
      item_name       TEXT NOT NULL,
      quantity        DECIMAL(10,2),
      unit            TEXT,
      catalog_item_id INTEGER,
      status          TEXT NOT NULL DEFAULT 'needed',
      notes           TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  try {
    await pool.query(`ALTER TABLE work_order_materials ADD COLUMN IF NOT EXISTS area_id INTEGER`);
  } catch (_) {}

  // ── Daily logs ─────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_order_daily_logs (
      id                        SERIAL PRIMARY KEY,
      work_order_id             INTEGER REFERENCES work_orders(id) ON DELETE CASCADE,
      log_date                  DATE NOT NULL DEFAULT CURRENT_DATE,
      work_completed            TEXT,
      crew_notes                TEXT,
      materials_needed_tomorrow TEXT,
      truck_emptied             BOOLEAN DEFAULT false,
      truck_loaded              BOOLEAN DEFAULT false,
      truck_fueled              BOOLEAN DEFAULT false,
      truck_clean               BOOLEAN DEFAULT false,
      truck_notes               TEXT,
      office_update             TEXT,
      submitted_by              TEXT,
      submitted_at              TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Work Areas ─────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_order_areas (
      id              SERIAL PRIMARY KEY,
      work_order_id   INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      name            TEXT NOT NULL,
      description     TEXT,
      estimated_hours DECIMAL(6,2),
      sort_order      INTEGER NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Area Tasks ─────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_order_area_tasks (
      id              SERIAL PRIMARY KEY,
      work_order_id   INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      area_id         INTEGER NOT NULL REFERENCES work_order_areas(id) ON DELETE CASCADE,
      title           TEXT NOT NULL,
      description     TEXT,
      requires_photo  BOOLEAN DEFAULT false,
      is_complete     BOOLEAN DEFAULT false,
      completed_by    TEXT,
      completed_at    TIMESTAMPTZ,
      photos          JSONB DEFAULT '[]',
      sort_order      INTEGER NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Quality Checklist Items ────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_order_checklists (
      id              SERIAL PRIMARY KEY,
      work_order_id   INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      area_id         INTEGER REFERENCES work_order_areas(id) ON DELETE CASCADE,
      label           TEXT NOT NULL,
      is_complete     BOOLEAN DEFAULT false,
      completed_by    TEXT,
      completed_at    TIMESTAMPTZ,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Inspection Hold Points ─────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_order_hold_points (
      id              SERIAL PRIMARY KEY,
      work_order_id   INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      area_id         INTEGER REFERENCES work_order_areas(id) ON DELETE CASCADE,
      label           TEXT NOT NULL,
      description     TEXT,
      is_approved     BOOLEAN DEFAULT false,
      approved_by     TEXT,
      approved_at     TIMESTAMPTZ,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Indexes ────────────────────────────────────────────────────────────────
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wo_steps_order    ON work_order_steps(work_order_id, step_number)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wo_materials_wo   ON work_order_materials(work_order_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wo_logs_date      ON work_order_daily_logs(work_order_id, log_date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wo_areas_wo       ON work_order_areas(work_order_id, sort_order)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wo_tasks_area     ON work_order_area_tasks(area_id, sort_order)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wo_checklist_area ON work_order_checklists(area_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wo_holdpts_area   ON work_order_hold_points(area_id)`);

  console.log("[migration] Work orders tables ready");
}
