import type { Express } from "express";
import { pool } from "./db";

async function migrate() {
  // Keep legacy tables intact (do not drop)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dm_conversations (
      id SERIAL PRIMARY KEY,
      participant1_id VARCHAR(36) NOT NULL,
      participant2_id VARCHAR(36) NOT NULL,
      last_message_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(participant1_id, participant2_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dm_messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
      sender_id VARCHAR(36) NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dm_reads (
      conversation_id INTEGER NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      last_read_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (conversation_id, user_id)
    )
  `);

  // Flat direct_messages table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS direct_messages (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject TEXT,
      body TEXT NOT NULL,
      sent_at TIMESTAMP DEFAULT NOW(),
      read_at TIMESTAMP,
      deleted_by_sender BOOLEAN NOT NULL DEFAULT FALSE,
      deleted_by_recipient BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);

  // Notification tracking per message per user
  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_notifications (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id VARCHAR(36) NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
      seen BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log("[migration] DM messaging tables ready");
}

export function registerMessagesRoutes(app: Express, requireAuth: any) {
  migrate().catch(console.error);

  // List all messageable staff users (not self, not customers)
  app.get("/api/dm/users", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { rows } = await pool.query(
        `SELECT id, name, role, profile_picture, email
         FROM users
         WHERE id != $1
           AND is_active = TRUE
           AND role IN ('Admin', 'Manager', 'Crew')
         ORDER BY name`,
        [me]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Inbox: messages received by me, not deleted by me
  app.get("/api/dm/inbox", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { rows } = await pool.query(
        `SELECT
           m.id, m.sender_id, m.recipient_id, m.subject, m.body,
           m.sent_at, m.read_at, m.deleted_by_sender, m.deleted_by_recipient,
           u.name AS sender_name, u.role AS sender_role, u.profile_picture AS sender_picture
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

  // Sent: messages sent by me, not deleted by me
  app.get("/api/dm/sent", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { rows } = await pool.query(
        `SELECT
           m.id, m.sender_id, m.recipient_id, m.subject, m.body,
           m.sent_at, m.read_at, m.deleted_by_sender, m.deleted_by_recipient,
           u.name AS recipient_name, u.role AS recipient_role, u.profile_picture AS recipient_picture
         FROM direct_messages m
         JOIN users u ON u.id = m.recipient_id
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

  // Get a single message and mark it read if I'm the recipient
  app.get("/api/dm/:id", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { id } = req.params;
      const { rows } = await pool.query(
        `SELECT
           m.id, m.sender_id, m.recipient_id, m.subject, m.body,
           m.sent_at, m.read_at, m.deleted_by_sender, m.deleted_by_recipient,
           s.name AS sender_name, s.role AS sender_role, s.profile_picture AS sender_picture,
           r.name AS recipient_name, r.role AS recipient_role, r.profile_picture AS recipient_picture
         FROM direct_messages m
         JOIN users s ON s.id = m.sender_id
         JOIN users r ON r.id = m.recipient_id
         WHERE m.id = $1
           AND (m.sender_id = $2 OR m.recipient_id = $2)`,
        [id, me]
      );
      if (!rows.length) return res.status(404).json({ message: "Not found" });
      const msg = rows[0];
      // Mark as read and mark notification seen if I'm the recipient
      if (msg.recipient_id === me && !msg.read_at) {
        await pool.query(
          `UPDATE direct_messages SET read_at = NOW() WHERE id = $1`,
          [id]
        );
        msg.read_at = new Date().toISOString();
      }
      if (msg.recipient_id === me) {
        await pool.query(
          `UPDATE message_notifications SET seen = TRUE
           WHERE message_id = $1 AND user_id = $2`,
          [id, me]
        );
      }
      res.json(msg);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Compose: send a new message
  app.post("/api/dm", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { recipientId, subject, body } = req.body;
      if (!recipientId) return res.status(400).json({ message: "recipientId required" });
      if (!body?.trim()) return res.status(400).json({ message: "body required" });

      const { rows } = await pool.query(
        `INSERT INTO direct_messages (id, sender_id, recipient_id, subject, body)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)
         RETURNING id, sender_id, recipient_id, subject, body, sent_at, read_at`,
        [me, recipientId, subject?.trim() || null, body.trim()]
      );
      const msg = rows[0];
      // Create a notification for the recipient
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

  // Soft-delete a message
  app.delete("/api/dm/:id", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { id } = req.params;
      const { rows } = await pool.query(
        `SELECT sender_id, recipient_id FROM direct_messages WHERE id = $1`,
        [id]
      );
      if (!rows.length) return res.status(404).json({ message: "Not found" });
      const msg = rows[0];
      if (msg.sender_id !== me && msg.recipient_id !== me) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (msg.sender_id === me) {
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

  // Unread count: unseen notifications for me (excludes messages I've deleted)
  app.get("/api/dm/unread-count", requireAuth, async (req, res) => {
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
}
