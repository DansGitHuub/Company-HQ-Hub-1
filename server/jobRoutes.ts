import { Express } from "express";
import { pool } from "./db";

const JOB_TYPES = [
  "Lawn Care", "Landscaping", "Snow Removal", "Irrigation",
  "Cleanup", "Tree Service", "Mulching", "Hardscaping",
  "Spring Cleanup", "Fall Cleanup", "Seeding", "Aeration",
  "Fertilization", "Planting", "Pruning", "Other",
];

export function registerJobRoutes(app: Express, requireAuth: any) {

  // ── LIST ──────────────────────────────────────────────────────────────────────
  app.get("/api/jobs", requireAuth, async (req, res) => {
    const { status, customer_id, date_from, date_to, search } = req.query as Record<string, string>;

    try {
      let q = `
        SELECT
          j.id, j.title, j.client, j.status, j.job_type, j.type,
          j.stage, j.category, j.price, j.value,
          j.scheduled_date, j.scheduled_start_time, j.scheduled_end_time,
          j.completion_date, j.estimated_hours, j.address, j.city, j.state,
          j.customer_id, j.property_id, j.created_at,
          c.first_name  AS cust_first,
          c.last_name   AS cust_last,
          c.company_name AS cust_company,
          p.address     AS prop_address,
          p.city        AS prop_city,
          p.state       AS prop_state
        FROM jobs j
        LEFT JOIN customers c ON c.id = j.customer_id
        LEFT JOIN properties p ON p.id = j.property_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status && status !== "all") {
        const statuses = status.split(",").map((s: string) => s.trim());
        params.push(statuses);
        q += ` AND j.status = ANY($${params.length})`;
      }
      if (customer_id) {
        params.push(customer_id);
        q += ` AND j.customer_id = $${params.length}`;
      }
      if (date_from) {
        params.push(date_from);
        q += ` AND j.scheduled_date::date >= $${params.length}`;
      }
      if (date_to) {
        params.push(date_to);
        q += ` AND j.scheduled_date::date <= $${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        const idx = params.length;
        q += ` AND (j.title ILIKE $${idx} OR j.client ILIKE $${idx} OR j.address ILIKE $${idx}
                    OR c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx} OR c.company_name ILIKE $${idx})`;
      }

      q += ` ORDER BY j.created_at DESC`;

      const result = await pool.query(q, params);
      return res.json(result.rows);
    } catch (err: any) {
      console.error("[jobs] GET /api/jobs error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── SINGLE JOB ────────────────────────────────────────────────────────────────
  app.get("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          j.*,
          c.first_name  AS cust_first,
          c.last_name   AS cust_last,
          c.company_name AS cust_company,
          p.address     AS prop_address,
          p.city        AS prop_city,
          p.state       AS prop_state,
          p.zip         AS prop_zip,
          COALESCE(
            (SELECT SUM(te.duration_minutes)
             FROM time_entries te
             WHERE te.job_id = j.id AND te.duration_minutes IS NOT NULL), 0
          )::numeric / 60 AS actual_hours
        FROM jobs j
        LEFT JOIN customers c ON c.id = j.customer_id
        LEFT JOIN properties p ON p.id = j.property_id
        WHERE j.id = $1
      `, [req.params.id]);

      if (rows.length === 0) return res.status(404).json({ message: "Job not found" });

      // Time entries for this job
      const timeRows = await pool.query(`
        SELECT te.*, u.name AS employee_name
        FROM time_entries te
        LEFT JOIN users u ON u.id = te.user_id
        WHERE te.job_id = $1
        ORDER BY te.clock_in DESC
      `, [req.params.id]);

      // Most recent linked invoice (so the client can swap "Generate Invoice" → "View Invoice")
      const { rows: invRows } = await pool.query(
        `SELECT id, invoice_number FROM invoices WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [req.params.id]
      );

      return res.json({
        ...rows[0],
        time_entries: timeRows.rows,
        linked_invoice_id: invRows[0]?.id ?? null,
        linked_invoice_number: invRows[0]?.invoice_number ?? null,
      });
    } catch (err: any) {
      console.error("[jobs] GET /api/jobs/:id error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── CREATE ────────────────────────────────────────────────────────────────────
  app.post("/api/jobs", requireAuth, async (req, res) => {
    const {
      title, client, description, status = "lead", job_type, type,
      scheduled_date, scheduled_start_time, scheduled_end_time,
      completion_date, estimated_hours, price, crew_notes, notes,
      customer_id, property_id, address, city, state, zip,
      category, stage, value,
    } = req.body;

    try {
      const result = await pool.query(`
        INSERT INTO jobs (
          title, client, description, status, job_type, type,
          scheduled_date, scheduled_start_time, scheduled_end_time,
          completion_date, estimated_hours, price, crew_notes, notes,
          customer_id, property_id, address, city, state, zip,
          category, stage, value, created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NOW(),NOW()
        ) RETURNING *
      `, [
        title || client || "Untitled Job",
        client || title || "Unknown",
        description || null,
        status,
        job_type || type || null,
        type || job_type || null,
        scheduled_date || null,
        scheduled_start_time || null,
        scheduled_end_time || null,
        completion_date || null,
        estimated_hours || null,
        price || null,
        crew_notes || notes || null,
        notes || crew_notes || null,
        customer_id || null,
        property_id || null,
        address || null,
        city || null,
        state || null,
        zip || null,
        category || "Install",
        stage || "Lead",
        value || (price ? Math.round(Number(price)) : 0),
      ]);
      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      console.error("[jobs] POST /api/jobs error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────────
  app.put("/api/jobs/:id", requireAuth, async (req, res) => {
    const {
      title, client, description, status, job_type, type,
      scheduled_date, scheduled_start_time, scheduled_end_time,
      completion_date, estimated_hours, price, crew_notes, notes,
      customer_id, property_id, address, city, state, zip,
      category, stage, value,
    } = req.body;

    try {
      const result = await pool.query(`
        UPDATE jobs SET
          title               = COALESCE($1, title),
          client              = COALESCE($2, client),
          description         = $3,
          status              = COALESCE($4, status),
          job_type            = $5,
          type                = COALESCE($6, type),
          scheduled_date      = $7,
          scheduled_start_time = $8,
          scheduled_end_time  = $9,
          completion_date     = $10,
          estimated_hours     = $11,
          price               = $12,
          crew_notes          = $13,
          notes               = $14,
          customer_id         = $15,
          property_id         = $16,
          address             = COALESCE($17, address),
          city                = COALESCE($18, city),
          state               = COALESCE($19, state),
          zip                 = COALESCE($20, zip),
          category            = COALESCE($21, category),
          stage               = COALESCE($22, stage),
          value               = COALESCE($23, value),
          updated_at          = NOW()
        WHERE id = $24
        RETURNING *
      `, [
        title || null,
        client || null,
        description ?? null,
        status || null,
        job_type ?? null,
        type || null,
        scheduled_date ?? null,
        scheduled_start_time ?? null,
        scheduled_end_time ?? null,
        completion_date ?? null,
        estimated_hours ?? null,
        price ?? null,
        crew_notes ?? null,
        notes ?? null,
        customer_id ?? null,
        property_id ?? null,
        address ?? null,
        city ?? null,
        state ?? null,
        zip ?? null,
        category ?? null,
        stage ?? null,
        value ?? null,
        req.params.id,
      ]);

      if (result.rows.length === 0) return res.status(404).json({ message: "Job not found" });
      return res.json(result.rows[0]);
    } catch (err: any) {
      console.error("[jobs] PUT /api/jobs/:id error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH (status only / or legacy) ──────────────────────────────────────────
  app.patch("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const fields = req.body;
      // Build dynamic SET clause
      const setClauses: string[] = [];
      const params: any[] = [];

      const allowed = [
        "title","client","description","status","job_type","type","stage",
        "scheduled_date","scheduled_start_time","scheduled_end_time",
        "completion_date","estimated_hours","price","crew_notes","notes",
        "customer_id","property_id","address","city","state","zip",
        "category","value","is_mandatory_date",
      ];
      for (const key of allowed) {
        if (key in fields) {
          params.push(fields[key]);
          setClauses.push(`${key} = $${params.length}`);
        }
      }
      if (setClauses.length === 0) return res.status(400).json({ message: "No fields to update" });
      params.push(req.params.id);
      const result = await pool.query(
        `UPDATE jobs SET ${setClauses.join(", ")}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "Job not found" });
      return res.json(result.rows[0]);
    } catch (err: any) {
      console.error("[jobs] PATCH /api/jobs/:id error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH STATUS ONLY ─────────────────────────────────────────────────────────
  app.patch("/api/jobs/:id/status", requireAuth, async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "status is required" });
    try {
      const result = await pool.query(
        `UPDATE jobs SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
        [status, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "Job not found" });
      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── SOFT DELETE ───────────────────────────────────────────────────────────────
  app.delete("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      await pool.query(
        `UPDATE jobs SET status='cancelled', updated_at=NOW() WHERE id=$1`,
        [req.params.id]
      );
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── JOB TYPES LIST ────────────────────────────────────────────────────────────
  app.get("/api/jobs/meta/types", requireAuth, (_req, res) => {
    return res.json(JOB_TYPES);
  });
}
