import { Express } from "express";
import { pool } from "./db";

async function migrateConsultations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS consultations (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL,
      contact_name     VARCHAR(255),
      contact_phone    VARCHAR(50),
      contact_email    VARCHAR(255),
      scheduled_date   DATE,
      scheduled_time   TIME,
      duration_minutes INT DEFAULT 60,
      status           VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                         CHECK (status IN ('scheduled','completed','cancelled','no_show')),
      address          TEXT,
      notes            TEXT,
      follow_up_required BOOLEAN DEFAULT FALSE,
      follow_up_date   DATE,
      assigned_to      VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
      estimated_value  NUMERIC(12,2),
      lead_source      VARCHAR(100),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Indexes for common queries
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_consultations_scheduled_date ON consultations(scheduled_date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_consultations_customer_id ON consultations(customer_id)`);
  console.log("[migration] consultations table ready");
}

export async function registerConsultationRoutes(app: Express, requireAuth: any) {
  await migrateConsultations();

  // ── STATS ─────────────────────────────────────────────────────────────────────
  app.get("/api/consultations/stats", requireAuth, async (req, res) => {
    try {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const { rows } = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'scheduled')::int                          AS total_scheduled,
          COUNT(*) FILTER (WHERE status = 'completed'
                           AND scheduled_date >= $1)::int                             AS completed_this_month,
          COUNT(*) FILTER (WHERE status = 'no_show')::int                            AS no_shows,
          COALESCE(SUM(estimated_value) FILTER (WHERE status = 'scheduled'), 0)::numeric AS pipeline_value
        FROM consultations
      `, [monthStart]);

      res.json(rows[0] ?? {
        total_scheduled: 0, completed_this_month: 0, no_shows: 0, pipeline_value: 0,
      });
    } catch (err: any) {
      console.error("[consultations/stats]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── LIST ──────────────────────────────────────────────────────────────────────
  app.get("/api/consultations", requireAuth, async (req, res) => {
    const { status, date_from, date_to, assigned_to, search } = req.query as Record<string, string>;
    try {
      const params: any[] = [];
      const conds: string[] = [];

      if (status)      { params.push(status);      conds.push(`c.status = $${params.length}`); }
      if (date_from)   { params.push(date_from);   conds.push(`c.scheduled_date >= $${params.length}`); }
      if (date_to)     { params.push(date_to);     conds.push(`c.scheduled_date <= $${params.length}`); }
      if (assigned_to) { params.push(assigned_to); conds.push(`c.assigned_to = $${params.length}`); }
      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        conds.push(`(
          LOWER(c.contact_name) LIKE $${params.length} OR
          LOWER(c.address)      LIKE $${params.length} OR
          LOWER(cust.first_name || ' ' || cust.last_name) LIKE $${params.length} OR
          LOWER(COALESCE(cust.company_name,'')) LIKE $${params.length}
        )`);
      }

      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";

      const { rows } = await pool.query(`
        SELECT
          c.*,
          cust.first_name      AS cust_first,
          cust.last_name       AS cust_last,
          cust.company_name    AS cust_company,
          u.name               AS assigned_name
        FROM consultations c
        LEFT JOIN customers cust ON cust.id = c.customer_id
        LEFT JOIN users     u    ON u.id    = c.assigned_to
        ${where}
        ORDER BY c.scheduled_date DESC NULLS LAST, c.scheduled_time ASC NULLS LAST
      `, params);

      res.json(rows.map(r => ({
        ...r,
        customer_name: r.cust_company || `${r.cust_first ?? ""} ${r.cust_last ?? ""}`.trim() || null,
      })));
    } catch (err: any) {
      console.error("[consultations/list]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── CREATE ────────────────────────────────────────────────────────────────────
  app.post("/api/consultations", requireAuth, async (req, res) => {
    const {
      customer_id, contact_name, contact_phone, contact_email,
      scheduled_date, scheduled_time, duration_minutes, status,
      address, notes, follow_up_required, follow_up_date,
      assigned_to, estimated_value, lead_source,
    } = req.body;
    try {
      const { rows } = await pool.query(`
        INSERT INTO consultations (
          customer_id, contact_name, contact_phone, contact_email,
          scheduled_date, scheduled_time, duration_minutes, status,
          address, notes, follow_up_required, follow_up_date,
          assigned_to, estimated_value, lead_source
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING *
      `, [
        customer_id || null, contact_name || null, contact_phone || null, contact_email || null,
        scheduled_date || null, scheduled_time || null, duration_minutes ?? 60, status ?? "scheduled",
        address || null, notes || null, follow_up_required ?? false, follow_up_date || null,
        assigned_to || null, estimated_value || null, lead_source || null,
      ]);
      res.status(201).json(rows[0]);
    } catch (err: any) {
      console.error("[consultations/create]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────────
  app.patch("/api/consultations/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const {
      customer_id, contact_name, contact_phone, contact_email,
      scheduled_date, scheduled_time, duration_minutes, status,
      address, notes, follow_up_required, follow_up_date,
      assigned_to, estimated_value, lead_source,
    } = req.body;
    try {
      const { rows } = await pool.query(`
        UPDATE consultations SET
          customer_id       = COALESCE($1, customer_id),
          contact_name      = $2,
          contact_phone     = $3,
          contact_email     = $4,
          scheduled_date    = $5,
          scheduled_time    = $6,
          duration_minutes  = COALESCE($7, duration_minutes),
          status            = COALESCE($8, status),
          address           = $9,
          notes             = $10,
          follow_up_required = COALESCE($11, follow_up_required),
          follow_up_date    = $12,
          assigned_to       = $13,
          estimated_value   = $14,
          lead_source       = $15,
          updated_at        = NOW()
        WHERE id = $16
        RETURNING *
      `, [
        customer_id || null, contact_name || null, contact_phone || null, contact_email || null,
        scheduled_date || null, scheduled_time || null, duration_minutes ?? null, status ?? null,
        address || null, notes || null, follow_up_required ?? null, follow_up_date || null,
        assigned_to || null, estimated_value || null, lead_source || null,
        id,
      ]);
      if (!rows[0]) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (err: any) {
      console.error("[consultations/update]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── DELETE ────────────────────────────────────────────────────────────────────
  app.delete("/api/consultations/:id", requireAuth, async (req, res) => {
    try {
      await pool.query("DELETE FROM consultations WHERE id = $1", [req.params.id]);
      res.status(204).end();
    } catch (err: any) {
      console.error("[consultations/delete]", err.message);
      res.status(500).json({ error: err.message });
    }
  });
}
