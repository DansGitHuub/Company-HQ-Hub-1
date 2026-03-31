import { Express } from "express";
import { pool } from "./db";

export function registerCustomerRoutes(app: Express, requireAuth: any) {
  app.get("/api/customers", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          c.id,
          c.first_name,
          c.last_name,
          c.company_name,
          c.source,
          c.created_at,
          cp.phone  AS primary_phone,
          ce.email  AS primary_email
        FROM customers c
        LEFT JOIN customer_phones cp
          ON cp.customer_id = c.id AND cp.is_primary = true
        LEFT JOIN customer_emails ce
          ON ce.customer_id = c.id AND ce.is_primary = true
        ORDER BY c.created_at DESC
      `);
      return res.json(result.rows);
    } catch (err: any) {
      console.error("[customers] GET /api/customers error:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  });
}
