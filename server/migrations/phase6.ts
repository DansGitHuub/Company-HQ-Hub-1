import { pool } from "../db";

export async function runPhase6Migration() {
  try {
    // ── job_materials ─────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_materials (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id           TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        catalog_item_id  INTEGER REFERENCES catalog_items(id) ON DELETE SET NULL,
        item_name        TEXT NOT NULL,
        item_number      TEXT,
        units            TEXT,
        quantity         NUMERIC(10,2) NOT NULL DEFAULT 1,
        unit_cost        NUMERIC(10,2),
        notes            TEXT,
        created_by_id    INTEGER,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_job_materials_job ON job_materials(job_id)`);

    // ── job_templates ─────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_templates (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name             TEXT NOT NULL,
        description      TEXT,
        job_type         TEXT,
        division         TEXT,
        estimated_hours  NUMERIC(8,2),
        estimated_days   INTEGER,
        scope_of_work    TEXT,
        crew_notes       TEXT,
        price            NUMERIC(10,2),
        checklist        JSONB DEFAULT '[]',
        is_active        BOOLEAN NOT NULL DEFAULT true,
        created_by_id    INTEGER,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    console.log("[migration] job_materials + job_templates tables ready");
  } catch (err: any) {
    console.error("[migration] Phase 6 error:", err.message);
  }
}
