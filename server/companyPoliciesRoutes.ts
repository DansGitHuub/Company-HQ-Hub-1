import type { Express } from "express";
import { pool } from "./db";

interface PolicySeed {
  slug: string;
  question: string;
  category: string;
  answer_type: "yes_no" | "multiple_choice" | "short_text";
  options: string[] | null;
  sort_order: number;
}

const POLICY_SEEDS: PolicySeed[] = [
  // Customer Communication
  {
    slug: "customer_comm_tone",
    question: "What tone should the AI use when communicating with customers?",
    category: "Customer Communication",
    answer_type: "multiple_choice",
    options: ["Warm and friendly", "Professional and formal", "Casual and conversational"],
    sort_order: 1,
  },
  {
    slug: "proactive_job_updates",
    question: "Should customers be proactively notified when a job is running behind schedule?",
    category: "Customer Communication",
    answer_type: "yes_no",
    options: null,
    sort_order: 2,
  },
  {
    slug: "upsell_at_completion",
    question: "Should the AI suggest related services to customers at or after job completion?",
    category: "Customer Communication",
    answer_type: "yes_no",
    options: null,
    sort_order: 3,
  },
  // Estimates & Deposits
  {
    slug: "require_deposit_before_scheduling",
    question: "Do we require a deposit before scheduling all new jobs?",
    category: "Estimates & Deposits",
    answer_type: "yes_no",
    options: null,
    sort_order: 4,
  },
  {
    slug: "estimate_validity_period",
    question: "How long should estimates remain valid before they expire?",
    category: "Estimates & Deposits",
    answer_type: "multiple_choice",
    options: ["15 days", "30 days", "45 days", "60 days"],
    sort_order: 5,
  },
  // Scheduling & Cancellation
  {
    slug: "cancellation_fee_policy",
    question: "Do we charge a cancellation fee for jobs cancelled within 24 hours of the scheduled date?",
    category: "Scheduling & Cancellation",
    answer_type: "yes_no",
    options: null,
    sort_order: 6,
  },
  {
    slug: "reschedule_turnaround",
    question: "When a customer requests a reschedule, how quickly should we offer a new date?",
    category: "Scheduling & Cancellation",
    answer_type: "multiple_choice",
    options: ["Same day", "Within 48 hours", "Within 1 week"],
    sort_order: 7,
  },
  // Safety & Quality
  {
    slug: "before_after_photos_required",
    question: "Are crew members required to take both before AND after photos on every job?",
    category: "Safety & Quality",
    answer_type: "yes_no",
    options: null,
    sort_order: 8,
  },
  {
    slug: "safety_incident_reporting_window",
    question: "How quickly must any on-site safety incident be reported to management?",
    category: "Safety & Quality",
    answer_type: "multiple_choice",
    options: ["Immediately (same hour)", "Within 4 hours", "By end of day"],
    sort_order: 9,
  },
  // Service Area & Pricing
  {
    slug: "travel_surcharge_policy",
    question: "Do we apply a travel surcharge for jobs located more than 30 miles from the shop?",
    category: "Service Area & Pricing",
    answer_type: "yes_no",
    options: null,
    sort_order: 10,
  },
];

async function migrateCompanyPolicies() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_policies (
      id          SERIAL PRIMARY KEY,
      slug        VARCHAR(100) NOT NULL UNIQUE,
      question    TEXT NOT NULL,
      category    TEXT NOT NULL,
      answer_type VARCHAR(20) NOT NULL CHECK (answer_type IN ('yes_no','multiple_choice','short_text')),
      options     JSONB,
      answer      TEXT,
      is_active   BOOLEAN NOT NULL DEFAULT true,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      updated_by  TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const p of POLICY_SEEDS) {
    await pool.query(
      `INSERT INTO company_policies (slug, question, category, answer_type, options, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (slug) DO NOTHING`,
      [p.slug, p.question, p.category, p.answer_type, p.options ? JSON.stringify(p.options) : null, p.sort_order]
    );
  }
  console.log("[migration] company_policies table ready");
}

export async function registerCompanyPoliciesRoutes(app: Express, requireAuth: any, requireAdmin: any) {
  await migrateCompanyPolicies();

  app.get("/api/company-policies", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM company_policies WHERE is_active = true ORDER BY category, sort_order`
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/company-policies/:slug", requireAuth, requireAdmin, async (req: any, res) => {
    const { slug } = req.params;
    const { answer } = req.body ?? {};
    try {
      const { rows: existing } = await pool.query(
        `SELECT * FROM company_policies WHERE slug = $1`, [slug]
      );
      if (!existing[0]) return res.status(404).json({ error: "Policy not found" });

      const updatedBy = req.user?.name || req.user?.username || req.user?.email || null;
      const { rows } = await pool.query(
        `UPDATE company_policies
         SET answer = $1, updated_by = $2, updated_at = NOW()
         WHERE slug = $3
         RETURNING *`,
        [answer === null || answer === undefined ? null : String(answer).trim(), updatedBy, slug]
      );
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
