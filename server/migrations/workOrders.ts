import { pool } from "../db";

export async function runWorkOrdersMigration() {
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

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wo_steps_order   ON work_order_steps(work_order_id, step_number)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wo_materials_wo  ON work_order_materials(work_order_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wo_logs_date     ON work_order_daily_logs(work_order_id, log_date)`);

  // Fix job_id column type if it was previously created as INTEGER
  try {
    await pool.query(`
      ALTER TABLE work_orders
        ALTER COLUMN job_id TYPE VARCHAR(36) USING job_id::text
    `);
  } catch (_) {
    // Column is already VARCHAR(36) or table doesn't exist yet — safe to ignore
  }

  console.log("[migration] Work orders tables ready");
}
