import { pool } from "../db";

export async function runWorksheetTablesMigration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // worksheet_sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS worksheet_sessions (
        id            SERIAL PRIMARY KEY,
        job_id        VARCHAR(36) NOT NULL REFERENCES jobs(id),
        employee_id   VARCHAR(36) NOT NULL REFERENCES users(id),
        date          DATE NOT NULL,
        status        TEXT NOT NULL DEFAULT 'active',
        is_duplicate  BOOLEAN DEFAULT FALSE,
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW(),
        submitted_at  TIMESTAMP
      )
    `);

    // worksheet_time_entries
    await client.query(`
      CREATE TABLE IF NOT EXISTS worksheet_time_entries (
        id                SERIAL PRIMARY KEY,
        session_id        INTEGER NOT NULL REFERENCES worksheet_sessions(id),
        job_id            VARCHAR(36) NOT NULL REFERENCES jobs(id),
        work_area_id      VARCHAR(36),
        start_time        TIMESTAMP NOT NULL,
        end_time          TIMESTAMP,
        duration_minutes  INTEGER,
        notes             TEXT,
        created_at        TIMESTAMP DEFAULT NOW()
      )
    `);

    // worksheet_materials_used
    await client.query(`
      CREATE TABLE IF NOT EXISTS worksheet_materials_used (
        id              SERIAL PRIMARY KEY,
        session_id      INTEGER NOT NULL REFERENCES worksheet_sessions(id),
        material_id     VARCHAR(36) REFERENCES materials(id),
        misc_name       TEXT,
        quantity        NUMERIC NOT NULL,
        unit            TEXT,
        notes           TEXT,
        receipt_photos  TEXT[] DEFAULT '{}',
        created_at      TIMESTAMP DEFAULT NOW()
      )
    `);

    // worksheet_photos
    await client.query(`
      CREATE TABLE IF NOT EXISTS worksheet_photos (
        id          SERIAL PRIMARY KEY,
        session_id  INTEGER NOT NULL REFERENCES worksheet_sessions(id),
        photo_url   TEXT NOT NULL,
        photo_type  TEXT NOT NULL,
        caption     TEXT,
        created_at  TIMESTAMP DEFAULT NOW()
      )
    `);

    // time_cards
    await client.query(`
      CREATE TABLE IF NOT EXISTS time_cards (
        id              SERIAL PRIMARY KEY,
        session_id      INTEGER REFERENCES worksheet_sessions(id),
        employee_id     VARCHAR(36) NOT NULL REFERENCES users(id),
        job_id          VARCHAR(36) NOT NULL REFERENCES jobs(id),
        date            DATE NOT NULL,
        clock_in_time   TIMESTAMP NOT NULL,
        clock_out_time  TIMESTAMP,
        total_minutes   INTEGER,
        status          TEXT NOT NULL DEFAULT 'draft',
        signature_name  TEXT,
        signed_at       TIMESTAMP,
        submitted_at    TIMESTAMP,
        qbo_exported_at TIMESTAMP,
        created_at      TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add worksheet_session_id column to daily_worksheets if not already present
    await client.query(`
      ALTER TABLE daily_worksheets
        ADD COLUMN IF NOT EXISTS worksheet_session_id INTEGER REFERENCES worksheet_sessions(id)
    `);

    await client.query("COMMIT");
    console.log("[migration] Worksheet sessions, time entries, materials, photos, time cards tables ready");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
