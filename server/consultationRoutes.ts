import { Express } from "express";
import { pool } from "./db";
import { sendEmail, escapeHtml, getAppUrl } from "./emailService";
import { storage } from "./storage";

import { requireRole } from "./auth";

// ── Pipeline stage definitions ─────────────────────────────────────────────────
export const PIPELINE_STAGES = [
  "new_lead", "needs_review", "qualified", "appointment_scheduled",
  "pre_visit_ready", "site_visit_complete", "estimate_in_progress",
  "estimate_ready", "estimate_sent", "follow_up",
  "sold_approved", "lost_nurture", "handoff_production",
  "job_scheduled", "in_progress", "punch_list",
  "complete", "invoice_review", "closed",
] as const;

// Service types that skip 811 task
const SKIP_811_TYPES = ["Maintenance", "Snow Removal", "Salt Application", "Spring Clean Up", "Summer Clean Up", "Fall Clean Up"];

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
      assigned_to      VARCHAR(36) REFERENCES employees(id) ON DELETE SET NULL,
      estimated_value  NUMERIC(12,2),
      lead_source      VARCHAR(100),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_consultations_scheduled_date ON consultations(scheduled_date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_consultations_customer_id ON consultations(customer_id)`);

  // Pipeline stage columns (Part 2)
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(50) DEFAULT 'new_lead'`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS budget_range VARCHAR(100)`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS project_description TEXT`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS best_time_to_reach VARCHAR(100)`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS utilities_marked BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS permit_required BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS permit_status VARCHAR(100)`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS service_type VARCHAR(100)`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::jsonb`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS how_heard VARCHAR(100)`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS project_type VARCHAR(50)`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS desired_timeline VARCHAR(100)`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS additional_notes TEXT`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_consultations_pipeline_stage ON consultations(pipeline_stage)`);

  // Phase 2: business data chain columns
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS property_id UUID`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS contact_id UUID`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS lead_score INT DEFAULT 0`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS lost_reason TEXT`);
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS next_follow_up_date DATE`);

  // Blocker #4: link consultations back to the qualified lead they were auto-created from
  await pool.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS qualified_lead_id VARCHAR(36) REFERENCES qualified_leads(id) ON DELETE SET NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_consultations_qualified_lead_id ON consultations(qualified_lead_id)`);
  console.log("[migration] consultations.qualified_lead_id column ready (Lead Qualifier -> pipeline link)");

  // Fix assigned_to FK: drop any existing constraint (old or new) then re-add pointing to employees
  await pool.query(`ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_assigned_to_fkey`);
  await pool.query(`ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_assigned_to_employees_fkey`);
  await pool.query(`ALTER TABLE consultations ADD CONSTRAINT consultations_assigned_to_employees_fkey FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL`);
  console.log("[migration] consultations assigned_to FK fixed -> employees(id)");

  // S10-5/S10-6: lead assignment settings in app_settings
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_map_app TEXT DEFAULT 'google'`);
  await pool.query(`INSERT INTO app_settings (key, value) VALUES ('lead_assign_mode', 'none') ON CONFLICT (key) DO NOTHING`);
  await pool.query(`INSERT INTO app_settings (key, value) VALUES ('lead_default_assignee', '') ON CONFLICT (key) DO NOTHING`);
  await pool.query(`INSERT INTO app_settings (key, value) VALUES ('lead_assign_last_idx', '0') ON CONFLICT (key) DO NOTHING`);

  console.log("[migration] consultations table ready");
}

// ── Lead auto-assign + follow-up helpers ─────────────────────────────────────

function addBusinessDays(date: Date, days: number): Date {
  const d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

export async function getAutoFollowUpDate(): Promise<string | null> {
  try {
    const r = await pool.query(`SELECT value FROM business_rules WHERE key = 'lead_followup_days'`);
    const days = Math.max(1, parseInt(r.rows[0]?.value ?? "2", 10));
    return addBusinessDays(new Date(), days).toISOString().slice(0, 10);
  } catch {
    return addBusinessDays(new Date(), 2).toISOString().slice(0, 10);
  }
}

export async function getAutoAssignee(explicitAssignee: string | null | undefined): Promise<string | null> {
  if (explicitAssignee) return explicitAssignee;
  try {
    const modeRes = await pool.query(`SELECT value FROM app_settings WHERE key = 'lead_assign_mode'`);
    const mode = modeRes.rows[0]?.value ?? "none";

    if (mode === "specific") {
      const idRes = await pool.query(`SELECT value FROM app_settings WHERE key = 'lead_default_assignee'`);
      const empId = (idRes.rows[0]?.value ?? "").trim();
      if (!empId) return null;
      const chk = await pool.query(`SELECT id FROM employees WHERE id = $1`, [empId]);
      return chk.rows.length ? empId : null;
    }

    if (mode === "round_robin") {
      const empsRes = await pool.query(`
        SELECT e.id FROM employees e
        JOIN users u ON u.id = e.user_id
        WHERE u.role IN ('Admin','Manager') AND e.status = 'active'
        ORDER BY e.id
      `);
      if (!empsRes.rows.length) return null;
      const idxRes = await pool.query(`SELECT value FROM app_settings WHERE key = 'lead_assign_last_idx'`);
      const lastIdx = parseInt(idxRes.rows[0]?.value ?? "0", 10) || 0;
      const nextIdx = (lastIdx + 1) % empsRes.rows.length;
      await pool.query(`UPDATE app_settings SET value = $1 WHERE key = 'lead_assign_last_idx'`, [String(nextIdx)]);
      return empsRes.rows[nextIdx].id;
    }
  } catch (e: any) {
    console.error("[lead-auto-assign]", e.message);
  }
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function sendStaffNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  link: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await pool.query(
      `INSERT INTO staff_notifications (id, user_id, type, title, message, link, metadata, is_read, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, FALSE, NOW())`,
      [userId, type, title, message, link, JSON.stringify(metadata)],
    );
  } catch (err: any) {
    console.error("[consultations] notification error:", err.message);
  }
}

async function getDanChapin(): Promise<{ id: string; email: string; name: string } | null> {
  const { rows } = await pool.query(`SELECT id, email, name FROM users WHERE email ILIKE 'dan@chapinlandscapes.com' LIMIT 1`);
  return rows[0] ?? null;
}

async function getMattH(): Promise<{ id: string; email: string; name: string } | null> {
  const { rows } = await pool.query(`SELECT id, email, name FROM users WHERE email ILIKE 'matt@chapinlandscapes.com' LIMIT 1`);
  return rows[0] ?? null;
}

async function triggerNewLeadAlerts(consultation: any) {
  try {
    const dan = await getDanChapin();
    if (!dan) return;
    const customerName = consultation.customer_name || consultation.contact_name || "Unknown";
    const serviceType = consultation.service_type || "N/A";
    const budget = consultation.budget_range || "Not provided";
    const msg = `New lead received from ${customerName} - ${serviceType} - Budget: ${budget}`;
    const link = `/consultations`;

    await sendStaffNotification(dan.id, "new_lead", "New Lead Received", msg, link);

    // Email
    await sendEmail(dan.email, "New Lead Received — Chapin Landscapes", `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #166534; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Chapin Landscapes</h1>
          <p style="color: #bbf7d0; margin: 4px 0 0; font-size: 14px;">New Lead Notification</p>
        </div>
        <div style="padding: 30px; background-color: #f9fafb;">
          <h2 style="color: #1f2937;">New Lead Received</h2>
          <p style="color: #4b5563;">A new lead has come in and is waiting for your review.</p>
          <table style="width:100%; border-collapse:collapse; margin:16px 0;">
            <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f3f4f6;">Customer</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(customerName)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f3f4f6;">Service Type</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(serviceType)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f3f4f6;">Budget</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(budget)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f3f4f6;">Phone</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(consultation.contact_phone || "N/A")}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f3f4f6;">Email</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(consultation.contact_email || "N/A")}</td></tr>
          </table>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${getAppUrl()}/consultations" style="background-color: #166534; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View in CompanyHQ</a>
          </div>
        </div>
        <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>Chapin Landscapes — CompanyHQ</p>
        </div>
      </div>
    `);
  } catch (err: any) {
    console.error("[consultations] lead alert error:", err.message);
  }
}

async function trigger811Task(consultation: any) {
  try {
    const serviceType = consultation.service_type || "";
    if (SKIP_811_TYPES.some(s => serviceType.toLowerCase().includes(s.toLowerCase()))) {
      console.log("[consultations] 811 task skipped for service type:", serviceType);
      return;
    }

    const matt = await getMattH();
    if (!matt) {
      console.log("[consultations] Matt H not found, skipping 811 task");
      return;
    }

    const customerName = consultation.customer_name || consultation.contact_name || "Unknown Customer";
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    // Get a system/admin user for createdByUserId
    const { rows: adminRows } = await pool.query(`SELECT id FROM users WHERE is_master_admin = TRUE LIMIT 1`);
    const adminId = adminRows[0]?.id || matt.id;

    const task = await storage.createTask({
      title: `Call 811 - Utility Marking for ${customerName}`,
      description: `Call 811 to have utilities marked before work begins for ${customerName}. Address: ${consultation.address || "See consultation"}`,
      type: "standard",
      priority: "high",
      status: "todo",
      createdByUserId: adminId,
      assignedToUserId: matt.id,
      dueDate: dueDate,
      category: "Operations",
      linkedRecordType: "consultation",
      linkedRecordId: consultation.id,
    });

    await sendStaffNotification(
      matt.id,
      "task_assigned",
      "Task Assigned: Call 811",
      `Task assigned: Call 811 for ${customerName}. Due in 3 days.`,
      `/tasks`
    );

    console.log("[consultations] 811 task created for:", customerName);
  } catch (err: any) {
    console.error("[consultations] 811 task error:", err.message);
  }
}

export async function registerConsultationRoutes(app: Express, requireAuth: any) {
  await migrateConsultations();

  // ── STATS ─────────────────────────────────────────────────────────────────────
  app.get("/api/consultations/stats", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
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
      res.json(rows[0] ?? { total_scheduled: 0, completed_this_month: 0, no_shows: 0, pipeline_value: 0 });
    } catch (err: any) {
      console.error("[consultations/stats]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PIPELINE STATS ───────────────────────────────────────────────────────────
  app.get("/api/consultations/pipeline-stats", requireAuth, requireRole("Admin", "Manager"), async (_req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT pipeline_stage, COUNT(*)::int AS count
        FROM consultations
        GROUP BY pipeline_stage
      `);
      const map: Record<string, number> = {};
      rows.forEach(r => { map[r.pipeline_stage] = r.count; });
      res.json(map);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── LIST ──────────────────────────────────────────────────────────────────────
  app.get("/api/consultations", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    const {
      status, date_from, date_to, assigned_to, search, pipeline_stage, customer_id,
      unassigned_only, overdue_followup,
    } = req.query as Record<string, string>;
    try {
      const params: any[] = [];
      const conds: string[] = [];

      if (customer_id)    { params.push(customer_id);    conds.push(`c.customer_id = $${params.length}`); }
      if (status)         { params.push(status);         conds.push(`c.status = $${params.length}`); }
      if (pipeline_stage) { params.push(pipeline_stage); conds.push(`c.pipeline_stage = $${params.length}`); }
      if (date_from)      { params.push(date_from);      conds.push(`c.scheduled_date >= $${params.length}`); }
      if (date_to)        { params.push(date_to);        conds.push(`c.scheduled_date <= $${params.length}`); }
      if (assigned_to)    { params.push(assigned_to);    conds.push(`c.assigned_to = $${params.length}`); }
      if (unassigned_only === "true") { conds.push(`c.assigned_to IS NULL`); }
      if (overdue_followup === "true") { conds.push(`c.next_follow_up_date < CURRENT_DATE`); }
      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        conds.push(`(
          LOWER(c.contact_name) LIKE $${params.length} OR
          LOWER(c.address)      LIKE $${params.length} OR
          LOWER(cust.first_name || ' ' || cust.last_name) LIKE $${params.length} OR
          LOWER(COALESCE(cust.company_name,'')) LIKE $${params.length}
        )`);
      }

      const today = new Date().toISOString().slice(0, 10);
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const { rows } = await pool.query(`
        SELECT
          c.*,
          cust.first_name   AS cust_first,
          cust.last_name    AS cust_last,
          cust.company_name AS cust_company,
          u.name            AS assigned_name
        FROM consultations c
        LEFT JOIN customers cust ON cust.id = c.customer_id
        LEFT JOIN users     u    ON u.id    = c.assigned_to
        ${where}
        ORDER BY c.created_at DESC NULLS LAST
      `, params);

      res.json(rows.map(r => ({
        ...r,
        customer_name: r.cust_company || `${r.cust_first ?? ""} ${r.cust_last ?? ""}`.trim() || null,
        is_overdue_followup: !!(r.next_follow_up_date && r.next_follow_up_date.toISOString?.().slice(0,10) < today || (typeof r.next_follow_up_date === "string" && r.next_follow_up_date < today)),
      })));
    } catch (err: any) {
      console.error("[consultations/list]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── CREATE ────────────────────────────────────────────────────────────────────
  app.post("/api/consultations", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    const {
      customer_id, contact_name, contact_phone, contact_email,
      scheduled_date, scheduled_time, duration_minutes, status,
      address, notes, follow_up_required, follow_up_date,
      assigned_to, estimated_value, lead_source,
      pipeline_stage, budget_range, project_description, best_time_to_reach,
      utilities_marked, permit_required, permit_status, service_type,
      photo_urls, how_heard, project_type, desired_timeline, additional_notes,
      next_follow_up_date,
    } = req.body;
    try {
      const effectiveStage = pipeline_stage || "new_lead";

      // S10-5: auto-assign if no explicit assignee provided
      const effectiveAssignee = await getAutoAssignee(assigned_to || null);

      // S10-6: auto-set follow-up date for new leads without explicit date
      let effectiveFollowUpDate = next_follow_up_date || null;
      if (!effectiveFollowUpDate && effectiveStage === "new_lead") {
        effectiveFollowUpDate = await getAutoFollowUpDate();
      }

      const { rows } = await pool.query(`
        INSERT INTO consultations (
          customer_id, contact_name, contact_phone, contact_email,
          scheduled_date, scheduled_time, duration_minutes, status,
          address, notes, follow_up_required, follow_up_date,
          assigned_to, estimated_value, lead_source,
          pipeline_stage, budget_range, project_description, best_time_to_reach,
          utilities_marked, permit_required, permit_status, service_type,
          photo_urls, how_heard, project_type, desired_timeline, additional_notes,
          next_follow_up_date
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
        RETURNING *
      `, [
        customer_id || null, contact_name || null, contact_phone || null, contact_email || null,
        scheduled_date || null, scheduled_time || null, duration_minutes ?? 60, status ?? "scheduled",
        address || null, notes || null, follow_up_required ?? false, follow_up_date || null,
        effectiveAssignee, estimated_value || null, lead_source || null,
        effectiveStage, budget_range || null, project_description || null, best_time_to_reach || null,
        utilities_marked ?? false, permit_required ?? false, permit_status || null, service_type || null,
        JSON.stringify(photo_urls || []), how_heard || null, project_type || null, desired_timeline || null, additional_notes || null,
        effectiveFollowUpDate,
      ]);

      const created = rows[0];

      // Part 3: Lead alerts
      if ((created.pipeline_stage || "new_lead") === "new_lead") {
        const customerName = contact_name || null;
        triggerNewLeadAlerts({
          ...created,
          customer_name: customerName,
        }).catch(e => console.error("[lead-alert]", e.message));
      }

      res.status(201).json(created);
    } catch (err: any) {
      console.error("[consultations/create]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── LEAD SOURCE BREAKDOWN ────────────────────────────────────────────────────
  app.get("/api/consultations/source-stats", requireAuth, requireRole("Admin", "Manager"), async (_req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          COALESCE(NULLIF(lead_source, ''), 'Unknown') AS source,
          COUNT(*)::int AS count
        FROM consultations
        GROUP BY COALESCE(NULLIF(lead_source, ''), 'Unknown')
        ORDER BY count DESC
      `);
      res.json(rows);
    } catch (err: any) {
      console.error("[consultations/source-stats]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────────
  app.patch("/api/consultations/:id", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    const { id } = req.params;
    const {
      customer_id, contact_name, contact_phone, contact_email,
      scheduled_date, scheduled_time, duration_minutes, status,
      address, notes, follow_up_required, follow_up_date,
      assigned_to, estimated_value, lead_source,
      pipeline_stage, budget_range, project_description, best_time_to_reach,
      utilities_marked, permit_required, permit_status, service_type,
      photo_urls, how_heard, project_type, desired_timeline, additional_notes,
      next_follow_up_date, lost_reason,
    } = req.body;
    try {
      // Get previous stage
      const { rows: prev } = await pool.query(`SELECT pipeline_stage, service_type, contact_name, customer_id, address FROM consultations WHERE id = $1`, [id]);
      const prevStage = prev[0]?.pipeline_stage;

      const { rows } = await pool.query(`
        UPDATE consultations SET
          customer_id         = COALESCE($1, customer_id),
          contact_name        = $2,
          contact_phone       = $3,
          contact_email       = $4,
          scheduled_date      = $5,
          scheduled_time      = $6,
          duration_minutes    = COALESCE($7, duration_minutes),
          status              = COALESCE($8, status),
          address             = $9,
          notes               = $10,
          follow_up_required  = COALESCE($11, follow_up_required),
          follow_up_date      = $12,
          assigned_to         = $13,
          estimated_value     = $14,
          lead_source         = $15,
          pipeline_stage      = COALESCE($16, pipeline_stage),
          budget_range        = COALESCE($17, budget_range),
          project_description = COALESCE($18, project_description),
          best_time_to_reach  = COALESCE($19, best_time_to_reach),
          utilities_marked    = COALESCE($20, utilities_marked),
          permit_required     = COALESCE($21, permit_required),
          permit_status       = COALESCE($22, permit_status),
          service_type        = COALESCE($23, service_type),
          photo_urls          = COALESCE($24::jsonb, photo_urls),
          how_heard           = COALESCE($25, how_heard),
          project_type        = COALESCE($26, project_type),
          desired_timeline    = COALESCE($27, desired_timeline),
          additional_notes    = COALESCE($28, additional_notes),
          next_follow_up_date = $29,
          lost_reason         = COALESCE($30, lost_reason),
          updated_at          = NOW()
        WHERE id = $31
        RETURNING *
      `, [
        customer_id || null, contact_name ?? null, contact_phone ?? null, contact_email ?? null,
        scheduled_date ?? null, scheduled_time ?? null, duration_minutes ?? null, status ?? null,
        address ?? null, notes ?? null, follow_up_required ?? null, follow_up_date ?? null,
        assigned_to ?? null, estimated_value ?? null, lead_source ?? null,
        pipeline_stage ?? null, budget_range ?? null, project_description ?? null, best_time_to_reach ?? null,
        utilities_marked ?? null, permit_required ?? null, permit_status ?? null, service_type ?? null,
        photo_urls ? JSON.stringify(photo_urls) : null,
        how_heard ?? null, project_type ?? null, desired_timeline ?? null, additional_notes ?? null,
        next_follow_up_date ?? null,
        lost_reason ?? null,
        id,
      ]);
      if (!rows[0]) return res.status(404).json({ error: "Not found" });

      const updated = rows[0];

      // Part 4: 811 auto-task when moving to sold_approved
      if (pipeline_stage === "sold_approved" && prevStage !== "sold_approved") {
        const customerRow = updated.customer_id
          ? await pool.query(`SELECT first_name, last_name, company_name FROM customers WHERE id = $1`, [updated.customer_id])
          : null;
        const custName = customerRow?.rows[0]
          ? (customerRow.rows[0].company_name || `${customerRow.rows[0].first_name} ${customerRow.rows[0].last_name}`)
          : (updated.contact_name || "Unknown Customer");

        trigger811Task({ ...updated, customer_name: custName })
          .catch(e => console.error("[811-task]", e.message));
      }

      res.json(updated);
    } catch (err: any) {
      console.error("[consultations/update]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── DELETE ────────────────────────────────────────────────────────────────────
  app.delete("/api/consultations/:id", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    try {
      await pool.query("DELETE FROM consultations WHERE id = $1", [req.params.id]);
      res.status(204).end();
    } catch (err: any) {
      console.error("[consultations/delete]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── LEAD ASSIGNMENT SETTINGS (Admin only) ────────────────────────────────────
  app.get("/api/settings/lead-assignment", requireAuth, requireRole("Admin", "Manager"), async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT key, value FROM app_settings WHERE key IN ('lead_assign_mode','lead_default_assignee','lead_assign_last_idx')`
      );
      const map: Record<string, string> = {};
      rows.forEach(r => { map[r.key] = r.value; });

      let assigneeDetails = null;
      const empId = (map["lead_default_assignee"] ?? "").trim();
      if (empId) {
        const empRes = await pool.query(
          `SELECT e.id, e.first_name, e.last_name FROM employees e WHERE e.id = $1`,
          [empId]
        );
        if (empRes.rows.length) {
          assigneeDetails = { id: empRes.rows[0].id, name: `${empRes.rows[0].first_name} ${empRes.rows[0].last_name}` };
        }
      }

      res.json({
        mode: map["lead_assign_mode"] ?? "none",
        default_assignee: map["lead_default_assignee"] ?? "",
        assignee_details: assigneeDetails,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/settings/lead-assignment", requireAuth, requireRole("Admin"), async (req, res) => {
    const { mode, default_assignee } = req.body;
    const validModes = ["none", "specific", "round_robin"];
    if (mode !== undefined && !validModes.includes(mode)) {
      return res.status(400).json({ error: "mode must be one of: none, specific, round_robin" });
    }
    try {
      if (mode !== undefined) {
        await pool.query(
          `INSERT INTO app_settings (key, value, updated_at) VALUES ('lead_assign_mode', $1, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
          [mode]
        );
      }
      if (default_assignee !== undefined) {
        await pool.query(
          `INSERT INTO app_settings (key, value, updated_at) VALUES ('lead_default_assignee', $1, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
          [default_assignee ?? ""]
        );
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

// ── Lead alert scheduler (exported for index.ts) ──────────────────────────────
export async function checkStaleLeads() {
  try {
    const dan = await getDanChapin();
    if (!dan) return;

    const { rows } = await pool.query(`
      SELECT c.*, 
             COALESCE(cust.company_name, cust.first_name || ' ' || cust.last_name, c.contact_name) AS customer_name
      FROM consultations c
      LEFT JOIN customers cust ON cust.id = c.customer_id
      WHERE c.pipeline_stage = 'new_lead'
        AND c.created_at < NOW() - INTERVAL '4 hours'
        AND c.updated_at <= c.created_at + INTERVAL '1 minute'
    `);

    for (const lead of rows) {
      const customerName = lead.customer_name || lead.contact_name || "Unknown";
      const msg = `Lead ${customerName} has been waiting 4+ hours without review.`;

      // Dedupe: skip if an unread stale_lead alert for this lead already exists in the last 24 h
      const { rows: dupe } = await pool.query(
        `SELECT id FROM staff_notifications
         WHERE user_id = $1
           AND type = 'stale_lead'
           AND is_read = false
           AND metadata->>'leadId' = $2
           AND created_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
        [dan.id, String(lead.id)],
      );
      if (dupe.length > 0) {
        console.log(`[lead-alert] Skipping duplicate stale_lead notification for lead ${lead.id}`);
        continue;
      }

      await sendStaffNotification(dan.id, "stale_lead", "Stale Lead Alert", msg, `/consultations`, { leadId: String(lead.id) });
      await sendEmail(dan.email, "Stale Lead Alert — Chapin Landscapes", `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #dc2626; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Lead Follow-Up Alert</h1>
          </div>
          <div style="padding: 30px; background-color: #f9fafb;">
            <h2 style="color: #1f2937;">Lead Waiting for Review</h2>
            <p style="color: #4b5563;"><strong>${escapeHtml(customerName)}</strong> has been waiting <strong>4+ hours</strong> without review.</p>
            <p style="color: #4b5563;">Service Type: ${escapeHtml(lead.service_type || "N/A")}</p>
            <div style="text-align: center; margin-top: 24px;">
              <a href="${getAppUrl()}/consultations" style="background-color: #166534; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Lead Now</a>
            </div>
          </div>
        </div>
      `);
      console.log(`[lead-alert] Stale lead alert sent for: ${customerName}`);
    }
  } catch (err: any) {
    console.error("[lead-alert] checkStaleLeads error:", err.message);
  }
}

export function startLeadAlertScheduler() {
  const INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours
  console.log("[LeadAlertScheduler] Starting lead alert scheduler (checking every 12 hours)...");
  setInterval(() => {
    checkStaleLeads().catch(e => console.error("[lead-alert-scheduler]", e.message));
  }, INTERVAL_MS);
}
