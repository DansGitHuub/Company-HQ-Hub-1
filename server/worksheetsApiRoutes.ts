import { Express } from "express";
import { pool } from "./db";

export function registerWorksheetsApiRoutes(app: Express, requireAuth: any) {

  // ── Helper: fetch worksheet with its child rows ──────────────────────────────
  async function fetchWorksheetFull(id: string) {
    const [ws, mats, exps, team] = await Promise.all([
      pool.query(`SELECT * FROM worksheets WHERE id = $1`, [id]),
      pool.query(`SELECT * FROM worksheet_materials WHERE worksheet_id = $1 ORDER BY created_at`, [id]),
      pool.query(`SELECT * FROM worksheet_expenses WHERE worksheet_id = $1 ORDER BY created_at`, [id]),
      pool.query(
        `SELECT wtm.*, u.name AS user_name, u.username FROM worksheet_team_members wtm
         JOIN users u ON u.id = wtm.user_id
         WHERE wtm.worksheet_id = $1 ORDER BY wtm.created_at`,
        [id]
      ),
    ]);
    if (ws.rows.length === 0) return null;
    return {
      ...ws.rows[0],
      materials: mats.rows,
      expenses: exps.rows,
      teamMembers: team.rows,
    };
  }

  // ── GET /api/worksheets (admin list) ─────────────────────────────────────────
  app.get("/api/worksheets", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           w.id,
           w.date,
           w.status,
           w.user_id,
           u.name  AS employee_name,
           u.username AS employee_username,
           j.client AS job_name,
           COALESCE(mat.total, 0) AS materials_total,
           COALESCE(exp.total, 0) AS expenses_total
         FROM worksheets w
         LEFT JOIN users u ON u.id = w.user_id
         LEFT JOIN jobs  j ON j.id = w.job_id
         LEFT JOIN (
           SELECT worksheet_id, SUM(quantity * unit_cost) AS total
           FROM worksheet_materials
           GROUP BY worksheet_id
         ) mat ON mat.worksheet_id = w.id
         LEFT JOIN (
           SELECT worksheet_id, SUM(amount) AS total
           FROM worksheet_expenses
           GROUP BY worksheet_id
         ) exp ON exp.worksheet_id = w.id
         ORDER BY w.date DESC, w.created_at DESC`
      );
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/worksheets/export ────────────────────────────────────────────────
  app.get("/api/worksheets/export", requireAuth, async (req, res) => {
    try {
      const statusParam = (req.query.status as string) || "approved,submitted";
      const statuses = statusParam.split(",").map((s) => s.trim()).filter(Boolean);
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo   = req.query.dateTo   as string | undefined;

      const params: any[] = [statuses];
      let dateFilter = "";
      if (dateFrom) { params.push(dateFrom); dateFilter += ` AND w.date >= $${params.length}`; }
      if (dateTo)   { params.push(dateTo);   dateFilter += ` AND w.date <= $${params.length}`; }

      const result = await pool.query(
        `SELECT
           w.date,
           COALESCE(u.name, u.username) AS employee,
           j.client                      AS job_area,
           tc.clock_in_time,
           tc.clock_out_time,
           tc.total_minutes,
           COALESCE(mat.total, 0)        AS materials_total,
           COALESCE(exp.total, 0)        AS expenses_total,
           w.notes
         FROM worksheets w
         LEFT JOIN users u ON u.id = w.user_id
         LEFT JOIN jobs  j ON j.id = w.job_id
         LEFT JOIN LATERAL (
           SELECT clock_in_time, clock_out_time, total_minutes
           FROM time_cards
           WHERE employee_id = w.user_id AND date = w.date
           ORDER BY clock_in_time ASC LIMIT 1
         ) tc ON true
         LEFT JOIN (
           SELECT worksheet_id, SUM(COALESCE(quantity,0) * COALESCE(unit_cost,0)) AS total
           FROM worksheet_materials GROUP BY worksheet_id
         ) mat ON mat.worksheet_id = w.id
         LEFT JOIN (
           SELECT worksheet_id, SUM(COALESCE(amount,0)) AS total
           FROM worksheet_expenses GROUP BY worksheet_id
         ) exp ON exp.worksheet_id = w.id
         WHERE w.status = ANY($1)
         ${dateFilter}
         ORDER BY w.date DESC, u.name ASC`,
        params
      );

      // ── Build CSV ──────────────────────────────────────────────────────────
      const escape = (v: any): string => {
        if (v === null || v === undefined) return "";
        const s = String(v);
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const fmtTime = (ts: Date | null | undefined) => {
        if (!ts) return "";
        return new Date(ts).toLocaleTimeString("en-US", {
          hour: "2-digit", minute: "2-digit", hour12: true,
        });
      };

      const fmtMoney = (v: any) => {
        const n = parseFloat(v);
        return isNaN(n) ? "0.00" : n.toFixed(2);
      };

      const fmtHours = (mins: number | null) => {
        if (mins === null || mins === undefined) return "";
        return (mins / 60).toFixed(2);
      };

      const headers = [
        "Date", "Employee", "Job/Area",
        "Clock-In", "Clock-Out", "Hours",
        "Materials Total", "Expenses Total", "Notes",
      ].join(",");

      const rows = result.rows.map((r) =>
        [
          escape(r.date),
          escape(r.employee),
          escape(r.job_area),
          escape(fmtTime(r.clock_in_time)),
          escape(fmtTime(r.clock_out_time)),
          escape(fmtHours(r.total_minutes)),
          escape(fmtMoney(r.materials_total)),
          escape(fmtMoney(r.expenses_total)),
          escape(r.notes),
        ].join(",")
      );

      const csv = [headers, ...rows].join("\r\n");
      const today = new Date().toISOString().slice(0, 10);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="worksheets-${today}.csv"`);
      return res.send(csv);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/worksheets/today ─────────────────────────────────────────────────
  app.get("/api/worksheets/today", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    try {
      // Try to find today's worksheet for this user
      const existing = await pool.query(
        `SELECT id FROM worksheets WHERE user_id = $1 AND date = CURRENT_DATE LIMIT 1`,
        [userId]
      );

      let worksheetId: string;
      if (existing.rows.length > 0) {
        worksheetId = existing.rows[0].id;
      } else {
        // Auto-create
        const created = await pool.query(
          `INSERT INTO worksheets (user_id, date, status) VALUES ($1, CURRENT_DATE, 'draft') RETURNING id`,
          [userId]
        );
        worksheetId = created.rows[0].id;
      }

      const full = await fetchWorksheetFull(worksheetId);
      return res.json(full);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/worksheets/:id ───────────────────────────────────────────────────
  app.get("/api/worksheets/:id", requireAuth, async (req, res) => {
    try {
      const full = await fetchWorksheetFull(req.params.id);
      if (!full) return res.status(404).json({ message: "Worksheet not found" });
      return res.json(full);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH /api/worksheets/:id ─────────────────────────────────────────────────
  app.patch("/api/worksheets/:id", requireAuth, async (req, res) => {
    const { notes, status, signature_url } = req.body;
    // job_id: if key is present in body (even as null/empty), update it; otherwise keep existing
    const hasJobId = "job_id" in req.body;
    const jobIdValue = req.body.job_id || null;
    try {
      if (hasJobId) {
        // Include job_id with explicit cast so PostgreSQL knows the type even when null
        await pool.query(
          `UPDATE worksheets SET
            notes         = COALESCE($1::text, notes),
            job_id        = $2::text,
            status        = COALESCE($3::text, status),
            signature_url = COALESCE($5::text, signature_url),
            updated_at    = NOW()
           WHERE id = $4`,
          [notes ?? null, jobIdValue, status ?? null, req.params.id, signature_url ?? null]
        );
      } else {
        // job_id not present in request body — leave it unchanged
        // Only 4 params so no untyped null gaps
        await pool.query(
          `UPDATE worksheets SET
            notes         = COALESCE($1::text, notes),
            status        = COALESCE($2::text, status),
            signature_url = COALESCE($4::text, signature_url),
            updated_at    = NOW()
           WHERE id = $3`,
          [notes ?? null, status ?? null, req.params.id, signature_url ?? null]
        );
      }
      const full = await fetchWorksheetFull(req.params.id);
      return res.json(full);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/worksheets/:id/submit ──────────────────────────────────────────
  app.post("/api/worksheets/:id/submit", requireAuth, async (req, res) => {
    try {
      await pool.query(
        `UPDATE worksheets SET status = 'submitted', updated_at = NOW() WHERE id = $1`,
        [req.params.id]
      );
      const full = await fetchWorksheetFull(req.params.id);
      return res.json(full);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/worksheets/:id/materials ───────────────────────────────────────
  app.post("/api/worksheets/:id/materials", requireAuth, async (req, res) => {
    const { material_name, quantity, unit, unit_cost, notes } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO worksheet_materials (worksheet_id, material_name, quantity, unit, unit_cost, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [req.params.id, material_name || null, quantity ?? null, unit || null, unit_cost ?? null, notes || null]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE /api/worksheets/:id/materials/:materialId ─────────────────────────
  app.delete("/api/worksheets/:id/materials/:materialId", requireAuth, async (req, res) => {
    try {
      await pool.query(
        `DELETE FROM worksheet_materials WHERE id = $1 AND worksheet_id = $2`,
        [req.params.materialId, req.params.id]
      );
      return res.status(204).send();
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/worksheets/:id/expenses ────────────────────────────────────────
  app.post("/api/worksheets/:id/expenses", requireAuth, async (req, res) => {
    const { description, amount, category, receipt_url } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO worksheet_expenses (worksheet_id, description, amount, category, receipt_url)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.params.id, description || null, amount ?? null, category || null, receipt_url || null]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE /api/worksheets/:id/expenses/:expenseId ───────────────────────────
  app.delete("/api/worksheets/:id/expenses/:expenseId", requireAuth, async (req, res) => {
    try {
      await pool.query(
        `DELETE FROM worksheet_expenses WHERE id = $1 AND worksheet_id = $2`,
        [req.params.expenseId, req.params.id]
      );
      return res.status(204).send();
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/worksheets/:id/team-members ────────────────────────────────────
  app.post("/api/worksheets/:id/team-members", requireAuth, async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ message: "user_id is required" });
    try {
      const result = await pool.query(
        `INSERT INTO worksheet_team_members (worksheet_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (worksheet_id, user_id) DO NOTHING
         RETURNING *`,
        [req.params.id, user_id]
      );
      return res.status(201).json(result.rows[0] ?? { message: "already exists" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE /api/worksheets/:id/team-members/:memberId ────────────────────────
  app.delete("/api/worksheets/:id/team-members/:memberId", requireAuth, async (req, res) => {
    try {
      await pool.query(
        `DELETE FROM worksheet_team_members WHERE id = $1 AND worksheet_id = $2`,
        [req.params.memberId, req.params.id]
      );
      return res.status(204).send();
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/materials/catalog?q= ────────────────────────────────────────────
  // Searches both the materials inventory and catalog_items tables.
  // Returns: [{ id, name, unit, unit_cost, source }]
  app.get("/api/materials/catalog", requireAuth, async (req, res) => {
    const q = ((req.query.q as string) || "").trim();
    const pattern = `%${q}%`;
    try {
      const [fromMaterials, fromCatalog] = await Promise.all([
        pool.query(
          `SELECT id::text, name, NULL AS unit, NULL AS unit_cost, 'inventory' AS source
           FROM materials
           WHERE ($1 = '' OR name ILIKE $2) AND status = 'Active'
           ORDER BY name LIMIT 25`,
          [q, pattern]
        ),
        pool.query(
          `SELECT id::text, name, units AS unit, cost AS unit_cost, 'catalog' AS source
           FROM catalog_items
           WHERE ($1 = '' OR name ILIKE $2)
           ORDER BY name LIMIT 25`,
          [q, pattern]
        ),
      ]);

      // Merge, dedupe by lowercase name, catalog takes priority
      const seen = new Set<string>();
      const results: any[] = [];
      for (const row of [...fromCatalog.rows, ...fromMaterials.rows]) {
        const key = row.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          results.push(row);
        }
      }
      results.sort((a, b) => a.name.localeCompare(b.name));

      return res.json(results.slice(0, 30));
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
