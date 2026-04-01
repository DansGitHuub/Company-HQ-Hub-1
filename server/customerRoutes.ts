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

  app.get("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const customerResult = await pool.query(
        `SELECT * FROM customers WHERE id = $1`,
        [id]
      );
      if (customerResult.rows.length === 0) {
        return res.status(404).json({ message: "Customer not found" });
      }
      const customer = customerResult.rows[0];

      const [phones, emails, contacts, properties] = await Promise.all([
        pool.query(
          `SELECT * FROM customer_phones WHERE customer_id = $1 ORDER BY is_primary DESC, created_at ASC`,
          [id]
        ),
        pool.query(
          `SELECT * FROM customer_emails WHERE customer_id = $1 ORDER BY is_primary DESC, created_at ASC`,
          [id]
        ),
        pool.query(
          `SELECT * FROM customer_contacts WHERE customer_id = $1 ORDER BY created_at ASC`,
          [id]
        ),
        pool.query(
          `SELECT * FROM properties WHERE customer_id = $1 ORDER BY created_at ASC`,
          [id]
        ),
      ]);

      return res.json({
        ...customer,
        phones: phones.rows,
        emails: emails.rows,
        contacts: contacts.rows,
        properties: properties.rows,
      });
    } catch (err: any) {
      console.error("[customers] GET /api/customers/:id error:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  });
}
