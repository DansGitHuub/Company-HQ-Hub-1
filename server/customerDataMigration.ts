import { pool } from "./db";
import fs from "fs";
import path from "path";

export async function runCustomerDataMigration() {
  try {
    const countResult = await pool.query("SELECT COUNT(*) AS cnt FROM customers");
    const count = parseInt(countResult.rows[0].cnt, 10);

    if (count > 0) {
      console.log(`[customer-data] ${count} customers already in database — skipping seed`);
      return;
    }

    const sqlPath = path.resolve(process.cwd(), "server/migrations/customer_data.sql");

    if (!fs.existsSync(sqlPath)) {
      console.log("[customer-data] Seed file not found, skipping");
      return;
    }

    console.log("[customer-data] Customers table is empty — seeding from data file...");

    const sql = fs.readFileSync(sqlPath, "utf-8");
    const statements = sql.split("\n").filter((line) => line.trim().startsWith("INSERT"));

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const stmt of statements) {
        if (stmt.trim()) await client.query(stmt);
      }
      await client.query("COMMIT");

      const afterResult = await pool.query("SELECT COUNT(*) AS cnt FROM customers");
      console.log(`[customer-data] Seeded ${afterResult.rows[0].cnt} customers successfully`);
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("[customer-data] Rollback — error during seed:", err.message);
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("[customer-data] Migration error:", err.message);
  }
}
