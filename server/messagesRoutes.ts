import type { Express } from "express";
import { pool } from "./db";

async function migrate() {
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

  // List conversations for current user with last message and unread flag
  app.get("/api/dm/conversations", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { rows } = await pool.query(
        `SELECT
           c.id,
           c.last_message_at,
           c.created_at,
           CASE WHEN c.participant1_id = $1 THEN c.participant2_id ELSE c.participant1_id END AS other_user_id,
           u.name AS other_user_name,
           u.role AS other_user_role,
           u.profile_picture AS other_user_picture,
           m.body AS last_message_body,
           m.sender_id AS last_message_sender_id,
           CASE
             WHEN r.last_read_at IS NULL THEN TRUE
             WHEN m.created_at > r.last_read_at AND m.sender_id != $1 THEN TRUE
             ELSE FALSE
           END AS has_unread
         FROM dm_conversations c
         JOIN users u ON u.id = CASE WHEN c.participant1_id = $1 THEN c.participant2_id ELSE c.participant1_id END
         LEFT JOIN LATERAL (
           SELECT body, created_at, sender_id FROM dm_messages
           WHERE conversation_id = c.id
           ORDER BY created_at DESC LIMIT 1
         ) m ON TRUE
         LEFT JOIN dm_reads r ON r.conversation_id = c.id AND r.user_id = $1
         WHERE c.participant1_id = $1 OR c.participant2_id = $1
         ORDER BY c.last_message_at DESC NULLS LAST`,
        [me]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Start or get existing conversation with another user
  app.post("/api/dm/conversations", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { recipientId } = req.body;
      if (!recipientId) return res.status(400).json({ message: "recipientId required" });
      // Always store p1 < p2 lexicographically to enforce uniqueness
      const p1 = me < recipientId ? me : recipientId;
      const p2 = me < recipientId ? recipientId : me;
      await pool.query(
        `INSERT INTO dm_conversations (participant1_id, participant2_id)
         VALUES ($1, $2)
         ON CONFLICT (participant1_id, participant2_id) DO NOTHING`,
        [p1, p2]
      );
      const { rows } = await pool.query(
        `SELECT id FROM dm_conversations WHERE participant1_id = $1 AND participant2_id = $2`,
        [p1, p2]
      );
      res.json({ id: rows[0].id });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get messages in a conversation (last 100)
  app.get("/api/dm/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const convId = parseInt(req.params.id);
      // Verify user is a participant
      const { rows: check } = await pool.query(
        `SELECT id FROM dm_conversations WHERE id = $1 AND (participant1_id = $2 OR participant2_id = $2)`,
        [convId, me]
      );
      if (!check.length) return res.status(403).json({ message: "Not a participant" });
      const { rows } = await pool.query(
        `SELECT m.id, m.body, m.created_at, m.sender_id,
                u.name AS sender_name, u.profile_picture AS sender_picture
         FROM dm_messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.conversation_id = $1
         ORDER BY m.created_at ASC
         LIMIT 100`,
        [convId]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Send a message
  app.post("/api/dm/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const convId = parseInt(req.params.id);
      const { body } = req.body;
      if (!body?.trim()) return res.status(400).json({ message: "body required" });
      // Verify participant
      const { rows: check } = await pool.query(
        `SELECT id FROM dm_conversations WHERE id = $1 AND (participant1_id = $2 OR participant2_id = $2)`,
        [convId, me]
      );
      if (!check.length) return res.status(403).json({ message: "Not a participant" });
      const { rows } = await pool.query(
        `INSERT INTO dm_messages (conversation_id, sender_id, body)
         VALUES ($1, $2, $3) RETURNING id, body, created_at, sender_id`,
        [convId, me, body.trim()]
      );
      // Update last_message_at
      await pool.query(
        `UPDATE dm_conversations SET last_message_at = NOW() WHERE id = $1`,
        [convId]
      );
      // Update read timestamp for sender (so it doesn't show as unread to sender)
      await pool.query(
        `INSERT INTO dm_reads (conversation_id, user_id, last_read_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = NOW()`,
        [convId, me]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Mark conversation as read
  app.post("/api/dm/conversations/:id/read", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const convId = parseInt(req.params.id);
      await pool.query(
        `INSERT INTO dm_reads (conversation_id, user_id, last_read_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = NOW()`,
        [convId, me]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Unread conversation count for current user
  app.get("/api/dm/unread-count", requireAuth, async (req, res) => {
    try {
      const me = req.user!.id;
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS count
         FROM dm_conversations c
         LEFT JOIN LATERAL (
           SELECT created_at, sender_id FROM dm_messages
           WHERE conversation_id = c.id
           ORDER BY created_at DESC LIMIT 1
         ) m ON TRUE
         LEFT JOIN dm_reads r ON r.conversation_id = c.id AND r.user_id = $1
         WHERE (c.participant1_id = $1 OR c.participant2_id = $1)
           AND m.sender_id IS NOT NULL
           AND m.sender_id != $1
           AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)`,
        [me]
      );
      res.json({ count: parseInt(rows[0].count) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
