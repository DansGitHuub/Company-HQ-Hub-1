import { Express } from "express";
import { pool } from "./db";

async function migrateArchive() {
  pool.query(`
    CREATE TABLE IF NOT EXISTS time_entries_archive (
      id INTEGER,
      user_id INTEGER,
      job_id INTEGER,
      clock_in TIMESTAMPTZ,
      clock_out TIMESTAMPTZ,
      duration_minutes INTEGER,
      entry_type TEXT,
      work_area_id INTEGER,
      work_area_name TEXT,
      notes TEXT,
      latitude NUMERIC,
      longitude NUMERIC,
      photo_url TEXT,
      is_manual BOOLEAN,
      qbo_exported_at TIMESTAMPTZ,
      qbo_time_activity_id TEXT,
      qbo_export_error TEXT,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      archived_at TIMESTAMPTZ DEFAULT NOW(),
      archived_by INTEGER
    )
  `).then(() =>
    pool.query(`CREATE INDEX IF NOT EXISTS idx_tea_archived_at ON time_entries_archive (archived_at)`)
  ).then(() =>
    pool.query(`CREATE INDEX IF NOT EXISTS idx_tea_user_id ON time_entries_archive (user_id)`)
  ).catch((err: any) => console.error("[archiveRoutes] migration error:", err.message));
}

migrateArchive();

export function registerArchiveRoutes(app: Express, requireAuth: any, requireRole: any) {

  // ── GET /api/archive/preview ──────────────────────────────────────────────
  app.get("/api/archive/preview", requireAuth, requireRole(["Admin"]), async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query as Record<string, string>;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const { rows } = await pool.query(
        `SELECT
           COUNT(*)::int AS count,
           COALESCE(SUM(duration_minutes), 0)::int AS total_minutes
         FROM time_entries
         WHERE clock_out IS NOT NULL
           AND clock_in >= $1::timestamptz
           AND clock_in <= ($2::date + INTERVAL '1 day - 1 second')::timestamptz`,
        [startDate, endDate]
      );

      const count = rows[0].count;
      const totalMinutes = rows[0].total_minutes;
      const totalHours = parseFloat((totalMinutes / 60).toFixed(2));

      res.json({ count, totalMinutes, totalHours, startDate, endDate });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/archive ─────────────────────────────────────────────────────
  app.post("/api/archive", requireAuth, requireRole(["Admin"]), async (req: any, res) => {
    const client = await pool.connect();
    try {
      const { startDate, endDate } = req.body;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const userId = req.user?.id;

      await client.query("BEGIN");

      // Check for active clock-ins (clock_out is null) in date range
      const activeCheck = await client.query(
        `SELECT te.id, COALESCE(u.first_name || ' ' || u.last_name, u.username) AS employee_name
         FROM time_entries te
         JOIN users u ON u.id = te.user_id
         WHERE te.clock_out IS NULL
           AND te.clock_in >= $1::timestamptz
           AND te.clock_in <= ($2::date + INTERVAL '1 day - 1 second')::timestamptz`,
        [startDate, endDate]
      );

      if (activeCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        const names = [...new Set(activeCheck.rows.map((r: any) => r.employee_name))];
        return res.status(409).json({
          error: "Cannot archive: some employees are still clocked in",
          employees: names,
        });
      }

      // Move entries to archive
      const insertRes = await client.query(
        `INSERT INTO time_entries_archive
           (id, user_id, job_id, clock_in, clock_out, duration_minutes, entry_type,
            work_area_id, work_area_name, notes, latitude, longitude, photo_url,
            is_manual, qbo_exported_at, qbo_time_activity_id, qbo_export_error,
            created_at, updated_at, archived_at, archived_by)
         SELECT
           id, user_id, job_id, clock_in, clock_out, duration_minutes, entry_type,
           work_area_id, work_area_name, notes, latitude, longitude, photo_url,
           is_manual, qbo_exported_at, qbo_time_activity_id, qbo_export_error,
           created_at, updated_at, NOW(), $3
         FROM time_entries
         WHERE clock_out IS NOT NULL
           AND clock_in >= $1::timestamptz
           AND clock_in <= ($2::date + INTERVAL '1 day - 1 second')::timestamptz`,
        [startDate, endDate, userId]
      );

      const archived = insertRes.rowCount ?? 0;

      await client.query(
        `DELETE FROM time_entries
         WHERE clock_out IS NOT NULL
           AND clock_in >= $1::timestamptz
           AND clock_in <= ($2::date + INTERVAL '1 day - 1 second')::timestamptz`,
        [startDate, endDate]
      );

      await client.query("COMMIT");

      res.json({ archived, startDate, endDate });
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // ── GET /api/archive/history ──────────────────────────────────────────────
  app.get("/api/archive/history", requireAuth, requireRole(["Admin"]), async (req: any, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string || "1", 10));
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || "20", 10)));
      const offset = (page - 1) * limit;

      const { rows: batches } = await pool.query(
        `SELECT
           date_trunc('minute', tea.archived_at) AS batch_time,
           tea.archived_by,
           COALESCE(u.first_name || ' ' || u.last_name, u.username) AS archived_by_name,
           COUNT(*)::int AS entry_count,
           COALESCE(SUM(tea.duration_minutes), 0)::int AS total_minutes,
           MIN(tea.clock_in) AS range_start,
           MAX(tea.clock_in) AS range_end
         FROM time_entries_archive tea
         LEFT JOIN users u ON u.id = tea.archived_by
         GROUP BY date_trunc('minute', tea.archived_at), tea.archived_by, u.first_name, u.last_name, u.username
         ORDER BY batch_time DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const { rows: countRows } = await pool.query(
        `SELECT COUNT(DISTINCT date_trunc('minute', archived_at)) AS total FROM time_entries_archive`
      );

      res.json({
        batches: batches.map((b: any) => ({
          ...b,
          total_hours: parseFloat((b.total_minutes / 60).toFixed(2)),
        })),
        page,
        totalPages: Math.ceil(parseInt(countRows[0].total, 10) / limit),
        totalBatches: parseInt(countRows[0].total, 10),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/archive/entries ──────────────────────────────────────────────
  app.get("/api/archive/entries", requireAuth, requireRole(["Admin"]), async (req: any, res) => {
    try {
      const {
        dateFrom, dateTo, userId,
        page = "1", limit = "50",
      } = req.query as Record<string, string>;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
      const offset = (pageNum - 1) * limitNum;

      const params: any[] = [];
      const conditions: string[] = [];

      if (dateFrom) { params.push(dateFrom); conditions.push(`tea.clock_in >= $${params.length}::timestamptz`); }
      if (dateTo)   { params.push(dateTo + "T23:59:59"); conditions.push(`tea.clock_in <= $${params.length}::timestamptz`); }
      if (userId)   { params.push(userId); conditions.push(`tea.user_id = $${params.length}`); }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const q = `
        SELECT
          tea.id, tea.clock_in, tea.clock_out, tea.duration_minutes,
          tea.entry_type, tea.work_area_name,
          tea.archived_at, tea.qbo_exported_at,
          u.id AS user_id,
          COALESCE(u.first_name || ' ' || u.last_name, u.username) AS employee_name,
          COALESCE(j.title, j.client) AS job_title,
          j.id AS job_id
        FROM time_entries_archive tea
        JOIN users u ON u.id = tea.user_id
        LEFT JOIN jobs j ON j.id = tea.job_id
        ${where}
        ORDER BY tea.clock_in DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const countQ = `
        SELECT COUNT(*) FROM time_entries_archive tea
        JOIN users u ON u.id = tea.user_id
        LEFT JOIN jobs j ON j.id = tea.job_id
        ${where}
      `;

      const [entryRes, countRes] = await Promise.all([
        pool.query(q, [...params, limitNum, offset]),
        pool.query(countQ, params),
      ]);

      const totalCount = parseInt(countRes.rows[0].count, 10);
      res.json({
        entries: entryRes.rows,
        page: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalCount,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
