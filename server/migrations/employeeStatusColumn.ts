import { pool } from "../db";

export async function runEmployeeStatusColumnMigration() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active';
    `);
    console.log("[migration] employees.status column ready");
  } catch (err: any) {
    console.error("[migration] employeeStatusColumn migration error:", err.message);
  } finally {
    client.release();
  }
}
