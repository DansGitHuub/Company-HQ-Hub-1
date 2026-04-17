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

export function registerMessageRoutes(app: Express, requireAuth: any) {
  // GET /api/users/messageable — users current user is allowed to message
  app.get("/api/users/messageable", requireAuth, async (req, res) => {
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

  // GET /api/direct-messages/unread-count — count unseen notifications for me
  // NOTE: must be registered before /conversation/:userId to avoid route conflicts
  app.get("/api/direct-messages/unread-count", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS count
         FROM message_notifications n
         JOIN direct_messages m ON m.id = n.message_id
         WHERE n.user_id = $1
           AND n.seen = FALSE
           AND m.deleted_by_recipient = FALSE`,
        [me]
      );
      res.json({ count: parseInt(rows[0].count) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/direct-messages/inbox — messages received by me, not deleted, newest first
  app.get("/api/direct-messages/inbox", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { rows } = await pool.query(
        `SELECT
           m.id, m.sender_id, m.recipient_id, m.subject, m.body,
           m.sent_at, m.read_at,
           u.name AS sender_name, u.role AS sender_role,
           u.profile_picture AS sender_picture
         FROM direct_messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.recipient_id = $1
           AND m.deleted_by_recipient = FALSE
         ORDER BY m.sent_at DESC`,
        [me]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/direct-messages/conversation/:userId
  // All messages between me and :userId, oldest first; auto-mark received as read
  app.get("/api/direct-messages/conversation/:userId", requireAuth, async (req, res) => {
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
         WHERE (
           (m.sender_id = $1 AND m.recipient_id = $2 AND m.deleted_by_sender = FALSE)
           OR
           (m.sender_id = $2 AND m.recipient_id = $1 AND m.deleted_by_recipient = FALSE)
         )
         ORDER BY m.sent_at ASC`,
        [me, other]
      );

      // Auto-mark all received messages as read + notifications as seen
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
        // Reflect in response
        rows.forEach((r) => {
          if (unreadIds.includes(r.id)) r.read_at = new Date().toISOString();
        });
      }

      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/direct-messages — send a message
  app.post("/api/direct-messages", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const myRole: string = (req.user as any).role ?? "";
      const { recipientId, subject, body } = req.body;

      if (!recipientId) return res.status(400).json({ message: "recipientId required" });
      if (!body?.trim()) return res.status(400).json({ message: "body required" });

      // Enforce access rules
      const { rows: recipRows } = await pool.query(
        `SELECT role FROM users WHERE id = $1 AND is_active = TRUE`,
        [recipientId]
      );
      if (!recipRows.length) return res.status(404).json({ message: "Recipient not found" });
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

  // DELETE /api/direct-messages/:id — soft delete
  app.delete("/api/direct-messages/:id", requireAuth, async (req, res) => {
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
