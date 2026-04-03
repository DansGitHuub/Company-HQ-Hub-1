import { pool } from "../db";

export async function runAppSettingsMigration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key        VARCHAR(100) PRIMARY KEY,
        value      TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      INSERT INTO app_settings (key, value)
      VALUES ('division_colors', '{"Maintenance":"#22c55e","Install":"#3b82f6","Snow":"#94a3b8","General":"#f59e0b"}')
      ON CONFLICT (key) DO NOTHING
    `);
    await client.query(`
      INSERT INTO app_settings (key, value)
      VALUES ('company_info', '{"name":"Chapin Landscapes","phone":"","email":"","address":"","website":"","tax_rate":"0","payment_terms":"Net 30"}')
      ON CONFLICT (key) DO NOTHING
    `);
    await client.query("COMMIT");
    console.log("[migration] app_settings table ready");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
