import { pool } from "../db";

// Additive-only migration: creates job_line_items, a structured record of
// scope/material line items copied from a sales estimate at conversion time.
// This table is fully separate from job_materials (the pre-existing ad-hoc
// Job Materials feature) and must never be merged into it.
export async function runJobLineItemsMigration() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_line_items (
        id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id                        TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        job_work_area_id              VARCHAR(36) REFERENCES job_work_areas(id) ON DELETE SET NULL,
        source_estimate_id            UUID REFERENCES sales_estimates(id) ON DELETE SET NULL,
        source_estimate_line_item_id  UUID REFERENCES estimate_line_items(id) ON DELETE SET NULL,
        item_type                     VARCHAR(20) NOT NULL DEFAULT 'service',
        catalog_item_id               INTEGER REFERENCES catalog_items(id) ON DELETE SET NULL,
        class_id                      INTEGER REFERENCES class_codes(id) ON DELETE SET NULL,
        item_name                     TEXT NOT NULL,
        quantity                      NUMERIC(10,2) NOT NULL DEFAULT 1,
        unit                          VARCHAR(30),
        unit_price                    NUMERIC(10,2) NOT NULL DEFAULT 0,
        line_total                    NUMERIC(10,2) NOT NULL DEFAULT 0,
        sort_order                    INTEGER NOT NULL DEFAULT 0,
        is_optional                   BOOLEAN NOT NULL DEFAULT false,
        notes                         TEXT,
        created_by_id                 TEXT,
        created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_job_line_items_job ON job_line_items(job_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_job_line_items_source ON job_line_items(source_estimate_line_item_id)`);

    console.log("[migration] job_line_items table ready");
  } catch (err: any) {
    console.error("[migration] job_line_items error:", err.message);
  }
}
