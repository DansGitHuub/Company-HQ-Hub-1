import { pool } from "./db";
import type { Express } from "express";
import { requireRole } from "./auth";

async function nextClaimNumber(): Promise<string> {
  const { rows } = await pool.query(`SELECT nextval('claim_number_seq') AS n`);
  return `CLM-${String(Number(rows[0].n)).padStart(5, "0")}`;
}

export function registerWarrantyRoutes(app: Express, requireAuth: any) {

  // ── List all warranties (admin) ──────────────────────────────────────────
  app.get("/api/warranties", requireAuth, requireRole("Admin", "Manager"), async (req: any, res) => {
    const { status, customer_id } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];

    if (status)      { params.push(status);      conditions.push(`jw.status = $${params.length}`); }
    if (customer_id) { params.push(customer_id); conditions.push(`jw.customer_id = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    try {
      const { rows } = await pool.query(
        `SELECT jw.*,
                j.title AS job_title, j.client AS job_client,
                u.name AS created_by_name
         FROM job_warranties jw
         LEFT JOIN jobs j ON j.id = jw.job_id
         LEFT JOIN users u ON u.id = jw.created_by
         ${where}
         ORDER BY jw.created_at DESC`,
        params
      );
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Get warranty for a specific job ─────────────────────────────────────
  app.get("/api/jobs/:jobId/warranty", requireAuth, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT jw.*,
                j.title AS job_title,
                u.name AS created_by_name
         FROM job_warranties jw
         LEFT JOIN jobs j ON j.id = jw.job_id
         LEFT JOIN users u ON u.id = jw.created_by
         WHERE jw.job_id = $1
         ORDER BY jw.created_at DESC
         LIMIT 1`,
        [req.params.jobId]
      );
      return res.json(rows[0] || null);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Get single warranty with claims ─────────────────────────────────────
  app.get("/api/warranties/:id", requireAuth, async (req: any, res) => {
    try {
      const { rows: wRows } = await pool.query(
        `SELECT jw.*, j.title AS job_title, j.client AS job_client
         FROM job_warranties jw
         LEFT JOIN jobs j ON j.id = jw.job_id
         WHERE jw.id = $1`,
        [req.params.id]
      );
      if (!wRows.length) return res.status(404).json({ message: "Warranty not found" });

      const { rows: claims } = await pool.query(
        `SELECT wc.*,
                u.name AS resolved_by_name
         FROM warranty_claims wc
         LEFT JOIN users u ON u.id = wc.resolved_by
         WHERE wc.warranty_id = $1
         ORDER BY wc.reported_at DESC`,
        [req.params.id]
      );
      return res.json({ ...wRows[0], claims });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Create warranty manually ─────────────────────────────────────────────
  app.post("/api/jobs/:jobId/warranty", requireAuth, requireRole("Admin", "Manager"), async (req: any, res) => {
    const {
      title, description, warranty_type = "workmanship",
      duration_months = 12, start_date, end_date, terms,
    } = req.body;
    try {
      const { rows: jobRows } = await pool.query(
        `SELECT customer_id, property_id FROM jobs WHERE id = $1`, [req.params.jobId]
      );
      if (!jobRows.length) return res.status(404).json({ message: "Job not found" });

      const sd = start_date || new Date().toISOString().slice(0, 10);
      let ed = end_date;
      if (!ed && duration_months) {
        const d = new Date(sd);
        d.setMonth(d.getMonth() + duration_months);
        ed = d.toISOString().slice(0, 10);
      }

      const { rows } = await pool.query(
        `INSERT INTO job_warranties
           (job_id, customer_id, property_id, title, description, warranty_type,
            duration_months, start_date, end_date, status, terms, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11)
         RETURNING *`,
        [req.params.jobId, jobRows[0].customer_id || null, jobRows[0].property_id || null,
         title, description || null, warranty_type, duration_months, sd, ed || null,
         terms || null, req.user.id]
      );
      return res.status(201).json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Create warranty claim ────────────────────────────────────────────────
  app.post("/api/warranties/:id/claims", requireAuth, async (req: any, res) => {
    const { title, description, reported_by, priority = "normal", photos } = req.body;
    if (!title || !description) return res.status(400).json({ message: "title and description required" });
    if (photos !== undefined && !Array.isArray(photos)) {
      return res.status(400).json({ message: "photos must be an array" });
    }
    try {
      const { rows: wRows } = await pool.query(
        `SELECT job_id, customer_id FROM job_warranties WHERE id = $1`, [req.params.id]
      );
      if (!wRows.length) return res.status(404).json({ message: "Warranty not found" });

      const claimNum = await nextClaimNumber();
      const { rows } = await pool.query(
        `INSERT INTO warranty_claims
           (warranty_id, job_id, customer_id, claim_number, title, description,
            reported_by, priority, status, photos)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open',$9::jsonb)
         RETURNING *`,
        [req.params.id, wRows[0].job_id, wRows[0].customer_id || null,
         claimNum, title, description, reported_by || null, priority,
         JSON.stringify(photos || [])]
      );
      return res.status(201).json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Add photo(s) to an existing claim ───────────────────────────────────
  // Body: { photos: [{ url, name, uploadedAt, uploadedBy }] }
  // Appends to the existing photos JSONB array — open to any authenticated
  // user (same access level as filing a claim) so evidence can be added later.
  app.post("/api/warranty-claims/:id/photos", requireAuth, async (req: any, res) => {
    const { photos } = req.body;
    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ message: "photos must be a non-empty array" });
    }
    try {
      const { rows } = await pool.query(
        `UPDATE warranty_claims
         SET photos = COALESCE(photos, '[]'::jsonb) || $1::jsonb,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify(photos), req.params.id]
      );
      if (!rows.length) return res.status(404).json({ message: "Claim not found" });
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Update claim status ──────────────────────────────────────────────────
  app.patch("/api/warranty-claims/:id", requireAuth, requireRole("Admin", "Manager"), async (req: any, res) => {
    const { status, resolution, service_job_id } = req.body;
    try {
      const { rows } = await pool.query(
        `UPDATE warranty_claims SET
           status = COALESCE($1, status),
           resolution = COALESCE($2, resolution),
           service_job_id = COALESCE($3, service_job_id),
           resolved_by = CASE WHEN $1 = 'resolved' THEN $4 ELSE resolved_by END,
           resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END,
           updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [status || null, resolution || null, service_job_id || null, req.user?.id || null, req.params.id]
      );
      if (!rows.length) return res.status(404).json({ message: "Claim not found" });
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── List all warranty claims for admin view ──────────────────────────────
  app.get("/api/warranty-claims", requireAuth, requireRole("Admin", "Manager"), async (req: any, res) => {
    const { status } = req.query;
    const params: any[] = [];
    let where = "";
    if (status) { params.push(status); where = `WHERE wc.status = $1`; }
    try {
      const { rows } = await pool.query(
        `SELECT wc.*,
                jw.title AS warranty_title, jw.job_id,
                j.title AS job_title,
                u.name AS resolved_by_name
         FROM warranty_claims wc
         LEFT JOIN job_warranties jw ON jw.id = wc.warranty_id
         LEFT JOIN jobs j ON j.id = wc.job_id
         LEFT JOIN users u ON u.id = wc.resolved_by
         ${where}
         ORDER BY wc.reported_at DESC`,
        params
      );
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
