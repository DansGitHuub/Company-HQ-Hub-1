import type { Express } from "express";
import { pool } from "./db";
import crypto from "crypto";

const SIDECAR = "http://127.0.0.1:1106";

export function registerWorksheetPhotoRoutes(app: Express, requireAuth: any) {
  // ── POST /api/worksheets/:sessionId/photos ──────────────────────────────────
  // Accepts multipart/form-data with fields:
  //   photo  — the image file
  //   photo_type — 'before' | 'after' | 'damage' | 'other'
  // Validates that the session belongs to the requesting user, uploads the file
  // to object storage via the sidecar presigned-URL flow, and inserts a row into
  // worksheet_photos.  Returns the new photo row.
  app.post("/api/worksheets/:sessionId/photos", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const sessionId = parseInt(req.params.sessionId, 10);
    if (isNaN(sessionId)) return res.status(400).json({ error: "Invalid session ID" });

    try {
      // Ownership check — worksheet_sessions.employee_id stores the user's id
      const { rows: sessionRows } = await pool.query(
        `SELECT id FROM worksheet_sessions WHERE id = $1 AND employee_id = $2`,
        [sessionId, userId]
      );
      if (!sessionRows.length) {
        return res.status(403).json({ error: "Session not found or access denied" });
      }

      // Parse multipart via multer (memory storage so we have the buffer)
      const multerMod = (await import("multer")).default;
      const upload = multerMod({
        storage: multerMod.memoryStorage(),
        limits: { fileSize: 20 * 1024 * 1024 },
      }).single("photo");
      await new Promise<void>((resolve, reject) =>
        upload(req as any, res as any, (err: any) => (err ? reject(err) : resolve()))
      );

      const file: Express.Multer.File = (req as any).file;
      if (!file) return res.status(400).json({ error: "No photo provided" });

      const photoType: string = ((req as any).body?.photo_type ?? "other").toLowerCase();
      const validTypes = ["before", "after", "damage", "other"];
      if (!validTypes.includes(photoType)) {
        return res.status(400).json({ error: `photo_type must be one of: ${validTypes.join(", ")}` });
      }

      const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
      if (!privateDir) {
        return res.status(500).json({ error: "Object storage not configured" });
      }

      // Build object path
      const fileId = crypto.randomUUID();
      const rawExt = file.originalname.includes(".")
        ? file.originalname.split(".").pop()!.toLowerCase()
        : "jpg";
      const ext = ["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(rawExt) ? rawExt : "jpg";
      const objectPath = `${privateDir}/route-photos/${fileId}.${ext}`;
      const storageKey = `/objects/route-photos/${fileId}.${ext}`;
      const withoutLeadingSlash = objectPath.startsWith("/") ? objectPath.slice(1) : objectPath;
      const pathParts = withoutLeadingSlash.split("/");
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");

      // Get a presigned PUT URL from the sidecar
      const signRes = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket_name: bucketName,
          object_name: objectName,
          method: "PUT",
          expires_at: new Date(Date.now() + 900_000).toISOString(),
        }),
      });
      if (!signRes.ok) {
        return res.status(500).json({ error: "Failed to get upload URL from storage" });
      }
      const { signed_url } = (await signRes.json()) as { signed_url: string };

      // PUT the buffer to object storage
      const putRes = await fetch(signed_url, {
        method: "PUT",
        headers: { "Content-Type": file.mimetype || "image/jpeg" },
        body: file.buffer as any,
      });
      if (!putRes.ok) {
        return res.status(500).json({ error: "Failed to upload photo to storage" });
      }

      // Insert into worksheet_photos — photo_url stores the storage key so the
      // download endpoint can retrieve it; we return the API URL to the client.
      const { rows } = await pool.query(
        `INSERT INTO worksheet_photos (session_id, photo_url, photo_type)
         VALUES ($1, $2, $3)
         RETURNING id, photo_type, created_at`,
        [sessionId, storageKey, photoType]
      );
      const photo = rows[0];

      res.status(201).json({
        id: photo.id,
        photo_type: photo.photo_type,
        photo_url: `/api/worksheets/photos/${photo.id}/download`,
        created_at: photo.created_at,
      });
    } catch (err: any) {
      console.error("[worksheets/photos] upload error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/jobs/:jobId/worksheet-photos ──────────────────────────────────
  // Returns all worksheet photos linked to a job (via worksheet_sessions.job_id).
  // Accessible to any authenticated user who can see the job.
  app.get("/api/jobs/:jobId/worksheet-photos", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT wp.id,
                wp.photo_type,
                wp.created_at,
                COALESCE(u.first_name || ' ' || u.last_name, 'Unknown') AS employee_name
         FROM   worksheet_photos wp
         JOIN   worksheet_sessions ws ON ws.id = wp.session_id
         LEFT   JOIN users u ON u.id::text = ws.employee_id::text
         WHERE  ws.job_id = $1
         ORDER  BY wp.created_at DESC`,
        [req.params.jobId]
      );
      res.json(
        rows.map((r) => ({
          ...r,
          photo_url: `/api/worksheets/photos/${r.id}/download`,
        }))
      );
    } catch (err: any) {
      console.error("[worksheets/photos] job-photos error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/worksheets/photos/:photoId/download ────────────────────────────
  // Streams the photo from object storage to the authenticated user.
  // Only the session owner (or an Admin) may download.
  app.get("/api/worksheets/photos/:photoId/download", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const photoId = parseInt(req.params.photoId, 10);
    if (isNaN(photoId)) return res.status(400).json({ error: "Invalid photo ID" });

    try {
      const { rows } = await pool.query(
        `SELECT wp.id, wp.photo_url, wp.photo_type, ws.employee_id
         FROM   worksheet_photos wp
         JOIN   worksheet_sessions ws ON ws.id = wp.session_id
         WHERE  wp.id = $1`,
        [photoId]
      );
      if (!rows.length) return res.status(404).json({ error: "Photo not found" });

      const photo = rows[0];
      if (photo.employee_id !== userId && (req.user as any).role !== "Admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      const { ObjectStorageService } = await import(
        "./replit_integrations/object_storage/objectStorage"
      );
      const svc = new ObjectStorageService();
      const file = await svc.getObjectEntityFile(photo.photo_url);
      const buffer = Buffer.from(await file.arrayBuffer());

      const ext = (photo.photo_url as string).split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeMap: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        heic: "image/heic",
      };
      res.setHeader("Content-Type", mimeMap[ext] ?? "image/jpeg");
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.send(buffer);
    } catch (err: any) {
      console.error("[worksheets/photos] download error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });
}
