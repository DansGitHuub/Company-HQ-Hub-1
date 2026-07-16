import { pool } from "../db";

export async function runPhase4Migration() {
  // ── Item 27: Record history / audit trail ─────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS record_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(100) NOT NULL,
      entity_label TEXT,
      field_changed VARCHAR(100),
      old_value TEXT,
      new_value TEXT,
      action VARCHAR(30) NOT NULL DEFAULT 'update',
      changed_by_id VARCHAR(36),
      changed_by_name TEXT,
      changed_at TIMESTAMP DEFAULT NOW(),
      notes TEXT
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_record_history_entity ON record_history(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_record_history_changed_at ON record_history(changed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_record_history_changed_by ON record_history(changed_by_id);
  `);

  // ── Item 29: Equipment-to-job linking ────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_equipment_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id VARCHAR(36) NOT NULL,
      equipment_id VARCHAR(36) NOT NULL,
      assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
      hours_used NUMERIC(8,2) DEFAULT 0,
      operator_user_id VARCHAR(36),
      operator_name TEXT,
      notes TEXT,
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_job_equip_job_id ON job_equipment_assignments(job_id);
    CREATE INDEX IF NOT EXISTS idx_job_equip_equip_id ON job_equipment_assignments(equipment_id);
  `);

  console.log("[migration] record_history + job_equipment_assignments tables ready");

  // ── Additive: equipment hourly rate for cost tracking (S16-4) ────────────
  await pool.query(`
    ALTER TABLE job_equipment_assignments
    ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(8,2) DEFAULT 0
  `);
  console.log("[migration] job_equipment_assignments.hourly_rate column ready");
}
