import { Express, RequestHandler } from "express";
import { pool } from "./db";

export function registerDailyLogRoutes(app: Express, requireAuth: RequestHandler) {

  // ── Migrate: create daily_logs table ────────────────────────────────────────
  pool.query(`
    CREATE TABLE IF NOT EXISTS daily_logs (
      id           SERIAL PRIMARY KEY,
      job_id       VARCHAR(36) NOT NULL,
      employee_id  VARCHAR(36) NOT NULL,
      log_date     DATE NOT NULL,
      work_description TEXT NOT NULL,
      hours_worked NUMERIC(5,2) NOT NULL DEFAULT 0,
      notes        TEXT,
      created_at   TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `).catch((err: any) => console.error("[dailyLogRoutes] migrate:", err.message));

  // ── GET /api/jobs/:jobId/daily-logs ─────────────────────────────────────────
  app.get("/api/jobs/:jobId/daily-logs", requireAuth, async (req, res) => {
    const { jobId } = req.params;
    try {
      const result = await pool.query(
        `SELECT
           dl.id,
           dl.job_id,
           dl.employee_id,
           u.name       AS employee_name,
           u.username   AS employee_username,
           dl.log_date,
           dl.work_description,
           dl.hours_worked,
           dl.notes,
           dl.created_at
         FROM daily_logs dl
         LEFT JOIN users u ON u.id = dl.employee_id
         WHERE dl.job_id = $1
         ORDER BY dl.log_date DESC, dl.created_at DESC`,
        [jobId]
      );
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/jobs/:jobId/daily-logs ────────────────────────────────────────
  app.post("/api/jobs/:jobId/daily-logs", requireAuth, async (req: any, res) => {
    const { jobId } = req.params;
    const { employee_id, log_date, work_description, hours_worked, notes } = req.body;

    if (!employee_id || !log_date || !work_description) {
      return res.status(400).json({ message: "employee_id, log_date y work_description son obligatorios." });
    }

    try {
      const result = await pool.query(
        `INSERT INTO daily_logs (job_id, employee_id, log_date, work_description, hours_worked, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [jobId, employee_id, log_date, work_description, Number(hours_worked) || 0, notes ?? null]
      );
      const row = result.rows[0];
      // Fetch with employee name
      const full = await pool.query(
        `SELECT dl.*, u.name AS employee_name, u.username AS employee_username
         FROM daily_logs dl LEFT JOIN users u ON u.id = dl.employee_id
         WHERE dl.id = $1`,
        [row.id]
      );
      return res.status(201).json(full.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE /api/daily-logs/:id ──────────────────────────────────────────────
  app.delete("/api/daily-logs/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    const user = req.user;
    const isAdmin = user?.role === "Admin" || user?.role === "Manager" || user?.isMasterAdmin;

    try {
      // Allow deletion only by the owner or admin/manager
      const check = await pool.query(`SELECT employee_id FROM daily_logs WHERE id = $1`, [id]);
      if (check.rowCount === 0) return res.status(404).json({ message: "Registro no encontrado." });

      const ownerId = check.rows[0].employee_id;
      if (!isAdmin && ownerId !== user.id) {
        return res.status(403).json({ message: "No tienes permiso para eliminar este registro." });
      }

      await pool.query(`DELETE FROM daily_logs WHERE id = $1`, [id]);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
