import { pool } from "../db";

export async function runSmsOptInsMigration() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sms_opt_ins (
      id          SERIAL PRIMARY KEY,
      first_name  TEXT NOT NULL,
      last_name   TEXT NOT NULL,
      phone       TEXT NOT NULL,
      email       TEXT,
      promotional_consent BOOLEAN NOT NULL DEFAULT false,
      opted_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("[migration] sms_opt_ins table ready");
}
