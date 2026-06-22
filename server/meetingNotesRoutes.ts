import { Express } from "express";
import { pool } from "./db";

const MGMT_ROLES = ["Admin", "Manager", "Master Admin"];

function requireRole(...roles: string[]) {
  return (req: any, res: any, next: any) => {
    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (!roles.includes(user.role) && !user.isMasterAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

export async function migrateMeetingNotesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meeting_notes (
        id        SERIAL PRIMARY KEY,
        meeting_date DATE NOT NULL,
        title     TEXT NOT NULL,
        attendees TEXT NOT NULL DEFAULT '',
        content   TEXT NOT NULL DEFAULT '',
        created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log("[migration] meeting_notes table ready");
  } catch (err) {
    console.error("[migration] meeting_notes error:", err);
  }
}

export function registerMeetingNotesRoutes(app: Express, requireAuth: any) {
  // GET all notes — any authenticated staff
  app.get("/api/meeting-notes", requireAuth, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT mn.id, mn.meeting_date, mn.title, mn.attendees, mn.content,
               mn.created_at, mn.updated_at, u.name AS created_by_name
        FROM meeting_notes mn
        LEFT JOIN users u ON u.id = mn.created_by
        ORDER BY mn.meeting_date DESC, mn.created_at DESC
      `);
      res.json(result.rows);
    } catch (err: any) {
      console.error("[meeting-notes] GET", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST create — Admin / Manager only
  app.post("/api/meeting-notes", requireAuth, requireRole(...MGMT_ROLES), async (req: any, res) => {
    const { meeting_date, title, attendees, content } = req.body;
    if (!meeting_date || !title) {
      return res.status(400).json({ error: "meeting_date and title are required" });
    }
    try {
      const result = await pool.query(
        `INSERT INTO meeting_notes (meeting_date, title, attendees, content, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [meeting_date, title.trim(), (attendees ?? "").trim(), (content ?? "").trim(), req.user.id]
      );
      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      console.error("[meeting-notes] POST", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH update — Admin / Manager only
  app.patch("/api/meeting-notes/:id", requireAuth, requireRole(...MGMT_ROLES), async (req, res) => {
    const { id } = req.params;
    const { meeting_date, title, attendees, content } = req.body;
    try {
      const result = await pool.query(
        `UPDATE meeting_notes
         SET meeting_date = COALESCE($1, meeting_date),
             title        = COALESCE($2, title),
             attendees    = COALESCE($3, attendees),
             content      = COALESCE($4, content),
             updated_at   = NOW()
         WHERE id = $5
         RETURNING *`,
        [meeting_date ?? null, title ? title.trim() : null, attendees != null ? attendees.trim() : null, content != null ? content.trim() : null, id]
      );
      if (!result.rows.length) return res.status(404).json({ error: "Not found" });
      res.json(result.rows[0]);
    } catch (err: any) {
      console.error("[meeting-notes] PATCH", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE — Admin / Manager only
  app.delete("/api/meeting-notes/:id", requireAuth, requireRole(...MGMT_ROLES), async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(`DELETE FROM meeting_notes WHERE id = $1 RETURNING id`, [id]);
      if (!result.rows.length) return res.status(404).json({ error: "Not found" });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[meeting-notes] DELETE", err.message);
      res.status(500).json({ error: err.message });
    }
  });
}
