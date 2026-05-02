import { pool } from "../db";

export async function runEstimatingPhaseE2Migration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── calculator_definitions: registry of named calculator templates ─────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS calculator_definitions (
        id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
        name             VARCHAR(100) NOT NULL UNIQUE,
        display_name     TEXT         NOT NULL,
        category         VARCHAR(50)  NOT NULL,
        description      TEXT,
        input_schema     JSONB        NOT NULL,
        formula          JSONB        NOT NULL,
        default_class_id INTEGER      REFERENCES class_codes(id),
        is_active        BOOLEAN      NOT NULL DEFAULT true,
        sort_order       INTEGER      NOT NULL DEFAULT 0,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // ── calculator_runs: audit log of each calculator execution ───────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS calculator_runs (
        id                      VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
        calculator_id           VARCHAR(36)  NOT NULL REFERENCES calculator_definitions(id) ON DELETE RESTRICT,
        estimate_work_area_id   VARCHAR(36)  NOT NULL,
        inputs                  JSONB        NOT NULL,
        output_summary          JSONB        NOT NULL,
        run_by                  VARCHAR(36),
        run_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_calculator_runs_estimate_work_area_id
        ON calculator_runs(estimate_work_area_id)
    `);

    // ── Seed: mowing_time starter calculator ─────────────────────────────────
    await client.query(`
      INSERT INTO calculator_definitions (
        id, name, display_name, category, description,
        input_schema, formula, default_class_id, is_active, sort_order
      ) VALUES (
        gen_random_uuid(),
        'mowing_time',
        'Mowing Time',
        'maintenance',
        'Calculates mowing labor cost from lawn area, complexity, visits, and service level',
        '{"inputs":[{"name":"lawn_sqft","label":"Lawn area (sq ft)","type":"number","min":0,"default":10000},{"name":"complexity","label":"Complexity","type":"select","options":[{"value":"easy","label":"Easy 1.0x"},{"value":"medium","label":"Medium 1.25x"},{"value":"hard","label":"Hard 1.5x"}],"default":"medium"},{"name":"visits_per_season","label":"Visits per season","type":"number","min":1,"default":28},{"name":"service_level","label":"Service level","type":"select","options":[{"value":"standard","label":"Standard"},{"value":"premium","label":"Premium"}],"default":"standard"}]}'::jsonb,
        '{"type":"decomposed","laborRate":65,"productionRates":{"standard":12000,"premium":8000},"complexityMultipliers":{"easy":1.0,"medium":1.25,"hard":1.5},"lineItems":[{"item_type":"service","class_id":1,"description":"Mowing service per visit (lawn_sqft sq ft, complexity, service_level)","qtyExpr":"visits_per_season","unitPriceExpr":"(lawn_sqft / productionRates[service_level]) * laborRate * complexityMultipliers[complexity]","unit":"visit","is_optional":false}]}'::jsonb,
        1,
        true,
        1
      )
      ON CONFLICT (name) DO NOTHING
    `);

    await client.query("COMMIT");
    console.log("[migration] Estimating Phase E2 tables ready (calculator_definitions, calculator_runs)");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
