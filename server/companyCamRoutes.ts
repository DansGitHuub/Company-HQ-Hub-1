import { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { pool } from "./db";
import { requireAuth } from "./auth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractUri(uris: { type: string; uri: string }[], type: string): string | null {
  return uris?.find((u) => u.type === type)?.uri ?? null;
}

/**
 * CompanyCam description fields may arrive as a plain string OR as an object
 * with a plain_text_content key (rich-text envelope).  This helper normalises
 * both shapes and returns null for blank / missing values.
 */
function extractCompanyCamDescription(raw: any): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string') return raw.trim() || null;
  if (typeof raw === 'object' && typeof raw.plain_text_content === 'string') {
    return raw.plain_text_content.trim() || null;
  }
  return null;
}

/**
 * Lazy-populate companycam_users cache and return { emailAddress, firstName, lastName }.
 * email_address is NOT on photo or project payloads — resolved via /v2/users/{id}.
 */
async function resolveCreatorUser(creatorId: string): Promise<{
  emailAddress: string | null;
  firstName: string | null;
  lastName: string | null;
}> {
  const empty = { emailAddress: null, firstName: null, lastName: null };
  if (!creatorId) return empty;

  // Check cache first.
  const { rows: cached } = await pool.query(
    `SELECT email_address, first_name, last_name
       FROM companycam_users
      WHERE companycam_user_id = $1`,
    [creatorId]
  );
  if (cached.length > 0) {
    return {
      emailAddress: cached[0].email_address ?? null,
      firstName:    cached[0].first_name    ?? null,
      lastName:     cached[0].last_name     ?? null,
    };
  }

  // Cache miss — fetch from CC API.
  const token = process.env.COMPANYCAM_API_TOKEN;
  if (!token) {
    console.warn("[companycam] COMPANYCAM_API_TOKEN not set — cannot resolve creator");
    return empty;
  }

  try {
    const resp = await fetch(`https://api.companycam.com/v2/users/${creatorId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!resp.ok) {
      console.warn(`[companycam] /v2/users/${creatorId} returned ${resp.status}`);
      return empty;
    }
    const user = (await resp.json()) as {
      id?: string;
      email_address?: string;
      first_name?: string;
      last_name?: string;
      name?: string;
      phone_number?: string;
      status?: string;
    };

    // Split name into first/last if the API only returns a combined name.
    let firstName = user.first_name ?? null;
    let lastName  = user.last_name  ?? null;
    if (!firstName && !lastName && user.name) {
      const parts = user.name.trim().split(/\s+/);
      firstName = parts[0] ?? null;
      lastName  = parts.slice(1).join(" ") || null;
    }

    await pool.query(
      `INSERT INTO companycam_users
         (companycam_user_id, email_address, first_name, last_name,
          phone_number, status, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6, NOW())
       ON CONFLICT (companycam_user_id) DO UPDATE
         SET email_address  = EXCLUDED.email_address,
             first_name     = EXCLUDED.first_name,
             last_name      = EXCLUDED.last_name,
             phone_number   = EXCLUDED.phone_number,
             status         = EXCLUDED.status,
             last_synced_at = NOW(),
             updated_at     = NOW()`,
      [
        creatorId,
        user.email_address ?? null,
        firstName,
        lastName,
        user.phone_number ?? null,
        user.status       ?? null,
      ]
    );

    return { emailAddress: user.email_address ?? null, firstName, lastName };
  } catch (err: any) {
    console.error("[companycam] resolveCreatorUser fetch error:", err.message);
    return empty;
  }
}

/**
 * Lazy-populate companycam_projects so that a photo.created event whose parent
 * project has never been seen locally does not hit the FK constraint and 500.
 * Pattern mirrors resolveCreatorUser: check local first, then GET /v2/projects/{id}.
 */
async function resolveProject(projectId: string): Promise<void> {
  if (!projectId) return;

  // Local cache hit — FK will satisfy.
  const { rows } = await pool.query(
    `SELECT companycam_project_id FROM companycam_projects
      WHERE companycam_project_id = $1`,
    [projectId]
  );
  if (rows.length > 0) return;

  // Cache miss — fetch from CC API.
  const token = process.env.COMPANYCAM_API_TOKEN;
  if (!token) {
    console.warn("[companycam] COMPANYCAM_API_TOKEN not set — cannot lazy-fetch project", projectId);
    return;
  }

  try {
    const resp = await fetch(`https://api.companycam.com/v2/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!resp.ok) {
      console.warn(`[companycam] /v2/projects/${projectId} returned ${resp.status} — photo may fail FK`);
      return;
    }
    const proj = (await resp.json()) as any;
    const addr:   Record<string, any>           = proj?.address     ?? {};
    const coords: Record<string, any>           = proj?.coordinates ?? {};
    const uris:   { type: string; uri: string }[] = proj?.uris      ?? [];

    await pool.query(
      `INSERT INTO companycam_projects
         (companycam_project_id, name, status,
          address_street_1, address_street_2, address_city,
          address_state, address_postal_code, address_country,
          latitude, longitude,
          creator_companycam_user_id,
          archived, public, feature_image_url, raw_payload,
          cc_created_at, cc_updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
               to_timestamp($17), to_timestamp($18))
       ON CONFLICT (companycam_project_id) DO NOTHING`,
      [
        String(proj?.id ?? ""),
        proj?.name                                          ?? "",
        proj?.status                                        ?? null,
        addr?.street_address_1                              ?? null,
        addr?.street_address_2                              ?? null,
        addr?.city                                          ?? null,
        addr?.state                                         ?? null,
        addr?.postal_code                                   ?? null,
        addr?.country                                       ?? null,
        coords?.lat                                         ?? null,
        coords?.lng                                         ?? null,
        String(proj?.creator_id ?? proj?.creator?.id ?? "") || null,
        proj?.archived                                      ?? false,
        proj?.public                                        ?? true,
        proj?.feature_image_url ?? proj?.image_url ?? extractUri(uris, "web") ?? null,
        proj ? JSON.stringify(proj)                         : null,
        proj?.created_at                                    ?? null,
        proj?.updated_at                                    ?? null,
      ]
    );
    console.log(`[companycam] Lazy-fetched and cached project ${projectId}`);
  } catch (err: any) {
    console.error("[companycam] resolveProject fetch error:", err.message);
  }
}

// ─── Wave 3: Periodic API sync ────────────────────────────────────────────────

export async function syncCCProjectsFromApi(): Promise<{ upserted: number; autoLinked: number }> {
  const token = process.env.COMPANYCAM_API_TOKEN;
  if (!token) {
    console.warn("[companycam-sync] COMPANYCAM_API_TOKEN not set — skipping sync");
    return { upserted: 0, autoLinked: 0 };
  }

  let page = 1;
  let upserted = 0;

  while (true) {
    let projects: any[];
    try {
      const resp = await fetch(
        `https://api.companycam.com/v2/projects?per_page=50&page=${page}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
      );
      if (!resp.ok) {
        console.error(`[companycam-sync] API HTTP ${resp.status} on page ${page}`);
        break;
      }
      projects = await resp.json();
    } catch (err: any) {
      console.error(`[companycam-sync] Fetch error on page ${page}:`, err.message);
      break;
    }

    if (!Array.isArray(projects) || projects.length === 0) break;

    for (const proj of projects) {
      const addr   = proj.address     ?? {};
      const coords = proj.coordinates ?? {};
      try {
        await pool.query(
          `INSERT INTO companycam_projects
             (companycam_project_id, name, status,
              address_street_1, address_street_2, address_city,
              address_state, address_postal_code, address_country,
              latitude, longitude,
              creator_companycam_user_id,
              archived, public, feature_image_url, raw_payload,
              cc_created_at, cc_updated_at, synced_from_api_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
                   to_timestamp($17), to_timestamp($18), NOW())
           ON CONFLICT (companycam_project_id) DO UPDATE
             SET name                       = EXCLUDED.name,
                 status                     = EXCLUDED.status,
                 address_street_1           = EXCLUDED.address_street_1,
                 address_street_2           = EXCLUDED.address_street_2,
                 address_city               = EXCLUDED.address_city,
                 address_state              = EXCLUDED.address_state,
                 address_postal_code        = EXCLUDED.address_postal_code,
                 address_country            = EXCLUDED.address_country,
                 latitude                   = EXCLUDED.latitude,
                 longitude                  = EXCLUDED.longitude,
                 archived                   = EXCLUDED.archived,
                 feature_image_url          = EXCLUDED.feature_image_url,
                 raw_payload                = EXCLUDED.raw_payload,
                 cc_updated_at              = EXCLUDED.cc_updated_at,
                 synced_from_api_at         = NOW(),
                 updated_at                 = NOW()`,
          [
            String(proj.id ?? ""),
            proj.name                                               ?? "",
            proj.status                                             ?? null,
            addr.street_address_1                                   ?? null,
            addr.street_address_2                                   ?? null,
            addr.city                                               ?? null,
            addr.state                                              ?? null,
            addr.postal_code                                        ?? null,
            addr.country                                            ?? null,
            coords.lat                                              ?? null,
            coords.lng                                              ?? null,
            String(proj.creator_id ?? proj.creator?.id ?? "")      || null,
            proj.archived                                           ?? false,
            proj.public                                             ?? true,
            proj.feature_image_url ?? proj.image_url               ?? null,
            JSON.stringify(proj),
            proj.created_at                                         ?? null,
            proj.updated_at                                         ?? null,
          ]
        );
        upserted++;
      } catch (err: any) {
        console.error(`[companycam-sync] Upsert error for project ${proj.id}:`, err.message);
      }
    }

    if (projects.length < 50) break;
    page++;
  }

  // Auto-link: companycam_projects rows whose companycam_project_id is already
  // stored on a customer record (set by createCCProjectForCustomer) but whose
  // customer_id FK hasn't been filled in yet.
  const linkResult = await pool.query(`
    UPDATE companycam_projects cp
       SET customer_id = c.id,
           updated_at  = NOW()
      FROM customers c
     WHERE c.companycam_project_id = cp.companycam_project_id
       AND cp.customer_id IS NULL
  `);
  const autoLinked = linkResult.rowCount ?? 0;

  console.log(`[companycam-sync] Done: ${upserted} upserted, ${autoLinked} auto-linked`);
  return { upserted, autoLinked };
}

// ─── Route registration ───────────────────────────────────────────────────────

export function registerCompanyCamRoutes(app: Express) {
  /**
   * POST /api/companycam/webhook
   *
   * No auth middleware.  Body arrives as Buffer captured by the global
   * express.json() verify callback into req.rawBody before JSON parsing.
   * HMAC-SHA1 (base64) verified against X-CompanyCam-Signature header.
   */
  app.post("/api/companycam/webhook", async (req: any, res) => {
    // ── Signature verification ─────────────────────────────────────────────
    const secret    = process.env.COMPANYCAM_WEBHOOK_SECRET;
    const sigHeader = req.headers["x-companycam-signature"] as string | undefined;

    if (!secret) {
      console.warn("[companycam] COMPANYCAM_WEBHOOK_SECRET not set — rejecting webhook");
      return res.status(401).json({ error: "Webhook secret not configured" });
    }

    if (!sigHeader) {
      return res.status(401).json({ error: "Missing X-CompanyCam-Signature header" });
    }

    const rawBody = req.rawBody as Buffer | undefined;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ error: "Could not read raw request body" });
    }

    const expectedSig = crypto
      .createHmac("sha1", secret)
      .update(rawBody)
      .digest("base64");

    let sigMatch = false;
    try {
      sigMatch = crypto.timingSafeEqual(
        Buffer.from(sigHeader,    "utf8"),
        Buffer.from(expectedSig, "utf8")
      );
    } catch {
      sigMatch = false;
    }

    if (!sigMatch) {
      console.warn("[companycam] Webhook signature mismatch");
      return res.status(401).json({ error: "Invalid signature" });
    }

    // ── Parse payload ──────────────────────────────────────────────────────
    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }

    console.log('[companycam] Raw payload keys:', Object.keys(payload || {}).join(','), '| first 400:', JSON.stringify(payload).slice(0, 400));

    const eventType: string = payload?.event_type ?? payload?.scope ?? payload?.event_name ?? payload?.type ?? "";
    const data: any          = payload?.payload    ?? payload?.data ?? payload ?? {};

    console.log(`[companycam] Received event: ${eventType}`);

    // ── Dispatch by event type ─────────────────────────────────────────────
    try {
      // ── project.created / project.updated ────────────────────────────────
      if (eventType === "project.created" || eventType === "project.updated") {
        const proj   = data?.project   ?? data;
        const addr   = proj?.address   ?? {};
        const coords = proj?.coordinates ?? {};

        await pool.query(
          `INSERT INTO companycam_projects
             (companycam_project_id, name, status,
              address_street_1, address_street_2, address_city,
              address_state, address_postal_code, address_country,
              latitude, longitude,
              creator_companycam_user_id,
              archived, public, feature_image_url, raw_payload,
              cc_created_at, cc_updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
                   to_timestamp($17), to_timestamp($18))
           ON CONFLICT (companycam_project_id) DO UPDATE
             SET name                       = EXCLUDED.name,
                 status                     = EXCLUDED.status,
                 address_street_1           = EXCLUDED.address_street_1,
                 address_street_2           = EXCLUDED.address_street_2,
                 address_city               = EXCLUDED.address_city,
                 address_state              = EXCLUDED.address_state,
                 address_postal_code        = EXCLUDED.address_postal_code,
                 address_country            = EXCLUDED.address_country,
                 latitude                   = EXCLUDED.latitude,
                 longitude                  = EXCLUDED.longitude,
                 creator_companycam_user_id = EXCLUDED.creator_companycam_user_id,
                 archived                   = EXCLUDED.archived,
                 public                     = EXCLUDED.public,
                 feature_image_url          = EXCLUDED.feature_image_url,
                 raw_payload                = EXCLUDED.raw_payload,
                 cc_created_at              = EXCLUDED.cc_created_at,
                 cc_updated_at              = EXCLUDED.cc_updated_at,
                 updated_at                 = NOW()
             -- estimate_id and customer_id are LOCAL linkage — never overwritten`,
          [
            String(proj?.id    ?? ""),
            proj?.name         ?? "",
            proj?.status       ?? null,
            addr?.street_address_1 ?? null,
            addr?.street_address_2 ?? null,
            addr?.city         ?? null,
            addr?.state        ?? null,
            addr?.postal_code  ?? null,
            addr?.country      ?? null,
            coords?.lat        ?? null,
            coords?.lng        ?? null,
            String(proj?.creator_id ?? proj?.creator?.id ?? "") || null,
            proj?.archived     ?? false,
            proj?.public       ?? true,
            proj?.feature_image_url ?? proj?.image_url ?? null,
            proj ? JSON.stringify(proj) : null,
            proj?.created_at   ?? null,
            proj?.updated_at   ?? null,
          ]
        );
      }

      // ── photo.created ─────────────────────────────────────────────────────
      else if (eventType === "photo.created") {
        const photo  = data?.photo     ?? data;
        const photoProjectId = String(photo?.project_id ?? "");

        console.log('[companycam] photo.created branch — data keys:', Object.keys(data || {}).join(','), '| Boolean(data.photo):', Boolean(data?.photo), '| eventType:', eventType);

        // Guarantee FK target exists before the photo INSERT.
        await resolveProject(photoProjectId);

        const uris: { type: string; uri: string }[] = photo?.uris ?? [];
        const coords = photo?.coordinates ?? {};
        const creatorId = String(
          photo?.creator_id ?? photo?.creator?.id ?? ""
        );

        // Lazy-populate user cache and resolve display info.
        const { emailAddress, firstName, lastName } = creatorId
          ? await resolveCreatorUser(creatorId)
          : { emailAddress: null, firstName: null, lastName: null };

        const capturedByName = (firstName || lastName)
          ? [firstName, lastName].filter(Boolean).join(" ")
          : null;

        const capturedAt = photo?.captured_at ?? photo?.created_at ?? null;

        console.log('[companycam] photo INSERT params:', JSON.stringify({ photoId: photo?.id, photoProjectId, urisLength: uris.length, capturedAt, creatorId, emailAddress, capturedByName }));

        try {
          const result = await pool.query(
            `INSERT INTO companycam_photos
               (companycam_photo_id, companycam_project_id,
                photo_url_original, photo_url_web, photo_url_thumbnail,
                photo_url_web_annotation,
                captured_at, latitude, longitude,
                creator_companycam_user_id, captured_by_email, captured_by_name,
                companycam_app_url, description,
                internal, hash, processing_status, raw_payload)
             VALUES ($1,$2,$3,$4,$5,$6,
                     to_timestamp($7),$8,$9,
                     $10,$11,$12,$13,$14,$15,$16,$17,$18)
             ON CONFLICT (companycam_photo_id) DO UPDATE
               SET companycam_project_id       = EXCLUDED.companycam_project_id,
                   photo_url_original          = EXCLUDED.photo_url_original,
                   photo_url_web               = EXCLUDED.photo_url_web,
                   photo_url_thumbnail         = EXCLUDED.photo_url_thumbnail,
                   photo_url_web_annotation    = EXCLUDED.photo_url_web_annotation,
                   captured_at                 = EXCLUDED.captured_at,
                   latitude                    = EXCLUDED.latitude,
                   longitude                   = EXCLUDED.longitude,
                   creator_companycam_user_id  = EXCLUDED.creator_companycam_user_id,
                   captured_by_email           = EXCLUDED.captured_by_email,
                   captured_by_name            = EXCLUDED.captured_by_name,
                   companycam_app_url          = EXCLUDED.companycam_app_url,
                   description                 = EXCLUDED.description,
                   internal                    = EXCLUDED.internal,
                   hash                        = EXCLUDED.hash,
                   processing_status           = EXCLUDED.processing_status,
                   raw_payload                 = EXCLUDED.raw_payload`,
            [
              String(photo?.id ?? ""),
              photoProjectId,
              extractUri(uris, "original"),
              extractUri(uris, "web"),
              extractUri(uris, "thumbnail"),
              extractUri(uris, "web_annotation"),
              capturedAt,
              coords?.lat              ?? null,
              coords?.lng              ?? null,
              creatorId                || null,
              emailAddress,
              capturedByName,
              photo?.companycam_app_url ?? photo?.app_url ?? null,
              extractCompanyCamDescription(photo?.description),
              photo?.internal          ?? false,
              photo?.hash              ?? null,
              photo?.processing_status ?? photo?.status ?? null,
              photo ? JSON.stringify(photo) : null,
            ]
          );
          console.log('[companycam] photo INSERT rowCount:', result.rowCount);
        } catch (err: any) {
          console.error('[companycam] photo INSERT failed:', err.stack ?? err.message ?? err);
          throw err;
        }

        // v1.2.2: delayed-fetch self-heal — CC doesn't fire photo.updated for
        // description-only changes, so if photo.created arrived without a description,
        // refetch the photo from CC's API after 30s and update.
        const insertedDesc = extractCompanyCamDescription(photo?.description);
        if (!insertedDesc) {
          const photoIdStr = String(photo?.id ?? "");
          setTimeout(async () => {
            try {
              const resp = await fetch(`https://api.companycam.com/v2/photos/${photoIdStr}`, {
                headers: { Authorization: `Bearer ${process.env.COMPANYCAM_API_TOKEN}` }
              });
              if (!resp.ok) {
                console.error('[companycam] delayed-fetch HTTP', resp.status, 'for', photoIdStr);
                return;
              }
              const fresh: any = await resp.json();
              const freshDesc = extractCompanyCamDescription(fresh?.description);
              if (!freshDesc) {
                console.log('[companycam] delayed-fetch: still no description for', photoIdStr);
                return;
              }
              const upd = await pool.query(
                'UPDATE companycam_photos SET description = $1 WHERE companycam_photo_id = $2 AND description IS NULL',
                [freshDesc, photoIdStr]
              );
              console.log('[companycam] delayed-fetch populated description for', photoIdStr, 'rowCount:', upd.rowCount);
            } catch (err: any) {
              console.error('[companycam] delayed-fetch error for', photoIdStr, ':', err?.stack ?? err?.message ?? err);
            }
          }, 30000);
        }
      }

      // ── photo.updated ─────────────────────────────────────────────────────
      else if (eventType === "photo.updated") {
        const photo = data?.photo ?? data;
        const photoProjectId = String(photo?.project_id ?? "");

        await resolveProject(photoProjectId);

        const uris: { type: string; uri: string }[] = photo?.uris ?? [];
        const coords = photo?.coordinates ?? {};
        const creatorId = String(
          photo?.creator_id ?? photo?.creator?.id ?? ""
        );

        const { emailAddress, firstName, lastName } = creatorId
          ? await resolveCreatorUser(creatorId)
          : { emailAddress: null, firstName: null, lastName: null };

        const capturedByName = (firstName || lastName)
          ? [firstName, lastName].filter(Boolean).join(" ")
          : null;

        const capturedAt = photo?.captured_at ?? photo?.created_at ?? null;

        try {
          const result = await pool.query(
            `INSERT INTO companycam_photos
               (companycam_photo_id, companycam_project_id,
                photo_url_original, photo_url_web, photo_url_thumbnail,
                photo_url_web_annotation,
                captured_at, latitude, longitude,
                creator_companycam_user_id, captured_by_email, captured_by_name,
                companycam_app_url, description,
                internal, hash, processing_status, raw_payload)
             VALUES ($1,$2,$3,$4,$5,$6,
                     to_timestamp($7),$8,$9,
                     $10,$11,$12,$13,$14,$15,$16,$17,$18)
             ON CONFLICT (companycam_photo_id) DO UPDATE
               SET description = EXCLUDED.description,
                   raw_payload = EXCLUDED.raw_payload,
                   captured_at = COALESCE(EXCLUDED.captured_at, companycam_photos.captured_at)`,
            [
              String(photo?.id ?? ""),
              photoProjectId,
              extractUri(uris, "original"),
              extractUri(uris, "web"),
              extractUri(uris, "thumbnail"),
              extractUri(uris, "web_annotation"),
              capturedAt,
              coords?.lat              ?? null,
              coords?.lng              ?? null,
              creatorId                || null,
              emailAddress,
              capturedByName,
              photo?.companycam_app_url ?? photo?.app_url ?? null,
              extractCompanyCamDescription(photo?.description),
              photo?.internal          ?? false,
              photo?.hash              ?? null,
              photo?.processing_status ?? photo?.status ?? null,
              photo ? JSON.stringify(photo) : null,
            ]
          );
          console.log('[companycam] photo.updated rowCount:', result.rowCount);
        } catch (err: any) {
          console.error('[companycam] photo.updated INSERT failed:', err.stack ?? err.message ?? err);
          throw err;
        }
      }

      // ── document.created (ai_walkthrough_note only) ───────────────────────
      else if (eventType === "document.created") {
        const doc = data?.document ?? data;
        if (doc?.document_type === "ai_walkthrough_note") {
          await pool.query(
            `INSERT INTO companycam_walkthroughs
               (companycam_document_id, companycam_project_id,
                document_type, content, cc_created_at)
             VALUES ($1,$2,$3,$4, to_timestamp($5))
             ON CONFLICT (companycam_document_id) DO UPDATE
               SET content       = EXCLUDED.content,
                   cc_created_at = EXCLUDED.cc_created_at,
                   updated_at    = NOW()`,
            [
              String(doc?.id         ?? ""),
              String(doc?.project_id ?? ""),
              doc?.document_type     ?? "ai_walkthrough_note",
              doc?.content ?? doc?.body ?? null,
              doc?.created_at        ?? null,
            ]
          );
        }
      }

      else {
        console.log(`[companycam] Unhandled event '${eventType}' — ignoring`);
      }

      // Wave 4: log successful event (fire-and-forget — never blocks the 200 response)
      pool.query(
        `INSERT INTO companycam_webhook_events (event_type, success) VALUES ($1, true)`,
        [eventType]
      ).catch(() => {});
      return res.status(200).json({ received: true });
    } catch (err: any) {
      console.error("[companycam] Webhook processing error:", err.message ?? err);
      // Wave 4: log failed event
      pool.query(
        `INSERT INTO companycam_webhook_events (event_type, success, error_message) VALUES ($1, false, $2)`,
        [eventType, err?.message ?? "processing_failed"]
      ).catch(() => {});
      return res.status(200).json({ received: true, error: "processing_failed" });
    }
  });

  // ── Wave 3: Reconciliation queue ───────────────────────────────────────────

  // GET  /api/admin/companycam/recon-queue
  // Returns unmatched, non-dismissed, non-archived projects with address-based
  // customer suggestions (up to 6 per project, zip-exact first).
  app.get("/api/admin/companycam/recon-queue", requireAuth, async (_req: any, res: any) => {
    try {
      const { rows: projects } = await pool.query(`
        SELECT companycam_project_id, name,
               address_street_1, address_city, address_state, address_postal_code,
               cc_created_at, synced_from_api_at
          FROM companycam_projects
         WHERE customer_id      IS NULL
           AND recon_dismissed  = FALSE
           AND archived         = FALSE
         ORDER BY cc_created_at DESC NULLS LAST
         LIMIT 200
      `);

      const result: any[] = [];
      for (const p of projects) {
        const zip  = p.address_postal_code ?? "";
        const city = p.address_city ?? "";
        const { rows: suggestions } = await pool.query(
          `SELECT id, first_name, last_name, company_name,
                  billing_address, billing_city, billing_state, billing_zip
             FROM customers
            WHERE is_active = true
              AND companycam_project_id IS NULL
              AND (
                    (billing_zip  IS NOT NULL AND billing_zip  = $1)
                 OR (billing_city IS NOT NULL AND billing_city ILIKE $2)
                  )
            ORDER BY (billing_zip = $1)::int DESC, last_name
            LIMIT 6`,
          [zip, city || "%NOMATCH%"]
        );
        result.push({ ...p, suggested_customers: suggestions });
      }
      return res.json(result);
    } catch (err: any) {
      console.error("[companycam] recon-queue error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // GET /api/admin/companycam/recon-stats
  app.get("/api/admin/companycam/recon-stats", requireAuth, async (_req: any, res: any) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE customer_id IS NULL AND recon_dismissed = FALSE AND archived = FALSE) AS queued,
          COUNT(*) FILTER (WHERE customer_id IS NOT NULL)                                              AS linked,
          COUNT(*) FILTER (WHERE recon_dismissed = TRUE)                                               AS dismissed,
          MAX(synced_from_api_at)                                                                      AS last_synced_at
        FROM companycam_projects
      `);
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // POST /api/admin/companycam/recon-queue/:id/match
  // Body: { customer_id: uuid }
  // Links the CC project to the customer in both directions.
  app.post("/api/admin/companycam/recon-queue/:id/match", requireAuth, async (req: any, res: any) => {
    const ccProjectId = req.params.id;
    const { customer_id } = req.body ?? {};
    if (!customer_id) return res.status(400).json({ message: "customer_id is required" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE companycam_projects
            SET customer_id = $1, updated_at = NOW()
          WHERE companycam_project_id = $2`,
        [customer_id, ccProjectId]
      );
      await client.query(
        `UPDATE customers
            SET companycam_project_id    = $1,
                companycam_create_status = 'linked',
                companycam_create_error  = NULL
          WHERE id = $2`,
        [ccProjectId, customer_id]
      );
      await client.query("COMMIT");
      return res.json({ ok: true });
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("[companycam] recon match error:", err.message);
      return res.status(500).json({ message: err.message });
    } finally {
      client.release();
    }
  });

  // POST /api/admin/companycam/recon-queue/:id/dismiss
  app.post("/api/admin/companycam/recon-queue/:id/dismiss", requireAuth, async (req: any, res: any) => {
    try {
      await pool.query(
        `UPDATE companycam_projects
            SET recon_dismissed = TRUE, updated_at = NOW()
          WHERE companycam_project_id = $1`,
        [req.params.id]
      );
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // POST /api/admin/companycam/sync
  // Triggers a full API sync on demand.
  app.post("/api/admin/companycam/sync", requireAuth, async (_req: any, res: any) => {
    try {
      const result = await syncCCProjectsFromApi();
      return res.json(result);
    } catch (err: any) {
      console.error("[companycam] manual sync error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Wave 4: Webhook health dashboard ───────────────────────────────────────

  // GET /api/admin/companycam/webhook-health
  // Returns event counts (24h + 7d), last success timestamp, health flag, and
  // the 50 most recent individual events for the health dashboard.
  app.get("/api/admin/companycam/webhook-health", requireAuth, async (_req: any, res: any) => {
    try {
      const { rows: [agg] } = await pool.query(`
        SELECT
          (SELECT received_at FROM companycam_webhook_events
            WHERE success = true ORDER BY received_at DESC LIMIT 1)  AS last_success_at,
          COUNT(*) FILTER (WHERE received_at > NOW() - INTERVAL '24 hours')                         AS total_24h,
          COUNT(*) FILTER (WHERE received_at > NOW() - INTERVAL '24 hours' AND success = true)      AS success_24h,
          COUNT(*) FILTER (WHERE received_at > NOW() - INTERVAL '24 hours' AND success = false)     AS failed_24h,
          COUNT(*) FILTER (WHERE received_at > NOW() - INTERVAL '7 days')                           AS total_7d,
          COUNT(*) FILTER (WHERE received_at > NOW() - INTERVAL '7 days'  AND success = true)       AS success_7d,
          COUNT(*) FILTER (WHERE received_at > NOW() - INTERVAL '7 days'  AND success = false)      AS failed_7d
        FROM companycam_webhook_events
      `);

      const { rows: breakdown } = await pool.query(`
        SELECT event_type,
               COUNT(*)::int                              AS total,
               COUNT(*) FILTER (WHERE success = true)::int AS success
          FROM companycam_webhook_events
         WHERE received_at > NOW() - INTERVAL '24 hours'
         GROUP BY event_type
         ORDER BY total DESC
      `);

      const { rows: recent } = await pool.query(`
        SELECT id, event_type, success, error_message, received_at
          FROM companycam_webhook_events
         ORDER BY received_at DESC
         LIMIT 50
      `);

      const lastSuccessAt: string | null = agg?.last_success_at ?? null;
      const isHealthy = lastSuccessAt !== null &&
        new Date(lastSuccessAt) > new Date(Date.now() - 48 * 60 * 60 * 1000);

      return res.json({
        last_success_at: lastSuccessAt,
        is_healthy:       isHealthy,
        counts_24h: {
          total:   Number(agg?.total_24h   ?? 0),
          success: Number(agg?.success_24h ?? 0),
          failed:  Number(agg?.failed_24h  ?? 0),
        },
        counts_7d: {
          total:   Number(agg?.total_7d   ?? 0),
          success: Number(agg?.success_7d ?? 0),
          failed:  Number(agg?.failed_7d  ?? 0),
        },
        event_type_breakdown_24h: breakdown,
        recent_events:            recent,
      });
    } catch (err: any) {
      console.error("[companycam] webhook-health error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Phase 2: Link CompanyCam project to a Job ────────────────────────────────
  // PATCH /api/jobs/:jobId/companycam-project { companycam_project_id }
  app.patch("/api/jobs/:jobId/companycam-project", requireAuth, async (req: any, res: any) => {
    const { jobId } = req.params;
    const { companycam_project_id } = req.body;
    try {
      // Update jobs table
      await pool.query(
        `UPDATE jobs SET companycam_project_id = $1, updated_at = NOW() WHERE id = $2`,
        [companycam_project_id || null, jobId]
      );
      // If linking (not unlinking), update the companycam_projects row too
      if (companycam_project_id) {
        await pool.query(
          `UPDATE companycam_projects SET job_id = $1, updated_at = NOW() WHERE companycam_project_id = $2`,
          [jobId, companycam_project_id]
        );
      } else {
        // Unlinking — clear job_id on the old project
        await pool.query(
          `UPDATE companycam_projects SET job_id = NULL, updated_at = NOW() WHERE job_id = $1`,
          [jobId]
        );
      }
      return res.json({ ok: true, job_id: jobId, companycam_project_id: companycam_project_id || null });
    } catch (err: any) {
      console.error("[companycam] job-link error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // GET /api/jobs/:jobId/companycam-photos — get all photos for a job via linked CC project
  app.get("/api/jobs/:jobId/companycam-photos", requireAuth, async (req: any, res: any) => {
    const { jobId } = req.params;
    try {
      // Get job's CompanyCam project ID
      const { rows: jobRows } = await pool.query(
        `SELECT companycam_project_id, source_estimate_id FROM jobs WHERE id = $1`,
        [jobId]
      );
      if (!jobRows.length) return res.status(404).json({ message: "Job not found" });

      let ccProjectId = jobRows[0].companycam_project_id;

      // Fallback: try the source estimate's companycam_project_id
      if (!ccProjectId && jobRows[0].source_estimate_id) {
        const { rows: estRows } = await pool.query(
          `SELECT companycam_project_id FROM sales_estimates WHERE id = $1`,
          [jobRows[0].source_estimate_id]
        );
        ccProjectId = estRows[0]?.companycam_project_id || null;
      }

      if (!ccProjectId) return res.json({ project: null, photos: [] });

      // Get project and photos
      const { rows: projRows } = await pool.query(
        `SELECT * FROM companycam_projects WHERE companycam_project_id = $1`,
        [ccProjectId]
      );
      const { rows: photos } = await pool.query(
        `SELECT * FROM companycam_photos WHERE companycam_project_id = $1 ORDER BY captured_at DESC NULLS LAST`,
        [ccProjectId]
      );
      return res.json({ project: projRows[0] || null, photos });
    } catch (err: any) {
      console.error("[companycam] job-photos error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });
}
