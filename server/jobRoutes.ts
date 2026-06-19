import { Express } from "express";
import { pool } from "./db";
import { sendEmail, escapeHtml } from "./emailService";
import { sendSms, isSmsConfigured } from "./smsService";
import { logChange } from "./auditLog";

// Statuses that trigger a customer notification email
const NOTIFY_STATUSES: Record<string, string> = {
  scheduled:   "Your Job Has Been Scheduled",
  in_progress: "Your Job Is Now In Progress",
  completed:   "Your Job Is Complete",
  cancelled:   "Update on Your Job",
};

async function sendJobStatusEmail(jobId: string, newStatus: string) {
  const label = NOTIFY_STATUSES[newStatus];
  if (!label) return; // only notify for specific statuses

  try {
    const jobRes = await pool.query(`
      SELECT j.title, j.scheduled_date, j.address, j.city, j.state, j.description,
             c.first_name, c.last_name, c.company_name,
             ce.email AS customer_email
      FROM jobs j
      LEFT JOIN customers c ON c.id = j.customer_id
      LEFT JOIN customer_emails ce ON ce.customer_id = c.id AND ce.is_primary = true
      WHERE j.id = $1
    `, [jobId]);
    const row = jobRes.rows[0];
    if (!row?.customer_email) return;

    const customerName = row.first_name
      ? `${row.first_name} ${row.last_name}`.trim()
      : row.company_name || "Valued Customer";

    const statusLine: Record<string, string> = {
      scheduled:   "Great news — your job has been scheduled! Our team will be there on the date below.",
      in_progress: "Our crew has started work on your job. We'll keep you updated as we make progress.",
      completed:   "Your job is complete! Thank you for choosing Chapin Landscapes.",
      cancelled:   "We wanted to let you know that your job has been cancelled. Please contact us if you have any questions.",
    };

    const dateStr = row.scheduled_date
      ? new Date(row.scheduled_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
      : null;
    const location = [row.address, row.city, row.state].filter(Boolean).join(", ");

    await sendEmail({
      to: row.customer_email,
      subject: `${label} — ${row.title}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#222">
          <div style="background:#2d5a27;padding:20px 24px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">Chapin Landscapes</h1>
          </div>
          <div style="padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px">
            <p>Hi ${escapeHtml(customerName)},</p>
            <p>${statusLine[newStatus] ?? ""}</p>
            <table style="border-collapse:collapse;width:100%;margin:16px 0">
              <tr><td style="padding:8px 12px;font-weight:bold;background:#f9fafb;border:1px solid #e5e7eb">Job</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${escapeHtml(row.title)}</td></tr>
              ${dateStr ? `<tr><td style="padding:8px 12px;font-weight:bold;background:#f9fafb;border:1px solid #e5e7eb">Date</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${dateStr}</td></tr>` : ""}
              ${location ? `<tr><td style="padding:8px 12px;font-weight:bold;background:#f9fafb;border:1px solid #e5e7eb">Location</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${escapeHtml(location)}</td></tr>` : ""}
            </table>
            <p>If you have any questions, please don't hesitate to reach out.</p>
            <p style="margin-top:24px;color:#666;font-size:0.85em">Chapin Landscapes · (555) 000-0000</p>
          </div>
        </div>
      `,
    });
  } catch {
    // don't block the response if email fails
  }
}

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
  app.patch("/api/jobs/:id/status", requireAuth, async (req: any, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "status is required" });
    try {
      const before = await pool.query(`SELECT status, title FROM jobs WHERE id = $1`, [req.params.id]);
      const oldStatus = before.rows[0]?.status ?? "";
      const result = await pool.query(
        `UPDATE jobs SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
        [status, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "Job not found" });
      // Audit log
      if (oldStatus !== status) {
        await logChange({
          entityType: "job",
          entityId: req.params.id,
          entityLabel: before.rows[0]?.title,
          fieldChanged: "status",
          oldValue: oldStatus,
          newValue: status,
          action: "status_change",
          changedById: req.user?.id ?? null,
          changedByName: req.user ? `${req.user.firstName ?? req.user.first_name ?? ""} ${req.user.lastName ?? req.user.last_name ?? ""}`.trim() : null,
        });
        // Fire-and-forget customer notification email
        sendJobStatusEmail(req.params.id, status);
      }
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

  // ── CONTACT CUSTOMER ─────────────────────────────────────────────────────────
  app.post("/api/jobs/:id/contact-customer", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { via, subject, message } = req.body as {
        via: ("email" | "sms")[];
        subject: string;
        message: string;
      };

      if (!via?.length) return res.status(400).json({ message: "Specify at least one channel (email or sms)" });
      if (!message?.trim()) return res.status(400).json({ message: "Message is required" });

      // Fetch job + customer primary contacts
      const jobRes = await pool.query(`
        SELECT j.id, j.title, j.client, j.customer_id,
               c.first_name, c.last_name, c.company_name,
               ce.email AS primary_email,
               cp.phone AS primary_phone
        FROM jobs j
        LEFT JOIN customers c ON c.id = j.customer_id
        LEFT JOIN customer_emails ce ON ce.customer_id = c.id AND ce.is_primary = true
        LEFT JOIN customer_phones cp ON cp.customer_id = c.id AND cp.is_primary = true
        WHERE j.id = $1
      `, [id]);

      if (!jobRes.rows.length) return res.status(404).json({ message: "Job not found" });

      const job = jobRes.rows[0];
      const customerName = job.first_name
        ? `${job.first_name} ${job.last_name || ""}`.trim()
        : (job.company_name || job.client || "Customer");

      const results: Record<string, boolean | string> = {};

      // ── Email ──
      if (via.includes("email")) {
        if (!job.primary_email) {
          results.email = "no_email";
        } else {
          const html = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:#166534;padding:20px;text-align:center;">
                <h1 style="color:white;margin:0;">Chapin Landscapes</h1>
              </div>
              <div style="padding:30px;background:#f9fafb;">
                <p style="color:#374151;">Hi ${escapeHtml(customerName)},</p>
                <div style="background:white;padding:20px;border-radius:8px;border:1px solid #e5e7eb;color:#374151;white-space:pre-wrap;">${escapeHtml(message)}</div>
              </div>
              <div style="padding:16px;text-align:center;color:#9ca3af;font-size:12px;">
                Chapin Landscapes · Professional Landscape Services
              </div>
            </div>
          `;
          const sent = await sendEmail(job.primary_email, subject || `Regarding your job: ${job.title || ""}`, html);
          results.email = sent ? "sent" : "failed";
        }
      }

      // ── SMS ──
      if (via.includes("sms")) {
        if (!job.primary_phone) {
          results.sms = "no_phone";
        } else if (!isSmsConfigured()) {
          results.sms = "not_configured";
        } else {
          const sent = await sendSms(job.primary_phone, message);
          results.sms = sent ? "sent" : "failed";
        }
      }

      return res.json({ ok: true, results, customerName, email: job.primary_email, phone: job.primary_phone });
    } catch (err: any) {
      console.error("[jobs] contact-customer error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── JOB TYPES LIST ────────────────────────────────────────────────────────────
  app.get("/api/jobs/meta/types", requireAuth, (_req, res) => {
    return res.json(JOB_TYPES);
  });
}
