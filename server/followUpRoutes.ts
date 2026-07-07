import { Express } from "express";
import { pool } from "./db";
import { requireRole } from "./auth";

export function registerFollowUpRoutes(app: Express, requireAuth: any) {
  app.get("/api/follow-ups/overdue", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT id,
               COALESCE(company_name, first_name || ' ' || last_name) AS name,
               next_follow_up_date,
               'customer' AS type
        FROM customers
        WHERE next_follow_up_date IS NOT NULL
          AND next_follow_up_date < CURRENT_DATE
          AND is_active = true
        UNION ALL
        SELECT id,
               COALESCE(contact_name, 'Unknown Lead') AS name,
               next_follow_up_date,
               'lead' AS type
        FROM consultations
        WHERE next_follow_up_date IS NOT NULL
          AND next_follow_up_date < CURRENT_DATE
          AND pipeline_stage NOT IN ('closed_won', 'closed_lost', 'closed')
        ORDER BY next_follow_up_date ASC
      `);
      res.json(rows);
    } catch (err: any) {
      console.error("[follow-ups/overdue]", err.message);
      res.status(500).json({ error: err.message });
    }
  });
}
