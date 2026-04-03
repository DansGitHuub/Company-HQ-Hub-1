import { pool } from "../db";

export async function runSchedulingMigration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Add division + color to jobs (scheduled_date / scheduled_start_time / scheduled_end_time already exist)
    await client.query(`
      ALTER TABLE jobs
        ADD COLUMN IF NOT EXISTS division VARCHAR(50) DEFAULT 'Maintenance',
        ADD COLUMN IF NOT EXISTS color    VARCHAR(20) DEFAULT '#22c55e'
    `);

    // Crew assignment table — uses VARCHAR(36) to match jobs.id and employees.id
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_assignments (
        id            VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
        job_id        VARCHAR(36)  NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        employee_id   VARCHAR(36)  NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        scheduled_date DATE        NOT NULL,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE (job_id, employee_id, scheduled_date)
      )
    `);

    await client.query("COMMIT");
    console.log("[migration] Scheduling tables ready");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
