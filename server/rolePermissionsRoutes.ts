import type { Express } from "express";
import { pool } from "./db";
import { reloadPermissionCache } from "./permissionCache";

const ALL_ROLES = ["Customer", "New Hire", "Crew", "Crew Lead", "HR", "Sales", "Manager", "Admin"];
const ALL_PERMS = [
  "see_finance", "see_people_hr", "see_hiring", "see_customers", "see_jobs_work",
  "see_time_reports", "manage_content", "manage_equipment", "approve_work",
  "manage_marketing", "manage_settings", "manage_spanish_content",
];

export function registerRolePermissionsRoutes(app: Express, requireAuth: any, requireAdmin: any) {
  app.get("/api/role-permissions", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT role, permission, granted FROM role_permissions ORDER BY role, permission`
      );
      const matrix: Record<string, Record<string, boolean>> = {};
      for (const role of ALL_ROLES) {
        matrix[role] = {};
        for (const perm of ALL_PERMS) matrix[role][perm] = false;
      }
      for (const row of rows) {
        if (matrix[row.role]) matrix[row.role][row.permission] = row.granted;
      }
      res.json(matrix);
    } catch (err) {
      console.error("[role-permissions] GET error:", err);
      res.status(500).json({ message: "Failed to load permissions" });
    }
  });

  app.patch("/api/role-permissions", requireAuth, requireAdmin, async (req: any, res) => {
    const { role, permission, granted } = req.body;
    if (!role || !permission || typeof granted !== "boolean") {
      return res.status(400).json({ message: "role, permission, and granted (boolean) are required" });
    }
    if (!ALL_ROLES.includes(role)) {
      return res.status(400).json({ message: `Unknown role: ${role}` });
    }
    if (!ALL_PERMS.includes(permission)) {
      return res.status(400).json({ message: `Unknown permission: ${permission}` });
    }
    if (role === "Customer") {
      return res.status(400).json({ message: "Customer role permissions cannot be modified." });
    }
    if (role === "Admin" && permission === "manage_settings" && !granted) {
      return res.status(400).json({ message: "Admin must always have Manage Settings access." });
    }
    try {
      const { rowCount } = await pool.query(
        `UPDATE role_permissions
         SET granted = $3, updated_at = NOW(), updated_by = $4
         WHERE role = $1 AND permission = $2`,
        [role, permission, granted, req.user?.id ?? null]
      );
      if ((rowCount ?? 0) === 0) {
        await pool.query(
          `INSERT INTO role_permissions (role, permission, granted, updated_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (role, permission) DO UPDATE SET granted = $3, updated_at = NOW(), updated_by = $4`,
          [role, permission, granted, req.user?.id ?? null]
        );
      }
      await reloadPermissionCache();
      res.json({ ok: true });
    } catch (err) {
      console.error("[role-permissions] PATCH error:", err);
      res.status(500).json({ message: "Failed to update permission" });
    }
  });

  app.get("/api/my-permissions", requireAuth, async (req: any, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({});
    if (user.isMasterAdmin) {
      const all: Record<string, boolean> = {};
      for (const p of ALL_PERMS) all[p] = true;
      return res.json(all);
    }
    try {
      const { rows } = await pool.query(
        `SELECT permission, granted FROM role_permissions WHERE role = $1`,
        [user.role]
      );
      const perms: Record<string, boolean> = {};
      for (const perm of ALL_PERMS) perms[perm] = false;
      for (const row of rows) perms[row.permission] = row.granted;
      res.json(perms);
    } catch (err) {
      res.status(500).json({ message: "Failed to load permissions" });
    }
  });
}
