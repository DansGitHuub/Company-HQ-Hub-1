import { pool } from "../db";

export async function runPlantCardsMigration() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plant_cards (
      id            SERIAL PRIMARY KEY,
      catalog_item_id INTEGER REFERENCES catalog_items(id) ON DELETE SET NULL,
      common_name   TEXT NOT NULL,
      botanical_name TEXT,
      plant_type    TEXT,
      deciduous_evergreen TEXT,
      mature_size   TEXT,
      growth_rate   TEXT,
      hardiness_zone TEXT,
      light_requirement TEXT,
      soil_moisture TEXT,
      water_needs   TEXT,
      deer_resistant BOOLEAN DEFAULT false,
      flowering     BOOLEAN DEFAULT false,
      flower_season TEXT,
      flower_color  TEXT,
      pruning_time  TEXT,
      known_pests_issues TEXT,
      special_notes TEXT,
      maintenance_notes TEXT,
      photos        JSONB DEFAULT '[]',
      published     BOOLEAN DEFAULT true,
      created_by    TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_plant_cards_catalog_item
    ON plant_cards(catalog_item_id)
  `);
  console.log("[migration] plant_cards table ready");
}
