import { Express } from "express";
import { pool } from "./db";
import { requireAuth } from "./auth";

export async function migrateNotesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT,
        body TEXT,
        color TEXT DEFAULT 'default',
        is_pinned BOOLEAN DEFAULT FALSE,
        is_archived BOOLEAN DEFAULT FALSE,
        tags TEXT[] DEFAULT '{}',
        reminder_at TIMESTAMP,
        reminder_sent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("[migration] Notes table ready");
  } catch (err) {
    console.error("[migration] Notes table error:", err);
  }
}

export async function runNoteReminderScheduler() {
  try {
    const due = await pool.query(`
      SELECT n.*, u.id as u_id FROM notes n
      JOIN users u ON n.user_id = u.id
      WHERE n.reminder_at <= NOW()
        AND n.reminder_sent = FALSE
        AND n.is_archived = FALSE
    `);
    for (const note of due.rows) {
      await pool.query(
        `INSERT INTO staff_notifications (id, user_id, type, title, message, link, metadata)
         VALUES (gen_random_uuid(), $1, 'note_reminder', $2, $3, '/dashboard', $4)`,
        [
          note.user_id,
          `Reminder: ${note.title || "Note"}`,
          note.body ? note.body.slice(0, 120) + (note.body.length > 120 ? "…" : "") : "You set a reminder for this note.",
          JSON.stringify({ noteId: note.id }),
        ]
      );
      await pool.query(`UPDATE notes SET reminder_sent = TRUE WHERE id = $1`, [note.id]);
    }
    if (due.rows.length > 0) {
      console.log(`[notes-scheduler] Sent ${due.rows.length} note reminder(s)`);
    }
  } catch (err) {
    console.error("[notes-scheduler] Error:", err);
  }
}

export function registerNotesRoutes(app: Express) {
  app.get("/api/notes", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { archived, pinned, q } = req.query as Record<string, string>;
      const isArchived = archived === "true";
      const isPinned = pinned === "true";

      let rows: any[];
      if (q) {
        const { rows: r } = await pool.query(
          `SELECT * FROM notes WHERE user_id = $1 AND is_archived = $2
           AND (title ILIKE $3 OR body ILIKE $3 OR $3 = ANY(tags))
           ORDER BY is_pinned DESC, updated_at DESC`,
          [userId, false, `%${q}%`]
        );
        rows = r;
      } else if (pinned === "true") {
        const { rows: r } = await pool.query(
          `SELECT * FROM notes WHERE user_id = $1 AND is_pinned = TRUE AND is_archived = FALSE ORDER BY updated_at DESC`,
          [userId]
        );
        rows = r;
      } else {
        const { rows: r } = await pool.query(
          `SELECT * FROM notes WHERE user_id = $1 AND is_archived = $2 ORDER BY is_pinned DESC, updated_at DESC`,
          [userId, isArchived]
        );
        rows = r;
      }
      res.json(rows.map(camelizeNote));
    } catch (err) {
      console.error("[notes] GET error:", err);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { title, body, color, isPinned, tags, reminderAt } = req.body;
      const { rows } = await pool.query(
        `INSERT INTO notes (id, user_id, title, body, color, is_pinned, tags, reminder_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [userId, title || null, body || null, color || "default", isPinned || false,
          tags || [], reminderAt || null]
      );
      res.status(201).json(camelizeNote(rows[0]));
    } catch (err) {
      console.error("[notes] POST error:", err);
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.patch("/api/notes/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { id } = req.params;
      const { title, body, color, isPinned, isArchived, tags, reminderAt } = req.body;

      const existing = await pool.query(`SELECT * FROM notes WHERE id = $1 AND user_id = $2`, [id, userId]);
      if (existing.rows.length === 0) return res.status(404).json({ error: "Note not found" });

      const reminderChanged = reminderAt !== undefined &&
        String(reminderAt) !== String(existing.rows[0].reminder_at);

      const { rows } = await pool.query(
        `UPDATE notes SET
          title = COALESCE($1, title),
          body = COALESCE($2, body),
          color = COALESCE($3, color),
          is_pinned = COALESCE($4, is_pinned),
          is_archived = COALESCE($5, is_archived),
          tags = COALESCE($6, tags),
          reminder_at = $7,
          reminder_sent = CASE WHEN $8 THEN FALSE ELSE reminder_sent END,
          updated_at = NOW()
         WHERE id = $9 AND user_id = $10
         RETURNING *`,
        [title, body, color, isPinned, isArchived, tags,
          reminderAt !== undefined ? reminderAt || null : existing.rows[0].reminder_at,
          reminderChanged, id, userId]
      );
      res.json(camelizeNote(rows[0]));
    } catch (err) {
      console.error("[notes] PATCH error:", err);
      res.status(500).json({ error: "Failed to update note" });
    }
  });

  app.delete("/api/notes/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { id } = req.params;
      await pool.query(`DELETE FROM notes WHERE id = $1 AND user_id = $2`, [id, userId]);
      res.json({ success: true });
    } catch (err) {
      console.error("[notes] DELETE error:", err);
      res.status(500).json({ error: "Failed to delete note" });
    }
  });
}

function camelizeNote(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    color: row.color,
    isPinned: row.is_pinned,
    isArchived: row.is_archived,
    tags: row.tags || [],
    reminderAt: row.reminder_at,
    reminderSent: row.reminder_sent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
