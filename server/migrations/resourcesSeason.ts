import { db } from "../db";
import { sql } from "drizzle-orm";

export async function runResourcesSeasonMigration() {
  try {
    await db.execute(sql`
      ALTER TABLE customer_resources ADD COLUMN IF NOT EXISTS season TEXT DEFAULT 'N/A'
    `);

    await db.execute(sql`
      UPDATE customer_resources
      SET category = 'Care Guides'
      WHERE type = 'guide'
        AND category NOT IN ('Care Guides', 'Manufacturer Info', 'Professional Documents', 'Seasonal Checklists')
    `);

    await db.execute(sql`
      UPDATE customer_resources
      SET category = 'Manufacturer Info'
      WHERE type = 'instruction'
        AND category NOT IN ('Care Guides', 'Manufacturer Info', 'Professional Documents', 'Seasonal Checklists')
    `);

    await db.execute(sql`
      UPDATE customer_resources
      SET category = 'Professional Documents'
      WHERE type = 'document'
        AND category NOT IN ('Care Guides', 'Manufacturer Info', 'Professional Documents', 'Seasonal Checklists')
    `);

    await db.execute(sql`
      UPDATE customer_resources
      SET category = 'Seasonal Checklists'
      WHERE type = 'faq'
        AND category NOT IN ('Care Guides', 'Manufacturer Info', 'Professional Documents', 'Seasonal Checklists')
    `);

    console.log("[migration] Customer resources: season column + category remapping ready");
  } catch (err) {
    console.error("[migration] resourcesSeason failed:", err);
    throw err;
  }
}
