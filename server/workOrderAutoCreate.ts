import { pool } from "./db";

function mapCategoryToWoType(category: string | null): string {
  const c = (category || "").toLowerCase();
  if (c.includes("maintenance") || c.includes("maint")) return "maintenance_visit";
  if (c.includes("hardscape") || c.includes("hard"))    return "hardscape_project";
  if (c.includes("snow") || c.includes("ice"))          return "snow_ice";
  if (c.includes("service") || c.includes("repair"))    return "service_call";
  return "landscape_project";
}

/**
 * Auto-creates a draft Work Order for a newly-created job.
 * - Skips if a WO already exists for this job_id.
 * - Copies job_work_areas → work_order_areas.
 * - Copies Equipment line items → work_order_tools; Materials → work_order_materials.
 * Non-fatal: any error is logged and swallowed so job creation is never blocked.
 */
export async function autoCreateDraftWorkOrder(
  jobId: string,
  jobTitle: string | null,
  jobCategory: string | null,
): Promise<{ id: number } | null> {
  try {
    const existing = await pool.query(
      `SELECT id FROM work_orders WHERE job_id::text = $1 LIMIT 1`,
      [jobId]
    );
    if (existing.rows.length > 0) return existing.rows[0];

    const woType = mapCategoryToWoType(jobCategory);

    const woResult = await pool.query(
      `INSERT INTO work_orders (title, job_id, wo_type, status, priority, assigned_crew)
       VALUES ($1, $2, $3, 'draft', 'normal', '[]') RETURNING id`,
      [jobTitle || "Draft Work Order", jobId, woType]
    );
    const woId: number = woResult.rows[0].id;

    const { rows: areas } = await pool.query(
      `SELECT * FROM job_work_areas WHERE job_id = $1 ORDER BY sort_order`,
      [jobId]
    );

    for (const area of areas) {
      const areaResult = await pool.query(
        `INSERT INTO work_order_areas (work_order_id, name, description, sort_order)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [woId, area.name, area.notes || null, area.sort_order ?? 0]
      );
      const areaId: number = areaResult.rows[0].id;

      const { rows: lineItems } = await pool.query(
        `SELECT jli.quantity, jli.unit, jli.item_type,
                COALESCE(ci.name, jli.item_name) AS display_name,
                ci.class AS catalog_class
         FROM job_line_items jli
         LEFT JOIN catalog_items ci ON ci.id = jli.catalog_item_id
         WHERE jli.job_work_area_id = $1
           AND jli.is_optional = false
           AND (
             ci.class IN ('Equipment', 'Materials')
             OR lower(jli.item_type) IN ('equipment', 'material', 'materials')
           )`,
        [area.id]
      );

      for (const li of lineItems) {
        const isEquip =
          li.catalog_class === "Equipment" ||
          li.item_type?.toLowerCase() === "equipment";
        if (isEquip) {
          await pool.query(
            `INSERT INTO work_order_tools (work_order_id, area_id, item_name, quantity, unit)
             VALUES ($1, $2, $3, $4, $5)`,
            [woId, areaId, li.display_name, li.quantity ?? 1, li.unit || null]
          );
        } else {
          await pool.query(
            `INSERT INTO work_order_materials (work_order_id, area_id, item_name, quantity, unit, status)
             VALUES ($1, $2, $3, $4, $5, 'needed')`,
            [woId, areaId, li.display_name, li.quantity ?? 1, li.unit || null]
          );
        }
      }
    }

    return { id: woId };
  } catch (err: any) {
    console.error("[autoCreateDraftWorkOrder]", err.message);
    return null;
  }
}
