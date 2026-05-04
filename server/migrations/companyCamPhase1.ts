import { pool } from "../db";

export async function runCompanyCamPhase1Migration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. companycam_users ───────────────────────────────────────────────────
    // Lazy-populated user cache — email is NOT on photo/project payloads;
    // resolved on demand via GET /v2/users/{companycam_user_id}.
    // name is split into first_name + last_name per §A2 spec.
    await client.query(`
      CREATE TABLE IF NOT EXISTS companycam_users (
        id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        companycam_user_id    TEXT        NOT NULL UNIQUE,
        email_address         TEXT,
        first_name            TEXT,
        last_name             TEXT,
        phone_number          TEXT,
        status                TEXT,
        last_synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companycam_users_email
        ON companycam_users(email_address)
    `);

    // ── 2. companycam_projects ────────────────────────────────────────────────
    // Central project cache.  estimate_id / customer_id are LOCAL linkage fields
    // preserved across CC webhook UPDATEs (never overwritten by webhook data).
    // creator_companycam_user_id is a soft (denormalized) reference — no FK.
    await client.query(`
      CREATE TABLE IF NOT EXISTS companycam_projects (
        id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        companycam_project_id       TEXT        NOT NULL UNIQUE,
        name                        TEXT        NOT NULL,
        status                      TEXT,
        address_street_1            TEXT,
        address_street_2            TEXT,
        address_city                TEXT,
        address_state               TEXT,
        address_postal_code         TEXT,
        address_country             TEXT,
        latitude                    NUMERIC(10,7),
        longitude                   NUMERIC(10,7),
        creator_companycam_user_id  TEXT,
        archived                    BOOLEAN     NOT NULL DEFAULT FALSE,
        public                      BOOLEAN     NOT NULL DEFAULT TRUE,
        feature_image_url           TEXT,
        raw_payload                 JSONB,
        estimate_id                 UUID        REFERENCES sales_estimates(id) ON DELETE SET NULL,
        customer_id                 UUID        REFERENCES customers(id)       ON DELETE SET NULL,
        cc_created_at               TIMESTAMPTZ,
        cc_updated_at               TIMESTAMPTZ,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companycam_projects_address_state
        ON companycam_projects(address_state)
    `);

    // ── 3. companycam_photos ──────────────────────────────────────────────────
    // captured_at stored via to_timestamp(epoch_seconds) — CC returns Unix epoch
    // integers, not ISO-8601.
    // creator_companycam_user_id is a SOFT denormalized reference (no FK
    // constraint) because companycam_users is lazy-populated; a hard FK would
    // cause webhook ingest to fail on cache-miss rows.
    await client.query(`
      CREATE TABLE IF NOT EXISTS companycam_photos (
        id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        companycam_photo_id         TEXT        NOT NULL UNIQUE,
        companycam_project_id       TEXT        NOT NULL
                                      REFERENCES companycam_projects(companycam_project_id)
                                      ON DELETE CASCADE,
        photo_url_original          TEXT,
        photo_url_web               TEXT,
        photo_url_thumbnail         TEXT,
        photo_url_web_annotation    TEXT,
        captured_at                 TIMESTAMPTZ,
        latitude                    NUMERIC(10,7),
        longitude                   NUMERIC(10,7),
        creator_companycam_user_id  TEXT,
        captured_by_email           TEXT,
        captured_by_name            TEXT,
        companycam_app_url          TEXT,
        description                 TEXT,
        internal                    BOOLEAN     NOT NULL DEFAULT FALSE,
        hash                        TEXT,
        processing_status           TEXT,
        raw_payload                 JSONB,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companycam_photos_project
        ON companycam_photos(companycam_project_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companycam_photos_creator
        ON companycam_photos(creator_companycam_user_id)
    `);

    // ── 4. companycam_photo_tags ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS companycam_photo_tags (
        id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        companycam_photo_id  TEXT        NOT NULL
                               REFERENCES companycam_photos(companycam_photo_id)
                               ON DELETE CASCADE,
        tag_value            TEXT        NOT NULL,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(companycam_photo_id, tag_value)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companycam_photo_tags_photo
        ON companycam_photo_tags(companycam_photo_id)
    `);

    // ── 5. companycam_project_labels ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS companycam_project_labels (
        id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        companycam_project_id TEXT        NOT NULL
                                REFERENCES companycam_projects(companycam_project_id)
                                ON DELETE CASCADE,
        label_value           TEXT        NOT NULL,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(companycam_project_id, label_value)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companycam_project_labels_project
        ON companycam_project_labels(companycam_project_id)
    `);

    // ── 6. companycam_walkthroughs ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS companycam_walkthroughs (
        id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        companycam_document_id TEXT        NOT NULL UNIQUE,
        companycam_project_id  TEXT        NOT NULL
                                 REFERENCES companycam_projects(companycam_project_id)
                                 ON DELETE CASCADE,
        document_type          TEXT        NOT NULL,
        content                TEXT,
        cc_created_at          TIMESTAMPTZ,
        created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companycam_walkthroughs_project
        ON companycam_walkthroughs(companycam_project_id)
    `);

    // ── 7. voice_transcripts ──────────────────────────────────────────────────
    // appointment_id / suggested_appointment_id reference calendar_events
    // (the appointments table does not exist in this schema).
    // estimate_id / customer_id are LOCAL linkage for auto-matching after ingest.
    // external_id is the Plaud (or other source) document identifier.
    await client.query(`
      CREATE TABLE IF NOT EXISTS voice_transcripts (
        id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id               TEXT        NOT NULL UNIQUE,
        appointment_id            VARCHAR(36) REFERENCES calendar_events(id)    ON DELETE SET NULL,
        suggested_appointment_id  VARCHAR(36) REFERENCES calendar_events(id)    ON DELETE SET NULL,
        transcript_text           TEXT,
        source                    TEXT,
        audio_duration_seconds    INTEGER,
        recorded_at               TIMESTAMPTZ,
        recorded_by_email         TEXT,
        summary_text              TEXT,
        transcript_format         TEXT        NOT NULL DEFAULT 'json',
        estimate_id               UUID        REFERENCES sales_estimates(id)    ON DELETE SET NULL,
        customer_id               UUID        REFERENCES customers(id)          ON DELETE SET NULL,
        suggested_estimate_id     UUID        REFERENCES sales_estimates(id)    ON DELETE SET NULL,
        suggested_customer_id     UUID        REFERENCES customers(id)          ON DELETE SET NULL,
        link_confirmed_at         TIMESTAMPTZ,
        raw_payload               JSONB,
        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_voice_transcripts_appointment
        ON voice_transcripts(appointment_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_voice_transcripts_recorded_at
        ON voice_transcripts(recorded_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_voice_transcripts_estimate
        ON voice_transcripts(estimate_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_voice_transcripts_customer
        ON voice_transcripts(customer_id)
    `);

    await client.query("COMMIT");
    console.log("[migration] CompanyCam Phase 1 tables ready (7 tables, v2 schema)");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
