import { Express } from "express";
import { pool } from "./db";

export function registerPricingRoutes(app: Express, requireAuth: any) {
  // GET /api/admin/class-codes
  // Returns the four canonical cost-class rows ordered by sort_order.
  // Restricted to Admin / Manager / isMasterAdmin.
  app.get("/api/admin/class-codes", requireAuth, async (req: any, res) => {
    const user = req.user;
    if (
      user?.role !== "Admin" &&
      user?.role !== "Manager" &&
      !user?.isMasterAdmin
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const { rows } = await pool.query(
        `SELECT id, name, label, sort_order FROM class_codes ORDER BY sort_order`
      );
      return res.json(rows);
    } catch (err: any) {
      console.error("[pricing] GET /api/admin/class-codes error:", err);
      return res.status(500).json({ error: "Failed to fetch class codes" });
    }
  });
}
