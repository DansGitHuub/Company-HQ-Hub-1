import type { Express } from "express";
import { pool } from "./db";

function allowedRecipientRoles(senderRole: string): string[] {
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

export function registerDirectMessageRoutes(app: Express, requireAuth: any) {
  // ── GET /api/messages/users ─────────────────────────────────────────────────
  // Users the caller is allowed to message (role-filtered)
  app.get("/api/messages/users", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const myRole: string = (req.user as any).role ?? "";
      const allowed = allowedRecipientRoles(myRole);
      if (!allowed.length) return res.json([]);
      const placeholders = allowed.map((_, i) => `$${i + 2}`).join(", ");
      const { rows } = await pool.query(
        `SELECT id, name, role, profile_picture
         FROM users
         WHERE id != $1
           AND is_active = TRUE
           AND role IN (${placeholders})
         ORDER BY name`,
        [me, ...allowed]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/messages/unread-count ──────────────────────────────────────────
  // Count of messages received by me that are unread
  app.get("/api/messages/unread-count", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS count
         FROM direct_messages
         WHERE recipient_id = $1
           AND read_at IS NULL
           AND deleted_by_recipient = FALSE`,
        [me]
      );
      res.json({ count: parseInt(rows[0].count) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/messages/contacts ──────────────────────────────────────────────
  // All unique people I've exchanged messages with (both sent AND received),
  // with last message preview and unread count. This makes conversations
  // visible to BOTH the sender and recipient.
  app.get("/api/messages/contacts", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { rows } = await pool.query(
        `WITH my_contacts AS (
           SELECT DISTINCT
             CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS other_id
           FROM direct_messages
           WHERE (sender_id = $1 AND deleted_by_sender = FALSE)
              OR (recipient_id = $1 AND deleted_by_recipient = FALSE)
         ),
         last_msg AS (
           SELECT DISTINCT ON (
             CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END
           )
             CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS other_id,
             body, sent_at, sender_id
           FROM direct_messages
           WHERE (sender_id = $1 AND deleted_by_sender = FALSE)
              OR (recipient_id = $1 AND deleted_by_recipient = FALSE)
           ORDER BY
             CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END,
             sent_at DESC
         ),
         unread_counts AS (
           SELECT sender_id AS other_id, COUNT(*) AS unread_count
           FROM direct_messages
           WHERE recipient_id = $1
             AND read_at IS NULL
             AND deleted_by_recipient = FALSE
           GROUP BY sender_id
         )
         SELECT
           u.id AS other_user_id,
           u.name AS other_user_name,
           u.role AS other_user_role,
           u.profile_picture AS other_user_picture,
           lm.body AS last_message,
           lm.sent_at AS last_message_at,
           lm.sender_id AS last_sender_id,
           COALESCE(uc.unread_count, 0) AS unread_count
         FROM my_contacts mc
         JOIN users u ON u.id = mc.other_id
         JOIN last_msg lm ON lm.other_id = mc.other_id
         LEFT JOIN unread_counts uc ON uc.other_id = mc.other_id
         ORDER BY lm.sent_at DESC`,
        [me]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/messages/conversation/:userId ──────────────────────────────────
  // Full thread between me and :userId, oldest first.
  // Auto-marks all received unread messages as read.
  app.get("/api/messages/conversation/:userId", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const other = req.params.userId;

      const { rows } = await pool.query(
        `SELECT
           m.id, m.sender_id, m.recipient_id, m.subject, m.body,
           m.sent_at, m.read_at,
           s.name AS sender_name, s.role AS sender_role,
           s.profile_picture AS sender_picture,
           r.name AS recipient_name, r.role AS recipient_role,
           r.profile_picture AS recipient_picture
         FROM direct_messages m
         JOIN users s ON s.id = m.sender_id
         JOIN users r ON r.id = m.recipient_id
         WHERE (
           (m.sender_id = $1 AND m.recipient_id = $2 AND m.deleted_by_sender = FALSE)
           OR
           (m.sender_id = $2 AND m.recipient_id = $1 AND m.deleted_by_recipient = FALSE)
         )
         ORDER BY m.sent_at ASC`,
        [me, other]
      );

      // Mark received messages as read
      const unreadIds = rows
        .filter((r) => r.recipient_id === me && !r.read_at)
        .map((r) => r.id);

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
        rows.forEach((r) => {
          if (unreadIds.includes(r.id)) r.read_at = new Date().toISOString();
        });
      }

      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/messages ──────────────────────────────────────────────────────
  // Send a new message. Enforces access rules. Creates notification row.
  app.post("/api/messages", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const myRole: string = (req.user as any).role ?? "";
      const { recipientId, subject, body } = req.body;

      if (!recipientId) return res.status(400).json({ message: "recipientId required" });
      if (!body?.trim()) return res.status(400).json({ message: "body required" });

      // Enforce access rules
      const { rows: recipRows } = await pool.query(
        `SELECT id, role FROM users WHERE id = $1 AND is_active = TRUE`,
        [recipientId]
      );
      if (!recipRows.length) {
        return res.status(404).json({ message: "Recipient not found" });
      }
      const allowed = allowedRecipientRoles(myRole);
      if (!allowed.includes(recipRows[0].role)) {
        return res.status(403).json({ message: "You are not allowed to message this user" });
      }

      const { rows } = await pool.query(
        `INSERT INTO direct_messages (id, sender_id, recipient_id, subject, body)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)
         RETURNING id, sender_id, recipient_id, subject, body, sent_at, read_at`,
        [me, recipientId, subject?.trim() || null, body.trim()]
      );
      const msg = rows[0];

      // Create notification for recipient
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

  // ── DELETE /api/messages/:id ────────────────────────────────────────────────
  // Soft-delete: sets deleted_by_sender or deleted_by_recipient
  app.delete("/api/messages/:id", requireAuth, async (req, res) => {
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
        await pool.query(
          `UPDATE direct_messages SET deleted_by_sender = TRUE WHERE id = $1`,
          [id]
        );
      } else {
        await pool.query(
          `UPDATE direct_messages SET deleted_by_recipient = TRUE WHERE id = $1`,
          [id]
        );
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
