import { Express } from "express";
import { pool } from "./db";
import { sendEmail, escapeHtml } from "./emailService";
import { sendSms, isSmsConfigured } from "./smsService";
import { logChange } from "./auditLog";
import { autoCreateDraftWorkOrder } from "./workOrderAutoCreate";

// Statuses that trigger a customer notification email
const NOTIFY_STATUSES: Record<string, string> = {
  scheduled:   "Your Job Has Been Scheduled",
  in_progress: "Your Job Is Now In Progress",
  completed:   "Your Job Is Complete",
  cancelled:   "Update on Your Job",
};

function getPortalBaseUrl(): string {
  return process.env.APP_BASE_URL
    ?? (process.env.NODE_ENV === "production"
      ? "https://companyhq.chapinlandscapes.com"
      : `http://localhost:${process.env.PORT ?? 5000}`);
}

function renderJobStatusEmailHtml(
  row: { title: string; scheduled_date: string | null; address: string | null; city: string | null; state: string | null; first_name: string | null; last_name: string | null; company_name: string | null },
  newStatus: string,
  portalLink: string,
): { subject: string; html: string } {
  const label = NOTIFY_STATUSES[newStatus] ?? newStatus;
  const customerName = row.first_name
    ? `${row.first_name} ${row.last_name ?? ""}`.trim()
    : row.company_name || "Valued Customer";

  const statusLine: Record<string, string> = {
    scheduled:   "Great news — your job has been scheduled! Our team will be there on the date below.",
    in_progress: "Our crew has started work on your job. We'll keep you updated as we make progress.",
    completed:   "Your job is complete! Thank you for choosing Chapin Landscapes. You can view your job details, photos, and documents in your Customer Portal.",
    cancelled:   "We wanted to let you know that your job has been cancelled. Please contact us if you have any questions.",
  };

  const completionCta = newStatus === "completed"
    ? `<div style="text-align:center;margin:24px 0">
         <a href="${portalLink}" style="display:inline-block;background:#2d5a27;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:15px">View My Job in Customer Portal →</a>
       </div>`
    : "";

  const dateStr = row.scheduled_date
    ? new Date(row.scheduled_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : null;
  const location = [row.address, row.city, row.state].filter(Boolean).join(", ");

  const html = `
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
        ${completionCta}
        <p>If you have any questions, please don't hesitate to reach out.</p>
        <p style="margin-top:24px;color:#666;font-size:0.85em">Chapin Landscapes · <a href="${portalLink}" style="color:#2d5a27">Customer Portal</a></p>
      </div>
    </div>
  `;
  return { subject: `${label} — ${row.title}`, html };
}

async function sendJobStatusEmail(jobId: string, newStatus: string) {
  const label = NOTIFY_STATUSES[newStatus];
  if (!label) return;

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

    const portalLink = `${getPortalBaseUrl()}/customer-hub`;
    const { subject, html } = renderJobStatusEmailHtml(row, newStatus, portalLink);
    await sendEmail(row.customer_email, subject, html);
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
  const requireNonCustomer = (req: any, res: any, next: any) => {
    if (req.user?.role === "Customer") return res.status(403).json({ message: "Access denied" });
    next();
  };
  app.use("/api/jobs", requireNonCustomer);

  // ── LIST ──────────────────────────────────────────────────────────────────────
  app.get("/api/jobs", requireAuth, async (req, res) => {
    const { status, customer_id, date_from, date_to, search, behind_schedule, missing_work_order } = req.query as Record<string, string>;

    try {
      let q = `
        SELECT
          j.id, j.title, j.client, j.status, j.job_type, j.type,
          j.stage, j.category, j.price, j.value,
          j.progress,
          j.scheduled_date, j.scheduled_start_time, j.scheduled_end_time,
          j.completion_date, j.estimated_hours, j.address, j.city, j.state,
          j.customer_id, j.property_id, j.created_at,
          c.first_name  AS cust_first,
          c.last_name   AS cust_last,
          c.company_name AS cust_company,
          p.address     AS prop_address,
          p.city        AS prop_city,
          p.state       AS prop_state,
          CASE WHEN (
            (j.status = 'in_progress' AND COALESCE(j.progress, 0) < 100
             AND j.scheduled_date IS NOT NULL
             AND (CASE WHEN j.scheduled_end_time IS NOT NULL
                       THEN (j.scheduled_date::date::text || ' ' || j.scheduled_end_time)::timestamp < NOW()
                       ELSE j.scheduled_date::date < CURRENT_DATE END))
            OR
            (j.status = 'scheduled'
             AND j.scheduled_date IS NOT NULL
             AND (CASE WHEN j.scheduled_start_time IS NOT NULL
                       THEN (j.scheduled_date::date::text || ' ' || j.scheduled_start_time)::timestamp < NOW()
                       ELSE j.scheduled_date::date < CURRENT_DATE END))
          ) THEN true ELSE false END AS is_behind_schedule,
          EXISTS(SELECT 1 FROM work_orders wo WHERE wo.job_id = j.id::text) AS has_work_order
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

      if (behind_schedule === "true") {
        q += ` AND ((j.status = 'in_progress' AND COALESCE(j.progress, 0) < 100
               AND j.scheduled_date IS NOT NULL
               AND (CASE WHEN j.scheduled_end_time IS NOT NULL
                         THEN (j.scheduled_date::date::text || ' ' || j.scheduled_end_time)::timestamp < NOW()
                         ELSE j.scheduled_date::date < CURRENT_DATE END))
              OR (j.status = 'scheduled'
               AND j.scheduled_date IS NOT NULL
               AND (CASE WHEN j.scheduled_start_time IS NOT NULL
                         THEN (j.scheduled_date::date::text || ' ' || j.scheduled_start_time)::timestamp < NOW()
                         ELSE j.scheduled_date::date < CURRENT_DATE END)))`;
      }

      if (missing_work_order === "true") {
        q += ` AND NOT EXISTS(SELECT 1 FROM work_orders wo WHERE wo.job_id = j.id::text)
               AND j.status IN ('lead','scheduled','in_progress')`;
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
          (SELECT cp.phone FROM customer_phones cp
           WHERE cp.customer_id = c.id AND cp.is_primary = true LIMIT 1) AS cust_primary_phone,
          (SELECT ce.email FROM customer_emails ce
           WHERE ce.customer_id = c.id AND ce.is_primary = true LIMIT 1) AS cust_primary_email,
          p.address      AS prop_address,
          p.city         AS prop_city,
          p.state        AS prop_state,
          p.zip          AS prop_zip,
          p.access_notes AS prop_access_notes,
          p.gate_code    AS prop_gate_code,
          p.has_pets     AS prop_has_pets,
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

  // ── LABOR COST FOR JOB COSTING SUMMARY ───────────────────────────────────────
  // Computes labor cost from completed, non-break/shop time entries × employee pay_rate.
  // Mirrors the join used in /api/reports/job-profitability for consistency.
  app.get("/api/jobs/:id/labor-cost", requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
      const { rows } = await pool.query(
        `SELECT
           COALESCE(SUM(
             EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600
             * COALESCE(NULLIF(emp.pay_rate, '')::numeric, 0)
           ), 0)::numeric AS labor_cost,
           COALESCE(SUM(
             EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600
           ), 0)::numeric AS total_hours,
           COUNT(te.id)::int AS entry_count,
           COUNT(CASE WHEN (emp.pay_rate IS NULL OR emp.pay_rate = '') THEN 1 END)::int AS missing_rate_count
         FROM time_entries te
         LEFT JOIN employees emp ON emp.user_id = te.user_id
         WHERE te.job_id = $1
           AND te.clock_out IS NOT NULL
           AND te.entry_type NOT IN ('break', 'shop_time', 'shop')`,
        [id]
      );
      const r = rows[0];
      return res.json({
        labor_cost:          Math.round(Number(r.labor_cost) * 100) / 100,
        total_hours:         Math.round(Number(r.total_hours) * 100) / 100,
        entry_count:         Number(r.entry_count),
        missing_rate_count:  Number(r.missing_rate_count),
      });
    } catch (err: any) {
      console.error("[jobs/labor-cost]", err.message);
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
      const newJob = result.rows[0];
      autoCreateDraftWorkOrder(newJob.id, newJob.title || newJob.client, newJob.category)
        .catch((e: any) => console.error("[jobs] autoCreateDraftWorkOrder:", e.message));
      return res.status(201).json(newJob);
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
      category, stage, value, skipped_work_notes,
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
          skipped_work_notes  = $25,
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
        skipped_work_notes ?? null,
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
        "category","value","is_mandatory_date","skipped_work_notes",
        "crew_notes_customer_visible",
        "safety_notes",
        "restrictions_notes",
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
      if (before.rows.length === 0) return res.status(404).json({ message: "Job not found" });
      const oldStatus = before.rows[0]?.status ?? "";

      // Required before/after photo enforcement (Business Rules toggle, defaults ON)
      if (status.toLowerCase() === "completed" && oldStatus.toLowerCase() !== "completed") {
        try {
          const ruleRes = await pool.query(
            `SELECT value FROM business_rules WHERE key = 'require_before_after_photos'`
          );
          const enforceOn = ruleRes.rows.length === 0 || (ruleRes.rows[0].value ?? "On").toLowerCase() !== "off";
          if (enforceOn) {
            const photoRes = await pool.query(
              `SELECT wp.photo_type, COUNT(*)::int AS count
               FROM worksheet_photos wp
               JOIN worksheet_sessions ws ON ws.id = wp.session_id
               WHERE ws.job_id = $1 AND wp.photo_type IN ('before','after')
               GROUP BY wp.photo_type`,
              [req.params.id]
            );
            const counts: Record<string, number> = {};
            for (const r of photoRes.rows) counts[r.photo_type] = r.count;
            const missing: string[] = [];
            if (!counts.before) missing.push("a before photo");
            if (!counts.after) missing.push("an after photo");
            if (missing.length > 0) {
              return res.status(400).json({
                message: `Cannot mark job Completed — missing ${missing.join(" and ")}. Attach the required photo(s) under Worksheet Photos before completing this job.`,
              });
            }
          }
        } catch (ruleErr: any) {
          console.error("[jobs] required-photo check error:", ruleErr.message);
          // Fail open on unexpected errors so completion isn't permanently blocked by an infra issue
        }
      }

      // ── Work Order gate for "ready" status ──────────────────────────────────
      if (status.toLowerCase() === "ready") {
        const woCheck = await pool.query(
          `SELECT id, status FROM work_orders
           WHERE job_id = $1 AND status != 'cancelled'
           ORDER BY created_at DESC LIMIT 1`,
          [req.params.id]
        );
        if (woCheck.rows.length === 0) {
          return res.status(400).json({
            message: "Cannot mark this job Ready — no work order has been created for this job. Create and approve a work order first.",
            reason: "no_work_order",
          });
        }
        if (woCheck.rows[0].status === "draft") {
          return res.status(400).json({
            message: "Cannot mark this job Ready — the work order is still in Draft. A manager must approve the work order before the job can be marked Ready.",
            reason: "work_order_draft",
          });
        }
      }

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

        if (status.toLowerCase() === "completed") {
          import("./automationEngine").then(({ onJobCompleted }) => {
            onJobCompleted(req.params.id).catch(() => {});
          }).catch(() => {});
        }
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
        } else if (!isSmsConfigured("customer")) {
          results.sms = "not_configured";
        } else {
          const sent = await sendSms(job.primary_phone, message, "customer");
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

  // ── EMAIL PREVIEW ─────────────────────────────────────────────────────────────
  // GET /api/jobs/:id/status-email-preview?status=completed
  // Staff-only. Returns the rendered HTML for the customer notification email
  // without actually sending it. Used to verify portal link is correct.
  app.get("/api/jobs/:id/status-email-preview", requireAuth, requireNonCustomer, async (req, res) => {
    try {
      const status = (req.query.status as string) || "completed";
      const jobRes = await pool.query(`
        SELECT j.title, j.scheduled_date, j.address, j.city, j.state, j.description,
               c.first_name, c.last_name, c.company_name,
               ce.email AS customer_email
        FROM jobs j
        LEFT JOIN customers c ON c.id = j.customer_id
        LEFT JOIN customer_emails ce ON ce.customer_id = c.id AND ce.is_primary = true
        WHERE j.id = $1
      `, [req.params.id]);
      if (!jobRes.rows.length) return res.status(404).json({ message: "Job not found" });
      const row = jobRes.rows[0];
      const portalLink = `${getPortalBaseUrl()}/customer-hub`;
      const { subject, html } = renderJobStatusEmailHtml(row, status, portalLink);
      return res.json({ subject, html, portalLink, customerEmail: row.customer_email });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── ADMIN WORKSHEET SESSION (for staff-uploaded before/after photos) ─────────
  // POST /api/jobs/:id/admin-worksheet-session
  // Staff-only. Finds-or-creates an 'approved' worksheet_session owned by the
  // requesting user for the given job + today. Returns { sessionId }.
  // The session can then be used with the existing POST /api/worksheets/:sessionId/photos.
  app.post("/api/jobs/:id/admin-worksheet-session", requireAuth, requireNonCustomer, async (req: any, res) => {
    try {
      const jobId = req.params.id;
      const userId = req.user.id;

      const { rows: jobRows } = await pool.query(`SELECT id FROM jobs WHERE id = $1`, [jobId]);
      if (!jobRows.length) return res.status(404).json({ message: "Job not found" });

      const today = new Date().toISOString().slice(0, 10);

      const { rows: existing } = await pool.query(
        `SELECT id FROM worksheet_sessions WHERE job_id = $1 AND employee_id = $2 AND date = $3 AND status = 'approved' LIMIT 1`,
        [jobId, userId, today]
      );
      if (existing.length) {
        return res.json({ sessionId: existing[0].id });
      }

      const { rows: created } = await pool.query(
        `INSERT INTO worksheet_sessions (job_id, employee_id, date, status) VALUES ($1, $2, $3, 'approved') RETURNING id`,
        [jobId, userId, today]
      );
      return res.json({ sessionId: created[0].id });
    } catch (err: any) {
      console.error("[jobs] admin-worksheet-session error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });
}
