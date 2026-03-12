import { pool } from "./db";

export async function runCalendarMigration() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        event_type TEXT NOT NULL DEFAULT 'personal',
        start_datetime TIMESTAMPTZ NOT NULL,
        end_datetime TIMESTAMPTZ NOT NULL,
        all_day BOOLEAN NOT NULL DEFAULT false,
        location TEXT,
        created_by VARCHAR(36) NOT NULL REFERENCES users(id),
        assigned_to VARCHAR(36) REFERENCES users(id),
        linked_record_type TEXT,
        linked_record_id VARCHAR(36),
        google_event_id TEXT,
        is_company_event BOOLEAN NOT NULL DEFAULT false,
        is_private BOOLEAN NOT NULL DEFAULT false,
        recurrence_rule TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const cols = [
      { name: "google_access_token", type: "TEXT" },
      { name: "google_refresh_token", type: "TEXT" },
      { name: "google_calendar_id", type: "TEXT DEFAULT 'primary'" },
      { name: "google_token_expiry", type: "TIMESTAMPTZ" },
      { name: "voice_enabled", type: "BOOLEAN NOT NULL DEFAULT false" },
      { name: "voice_auto_speak", type: "BOOLEAN NOT NULL DEFAULT false" },
      { name: "voice_selection", type: "TEXT DEFAULT 'alloy'" },
    ];

    for (const col of cols) {
      const exists = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name=$1`,
        [col.name]
      );
      if (exists.rows.length === 0) {
        await client.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
      }
    }

    const contactCols = [
      { name: "contact_name", type: "TEXT" },
      { name: "contact_email", type: "TEXT" },
      { name: "contact_phone", type: "TEXT" },
    ];
    for (const col of contactCols) {
      const exists = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name=$1`,
        [col.name]
      );
      if (exists.rows.length === 0) {
        await client.query(`ALTER TABLE calendar_events ADD COLUMN ${col.name} ${col.type}`);
      }
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS google_calendar_events (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(36) NOT NULL REFERENCES users(id),
        google_event_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        start_datetime TIMESTAMPTZ NOT NULL,
        end_datetime TIMESTAMPTZ NOT NULL,
        all_day BOOLEAN NOT NULL DEFAULT false,
        location TEXT,
        calendar_id TEXT,
        synced_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_calendar_settings (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(36) NOT NULL REFERENCES users(id),
        category_key TEXT NOT NULL,
        display_name TEXT NOT NULL,
        color TEXT NOT NULL,
        is_custom BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("[migration] Calendar tables ready");
  } catch (err) {
    console.error("[migration] Calendar migration error:", err);
  } finally {
    client.release();
  }
}
