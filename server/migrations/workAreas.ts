import { pool } from "../db";

const DEFAULT_TYPES = [
  { name: "Mowing",            division: "Maintenance", sort_order: 1 },
  { name: "Trimming",          division: "Maintenance", sort_order: 2 },
  { name: "Edging",            division: "Maintenance", sort_order: 3 },
  { name: "Mulching",          division: "Maintenance", sort_order: 4 },
  { name: "Fertilization",     division: "Maintenance", sort_order: 5 },
  { name: "Aeration",          division: "Maintenance", sort_order: 6 },
  { name: "Leaf Cleanup",      division: "Maintenance", sort_order: 7 },
  { name: "Spring Cleanup",    division: "Maintenance", sort_order: 8 },
  { name: "Fall Cleanup",      division: "Maintenance", sort_order: 9 },
  { name: "Pruning",           division: "Maintenance", sort_order: 10 },
  { name: "Weeding",           division: "Maintenance", sort_order: 11 },
  { name: "Irrigation Check",  division: "Maintenance", sort_order: 12 },

  { name: "Planting",          division: "Install",     sort_order: 1 },
  { name: "Paver Patio",       division: "Install",     sort_order: 2 },
  { name: "Retaining Wall",    division: "Install",     sort_order: 3 },
  { name: "Grading",           division: "Install",     sort_order: 4 },
  { name: "Drainage",          division: "Install",     sort_order: 5 },
  { name: "Irrigation Install", division: "Install",    sort_order: 6 },
  { name: "Lighting Install",  division: "Install",     sort_order: 7 },
  { name: "Sod Install",       division: "Install",     sort_order: 8 },
  { name: "Seeding",           division: "Install",     sort_order: 9 },
  { name: "Tree Installation", division: "Install",     sort_order: 10 },

  { name: "Snow Plowing",      division: "Snow",        sort_order: 1 },
  { name: "Salting",           division: "Snow",        sort_order: 2 },
  { name: "Sidewalk Clearing", division: "Snow",        sort_order: 3 },
  { name: "Snow Hauling",      division: "Snow",        sort_order: 4 },

  { name: "Consultation",      division: "General",     sort_order: 1 },
  { name: "Site Visit",        division: "General",     sort_order: 2 },
  { name: "Shop Time",         division: "General",     sort_order: 3 },
  { name: "Drive Time",        division: "General",     sort_order: 4 },
  { name: "Meeting",           division: "General",     sort_order: 5 },
  { name: "Training",          division: "General",     sort_order: 6 },
  { name: "Break",             division: "General",     sort_order: 7 },
];

export async function runWorkAreasMigration() {
  // Table 1: company-managed list of work area types
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_area_types (
      id           VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name         VARCHAR(100) NOT NULL,
      division     VARCHAR(50),
      is_active    BOOLEAN      NOT NULL DEFAULT true,
      sort_order   INTEGER      NOT NULL DEFAULT 0,
      created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);

  // Table 2: work areas assigned to a specific job
  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_work_areas (
      id                 VARCHAR(36)    PRIMARY KEY DEFAULT gen_random_uuid()::text,
      job_id             VARCHAR(36)    REFERENCES jobs(id) ON DELETE CASCADE,
      work_area_type_id  VARCHAR(36)    REFERENCES work_area_types(id),
      name               VARCHAR(100)   NOT NULL,
      estimated_hours    DECIMAL(6,2),
      actual_hours       DECIMAL(6,2)   NOT NULL DEFAULT 0,
      status             VARCHAR(20)    NOT NULL DEFAULT 'pending',
      sort_order         INTEGER        NOT NULL DEFAULT 0,
      notes              TEXT,
      is_active          BOOLEAN        NOT NULL DEFAULT true
    );
  `);

  // Extend time_entries with work area columns
  await pool.query(`
    ALTER TABLE time_entries
      ADD COLUMN IF NOT EXISTS job_work_area_id VARCHAR(36) REFERENCES job_work_areas(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS work_area_name VARCHAR(100);
  `);

  // Seed defaults on first run
  const { rows } = await pool.query(`SELECT COUNT(*) FROM work_area_types`);
  if (parseInt(rows[0].count) === 0) {
    for (const t of DEFAULT_TYPES) {
      await pool.query(
        `INSERT INTO work_area_types (name, division, sort_order) VALUES ($1, $2, $3)`,
        [t.name, t.division, t.sort_order]
      );
    }
    console.log("[migration] work_area_types seeded with defaults");
  }

  console.log("[migration] Work areas tables ready");
}
