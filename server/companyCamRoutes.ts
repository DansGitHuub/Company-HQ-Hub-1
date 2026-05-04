import { Express } from "express";
import crypto from "crypto";
import { pool } from "./db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractUri(uris: { type: string; uri: string }[], type: string): string | null {
  return uris?.find((u) => u.type === type)?.uri ?? null;
}

/** Lazy-populate companycam_users cache and return the email address. */
async function resolveCreatorEmail(creatorId: string): Promise<string | null> {
  if (!creatorId) return null;

  // Check cache first.
  const { rows: cached } = await pool.query(
    `SELECT email_address FROM companycam_users WHERE companycam_user_id = $1`,
    [creatorId]
  );
  if (cached.length > 0) return cached[0].email_address ?? null;

  // Cache miss — fetch from CC API.
  const token = process.env.COMPANYCAM_API_TOKEN;
  if (!token) {
    console.warn("[companycam] COMPANYCAM_API_TOKEN not set — cannot resolve creator email");
    return null;
  }

  try {
    const resp = await fetch(`https://api.companycam.com/v2/users/${creatorId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!resp.ok) {
      console.warn(`[companycam] /v2/users/${creatorId} returned ${resp.status}`);
      return null;
    }
    const user = (await resp.json()) as { id?: string; email_address?: string; name?: string };

    await pool.query(
      `INSERT INTO companycam_users (companycam_user_id, email_address, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (companycam_user_id) DO UPDATE
         SET email_address = EXCLUDED.email_address,
             name          = EXCLUDED.name,
             updated_at    = NOW()`,
      [creatorId, user.email_address ?? null, user.name ?? null]
    );

    return user.email_address ?? null;
  } catch (err: any) {
    console.error("[companycam] resolveCreatorEmail fetch error:", err.message);
    return null;
  }
}

// ─── Route registration ───────────────────────────────────────────────────────

export function registerCompanyCamRoutes(app: Express) {
  /**
   * POST /api/companycam/webhook
   *
   * No auth middleware.  Body arrives as Buffer (captured by the global
   * express.json() verify callback into req.rawBody before JSON parsing).
   * HMAC-SHA1 signature is verified before any payload processing.
   */
  app.post("/api/companycam/webhook", async (req: any, res) => {
    // ── Signature verification ─────────────────────────────────────────────
    const secret = process.env.COMPANYCAM_WEBHOOK_SECRET;
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
        Buffer.from(sigHeader, "utf8"),
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

    const eventType: string = payload?.event_name ?? payload?.type ?? "";
    const data: any = payload?.payload ?? payload?.data ?? payload ?? {};

    console.log(`[companycam] Received event: ${eventType}`);

    // ── Route by event type ────────────────────────────────────────────────
    try {
      // ── project.created / project.updated ────────────────────────────────
      if (eventType === "project.created" || eventType === "project.updated") {
        const proj = data?.project ?? data;
        const addr = proj?.address ?? {};
        const coords = proj?.coordinates ?? {};

        await pool.query(
          `INSERT INTO companycam_projects
             (companycam_project_id, name, status,
              address_street_1, address_street_2, address_city,
              address_state, address_postal_code, address_country,
              latitude, longitude,
              cc_created_at, cc_updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
                   to_timestamp($12), to_timestamp($13))
           ON CONFLICT (companycam_project_id) DO UPDATE
             SET name                = EXCLUDED.name,
                 status              = EXCLUDED.status,
                 address_street_1    = EXCLUDED.address_street_1,
                 address_street_2    = EXCLUDED.address_street_2,
                 address_city        = EXCLUDED.address_city,
                 address_state       = EXCLUDED.address_state,
                 address_postal_code = EXCLUDED.address_postal_code,
                 address_country     = EXCLUDED.address_country,
                 latitude            = EXCLUDED.latitude,
                 longitude           = EXCLUDED.longitude,
                 cc_created_at       = EXCLUDED.cc_created_at,
                 cc_updated_at       = EXCLUDED.cc_updated_at,
                 updated_at          = NOW()
             -- estimate_id and customer_id are LOCAL linkage — never overwritten
          `,
          [
            String(proj?.id ?? ""),
            proj?.name ?? "",
            proj?.status ?? null,
            addr?.street_address_1 ?? null,
            addr?.street_address_2 ?? null,
            addr?.city ?? null,
            addr?.state ?? null,
            addr?.postal_code ?? null,
            addr?.country ?? null,
            coords?.lat ?? null,
            coords?.lng ?? null,
            proj?.created_at ?? null,
            proj?.updated_at ?? null,
          ]
        );
      }

      // ── photo.processed ───────────────────────────────────────────────────
      else if (eventType === "photo.processed") {
        const photo = data?.photo ?? data;
        const uris: { type: string; uri: string }[] = photo?.uris ?? [];
        const coords = photo?.coordinates ?? {};
        const creatorId = String(photo?.creator_id ?? photo?.creator?.id ?? "");

        // Lazy-populate user cache and get email.
        const capturedByEmail = creatorId ? await resolveCreatorEmail(creatorId) : null;

        // Insert/update user FK row first (if we have a creator_id).
        if (creatorId) {
          await pool.query(
            `INSERT INTO companycam_users (companycam_user_id, email_address)
             VALUES ($1, $2)
             ON CONFLICT (companycam_user_id) DO NOTHING`,
            [creatorId, capturedByEmail]
          );
        }

        const capturedAt = photo?.captured_at ?? photo?.created_at ?? null;

        await pool.query(
          `INSERT INTO companycam_photos
             (companycam_photo_id, companycam_project_id,
              photo_url_original, photo_url_web, photo_url_thumbnail, photo_url_web_annotation,
              captured_at, latitude, longitude,
              creator_id, captured_by_email)
           VALUES ($1,$2,$3,$4,$5,$6,
                   to_timestamp($7), $8,$9,$10,$11)
           ON CONFLICT (companycam_photo_id) DO UPDATE
             SET companycam_project_id    = EXCLUDED.companycam_project_id,
                 photo_url_original       = EXCLUDED.photo_url_original,
                 photo_url_web            = EXCLUDED.photo_url_web,
                 photo_url_thumbnail      = EXCLUDED.photo_url_thumbnail,
                 photo_url_web_annotation = EXCLUDED.photo_url_web_annotation,
                 captured_at              = EXCLUDED.captured_at,
                 latitude                 = EXCLUDED.latitude,
                 longitude                = EXCLUDED.longitude,
                 creator_id               = EXCLUDED.creator_id,
                 captured_by_email        = EXCLUDED.captured_by_email`,
          [
            String(photo?.id ?? ""),
            String(photo?.project_id ?? ""),
            extractUri(uris, "original"),
            extractUri(uris, "web"),
            extractUri(uris, "thumbnail"),
            extractUri(uris, "web_annotation"),
            capturedAt,
            coords?.lat ?? null,
            coords?.lng ?? null,
            creatorId || null,
            capturedByEmail,
          ]
        );
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
              String(doc?.id ?? ""),
              String(doc?.project_id ?? ""),
              doc?.document_type ?? "ai_walkthrough_note",
              doc?.content ?? doc?.body ?? null,
              doc?.created_at ?? null,
            ]
          );
        }
      }

      // ── tag.applied ───────────────────────────────────────────────────────
      else if (eventType === "tag.applied") {
        const tag = data?.tag ?? data;
        const photoId = String(tag?.photo_id ?? data?.photo_id ?? "");
        const tagValue = String(tag?.value ?? tag?.name ?? "");
        if (photoId && tagValue) {
          await pool.query(
            `INSERT INTO companycam_photo_tags (companycam_photo_id, tag_value)
             VALUES ($1, $2)
             ON CONFLICT (companycam_photo_id, tag_value) DO NOTHING`,
            [photoId, tagValue]
          );
        }
      }

      // ── label.applied ─────────────────────────────────────────────────────
      else if (eventType === "label.applied") {
        const label = data?.label ?? data;
        const projectId = String(label?.project_id ?? data?.project_id ?? "");
        const labelValue = String(label?.value ?? label?.name ?? "");
        if (projectId && labelValue) {
          await pool.query(
            `INSERT INTO companycam_project_labels (companycam_project_id, label_value)
             VALUES ($1, $2)
             ON CONFLICT (companycam_project_id, label_value) DO NOTHING`,
            [projectId, labelValue]
          );
        }
      }

      else {
        console.log(`[companycam] Unhandled event type '${eventType}' — ignoring`);
      }

      // Always return 200 — idempotent on duplicate ingest.
      return res.status(200).json({ received: true });
    } catch (err: any) {
      console.error("[companycam] Webhook processing error:", err.message ?? err);
      return res.status(500).json({ error: "Internal error processing webhook" });
    }
  });
}
