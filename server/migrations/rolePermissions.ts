import { pool } from "../db";

const ALL_ROLES = [
  "Customer",
  "New Hire",
  "Crew",
  "Crew Lead",
  "HR",
  "Sales",
  "Manager",
  "Admin",
];

const ALL_PERMS = [
  "see_finance",
  "see_people_hr",
  "see_hiring",
  "see_customers",
  "see_jobs_work",
  "see_time_reports",
  "manage_content",
  "manage_equipment",
  "approve_work",
  "manage_marketing",
  "manage_settings",
  "manage_spanish_content",
];

function defaultGranted(role: string, perm: string): boolean {
  switch (perm) {
    case "see_finance":
      return ["Manager", "Admin"].includes(role);
    case "see_people_hr":
      return ["HR", "Manager", "Admin"].includes(role);
    case "see_hiring":
      return ["HR", "Manager", "Admin"].includes(role);
    case "see_customers":
      return ["Sales", "Manager", "Admin"].includes(role);
    case "see_jobs_work":
      return ["New Hire", "Crew", "Crew Lead", "Sales", "Manager", "Admin"].includes(role);
    case "see_time_reports":
      return ["Manager", "Admin"].includes(role);
    case "manage_content":
      return ["Manager", "Admin"].includes(role);
    case "manage_equipment":
      return ["Crew Lead", "Manager", "Admin"].includes(role);
    case "approve_work":
      return ["Manager", "Admin"].includes(role);
    case "manage_marketing":
      return ["Sales", "Manager", "Admin"].includes(role);
    case "manage_settings":
      return ["Admin"].includes(role);
    case "manage_spanish_content":
      return ["Admin"].includes(role);
    default:
      return false;
  }
}

export async function runRolePermissionsMigration() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id          SERIAL PRIMARY KEY,
      role        VARCHAR(50)  NOT NULL,
      permission  VARCHAR(50)  NOT NULL,
      granted     BOOLEAN      NOT NULL DEFAULT false,
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_by  VARCHAR(36),
      UNIQUE (role, permission)
    )
  `);

  for (const role of ALL_ROLES) {
    for (const perm of ALL_PERMS) {
      const granted = defaultGranted(role, perm);
      await pool.query(
        `INSERT INTO role_permissions (role, permission, granted)
         VALUES ($1, $2, $3)
         ON CONFLICT (role, permission) DO NOTHING`,
        [role, perm, granted]
      );
    }
  }

  console.log("[migration] role_permissions table ready");
}
