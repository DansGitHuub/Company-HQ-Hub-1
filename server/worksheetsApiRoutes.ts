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
    const { notes, job_id, status, signature_url } = req.body;
    try {
      await pool.query(
        `UPDATE worksheets SET
          notes          = COALESCE($1, notes),
          job_id         = COALESCE($2, job_id),
          status         = COALESCE($3, status),
          signature_url  = COALESCE($5, signature_url),
          updated_at     = NOW()
         WHERE id = $4`,
        [notes ?? null, job_id ?? null, status ?? null, req.params.id, signature_url ?? null]
      );
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
