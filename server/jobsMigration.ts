import { pool } from "./db";

export async function runJobsMigration() {
  try {
    await pool.query(`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS title       VARCHAR(200) NOT NULL DEFAULT 'Untitled Job';
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status      VARCHAR(30)  NOT NULL DEFAULT 'lead';
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type    VARCHAR(50);
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_start_time TIME;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_end_time   TIME;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS price       DECIMAL(10,2);
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS crew_notes  TEXT;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_id VARCHAR(36) REFERENCES customers(id) ON DELETE SET NULL;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS property_id VARCHAR(36);
    `);

    // Back-fill title from client for rows that haven't been given a title yet
    await pool.query(`
      UPDATE jobs SET title = client WHERE title = 'Untitled Job' AND client IS NOT NULL AND client <> '';
    `);

    // Back-fill status from stage for backwards compat
    await pool.query(`
      UPDATE jobs SET status =
        CASE
          WHEN LOWER(stage) = 'lead'        THEN 'lead'
          WHEN LOWER(stage) = 'scheduled'   THEN 'scheduled'
          WHEN LOWER(stage) IN ('active','in progress','in_progress') THEN 'in_progress'
          WHEN LOWER(stage) = 'completed'   THEN 'completed'
          WHEN LOWER(stage) = 'invoiced'    THEN 'invoiced'
          WHEN LOWER(stage) = 'cancelled'   THEN 'cancelled'
          ELSE 'lead'
        END
      WHERE status = 'lead';
    `);

    // Back-fill job_type from type column
    await pool.query(`
      UPDATE jobs SET job_type = type WHERE job_type IS NULL AND type IS NOT NULL AND type <> '';
    `);

    // Indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_status      ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_scheduled   ON jobs(scheduled_date);
    `);

    console.log("[migration] Jobs extended schema ready");
  } catch (err: any) {
    console.error("[migration] Jobs migration error:", err.message);
  }
}
