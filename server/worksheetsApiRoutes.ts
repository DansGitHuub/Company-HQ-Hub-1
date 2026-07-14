import { Express } from "express";
import { pool } from "./db";
import { sendWorksheetSubmittedEmail } from "./email";
import { escapeHtml } from "./emailService";

const MANAGER_ROLES = ["Admin", "Manager", "Master Admin"];

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

  // ── Helper: notify all Admins + Managers (in-app + email) ───────────────────
  async function notifyManagersWorksheetSubmitted(
    worksheetId: string,
    employeeName: string,
    worksheetDate: string
  ) {
    try {
      const { rows: managers } = await pool.query(
        `SELECT id, name, email FROM users
         WHERE (role = ANY($1) OR "is_master_admin" = true)
           AND email IS NOT NULL
         ORDER BY name`,
        [MANAGER_ROLES]
      );

      const dateLabel = worksheetDate
        ? new Date(worksheetDate + "T12:00:00").toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
          })
        : worksheetDate;

      const notifTitle   = `Worksheet Submitted — ${employeeName}`;
      const notifMessage = `${employeeName} submitted their daily worksheet for ${dateLabel}. Tap to review.`;

      for (const mgr of managers) {
        // In-app bell notification
        await pool.query(
          `INSERT INTO staff_notifications (id, user_id, type, title, message, link, metadata)
           VALUES (gen_random_uuid(), $1, 'worksheet_submitted', $2, $3, '/admin/worksheets', $4)`,
          [
            mgr.id,
            notifTitle,
            notifMessage,
            JSON.stringify({ worksheetId, employeeName, date: worksheetDate }),
          ]
        );

        // Email (fire-and-forget, don't block response)
        if (mgr.email) {
          sendWorksheetSubmittedEmail(
            mgr.email,
            mgr.name || "Manager",
            employeeName,
            worksheetDate,
            worksheetId
          ).catch((err: any) =>
            console.error(`[worksheets] Email to ${mgr.email} failed:`, err?.message)
          );
        }
      }

      console.log(
        `[worksheets] Submit notifications sent to ${managers.length} manager(s) for worksheet ${worksheetId}`
      );
    } catch (err: any) {
      console.error("[worksheets] notifyManagersWorksheetSubmitted error:", err?.message);
    }
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
      const existing = await pool.query(
        `SELECT id FROM worksheets WHERE user_id = $1 AND date = CURRENT_DATE LIMIT 1`,
        [userId]
      );

      let worksheetId: string;
      if (existing.rows.length > 0) {
        worksheetId = existing.rows[0].id;
      } else {
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
  // Admins and Managers can always edit.
  // Crew (and other non-manager roles) are blocked once status is submitted or approved.
  app.patch("/api/worksheets/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const isManager = MANAGER_ROLES.includes(user.role) || user.isMasterAdmin;

    try {
      // ── Status guard for non-managers ────────────────────────────────────
      if (!isManager) {
        const { rows } = await pool.query(
          `SELECT status FROM worksheets WHERE id = $1`,
          [req.params.id]
        );
        if (rows.length === 0) {
          return res.status(404).json({ message: "Worksheet not found" });
        }
        const currentStatus = rows[0].status;
        if (currentStatus === "submitted" || currentStatus === "approved") {
          return res.status(403).json({
            message: "This worksheet has already been submitted and cannot be edited.",
          });
        }
      }

      const { notes, status, signature_url } = req.body;
      const hasJobId   = "job_id" in req.body;
      const jobIdValue = req.body.job_id || null;

      if (hasJobId) {
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
      // Fetch worksheet + submitter name + job_id before updating
      const { rows: wsRows } = await pool.query(
        `SELECT w.id, w.date, w.job_id, w.user_id, COALESCE(u.name, u.username) AS employee_name
         FROM worksheets w
         LEFT JOIN users u ON u.id = w.user_id
         WHERE w.id = $1`,
        [req.params.id]
      );

      if (wsRows.length === 0) {
        return res.status(404).json({ message: "Worksheet not found" });
      }

      const ws = wsRows[0];

      // Extract the 4 checklist answers from the request body (all optional for backward compat)
      const {
        checklist_work_order_changed  = false,
        checklist_work_order_note     = null,
        checklist_materials_needed    = false,
        checklist_materials_note      = null,
        checklist_change_order_needed = false,
        checklist_change_order_note   = null,
        checklist_issue_reported      = false,
        checklist_issue_note          = null,
      } = req.body ?? {};

      // ── Photo gates (server-side enforcement) ─────────────────────────────────
      if (ws.job_id) {
        const [sessionCheck, photoCheck] = await Promise.all([
          pool.query(
            `SELECT COUNT(*) AS cnt FROM worksheet_sessions
             WHERE job_id = $1 AND employee_id = $2 AND date::date = $3::date`,
            [ws.job_id, ws.user_id, ws.date]
          ),
          pool.query(
            `SELECT DISTINCT wp.photo_type
             FROM worksheet_photos wp
             JOIN worksheet_sessions wss ON wss.id = wp.session_id
             WHERE wss.job_id = $1 AND wss.employee_id = $2 AND wss.date::date = $3::date`,
            [ws.job_id, ws.user_id, ws.date]
          ),
        ]);

        const hasSessions = parseInt(sessionCheck.rows[0].cnt, 10) > 0;
        const photoTypes  = new Set(photoCheck.rows.map((r: any) => r.photo_type));
        const missing: string[] = [];

        if (!hasSessions) {
          // Explicit block: job is linked but crew never clocked in — no silent bypass
          missing.push('a time entry for this job (clock into this job and take before/after photos first)');
        } else {
          if (!photoTypes.has("before")) missing.push('"Before" photo');
          if (!photoTypes.has("after"))  missing.push('"After" photo');
          if (!!checklist_issue_reported && !photoTypes.has("damage")) {
            missing.push('"Damage" photo (required when an issue is reported)');
          }
        }

        if (missing.length > 0) {
          return res.status(400).json({
            message: `Missing required photos: ${missing.join(", ")}. Open the job from the Schedule view to add these photos.`,
            missing_photos: missing,
          });
        }
      }

      // Mark as submitted and save checklist answers atomically
      await pool.query(
        `UPDATE worksheets SET
           status                       = 'submitted',
           updated_at                   = NOW(),
           checklist_work_order_changed  = $2,
           checklist_work_order_note     = $3,
           checklist_materials_needed    = $4,
           checklist_materials_note      = $5,
           checklist_change_order_needed = $6,
           checklist_change_order_note   = $7,
           checklist_issue_reported      = $8,
           checklist_issue_note          = $9
         WHERE id = $1`,
        [
          req.params.id,
          !!checklist_work_order_changed,  checklist_work_order_note  || null,
          !!checklist_materials_needed,    checklist_materials_note   || null,
          !!checklist_change_order_needed, checklist_change_order_note|| null,
          !!checklist_issue_reported,      checklist_issue_note       || null,
        ]
      );

      // ── Q1: Work order changed → append highlighted note to worksheet ──────────
      if (checklist_work_order_changed && checklist_work_order_note?.trim()) {
        await pool.query(
          `UPDATE worksheets
             SET notes = COALESCE(notes || E'\\n\\n', '') || $2
           WHERE id = $1`,
          [req.params.id, `⚠️ FIELD FLAG — Work Order Changed:\n${checklist_work_order_note.trim()}`]
        ).catch((e: any) => console.error("[worksheets] Q1 note append:", e.message));
      }

      // ── Q2: Materials needed → insert worksheet_materials row ─────────────────
      if (checklist_materials_needed && checklist_materials_note?.trim()) {
        await pool.query(
          `INSERT INTO worksheet_materials (worksheet_id, material_name, notes)
           VALUES ($1, '⚠️ Additional Materials Needed', $2)`,
          [req.params.id, checklist_materials_note.trim()]
        ).catch((e: any) => console.error("[worksheets] Q2 material insert:", e.message));
      }

      // ── Q3: Change order needed → create draft change order (requires job) ────
      if (checklist_change_order_needed && checklist_change_order_note?.trim() && ws.job_id) {
        try {
          const { rows: jobRows } = await pool.query(
            `SELECT customer_id FROM jobs WHERE id = $1`,
            [ws.job_id]
          );
          if (jobRows.length) {
            const { rows: seqRows } = await pool.query(`SELECT nextval('co_number_seq') AS n`);
            const coNum = `CO-${String(Number(seqRows[0].n)).padStart(5, "0")}`;
            await pool.query(
              `INSERT INTO job_change_orders
                 (job_id, customer_id, co_number, title, description, status,
                  subtotal, tax_rate, tax_amount, total, created_by)
               VALUES ($1, $2, $3, $4, $5, 'draft', 0, 0, 0, 0, $6)`,
              [
                ws.job_id,
                jobRows[0].customer_id || null,
                coNum,
                "Possible Change Order — Field Flag",
                checklist_change_order_note.trim(),
                ws.user_id,
              ]
            );
            console.log(`[worksheets] Draft CO ${coNum} created for job ${ws.job_id}`);
          }
        } catch (coErr: any) {
          console.error("[worksheets] Q3 draft CO creation:", coErr.message);
        }
      }

      // ── Q4: Issue reported → append to job notes + notify all managers ────────
      if (checklist_issue_reported && checklist_issue_note?.trim()) {
        const issueText = `⚠️ FIELD ISSUE (${ws.employee_name || "Crew"}): ${checklist_issue_note.trim()}`;

        if (ws.job_id) {
          pool.query(
            `UPDATE jobs SET notes = COALESCE(notes || E'\\n\\n', '') || $2 WHERE id = $1`,
            [ws.job_id, issueText]
          ).catch((e: any) => console.error("[worksheets] Q4 job notes append:", e.message));
        }

        // Notify all Admins + Managers (in-app bell only — no email for field alerts)
        pool.query(
          `SELECT id FROM users WHERE (role = ANY($1) OR "is_master_admin" = true)`,
          [MANAGER_ROLES]
        ).then(({ rows: managers }) => {
          const link = ws.job_id ? `/jobs/${ws.job_id}` : "/admin/worksheets";
          return Promise.all(managers.map((mgr: any) =>
            pool.query(
              `INSERT INTO staff_notifications (id, user_id, type, title, message, link, metadata)
               VALUES (gen_random_uuid(), $1, 'field_issue_report', $2, $3, $4, $5)`,
              [
                mgr.id,
                `Field Issue — ${ws.employee_name || "Crew Member"}`,
                `${ws.employee_name || "A crew member"} reported a damage/delay/customer issue on their worksheet.`,
                link,
                JSON.stringify({ worksheetId: ws.id, jobId: ws.job_id || null, note: checklist_issue_note.trim() }),
              ]
            )
          ));
        }).catch((e: any) => console.error("[worksheets] Q4 issue notify:", e.message));
      }

      // Fire standard worksheet-submitted notifications to all managers/admins
      const dateStr = ws.date
        ? (ws.date instanceof Date ? ws.date.toISOString().slice(0, 10) : String(ws.date).slice(0, 10))
        : "";
      notifyManagersWorksheetSubmitted(ws.id, ws.employee_name || "An employee", dateStr).catch(() => {});

      const full = await fetchWorksheetFull(req.params.id);
      return res.json(full);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/worksheets/:id/photo-summary ────────────────────────────────────
  app.get("/api/worksheets/:id/photo-summary", requireAuth, async (req, res) => {
    try {
      const { rows: wsRows } = await pool.query(
        `SELECT user_id, job_id, date FROM worksheets WHERE id = $1`,
        [req.params.id]
      );
      if (!wsRows.length) return res.status(404).json({ message: "Worksheet not found" });

      const ws = wsRows[0];
      if (!ws.job_id) {
        return res.json({ before: 0, after: 0, damage: 0, other: 0, has_job: false, has_sessions: false });
      }

      const [sessionCheck, photoRows] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) AS cnt FROM worksheet_sessions
           WHERE job_id = $1 AND employee_id = $2 AND date::date = $3::date`,
          [ws.job_id, ws.user_id, ws.date]
        ),
        pool.query(
          `SELECT wp.photo_type, COUNT(*) AS cnt
           FROM worksheet_photos wp
           JOIN worksheet_sessions wss ON wss.id = wp.session_id
           WHERE wss.job_id = $1 AND wss.employee_id = $2 AND wss.date::date = $3::date
           GROUP BY wp.photo_type`,
          [ws.job_id, ws.user_id, ws.date]
        ),
      ]);

      const hasSessions = parseInt(sessionCheck.rows[0].cnt, 10) > 0;
      const counts: Record<string, number> = { before: 0, after: 0, damage: 0, other: 0 };
      for (const row of photoRows.rows) {
        counts[row.photo_type] = parseInt(row.cnt, 10);
      }

      return res.json({ ...counts, has_job: true, has_sessions: hasSessions });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/worksheets/:id/materials ────────────────────────────────────────
  app.get("/api/worksheets/:id/materials", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM worksheet_materials WHERE worksheet_id = $1 ORDER BY id`,
        [req.params.id]
      );
      return res.json(result.rows);
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
