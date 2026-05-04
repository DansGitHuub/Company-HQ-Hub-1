import { pool } from "../db";

export async function runCompanyCamPhase1Migration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. companycam_projects ────────────────────────────────────────────────
    // Central project cache.  estimate_id / customer_id are LOCAL linkage fields
    // preserved across CC webhook UPDATEs (never overwritten by webhook data).
    await client.query(`
      CREATE TABLE IF NOT EXISTS companycam_projects (
        id                    SERIAL PRIMARY KEY,
        companycam_project_id TEXT         NOT NULL UNIQUE,
        name                  TEXT         NOT NULL,
        status                TEXT,
        address_street_1      TEXT,
        address_street_2      TEXT,
        address_city          TEXT,
        address_state         TEXT,
        address_postal_code   TEXT,
        address_country       TEXT,
        latitude              NUMERIC(10,7),
        longitude             NUMERIC(10,7),
        estimate_id           UUID         REFERENCES sales_estimates(id) ON DELETE SET NULL,
        customer_id           UUID         REFERENCES customers(id)       ON DELETE SET NULL,
        cc_created_at         TIMESTAMPTZ,
        cc_updated_at         TIMESTAMPTZ,
        created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companycam_projects_estimate_id
        ON companycam_projects(estimate_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companycam_projects_customer_id
        ON companycam_projects(customer_id)
    `);

    // ── 2. companycam_users ───────────────────────────────────────────────────
    // Lazy-populated cache.  email_address is NOT on photo/project objects —
    // resolved via /v2/users/{creator_id} on cache miss.
    await client.query(`
      CREATE TABLE IF NOT EXISTS companycam_users (
        id                    SERIAL PRIMARY KEY,
        companycam_user_id    TEXT        NOT NULL UNIQUE,
        email_address         TEXT,
        name                  TEXT,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── 3. companycam_photos ──────────────────────────────────────────────────
    // captured_at is stored via to_timestamp(epoch_seconds) because CC returns
    // Unix epoch integers, not ISO-8601.
    await client.query(`
      CREATE TABLE IF NOT EXISTS companycam_photos (
        id                       SERIAL PRIMARY KEY,
        companycam_photo_id      TEXT         NOT NULL UNIQUE,
        companycam_project_id    TEXT         NOT NULL
                                   REFERENCES companycam_projects(companycam_project_id)
                                   ON DELETE CASCADE,
        photo_url_original       TEXT,
        photo_url_web            TEXT,
        photo_url_thumbnail      TEXT,
        photo_url_web_annotation TEXT,
        captured_at              TIMESTAMPTZ,
        latitude                 NUMERIC(10,7),
        longitude                NUMERIC(10,7),
        creator_id               TEXT
                                   REFERENCES companycam_users(companycam_user_id)
                                   ON DELETE SET NULL,
        captured_by_email        TEXT,
        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companycam_photos_project
        ON companycam_photos(companycam_project_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companycam_photos_creator
        ON companycam_photos(creator_id)
    `);

    // ── 4. companycam_photo_tags ──────────────────────────────────────────────
    // Upsert target: (companycam_photo_id, tag_value).
    await client.query(`
      CREATE TABLE IF NOT EXISTS companycam_photo_tags (
        id                    SERIAL PRIMARY KEY,
        companycam_photo_id   TEXT         NOT NULL
                                REFERENCES companycam_photos(companycam_photo_id)
                                ON DELETE CASCADE,
        tag_value             TEXT         NOT NULL,
        created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE(companycam_photo_id, tag_value)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companycam_photo_tags_photo
        ON companycam_photo_tags(companycam_photo_id)
    `);

    // ── 5. companycam_project_labels ──────────────────────────────────────────
    // Upsert target: (companycam_project_id, label_value).
    await client.query(`
      CREATE TABLE IF NOT EXISTS companycam_project_labels (
        id                    SERIAL PRIMARY KEY,
        companycam_project_id TEXT         NOT NULL
                                REFERENCES companycam_projects(companycam_project_id)
                                ON DELETE CASCADE,
        label_value           TEXT         NOT NULL,
        created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE(companycam_project_id, label_value)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companycam_project_labels_project
        ON companycam_project_labels(companycam_project_id)
    `);

    // ── 6. companycam_walkthroughs ────────────────────────────────────────────
    // Only document_type = 'ai_walkthrough_note' is ingested by the webhook.
    await client.query(`
      CREATE TABLE IF NOT EXISTS companycam_walkthroughs (
        id                     SERIAL PRIMARY KEY,
        companycam_document_id TEXT         NOT NULL UNIQUE,
        companycam_project_id  TEXT         NOT NULL
                                 REFERENCES companycam_projects(companycam_project_id)
                                 ON DELETE CASCADE,
        document_type          TEXT         NOT NULL,
        content                TEXT,
        cc_created_at          TIMESTAMPTZ,
        created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companycam_walkthroughs_project
        ON companycam_walkthroughs(companycam_project_id)
    `);

    // ── 7. voice_transcripts ──────────────────────────────────────────────────
    // appointment_id / suggested_appointment_id reference calendar_events
    // (not appointments — that table does not exist in this schema).
    // Column NAMES stay as appointment_id / suggested_appointment_id per
    // domain convention; only the FK target differs from the original spec.
    await client.query(`
      CREATE TABLE IF NOT EXISTS voice_transcripts (
        id                       SERIAL PRIMARY KEY,
        appointment_id           VARCHAR(36)
                                   REFERENCES calendar_events(id)
                                   ON DELETE SET NULL,
        suggested_appointment_id VARCHAR(36)
                                   REFERENCES calendar_events(id)
                                   ON DELETE SET NULL,
        transcript_text          TEXT,
        source                   TEXT,
        duration_seconds         INTEGER,
        recorded_at              TIMESTAMPTZ,
        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_voice_transcripts_appointment
        ON voice_transcripts(appointment_id)
    `);

    await client.query("COMMIT");
    console.log("[migration] CompanyCam Phase 1 tables ready (7 tables)");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
