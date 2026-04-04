import type { Express } from "express";
import { pool } from "./db";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  next();
}

function requireRole(...roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    next();
  };
}

const STAFF_ROLES = ["Admin", "Manager", "Master Admin"];

async function nextEstimateNumber(): Promise<string> {
  const { rows } = await pool.query(`SELECT nextval('sales_estimate_seq') AS n`);
  return `EST-${String(rows[0].n).padStart(4, "0")}`;
}

// Fetch full estimate with work areas and line items
async function getEstimateFull(id: string) {
  const { rows: est } = await pool.query(
    `SELECT e.*,
            c.first_name || ' ' || c.last_name AS customer_name,
            (SELECT email FROM customer_contacts WHERE customer_id = e.customer_id ORDER BY id LIMIT 1) AS customer_email,
            (SELECT phone FROM customer_contacts WHERE customer_id = e.customer_id ORDER BY id LIMIT 1) AS customer_phone,
            p.address AS property_address,
            u.name AS salesperson_name
     FROM sales_estimates e
     LEFT JOIN customers c ON c.id = e.customer_id
     LEFT JOIN properties p ON p.id = e.property_id
     LEFT JOIN users u ON u.id = e.salesperson_id
     WHERE e.id = $1`,
    [id]
  );
  if (!est.length) return null;
  const estimate = est[0];

  const { rows: areas } = await pool.query(
    `SELECT wa.*, wat.name AS type_name
     FROM estimate_work_areas wa
     LEFT JOIN work_area_types wat ON wat.id = wa.work_area_type_id
     WHERE wa.estimate_id = $1
     ORDER BY wa.sort_order, wa.id`,
    [id]
  );

  for (const area of areas) {
    const { rows: items } = await pool.query(
      `SELECT * FROM estimate_line_items WHERE estimate_work_area_id = $1 ORDER BY sort_order, id`,
      [area.id]
    );
    area.line_items = items;
  }
  estimate.work_areas = areas;
  return estimate;
}

export function registerEstimateRoutes(app: Express) {
  // ------ Templates ------
  // ?all=true returns inactive templates too (settings page)
  app.get("/api/estimate-templates", requireAuth, requireRole(...STAFF_ROLES), async (req, res) => {
    try {
      const showAll = req.query.all === "true";
      const { rows } = await pool.query(
        showAll
          ? `SELECT * FROM estimate_templates ORDER BY name`
          : `SELECT * FROM estimate_templates WHERE is_active = true ORDER BY name`
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error fetching templates" });
    }
  });

  app.post("/api/estimate-templates", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    const { name, estimate_type, default_customer_message, default_terms, is_active = true } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });
    try {
      const { rows } = await pool.query(
        `INSERT INTO estimate_templates (name, estimate_type, default_customer_message, default_terms, is_active)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, estimate_type || null, default_customer_message || null, default_terms || null, is_active]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error creating template" });
    }
  });

  app.put("/api/estimate-templates/:id", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    const { name, estimate_type, default_customer_message, default_terms, is_active } = req.body;
    try {
      const { rows } = await pool.query(
        `UPDATE estimate_templates SET
           name                    = COALESCE($1, name),
           estimate_type           = COALESCE($2, estimate_type),
           default_customer_message = COALESCE($3, default_customer_message),
           default_terms           = COALESCE($4, default_terms),
           is_active               = COALESCE($5, is_active)
         WHERE id = $6 RETURNING *`,
        [name ?? null, estimate_type ?? null, default_customer_message ?? null, default_terms ?? null, is_active ?? null, req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ message: "Template not found" });
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error updating template" });
    }
  });

  app.delete("/api/estimate-templates/:id", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
    try {
      await pool.query(`DELETE FROM estimate_templates WHERE id = $1`, [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error deleting template" });
    }
  });

  // ------ Estimates list ------
  app.get("/api/estimates", requireAuth, requireRole(...STAFF_ROLES), async (req, res) => {
    try {
      const { status, customer_id } = req.query as any;
      let sql = `
        SELECT e.*,
               c.first_name || ' ' || c.last_name AS customer_name,
               p.address AS property_address,
               u.name AS salesperson_name
        FROM sales_estimates e
        LEFT JOIN customers c ON c.id = e.customer_id
        LEFT JOIN properties p ON p.id = e.property_id
        LEFT JOIN users u ON u.id = e.salesperson_id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (status) { sql += ` AND e.status = $${params.length + 1}`; params.push(status); }
      if (customer_id) { sql += ` AND e.customer_id = $${params.length + 1}`; params.push(customer_id); }
      sql += ` ORDER BY e.created_at DESC`;
      const { rows } = await pool.query(sql, params);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error fetching estimates" });
    }
  });

  // ------ Single estimate ------
  app.get("/api/estimates/:id", requireAuth, requireRole(...STAFF_ROLES), async (req, res) => {
    try {
      const estimate = await getEstimateFull(req.params.id);
      if (!estimate) return res.status(404).json({ message: "Estimate not found" });
      res.json(estimate);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error fetching estimate" });
    }
  });

  // ------ Create estimate ------
  app.post("/api/estimates", requireAuth, requireRole(...STAFF_ROLES), async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const {
        customer_id, property_id, estimate_type = "project", template_name,
        title = "New Estimate", salesperson_id, valid_until, issued_date,
        subtotal = 0, tax_rate = 0, tax_amount = 0, discount_amount = 0,
        total = 0, down_payment_percent = 0, down_payment_amount = 0,
        notes, customer_message, terms,
        presentation_style = "simple",
        work_areas = [],
      } = req.body;

      const estNum = await nextEstimateNumber();

      const { rows } = await client.query(
        `INSERT INTO sales_estimates
           (estimate_number, customer_id, property_id, estimate_type, template_name,
            title, status, salesperson_id, valid_until, issued_date,
            subtotal, tax_rate, tax_amount, discount_amount, total,
            down_payment_percent, down_payment_amount, notes, customer_message, terms,
            presentation_style)
         VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         RETURNING id`,
        [estNum, customer_id || null, property_id || null, estimate_type, template_name || null,
         title, salesperson_id || null, valid_until || null, issued_date || new Date().toISOString().slice(0, 10),
         subtotal, tax_rate, tax_amount, discount_amount, total,
         down_payment_percent, down_payment_amount, notes || null, customer_message || null, terms || null,
         presentation_style || "simple"]
      );
      const estimateId = rows[0].id;

      for (let aIdx = 0; aIdx < work_areas.length; aIdx++) {
        const area = work_areas[aIdx];
        const { rows: ar } = await client.query(
          `INSERT INTO estimate_work_areas (estimate_id, name, work_area_type_id, sort_order, category, area_description, photo_url) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [estimateId, area.name, area.work_area_type_id || null, aIdx, area.category || null, area.area_description || null, area.photo_url || null]
        );
        const areaId = ar[0].id;
        for (let iIdx = 0; iIdx < (area.line_items || []).length; iIdx++) {
          const item = area.line_items[iIdx];
          await client.query(
            `INSERT INTO estimate_line_items (estimate_work_area_id, item_type, description, quantity, unit, unit_price, amount, sort_order, is_optional)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [areaId, item.item_type || "service", item.description, item.quantity ?? 1, item.unit || null,
             item.unit_price ?? 0, item.amount ?? 0, iIdx, item.is_optional ?? false]
          );
        }
      }

      await client.query("COMMIT");
      const full = await getEstimateFull(estimateId);
      res.status(201).json(full);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ message: "Error creating estimate" });
    } finally {
      client.release();
    }
  });

  // ------ Update estimate header ------
  app.put("/api/estimates/:id", requireAuth, requireRole(...STAFF_ROLES), async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const {
        customer_id, property_id, estimate_type, template_name,
        title, salesperson_id, valid_until, issued_date,
        subtotal, tax_rate, tax_amount, discount_amount, total,
        down_payment_percent, down_payment_amount,
        notes, customer_message, terms,
        presentation_style,
        work_areas,
      } = req.body;

      await client.query(
        `UPDATE sales_estimates SET
           customer_id=$1, property_id=$2, estimate_type=$3, template_name=$4,
           title=$5, salesperson_id=$6, valid_until=$7, issued_date=$8,
           subtotal=$9, tax_rate=$10, tax_amount=$11, discount_amount=$12, total=$13,
           down_payment_percent=$14, down_payment_amount=$15,
           notes=$16, customer_message=$17, terms=$18, updated_at=NOW(),
           presentation_style=COALESCE($20, presentation_style)
         WHERE id=$19`,
        [customer_id || null, property_id || null, estimate_type, template_name || null,
         title, salesperson_id || null, valid_until || null, issued_date,
         subtotal, tax_rate, tax_amount, discount_amount, total,
         down_payment_percent, down_payment_amount,
         notes || null, customer_message || null, terms || null,
         req.params.id, presentation_style || null]
      );

      if (work_areas !== undefined) {
        // Replace all work areas and line items
        await client.query(`DELETE FROM estimate_work_areas WHERE estimate_id = $1`, [req.params.id]);
        for (let aIdx = 0; aIdx < work_areas.length; aIdx++) {
          const area = work_areas[aIdx];
          const { rows: ar } = await client.query(
            `INSERT INTO estimate_work_areas (estimate_id, name, work_area_type_id, sort_order, category, area_description, photo_url) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
            [req.params.id, area.name, area.work_area_type_id || null, aIdx, area.category || null, area.area_description || null, area.photo_url || null]
          );
          const areaId = ar[0].id;
          for (let iIdx = 0; iIdx < (area.line_items || []).length; iIdx++) {
            const item = area.line_items[iIdx];
            await client.query(
              `INSERT INTO estimate_line_items (estimate_work_area_id, item_type, description, quantity, unit, unit_price, amount, sort_order, is_optional)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
              [areaId, item.item_type || "service", item.description, item.quantity ?? 1, item.unit || null,
               item.unit_price ?? 0, item.amount ?? 0, iIdx, item.is_optional ?? false]
            );
          }
        }
      }

      await client.query("COMMIT");
      const full = await getEstimateFull(req.params.id);
      if (!full) return res.status(404).json({ message: "Estimate not found" });
      res.json(full);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ message: "Error updating estimate" });
    } finally {
      client.release();
    }
  });

  // ------ Status transitions ------
  app.patch("/api/estimates/:id/send", requireAuth, requireRole(...STAFF_ROLES), async (req, res) => {
    try {
      await pool.query(
        `UPDATE sales_estimates SET status='sent', sent_at=NOW(), updated_at=NOW() WHERE id=$1`,
        [req.params.id]
      );
      const full = await getEstimateFull(req.params.id);
      res.json(full);
    } catch (err) {
      res.status(500).json({ message: "Error sending estimate" });
    }
  });

  app.patch("/api/estimates/:id/approve", requireAuth, requireRole(...STAFF_ROLES), async (req, res) => {
    try {
      await pool.query(
        `UPDATE sales_estimates SET status='approved', customer_response='approved', customer_response_at=NOW(), updated_at=NOW() WHERE id=$1`,
        [req.params.id]
      );
      res.json(await getEstimateFull(req.params.id));
    } catch (err) {
      res.status(500).json({ message: "Error approving estimate" });
    }
  });

  app.patch("/api/estimates/:id/decline", requireAuth, requireRole(...STAFF_ROLES), async (req, res) => {
    try {
      await pool.query(
        `UPDATE sales_estimates SET status='declined', customer_response='declined', customer_response_at=NOW(), customer_response_note=$2, updated_at=NOW() WHERE id=$1`,
        [req.params.id, req.body.note || null]
      );
      res.json(await getEstimateFull(req.params.id));
    } catch (err) {
      res.status(500).json({ message: "Error declining estimate" });
    }
  });

  // ------ Convert to Job ------
  app.patch("/api/estimates/:id/convert", requireAuth, requireRole("Admin", "Manager", "Master Admin"), async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const est = await getEstimateFull(req.params.id);
      if (!est) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Not found" }); }

      const { rows: jobRows } = await client.query(
        `INSERT INTO jobs (title, customer_id, property_id, status, price, description, created_at, updated_at)
         VALUES ($1, $2, $3, 'Lead', $4, $5, NOW(), NOW()) RETURNING id`,
        [est.title, est.customer_id || null, est.property_id || null, est.total, `Converted from estimate ${est.estimate_number}`]
      );
      const jobId = jobRows[0].id;

      await client.query(
        `UPDATE sales_estimates SET status='converted', converted_at=NOW(), converted_job_id=$2, updated_at=NOW() WHERE id=$1`,
        [req.params.id, jobId]
      );
      await client.query("COMMIT");
      res.json({ job_id: jobId, estimate: await getEstimateFull(req.params.id) });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ message: "Error converting estimate" });
    } finally {
      client.release();
    }
  });

  // ------ Delete ------
  app.delete("/api/estimates/:id", requireAuth, requireRole("Admin", "Master Admin"), async (req, res) => {
    try {
      await pool.query(`DELETE FROM sales_estimates WHERE id=$1`, [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting estimate" });
    }
  });
}
