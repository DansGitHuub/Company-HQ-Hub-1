import type { Express } from "express";
import { pool } from "./db";
import crypto from "crypto";

function canMessage(senderRole: string, recipientRole: string): boolean {
  switch (senderRole) {
    case "Admin":
    case "Manager":
      return true;
    case "Crew":
      return ["Admin", "Manager", "Crew"].includes(recipientRole);
    case "Customer":
      return ["Admin", "Manager"].includes(recipientRole);
    default:
      return false;
  }
}

function allowedRoles(senderRole: string): string[] {
  switch (senderRole) {
    case "Admin":
    case "Manager":
      return ["Admin", "Manager", "Crew", "Customer"];
    case "Crew":
      return ["Admin", "Manager", "Crew"];
    case "Customer":
      return ["Admin", "Manager"];
    default:
      return [];
  }
}

// Shared CTE query for conversations list
async function getConversations(userId: string, folder: string) {
  const { rows } = await pool.query(
    `WITH last_msg AS (
       SELECT DISTINCT ON (
         CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END
       )
         CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS other_id,
         id, body, sent_at, sender_id, read_at, job_id, task_id
       FROM direct_messages
       WHERE (sender_id = $1 AND deleted_by_sender = FALSE)
          OR (recipient_id = $1 AND deleted_by_recipient = FALSE)
       ORDER BY
         CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END,
         sent_at DESC
     ),
     starred_check AS (
       SELECT
         CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS other_id,
         BOOL_OR(CASE WHEN sender_id = $1 THEN starred_by_sender ELSE starred_by_recipient END) AS is_starred,
         BOOL_OR(CASE WHEN sender_id = $1 THEN archived_by_sender ELSE archived_by_recipient END) AS is_archived
       FROM direct_messages
       WHERE (sender_id = $1 AND deleted_by_sender = FALSE)
          OR (recipient_id = $1 AND deleted_by_recipient = FALSE)
       GROUP BY other_id
     ),
     unread_counts AS (
       SELECT sender_id AS other_id, COUNT(*) AS cnt
       FROM direct_messages
       WHERE recipient_id = $1
         AND read_at IS NULL
         AND deleted_by_recipient = FALSE
       GROUP BY sender_id
     )
     SELECT
       u.id             AS other_user_id,
       u.name           AS other_user_name,
       u.role           AS other_user_role,
       u.profile_picture AS other_user_picture,
       lm.body          AS last_message,
       lm.sent_at       AS last_message_at,
       lm.sender_id     AS last_sender_id,
       lm.read_at       AS last_read_at,
       COALESCE(sc.is_starred,  FALSE) AS is_starred,
       COALESCE(sc.is_archived, FALSE) AS is_archived,
       COALESCE(uc.cnt, 0)             AS unread_count,
       lm.job_id,
       lm.task_id,
       j.client         AS job_title,
       t.title          AS task_title
     FROM last_msg lm
     JOIN users u ON u.id = lm.other_id
     LEFT JOIN starred_check sc ON sc.other_id = lm.other_id
     LEFT JOIN unread_counts uc ON uc.other_id = lm.other_id
     LEFT JOIN jobs j  ON j.id  = lm.job_id
     LEFT JOIN tasks t ON t.id  = lm.task_id
     ORDER BY lm.sent_at DESC`,
    [userId]
  );

  switch (folder) {
    case "sent":
      return rows.filter((r) => !r.is_archived && r.last_sender_id === userId);
    case "starred":
      return rows.filter((r) => r.is_starred);
    case "archive":
      return rows.filter((r) => r.is_archived);
    default: // inbox
      return rows.filter((r) => !r.is_archived);
  }
}

export function registerDirectMessageRoutes(app: Express, requireAuth: any) {

  // ── GET /api/dm/inbox ────────────────────────────────────────────────────────
  // Messages where I am recipient, not archived, not deleted, newest first
  app.get("/api/dm/inbox", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { rows } = await pool.query(
        `SELECT
           m.id, m.sender_id, m.recipient_id, m.subject, m.body,
           m.sent_at, m.read_at,
           m.starred_by_recipient AS is_starred,
           m.archived_by_recipient AS is_archived,
           s.name AS sender_name, s.role AS sender_role, s.profile_picture AS sender_picture
         FROM direct_messages m
         JOIN users s ON s.id = m.sender_id
         WHERE m.recipient_id = $1
           AND m.deleted_by_recipient = FALSE
           AND m.archived_by_recipient = FALSE
         ORDER BY m.sent_at DESC`,
        [me]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/dm/sent ─────────────────────────────────────────────────────────
  // Messages I sent, not deleted by me, newest first
  app.get("/api/dm/sent", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { rows } = await pool.query(
        `SELECT
           m.id, m.sender_id, m.recipient_id, m.subject, m.body,
           m.sent_at, m.read_at,
           m.starred_by_sender AS is_starred,
           m.archived_by_sender AS is_archived,
           r.name AS recipient_name, r.role AS recipient_role, r.profile_picture AS recipient_picture
         FROM direct_messages m
         JOIN users r ON r.id = m.recipient_id
         WHERE m.sender_id = $1
           AND m.deleted_by_sender = FALSE
         ORDER BY m.sent_at DESC`,
        [me]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/dm/starred ──────────────────────────────────────────────────────
  // Messages starred by me (as sender or recipient), newest first
  app.get("/api/dm/starred", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { rows } = await pool.query(
        `SELECT
           m.id, m.sender_id, m.recipient_id, m.subject, m.body,
           m.sent_at, m.read_at,
           s.name AS sender_name, s.role AS sender_role, s.profile_picture AS sender_picture,
           r.name AS recipient_name, r.role AS recipient_role, r.profile_picture AS recipient_picture,
           CASE WHEN m.sender_id = $1 THEN m.starred_by_sender ELSE m.starred_by_recipient END AS is_starred
         FROM direct_messages m
         JOIN users s ON s.id = m.sender_id
         JOIN users r ON r.id = m.recipient_id
         WHERE (m.sender_id = $1 AND m.starred_by_sender = TRUE AND m.deleted_by_sender = FALSE)
            OR (m.recipient_id = $1 AND m.starred_by_recipient = TRUE AND m.deleted_by_recipient = FALSE)
         ORDER BY m.sent_at DESC`,
        [me]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/dm/archive ──────────────────────────────────────────────────────
  // Messages archived by me (as sender or recipient), newest first
  app.get("/api/dm/archive", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { rows } = await pool.query(
        `SELECT
           m.id, m.sender_id, m.recipient_id, m.subject, m.body,
           m.sent_at, m.read_at,
           s.name AS sender_name, s.role AS sender_role, s.profile_picture AS sender_picture,
           r.name AS recipient_name, r.role AS recipient_role, r.profile_picture AS recipient_picture
         FROM direct_messages m
         JOIN users s ON s.id = m.sender_id
         JOIN users r ON r.id = m.recipient_id
         WHERE (m.sender_id = $1 AND m.archived_by_sender = TRUE AND m.deleted_by_sender = FALSE)
            OR (m.recipient_id = $1 AND m.archived_by_recipient = TRUE AND m.deleted_by_recipient = FALSE)
         ORDER BY m.sent_at DESC`,
        [me]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/dm/messageable-users ───────────────────────────────────────────
  app.get("/api/dm/messageable-users", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const myRole: string = (req.user as any).role ?? "";
      const allowed = allowedRoles(myRole);
      if (!allowed.length) return res.json([]);
      const placeholders = allowed.map((_, i) => `$${i + 2}`).join(", ");
      const { rows } = await pool.query(
        `SELECT id, name, role, profile_picture
         FROM users
         WHERE id != $1 AND is_active = TRUE AND role IN (${placeholders})
         ORDER BY name`,
        [me, ...allowed]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/dm/unread-count ─────────────────────────────────────────────────
  app.get("/api/dm/unread-count", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS count
         FROM direct_messages
         WHERE recipient_id = $1 AND read_at IS NULL AND deleted_by_recipient = FALSE`,
        [me]
      );
      res.json({ count: parseInt(rows[0].count) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/dm/search?q= ────────────────────────────────────────────────────
  app.get("/api/dm/search", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const q = ((req.query.q as string) || "").trim().toLowerCase();
      if (!q) return res.json([]);
      const like = `%${q}%`;
      const { rows } = await pool.query(
        `WITH matched AS (
           SELECT
             m.id,
             m.sender_id,
             m.recipient_id,
             m.body,
             m.subject,
             m.sent_at,
             m.read_at,
             CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END AS other_id,
             u_s.name   AS sender_name,   u_s.role   AS sender_role,   u_s.profile_picture AS sender_picture,
             u_r.name   AS recipient_name, u_r.role  AS recipient_role, u_r.profile_picture AS recipient_picture,
             CASE WHEN m.sender_id = $1 THEN m.starred_by_sender   ELSE m.starred_by_recipient   END AS is_starred,
             CASE WHEN m.sender_id = $1 THEN m.archived_by_sender  ELSE m.archived_by_recipient  END AS is_archived
           FROM direct_messages m
           JOIN users u_s ON u_s.id = m.sender_id
           JOIN users u_r ON u_r.id = m.recipient_id
           WHERE (
             (m.sender_id    = $1 AND m.deleted_by_sender    = FALSE)
             OR (m.recipient_id = $1 AND m.deleted_by_recipient = FALSE)
           )
           AND (
             LOWER(m.body)        LIKE $2
             OR LOWER(m.subject)  LIKE $2
             OR LOWER(u_s.name)   LIKE $2
             OR LOWER(u_r.name)   LIKE $2
           )
         )
         SELECT DISTINCT ON (other_id)
           other_id                                                                    AS other_user_id,
           CASE WHEN sender_id = $1 THEN recipient_name  ELSE sender_name  END        AS other_user_name,
           CASE WHEN sender_id = $1 THEN recipient_role  ELSE sender_role  END        AS other_user_role,
           CASE WHEN sender_id = $1 THEN recipient_picture ELSE sender_picture END    AS other_user_picture,
           SUBSTRING(body, 1, 120)                                                    AS last_message,
           sent_at                                                                    AS last_message_at,
           sender_id                                                                  AS last_sender_id,
           read_at                                                                    AS last_read_at,
           is_starred,
           is_archived,
           0                                                                          AS unread_count
         FROM matched
         ORDER BY other_id, sent_at DESC`,
        [me, like]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/dm/conversations?folder=inbox|sent|starred|archive ──────────────
  app.get("/api/dm/conversations", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const folder = (req.query.folder as string) || "inbox";
      const rows = await getConversations(me, folder);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/dm/conversation/:userId ─────────────────────────────────────────
  app.get("/api/dm/conversation/:userId", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const other = req.params.userId;

      const { rows } = await pool.query(
        `SELECT
           m.id, m.sender_id, m.recipient_id, m.subject, m.body,
           m.sent_at, m.read_at,
           m.job_id, m.task_id,
           j.client  AS job_title,
           t.title   AS task_title,
           s.name AS sender_name, s.role AS sender_role, s.profile_picture AS sender_picture,
           r.name AS recipient_name, r.role AS recipient_role, r.profile_picture AS recipient_picture,
           COALESCE(
             (SELECT json_agg(json_build_object(
               'id',       a.id,
               'fileName', a.file_name,
               'fileSize', a.file_size,
               'mimeType', a.mime_type
             ) ORDER BY a.created_at)
             FROM message_attachments a WHERE a.message_id = m.id),
             '[]'::json
           ) AS attachments
         FROM direct_messages m
         JOIN users s ON s.id = m.sender_id
         JOIN users r ON r.id = m.recipient_id
         LEFT JOIN jobs j  ON j.id  = m.job_id
         LEFT JOIN tasks t ON t.id  = m.task_id
         WHERE (m.sender_id = $1 AND m.recipient_id = $2 AND m.deleted_by_sender = FALSE)
            OR (m.sender_id = $2 AND m.recipient_id = $1 AND m.deleted_by_recipient = FALSE)
         ORDER BY m.sent_at ASC`,
        [me, other]
      );

      // Mark received unread messages as read
      const unreadIds = rows.filter((r) => r.recipient_id === me && !r.read_at).map((r) => r.id);
      if (unreadIds.length > 0) {
        await pool.query(
          `UPDATE direct_messages SET read_at = NOW()
           WHERE id = ANY($1::varchar[])`,
          [unreadIds]
        );
        await pool.query(
          `UPDATE message_notifications SET seen = TRUE
           WHERE message_id = ANY($1::varchar[]) AND user_id = $2`,
          [unreadIds, me]
        );
        rows.forEach((r) => { if (unreadIds.includes(r.id)) r.read_at = new Date().toISOString(); });
      }

      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/dm/conversation/:userId/export ───────────────────────────────────
  app.get("/api/dm/conversation/:userId/export", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const other = req.params.userId;

      const { rows: msgs } = await pool.query(
        `SELECT
           m.sent_at, m.subject, m.body,
           s.name AS sender_name,
           r.name AS recipient_name
         FROM direct_messages m
         JOIN users s ON s.id = m.sender_id
         JOIN users r ON r.id = m.recipient_id
         WHERE (m.sender_id = $1 AND m.recipient_id = $2 AND m.deleted_by_sender = FALSE)
            OR (m.sender_id = $2 AND m.recipient_id = $1 AND m.deleted_by_recipient = FALSE)
         ORDER BY m.sent_at ASC`,
        [me, other]
      );

      const { rows: userRows } = await pool.query(
        `SELECT name FROM users WHERE id = $1`,
        [other]
      );
      const otherName = userRows[0]?.name ?? "Unknown";

      const lines: string[] = [
        `Conversation with: ${otherName}`,
        `Exported: ${new Date().toLocaleString()}`,
        "=".repeat(60),
        "",
      ];

      for (const m of msgs) {
        const ts = new Date(m.sent_at).toLocaleString();
        const subj = m.subject ? `[${m.subject}] ` : "";
        lines.push(`${ts} — ${m.sender_name}`);
        if (m.subject) lines.push(`Subject: ${m.subject}`);
        const plainBody = (m.body as string)
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .trim();
        lines.push(plainBody);
        lines.push("");
      }

      const filename = `conversation-${otherName.replace(/\s+/g, "-")}-${Date.now()}.txt`;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      res.send(lines.join("\n"));
    } catch (err: any) {
      console.error("[dm/export] error:", err.message);
      if (!res.headersSent) res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/dm ─────────────────────────────────────────────────────────────
  app.post("/api/dm", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const myRole: string = (req.user as any).role ?? "";
      const { recipientId, subject, body } = req.body;

      if (!recipientId) return res.status(400).json({ message: "recipientId required" });
      if (!body?.trim()) return res.status(400).json({ message: "body required" });

      const { rows: recipRows } = await pool.query(
        `SELECT id, role FROM users WHERE id = $1 AND is_active = TRUE`,
        [recipientId]
      );
      if (!recipRows.length) return res.status(404).json({ message: "Recipient not found" });
      if (!canMessage(myRole, recipRows[0].role)) {
        return res.status(403).json({ message: "You are not allowed to message this user" });
      }

      const { rows } = await pool.query(
        `INSERT INTO direct_messages (id, sender_id, recipient_id, subject, body)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)
         RETURNING id, sender_id, recipient_id, subject, body, sent_at, read_at`,
        [me, recipientId, subject?.trim() || null, body.trim()]
      );
      const msg = rows[0];

      await pool.query(
        `INSERT INTO message_notifications (id, user_id, message_id, seen)
         VALUES (gen_random_uuid(), $1, $2, FALSE)`,
        [recipientId, msg.id]
      );

      res.status(201).json(msg);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH /api/dm/:id/link ───────────────────────────────────────────────────
  // Link / unlink an entire conversation (all msgs between the two users) to a job or task
  app.patch("/api/dm/:id/link", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { id } = req.params;

      const { rows: msgRows } = await pool.query(
        `SELECT sender_id, recipient_id FROM direct_messages WHERE id = $1`,
        [id]
      );
      if (!msgRows.length) return res.status(404).json({ message: "Message not found" });
      const { sender_id, recipient_id } = msgRows[0];
      if (sender_id !== me && recipient_id !== me) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updates: string[] = [];
      const params: any[] = [];
      if ("jobId" in req.body) {
        updates.push(`job_id = $${params.length + 1}`);
        params.push(req.body.jobId || null);
      }
      if ("taskId" in req.body) {
        updates.push(`task_id = $${params.length + 1}`);
        params.push(req.body.taskId || null);
      }
      if (!updates.length) return res.status(400).json({ message: "No fields to update" });

      // Apply to ALL messages between these two users
      const p1 = params.length + 1;
      const p2 = params.length + 2;
      await pool.query(
        `UPDATE direct_messages SET ${updates.join(", ")}
         WHERE (sender_id = $${p1} AND recipient_id = $${p2})
            OR (sender_id = $${p2} AND recipient_id = $${p1})`,
        [...params, sender_id, recipient_id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/dm/by-job/:jobId ─────────────────────────────────────────────────
  // All messages linked to a job (for the Job detail Messages tab)
  app.get("/api/dm/by-job/:jobId", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { rows } = await pool.query(
        `SELECT
           m.id, m.sender_id, m.recipient_id, m.subject, m.body, m.sent_at, m.read_at,
           m.job_id, m.task_id,
           s.name AS sender_name, s.role AS sender_role, s.profile_picture AS sender_picture,
           r.name AS recipient_name, r.role AS recipient_role
         FROM direct_messages m
         JOIN users s ON s.id = m.sender_id
         JOIN users r ON r.id = m.recipient_id
         WHERE m.job_id = $1
         ORDER BY m.sent_at DESC`,
        [jobId]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/dm/by-task/:taskId ───────────────────────────────────────────────
  // All messages linked to a task (for the Task detail Messages section)
  app.get("/api/dm/by-task/:taskId", requireAuth, async (req, res) => {
    try {
      const { taskId } = req.params;
      const { rows } = await pool.query(
        `SELECT
           m.id, m.sender_id, m.recipient_id, m.subject, m.body, m.sent_at, m.read_at,
           m.job_id, m.task_id,
           s.name AS sender_name, s.role AS sender_role, s.profile_picture AS sender_picture,
           r.name AS recipient_name, r.role AS recipient_role
         FROM direct_messages m
         JOIN users s ON s.id = m.sender_id
         JOIN users r ON r.id = m.recipient_id
         WHERE m.task_id = $1
         ORDER BY m.sent_at DESC`,
        [taskId]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH /api/dm/:id/star ───────────────────────────────────────────────────
  // Toggle star on a single message for the current user
  app.patch("/api/dm/:id/star", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { id } = req.params;

      const { rows } = await pool.query(
        `SELECT sender_id, recipient_id, starred_by_sender, starred_by_recipient
         FROM direct_messages WHERE id = $1`,
        [id]
      );
      if (!rows.length) return res.status(404).json({ message: "Not found" });

      const { sender_id, recipient_id, starred_by_sender, starred_by_recipient } = rows[0];
      if (sender_id !== me && recipient_id !== me) {
        return res.status(403).json({ message: "Forbidden" });
      }

      let starred: boolean;
      if (sender_id === me) {
        starred = !starred_by_sender;
        await pool.query(`UPDATE direct_messages SET starred_by_sender = $1 WHERE id = $2`, [starred, id]);
      } else {
        starred = !starred_by_recipient;
        await pool.query(`UPDATE direct_messages SET starred_by_recipient = $1 WHERE id = $2`, [starred, id]);
      }

      res.json({ starred });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH /api/dm/:id/archive ────────────────────────────────────────────────
  // Toggle archive on a single message for the current user
  app.patch("/api/dm/:id/archive", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { id } = req.params;

      const { rows } = await pool.query(
        `SELECT sender_id, recipient_id, archived_by_sender, archived_by_recipient
         FROM direct_messages WHERE id = $1`,
        [id]
      );
      if (!rows.length) return res.status(404).json({ message: "Not found" });

      const { sender_id, recipient_id, archived_by_sender, archived_by_recipient } = rows[0];
      if (sender_id !== me && recipient_id !== me) {
        return res.status(403).json({ message: "Forbidden" });
      }

      let archived: boolean;
      if (sender_id === me) {
        archived = !archived_by_sender;
        await pool.query(`UPDATE direct_messages SET archived_by_sender = $1 WHERE id = $2`, [archived, id]);
      } else {
        archived = !archived_by_recipient;
        await pool.query(`UPDATE direct_messages SET archived_by_recipient = $1 WHERE id = $2`, [archived, id]);
      }

      res.json({ archived });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH /api/dm/:id/unread ─────────────────────────────────────────────────
  // Mark a received message as unread by setting read_at = NULL
  app.patch("/api/dm/:id/unread", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { id } = req.params;

      const { rows } = await pool.query(
        `SELECT sender_id, recipient_id FROM direct_messages WHERE id = $1`,
        [id]
      );
      if (!rows.length) return res.status(404).json({ message: "Not found" });
      if (rows[0].recipient_id !== me) {
        return res.status(403).json({ message: "Can only mark received messages as unread" });
      }

      await pool.query(`UPDATE direct_messages SET read_at = NULL WHERE id = $1`, [id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH /api/dm/conversation/:userId/star ──────────────────────────────────
  app.patch("/api/dm/conversation/:userId/star", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const other = req.params.userId;

      // Check current star state (any message starred by me)
      const { rows: check } = await pool.query(
        `SELECT BOOL_OR(CASE WHEN sender_id = $1 THEN starred_by_sender ELSE starred_by_recipient END) AS is_starred
         FROM direct_messages
         WHERE (sender_id = $1 AND recipient_id = $2 AND deleted_by_sender = FALSE)
            OR (sender_id = $2 AND recipient_id = $1 AND deleted_by_recipient = FALSE)`,
        [me, other]
      );
      const newStar = !check[0]?.is_starred;

      await pool.query(
        `UPDATE direct_messages SET starred_by_sender = $3
         WHERE sender_id = $1 AND recipient_id = $2 AND deleted_by_sender = FALSE`,
        [me, other, newStar]
      );
      await pool.query(
        `UPDATE direct_messages SET starred_by_recipient = $3
         WHERE sender_id = $2 AND recipient_id = $1 AND deleted_by_recipient = FALSE`,
        [me, other, newStar]
      );

      res.json({ starred: newStar });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH /api/dm/conversation/:userId/archive ───────────────────────────────
  app.patch("/api/dm/conversation/:userId/archive", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const other = req.params.userId;

      const { rows: check } = await pool.query(
        `SELECT BOOL_OR(CASE WHEN sender_id = $1 THEN archived_by_sender ELSE archived_by_recipient END) AS is_archived
         FROM direct_messages
         WHERE (sender_id = $1 AND recipient_id = $2 AND deleted_by_sender = FALSE)
            OR (sender_id = $2 AND recipient_id = $1 AND deleted_by_recipient = FALSE)`,
        [me, other]
      );
      const newArchive = !check[0]?.is_archived;

      await pool.query(
        `UPDATE direct_messages SET archived_by_sender = $3
         WHERE sender_id = $1 AND recipient_id = $2 AND deleted_by_sender = FALSE`,
        [me, other, newArchive]
      );
      await pool.query(
        `UPDATE direct_messages SET archived_by_recipient = $3
         WHERE sender_id = $2 AND recipient_id = $1 AND deleted_by_recipient = FALSE`,
        [me, other, newArchive]
      );

      res.json({ archived: newArchive });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH /api/dm/conversation/:userId/unread ────────────────────────────────
  app.patch("/api/dm/conversation/:userId/unread", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const other = req.params.userId;

      // Set read_at = NULL on the most recent message received from other
      await pool.query(
        `UPDATE direct_messages SET read_at = NULL
         WHERE id = (
           SELECT id FROM direct_messages
           WHERE sender_id = $2 AND recipient_id = $1 AND deleted_by_recipient = FALSE
           ORDER BY sent_at DESC LIMIT 1
         )`,
        [me, other]
      );

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/dm/:id/attachments ─────────────────────────────────────────────
  app.post("/api/dm/:id/attachments", requireAuth, async (req: any, res) => {
    try {
      const me = req.user!.id;
      const messageId = req.params.id;

      // Verify message exists and user is the sender
      const { rows: msgRows } = await pool.query(
        `SELECT sender_id FROM direct_messages WHERE id = $1`,
        [messageId]
      );
      if (!msgRows.length) return res.status(404).json({ message: "Message not found" });
      if (msgRows[0].sender_id !== me) return res.status(403).json({ message: "Forbidden" });

      const multer = (await import("multer")).default;
      const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }).single("file");
      await new Promise<void>((resolve, reject) => upload(req, res, (err: any) => err ? reject(err) : resolve()));

      const file: Express.Multer.File = (req as any).file;
      if (!file) return res.status(400).json({ message: "No file provided" });

      const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
      if (!privateDir) return res.status(500).json({ message: "Object storage not configured" });

      const fileId = crypto.randomUUID();
      const ext = file.originalname.includes(".")
        ? "." + file.originalname.split(".").pop()!.toLowerCase()
        : "";
      const objectPath = `${privateDir}/dm-attachments/${fileId}${ext}`;
      const storageKey = `/objects/dm-attachments/${fileId}${ext}`;
      const pathParts = objectPath.startsWith("/") ? objectPath.slice(1).split("/") : objectPath.split("/");
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");

      const SIDECAR = "http://127.0.0.1:1106";
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
      if (!signRes.ok) return res.status(500).json({ message: "Failed to get upload URL" });
      const { signed_url } = await signRes.json() as { signed_url: string };

      const uploadRes = await fetch(signed_url, {
        method: "PUT",
        headers: { "Content-Type": file.mimetype || "application/octet-stream" },
        body: file.buffer,
      });
      if (!uploadRes.ok) return res.status(500).json({ message: "Failed to upload file to storage" });

      const { rows } = await pool.query(
        `INSERT INTO message_attachments (id, message_id, file_name, file_size, mime_type, storage_key)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
         RETURNING id, file_name AS "fileName", file_size AS "fileSize", mime_type AS "mimeType"`,
        [messageId, file.originalname, file.size, file.mimetype || "application/octet-stream", storageKey]
      );

      res.status(201).json({ ...rows[0], url: `/api/dm/attachments/${rows[0].id}/download` });
    } catch (err: any) {
      console.error("[dm/attachments] upload error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/dm/attachments/:attachmentId/download ────────────────────────────
  app.get("/api/dm/attachments/:attachmentId/download", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { attachmentId } = req.params;

      const { rows } = await pool.query(
        `SELECT a.id, a.file_name, a.mime_type, a.storage_key,
                m.sender_id, m.recipient_id
         FROM message_attachments a
         JOIN direct_messages m ON m.id = a.message_id
         WHERE a.id = $1`,
        [attachmentId]
      );
      if (!rows.length) return res.status(404).json({ message: "Attachment not found" });

      const att = rows[0];
      if (att.sender_id !== me && att.recipient_id !== me) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
      const svc = new ObjectStorageService();
      const objectFile = await svc.getObjectEntityFile(att.storage_key);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(att.file_name)}"`);
      res.setHeader("Content-Type", att.mime_type || "application/octet-stream");
      await svc.downloadObject(objectFile, res);
    } catch (err: any) {
      console.error("[dm/attachments] download error:", err.message);
      if (!res.headersSent) res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE /api/dm/:id ───────────────────────────────────────────────────────
  app.delete("/api/dm/:id", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { id } = req.params;

      const { rows } = await pool.query(
        `SELECT sender_id, recipient_id FROM direct_messages WHERE id = $1`,
        [id]
      );
      if (!rows.length) return res.status(404).json({ message: "Not found" });

      const { sender_id, recipient_id } = rows[0];
      if (sender_id !== me && recipient_id !== me) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (sender_id === me) {
        await pool.query(`UPDATE direct_messages SET deleted_by_sender = TRUE WHERE id = $1`, [id]);
      } else {
        await pool.query(`UPDATE direct_messages SET deleted_by_recipient = TRUE WHERE id = $1`, [id]);
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/dm/folders ───────────────────────────────────────────────────────
  app.get("/api/dm/folders", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { rows } = await pool.query(
        `SELECT id, name, color, created_at FROM message_folders WHERE user_id = $1 ORDER BY created_at ASC`,
        [me]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/dm/folders ──────────────────────────────────────────────────────
  app.post("/api/dm/folders", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { name, color } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Name required" });
      const { rows } = await pool.query(
        `INSERT INTO message_folders (id, user_id, name, color)
         VALUES (gen_random_uuid(), $1, $2, $3)
         RETURNING id, name, color, created_at`,
        [me, name.trim(), color || "#6366f1"]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH /api/dm/folders/:id ─────────────────────────────────────────────────
  app.patch("/api/dm/folders/:id", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { id } = req.params;
      const { name, color } = req.body;
      const updates: string[] = [];
      const params: any[] = [];
      if (name !== undefined) { updates.push(`name = $${params.length + 1}`); params.push(name.trim()); }
      if (color !== undefined) { updates.push(`color = $${params.length + 1}`); params.push(color); }
      if (!updates.length) return res.status(400).json({ message: "No updates" });
      params.push(id, me);
      const { rowCount } = await pool.query(
        `UPDATE message_folders SET ${updates.join(", ")} WHERE id = $${params.length - 1} AND user_id = $${params.length}`,
        params
      );
      if (!rowCount) return res.status(404).json({ message: "Folder not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE /api/dm/folders/:id ────────────────────────────────────────────────
  app.delete("/api/dm/folders/:id", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { id } = req.params;
      await pool.query(`DELETE FROM message_folders WHERE id = $1 AND user_id = $2`, [id, me]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/dm/folders/:id/conversations ────────────────────────────────────
  app.post("/api/dm/folders/:id/conversations", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { id: folderId } = req.params;
      const { conversationPartnerId } = req.body;
      if (!conversationPartnerId) return res.status(400).json({ message: "conversationPartnerId required" });

      const { rows: folderRows } = await pool.query(
        `SELECT id FROM message_folders WHERE id = $1 AND user_id = $2`, [folderId, me]
      );
      if (!folderRows.length) return res.status(404).json({ message: "Folder not found" });

      await pool.query(
        `INSERT INTO message_folder_items (id, folder_id, conversation_partner_id, user_id)
         VALUES (gen_random_uuid(), $1, $2, $3)
         ON CONFLICT (folder_id, conversation_partner_id, user_id) DO NOTHING`,
        [folderId, conversationPartnerId, me]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE /api/dm/folders/:id/conversations/:partnerId ───────────────────────
  app.delete("/api/dm/folders/:id/conversations/:partnerId", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { id: folderId, partnerId } = req.params;
      await pool.query(
        `DELETE FROM message_folder_items WHERE folder_id = $1 AND conversation_partner_id = $2 AND user_id = $3`,
        [folderId, partnerId, me]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/dm/folders/:id/conversations ─────────────────────────────────────
  // Same shape as inbox — filtered to conversations in this folder
  app.get("/api/dm/folders/:id/conversations", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { id: folderId } = req.params;
      const { rows } = await pool.query(
        `WITH last_msg AS (
           SELECT DISTINCT ON (
             CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END
           )
             CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS other_id,
             id, body, sent_at, sender_id, read_at, job_id, task_id
           FROM direct_messages
           WHERE (sender_id = $1 AND deleted_by_sender = FALSE)
              OR (recipient_id = $1 AND deleted_by_recipient = FALSE)
           ORDER BY
             CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END,
             sent_at DESC
         ),
         starred_check AS (
           SELECT
             CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS other_id,
             BOOL_OR(CASE WHEN sender_id = $1 THEN starred_by_sender ELSE starred_by_recipient END) AS is_starred,
             BOOL_OR(CASE WHEN sender_id = $1 THEN archived_by_sender ELSE archived_by_recipient END) AS is_archived
           FROM direct_messages
           WHERE (sender_id = $1 AND deleted_by_sender = FALSE)
              OR (recipient_id = $1 AND deleted_by_recipient = FALSE)
           GROUP BY other_id
         ),
         unread_counts AS (
           SELECT sender_id AS other_id, COUNT(*) AS cnt
           FROM direct_messages
           WHERE recipient_id = $1
             AND read_at IS NULL
             AND deleted_by_recipient = FALSE
           GROUP BY sender_id
         )
         SELECT
           u.id             AS other_user_id,
           u.name           AS other_user_name,
           u.role           AS other_user_role,
           u.profile_picture AS other_user_picture,
           lm.body          AS last_message,
           lm.sent_at       AS last_message_at,
           lm.sender_id     AS last_sender_id,
           lm.read_at       AS last_read_at,
           COALESCE(sc.is_starred,  FALSE) AS is_starred,
           COALESCE(sc.is_archived, FALSE) AS is_archived,
           COALESCE(uc.cnt, 0)             AS unread_count,
           lm.job_id, lm.task_id,
           j.client AS job_title, t.title AS task_title
         FROM last_msg lm
         JOIN users u ON u.id = lm.other_id
         JOIN message_folder_items fi
           ON fi.conversation_partner_id = lm.other_id
           AND fi.folder_id = $2
           AND fi.user_id = $1
         LEFT JOIN starred_check sc ON sc.other_id = lm.other_id
         LEFT JOIN unread_counts uc ON uc.other_id = lm.other_id
         LEFT JOIN jobs j  ON j.id  = lm.job_id
         LEFT JOIN tasks t ON t.id  = lm.task_id
         ORDER BY lm.sent_at DESC`,
        [me, folderId]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
