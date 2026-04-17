import type { Express } from "express";
import { pool } from "./db";

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
         id, body, sent_at, sender_id, read_at
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
       COALESCE(uc.cnt, 0)             AS unread_count
     FROM last_msg lm
     JOIN users u ON u.id = lm.other_id
     LEFT JOIN starred_check sc ON sc.other_id = lm.other_id
     LEFT JOIN unread_counts uc ON uc.other_id = lm.other_id
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
           s.name AS sender_name, s.role AS sender_role, s.profile_picture AS sender_picture,
           r.name AS recipient_name, r.role AS recipient_role, r.profile_picture AS recipient_picture
         FROM direct_messages m
         JOIN users s ON s.id = m.sender_id
         JOIN users r ON r.id = m.recipient_id
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
}
