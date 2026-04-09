import { pool } from "../db";

export async function runWorksheetPhase3Migration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // worksheets — one per user per day, uuid pk
    await client.query(`
      CREATE TABLE IF NOT EXISTS worksheets (
        id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     VARCHAR(36) NOT NULL REFERENCES users(id),
        job_id      VARCHAR(36) REFERENCES jobs(id),
        date        DATE NOT NULL DEFAULT CURRENT_DATE,
        notes       TEXT,
        status      TEXT NOT NULL DEFAULT 'draft',
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS worksheets_user_date_uidx
        ON worksheets (user_id, date)
    `);

    // worksheet_materials — line items
    await client.query(`
      CREATE TABLE IF NOT EXISTS worksheet_materials (
        id            SERIAL PRIMARY KEY,
        worksheet_id  VARCHAR(36) NOT NULL REFERENCES worksheets(id) ON DELETE CASCADE,
        material_name TEXT,
        quantity      NUMERIC,
        unit          TEXT,
        unit_cost     NUMERIC,
        notes         TEXT,
        created_at    TIMESTAMP DEFAULT NOW()
      )
    `);

    // worksheet_expenses — receipts / misc costs
    await client.query(`
      CREATE TABLE IF NOT EXISTS worksheet_expenses (
        id            SERIAL PRIMARY KEY,
        worksheet_id  VARCHAR(36) NOT NULL REFERENCES worksheets(id) ON DELETE CASCADE,
        description   TEXT,
        amount        NUMERIC,
        category      TEXT,
        receipt_url   TEXT,
        created_at    TIMESTAMP DEFAULT NOW()
      )
    `);

    // worksheet_team_members — crew on the job that day
    await client.query(`
      CREATE TABLE IF NOT EXISTS worksheet_team_members (
        id            SERIAL PRIMARY KEY,
        worksheet_id  VARCHAR(36) NOT NULL REFERENCES worksheets(id) ON DELETE CASCADE,
        user_id       VARCHAR(36) NOT NULL REFERENCES users(id),
        created_at    TIMESTAMP DEFAULT NOW(),
        UNIQUE (worksheet_id, user_id)
      )
    `);

    await client.query("COMMIT");
    console.log("[migration] Worksheet phase-3 tables ready (worksheets, worksheet_materials, worksheet_expenses, worksheet_team_members)");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
