import { pool } from "../db";

export async function runSmsConsentMigration() {
  // consultations: add sms_consent audit columns
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS sms_consent_ip TEXT`);

  // job_applications: sms_consent + sms_consent_at already added in a prior migration;
  // only the IP column is new here
  await pool.query(`ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS sms_consent_ip TEXT`);

  console.log("[migration] sms_consent audit columns ready (consultations + job_applications)");
}
