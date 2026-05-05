import { Express } from "express";
import crypto from "crypto";
import { pool } from "./db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractUri(uris: { type: string; uri: string }[], type: string): string | null {
  return uris?.find((u) => u.type === type)?.uri ?? null;
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
              photo?.description       ?? null,
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

      return res.status(200).json({ received: true });
    } catch (err: any) {
      console.error("[companycam] Webhook processing error:", err.message ?? err);
      return res.status(500).json({ error: "Internal error processing webhook" });
    }
  });
}
