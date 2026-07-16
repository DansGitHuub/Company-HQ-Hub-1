import type { Express } from "express";
import { pool } from "./db";

// ── Notification type registry ─────────────────────────────────────────────────
// chan_sms defaults to false on all types — SMS costs real money per text.
// Admins must explicitly enable SMS per notification type.
const NOTIFICATION_TYPE_SEEDS = [
  // Operations
  { type: "job_over_budget",      label: "Job Over Budget",              description: "Fires when a job's logged costs exceed its set budget amount",               category: "Operations", cadence: "immediate",    sort_order: 10 },
  { type: "weather_delay",        label: "Weather Delay",                description: "Admin marked a job as weather-delayed; notifies managers and optionally customers", category: "Operations", cadence: "immediate",    sort_order: 20 },
  { type: "wo_closeout_ready",    label: "Work Order Closeout Ready",    description: "A work order is complete and awaiting final admin review",                    category: "Operations", cadence: "immediate",    sort_order: 30 },
  { type: "field_issue_report",   label: "Field Issue / Damage Report",  description: "A crew member has reported a field issue, delay, or damage",                 category: "Operations", cadence: "immediate",    sort_order: 40 },
  { type: "work_request",         label: "Customer Work Request",        description: "A customer has submitted a work request via the portal",                      category: "Operations", cadence: "immediate",    sort_order: 50 },
  // Financial
  { type: "payroll_ready",        label: "Payroll Ready",                description: "Admin has marked payroll as ready for processing",                           category: "Financial",  cadence: "immediate",    sort_order: 60 },
  { type: "estimate_approved",    label: "Estimate Approved",            description: "A customer has approved an estimate",                                         category: "Financial",  cadence: "immediate",    sort_order: 70 },
  { type: "change_order_approved",label: "Change Order Approved",        description: "A customer has approved a change order",                                      category: "Financial",  cadence: "immediate",    sort_order: 80 },
  { type: "change_order_rejected",label: "Change Order Rejected",        description: "A customer has rejected a change order",                                      category: "Financial",  cadence: "immediate",    sort_order: 90 },
  // HR & Time
  { type: "overtime_alert",       label: "Overtime Alert",               description: "An employee has exceeded the configured daily overtime threshold",            category: "HR & Time",  cadence: "immediate",    sort_order: 100 },
  { type: "missing_worksheet",    label: "Missing Worksheet",            description: "An employee has not submitted their daily worksheet by end of day",           category: "HR & Time",  cadence: "daily_digest", sort_order: 110 },
  { type: "worksheet_submitted",  label: "Worksheet Submitted",          description: "An employee has submitted their daily field worksheet",                       category: "HR & Time",  cadence: "daily_digest", sort_order: 120 },
  { type: "time_off_decision",    label: "Time Off Request Decision",    description: "A time off request has been approved or denied",                              category: "HR & Time",  cadence: "immediate",    sort_order: 130 },
  { type: "time_entry_decision",  label: "Time Entry Approved/Rejected", description: "A time entry has been reviewed and approved or rejected",                    category: "HR & Time",  cadence: "immediate",    sort_order: 140 },
  // Hiring
  { type: "candidate_hired",      label: "New Employee Hired",           description: "A candidate has been formally converted to a full employee",                  category: "Hiring",     cadence: "immediate",    sort_order: 150 },
  { type: "interview_scheduled",  label: "Interview Scheduled",          description: "A new candidate interview has been scheduled",                                category: "Hiring",     cadence: "immediate",    sort_order: 160 },
  { type: "application_followup", label: "Application Follow-up",        description: "A job application has been waiting without action for 3+ days",              category: "Hiring",     cadence: "daily_digest", sort_order: 170 },
  // Customer & Sales
  { type: "new_inquiry",          label: "New Lead / Inquiry",           description: "A new contact form or inquiry has been submitted from the public site",       category: "Customer",   cadence: "immediate",    sort_order: 180 },
  { type: "new_booking",          label: "New Service Booking",          description: "A new service booking has been confirmed via the booking page",               category: "Customer",   cadence: "immediate",    sort_order: 190 },
  { type: "customer_satisfaction",label: "Customer Satisfaction Rating", description: "A customer has submitted a post-job satisfaction rating",                    category: "Customer",   cadence: "immediate",    sort_order: 200 },
  // System
  { type: "note_reminder",        label: "Note Reminder",                description: "A flagged note has a scheduled reminder due",                                 category: "System",     cadence: "immediate",    sort_order: 210 },
  { type: "daily_worksheet",      label: "Daily Worksheet Reminder",     description: "End-of-day reminder for crew to submit their worksheet",                     category: "System",     cadence: "immediate",    sort_order: 220 },
  { type: "image_needs_review",   label: "AI Image Review Needed",       description: "AI failed to source a catalog image and needs manual upload",                 category: "System",     cadence: "daily_digest", sort_order: 230 },
];

// ── Migrations ─────────────────────────────────────────────────────────────────
async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_type_config (
      id            SERIAL PRIMARY KEY,
      type          TEXT NOT NULL UNIQUE,
      label         TEXT NOT NULL,
      description   TEXT,
      category      TEXT NOT NULL DEFAULT 'System',
      chan_in_app   BOOLEAN NOT NULL DEFAULT true,
      chan_email    BOOLEAN NOT NULL DEFAULT false,
      chan_sms      BOOLEAN NOT NULL DEFAULT false,
      chan_push     BOOLEAN NOT NULL DEFAULT false,
      cadence       TEXT NOT NULL DEFAULT 'immediate',
      sort_order    INTEGER DEFAULT 0,
      updated_at    TIMESTAMP DEFAULT NOW(),
      updated_by    TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_notification_prefs (
      id                SERIAL PRIMARY KEY,
      user_id           TEXT NOT NULL,
      notification_type TEXT NOT NULL,
      chan_in_app       BOOLEAN,
      chan_email        BOOLEAN,
      chan_sms          BOOLEAN,
      chan_push         BOOLEAN,
      cadence           TEXT,
      updated_at        TIMESTAMP DEFAULT NOW(),
      UNIQUE (user_id, notification_type)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_digest_queue (
      id                SERIAL PRIMARY KEY,
      user_id           TEXT NOT NULL,
      notification_type TEXT NOT NULL,
      cadence           TEXT NOT NULL,
      title             TEXT NOT NULL,
      message           TEXT NOT NULL,
      link              TEXT,
      metadata          JSONB DEFAULT '{}',
      created_at        TIMESTAMP DEFAULT NOW(),
      sent_at           TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_digest_log (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL,
      cadence     TEXT NOT NULL,
      sent_at     TIMESTAMP DEFAULT NOW(),
      item_count  INTEGER DEFAULT 0
    )
  `);

  // Additive migration: budget_amount on jobs for job_over_budget trigger
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(12,2)`);
  // Additive migration: weather_delayed_at on jobs for weather_delay trigger
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS weather_delayed_at TIMESTAMP`);

  // Seed notification types (ON CONFLICT DO NOTHING — never overwrites admin edits)
  for (const nt of NOTIFICATION_TYPE_SEEDS) {
    await pool.query(
      `INSERT INTO notification_type_config (type, label, description, category, cadence, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (type) DO NOTHING`,
      [nt.type, nt.label, nt.description, nt.category, nt.cadence, nt.sort_order]
    );
  }

  console.log("[migration] notification center tables ready");
}

// ── Route registration ─────────────────────────────────────────────────────────
export async function registerNotificationCenterRoutes(
  app: Express,
  requireAuth: any
) {
  await runMigrations();

  // GET all types with company defaults + caller's overrides merged
  app.get("/api/notification-settings", requireAuth, async (req: any, res: any) => {
    const userId = String((req.user as any).id ?? "");
    try {
      const { rows } = await pool.query(
        `SELECT
           c.type, c.label, c.description, c.category, c.sort_order,
           c.chan_in_app, c.chan_email, c.chan_sms, c.chan_push, c.cadence,
           p.chan_in_app  AS user_in_app,
           p.chan_email   AS user_email,
           p.chan_sms     AS user_sms,
           p.chan_push    AS user_push,
           p.cadence      AS user_cadence
         FROM notification_type_config c
         LEFT JOIN user_notification_prefs p
           ON p.notification_type = c.type AND p.user_id = $1
         ORDER BY c.sort_order, c.category, c.label`,
        [userId]
      );
      res.json(rows);
    } catch (e: any) {
      console.error("[notif-settings] GET:", e.message);
      res.status(500).json({ message: e.message });
    }
  });

  // PUT company default for a type — Admin/Manager only
  app.put(
    "/api/notification-settings/company/:type",
    requireAuth,
    async (req: any, res: any) => {
      const user = req.user as any;
      if (
        user.role !== "Admin" &&
        user.role !== "Manager" &&
        !user.isMasterAdmin
      ) {
        return res.status(403).json({ message: "Admin or Manager access required" });
      }
      const { type } = req.params;
      const { chan_in_app, chan_email, chan_sms, chan_push, cadence } = req.body;
      try {
        const result = await pool.query(
          `UPDATE notification_type_config
           SET chan_in_app = CASE WHEN $1::boolean IS NOT NULL THEN $1 ELSE chan_in_app END,
               chan_email  = CASE WHEN $2::boolean IS NOT NULL THEN $2 ELSE chan_email  END,
               chan_sms    = CASE WHEN $3::boolean IS NOT NULL THEN $3 ELSE chan_sms    END,
               chan_push   = CASE WHEN $4::boolean IS NOT NULL THEN $4 ELSE chan_push   END,
               cadence     = CASE WHEN $5::text    IS NOT NULL THEN $5 ELSE cadence    END,
               updated_at  = NOW(),
               updated_by  = $6
           WHERE type = $7
           RETURNING *`,
          [
            chan_in_app ?? null,
            chan_email  ?? null,
            chan_sms    ?? null,
            chan_push   ?? null,
            cadence     ?? null,
            String(user.id ?? ""),
            type,
          ]
        );
        if (!result.rows.length)
          return res.status(404).json({ message: "Notification type not found" });
        res.json(result.rows[0]);
      } catch (e: any) {
        console.error("[notif-settings] PUT company:", e.message);
        res.status(500).json({ message: e.message });
      }
    }
  );

  // PUT user override for a type
  app.put(
    "/api/notification-settings/user/:type",
    requireAuth,
    async (req: any, res: any) => {
      const userId = String((req.user as any).id ?? "");
      const { type } = req.params;
      const { chan_in_app, chan_email, chan_sms, chan_push, cadence } = req.body;
      try {
        await pool.query(
          `INSERT INTO user_notification_prefs
             (user_id, notification_type, chan_in_app, chan_email, chan_sms, chan_push, cadence)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, notification_type) DO UPDATE
             SET chan_in_app = EXCLUDED.chan_in_app,
                 chan_email  = EXCLUDED.chan_email,
                 chan_sms    = EXCLUDED.chan_sms,
                 chan_push   = EXCLUDED.chan_push,
                 cadence     = EXCLUDED.cadence,
                 updated_at  = NOW()`,
          [userId, type,
           chan_in_app ?? null,
           chan_email  ?? null,
           chan_sms    ?? null,
           chan_push   ?? null,
           cadence     ?? null]
        );
        res.json({ ok: true });
      } catch (e: any) {
        console.error("[notif-settings] PUT user:", e.message);
        res.status(500).json({ message: e.message });
      }
    }
  );

  // DELETE user override (reverts to company default)
  app.delete(
    "/api/notification-settings/user/:type",
    requireAuth,
    async (req: any, res: any) => {
      const userId = String((req.user as any).id ?? "");
      const { type } = req.params;
      try {
        await pool.query(
          `DELETE FROM user_notification_prefs
           WHERE user_id = $1 AND notification_type = $2`,
          [userId, type]
        );
        res.json({ ok: true });
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    }
  );

  // POST trigger: payroll ready (Admin only — notifies all Admin/Manager)
  app.post(
    "/api/payroll/notify-ready",
    requireAuth,
    async (req: any, res: any) => {
      const user = req.user as any;
      if (user.role !== "Admin" && !user.isMasterAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { period_label } = req.body;
      const label = period_label || "current pay period";
      try {
        const { dispatchToRole } = await import("./notificationTriggers");
        await dispatchToRole("payroll_ready", ["Admin", "Manager"], {
          title: "Payroll Ready for Processing",
          message: `Payroll for ${label} has been finalized and is ready for processing.`,
          link: "/admin/time-reports",
        });
        res.json({ ok: true, dispatched_for: label });
      } catch (e: any) {
        console.error("[notif] payroll-ready:", e.message);
        res.status(500).json({ message: e.message });
      }
    }
  );

  // PATCH /api/jobs/:id/weather-delay — Admin/Manager: mark job weather-delayed
  app.patch(
    "/api/jobs/:id/weather-delay",
    requireAuth,
    async (req: any, res: any) => {
      const user = req.user as any;
      if (
        user.role !== "Admin" &&
        user.role !== "Manager" &&
        !user.isMasterAdmin
      ) {
        return res.status(403).json({ message: "Admin or Manager access required" });
      }
      const jobId = req.params.id;
      const { notify_customer = false, custom_message } = req.body;
      try {
        const jobR = await pool.query(
          `UPDATE jobs SET weather_delayed_at = NOW() WHERE id = $1 RETURNING *`,
          [jobId]
        );
        if (!jobR.rows.length) return res.status(404).json({ message: "Job not found" });
        const job = jobR.rows[0];

        const { triggerWeatherDelay } = await import("./notificationTriggers");
        await triggerWeatherDelay({
          jobId,
          jobTitle: job.type || job.title || `Job #${jobId}`,
          notifyCustomer: notify_customer,
          customMessage: custom_message,
          actingUserId: String(user.id),
        });
        res.json({ ok: true, job });
      } catch (e: any) {
        console.error("[notif] weather-delay:", e.message);
        res.status(500).json({ message: e.message });
      }
    }
  );

  // PATCH /api/jobs/:id/budget-amount — set job budget for over-budget tracking
  app.patch(
    "/api/jobs/:id/budget-amount",
    requireAuth,
    async (req: any, res: any) => {
      const user = req.user as any;
      if (
        user.role !== "Admin" &&
        user.role !== "Manager" &&
        !user.isMasterAdmin
      ) {
        return res.status(403).json({ message: "Admin or Manager access required" });
      }
      const { amount } = req.body;
      if (amount === undefined || isNaN(parseFloat(amount))) {
        return res.status(400).json({ message: "amount is required and must be a number" });
      }
      try {
        const result = await pool.query(
          `UPDATE jobs SET budget_amount = $1 WHERE id = $2 RETURNING id, budget_amount`,
          [parseFloat(amount), req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ message: "Job not found" });
        // Immediately check if current costs already exceed this new budget
        const { checkJobBudget } = await import("./notificationTriggers");
        await checkJobBudget(req.params.id);
        res.json(result.rows[0]);
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    }
  );
}
