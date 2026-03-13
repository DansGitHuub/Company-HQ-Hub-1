import { db } from "./db";
import { sql } from "drizzle-orm";

export async function runLanguageMigration() {
  try {
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS language text DEFAULT 'en'
    `);
    console.log("[migration] Language column ready");
  } catch (error: any) {
    console.log("[migration] Language column migration:", error.message);
  }
}
