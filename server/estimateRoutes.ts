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
          `INSERT INTO estimate_work_areas (estimate_id, name, work_area_type_id, sort_order, category, area_description, photo_url, cost_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [estimateId, area.name, area.work_area_type_id || null, aIdx, area.category || null, area.area_description || null, area.photo_url || null, area.cost_code || null]
        );
        const areaId = ar[0].id;
        for (let iIdx = 0; iIdx < (area.line_items || []).length; iIdx++) {
          const item = area.line_items[iIdx];
          await client.query(
            `INSERT INTO estimate_line_items (estimate_work_area_id, item_type, description, quantity, unit, unit_price, amount, sort_order, is_optional, image_url, image_hidden)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [areaId, item.item_type || "service", item.description, item.quantity ?? 1, item.unit || null,
             item.unit_price ?? 0, item.amount ?? 0, iIdx, item.is_optional ?? false, item.image_url || null, item.image_hidden ?? false]
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

    // A20: Convert a consultation into a draft estimate. Replaces the previous client-side
  // "navigate to /estimates?customer_id=…" no-op with an actual record creation.
  app.post("/api/consultations/:id/convert-to-estimate", requireAuth, requireRole(...STAFF_ROLES), async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: cRows } = await client.query(
        `SELECT id, customer_id, contact_name, contact_email, contact_phone,
                address, project_description, service_type, estimated_value, notes
         FROM consultations WHERE id = $1`,
        [req.params.id]
      );
      if (cRows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Consultation not found" });
      }
      const c = cRows[0];
      if (!c.customer_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Link a customer to this consultation before converting to an estimate." });
      }

      const estNum = await nextEstimateNumber();
      const titleSrc = (c.project_description || c.service_type || "New Estimate").toString();
      const title = titleSrc.length > 100 ? titleSrc.slice(0, 97) + "..." : titleSrc;
      const notes = c.notes || c.project_description || null;

      const { rows } = await client.query(
        `INSERT INTO sales_estimates
         (estimate_number, customer_id, property_id, estimate_type, template_name,
          title, status, salesperson_id, valid_until, issued_date,
          subtotal, tax_rate, tax_amount, discount_amount, total,
          down_payment_percent, down_payment_amount, notes, customer_message, terms,
          presentation_style)
         VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         RETURNING id`,
        [estNum, c.customer_id, null, "project", null,
         title, null, null, new Date().toISOString().slice(0, 10),
         0, 0, 0, 0, 0,
         0, 0, notes, null, null,
         "simple"]
      );
      const estimateId = rows[0].id;
      await client.query("COMMIT");
      const full = await getEstimateFull(estimateId);
      return res.status(201).json(full);
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("[convert-to-estimate]", err.message);
      return res.status(500).json({ message: err.message });
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
            `INSERT INTO estimate_work_areas (estimate_id, name, work_area_type_id, sort_order, category, area_description, photo_url, cost_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            [req.params.id, area.name, area.work_area_type_id || null, aIdx, area.category || null, area.area_description || null, area.photo_url || null, area.cost_code || null]
          );
          const areaId = ar[0].id;
          for (let iIdx = 0; iIdx < (area.line_items || []).length; iIdx++) {
            const item = area.line_items[iIdx];
            await client.query(
              `INSERT INTO estimate_line_items (estimate_work_area_id, item_type, description, quantity, unit, unit_price, amount, sort_order, is_optional, image_url, image_hidden)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
              [areaId, item.item_type || "service", item.description, item.quantity ?? 1, item.unit || null,
               item.unit_price ?? 0, item.amount ?? 0, iIdx, item.is_optional ?? false, item.image_url || null, item.image_hidden ?? false]
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
        `INSERT INTO jobs (title, client, type, customer_id, property_id, status, stage, price, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'lead', 'Lead', $6, $7, NOW(), NOW()) RETURNING id`,
        [
          est.title || `Estimate ${est.estimate_number}`,
          est.customer_name || est.title || 'Unknown',
          est.estimate_type || 'Other',
          est.customer_id || null,
          est.property_id || null,
          est.total,
          `Converted from estimate ${est.estimate_number}`,
        ]
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

  // ------ Customer Portal ------

  // POST /api/estimates/:id/send-to-portal — generate portal token and mark sent
  app.post("/api/estimates/:id/send-to-portal", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { rows: existing } = await pool.query(
        `SELECT portal_token FROM sales_estimates WHERE id=$1`, [id]
      );
      if (!existing.length) return res.status(404).json({ message: "Estimate not found" });

      // Reuse token if already generated, otherwise create new
      let token = existing[0].portal_token;
      if (!token) {
        const { randomUUID } = await import("crypto");
        token = randomUUID();
        await pool.query(
          `UPDATE sales_estimates SET portal_token=$1, status='sent', sent_at=COALESCE(sent_at, NOW()), updated_at=NOW() WHERE id=$2`,
          [token, id]
        );
      }

      const portalUrl = `https://companyhq.app/portal/${token}`;
      res.json({ portal_token: token, portal_url: portalUrl });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: "Error generating portal link" });
    }
  });

  // GET /api/portal/:token — public, returns estimate + work areas, marks viewed_at on first load
  app.get("/api/portal/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { rows } = await pool.query(
        `SELECT e.*,
                c.first_name || ' ' || c.last_name AS customer_name,
                (SELECT email FROM customer_contacts WHERE customer_id = e.customer_id ORDER BY id LIMIT 1) AS customer_email,
                p.address AS property_address,
                u.name AS salesperson_name
         FROM sales_estimates e
         LEFT JOIN customers c ON c.id = e.customer_id
         LEFT JOIN properties p ON p.id = e.property_id
         LEFT JOIN users u ON u.id = e.salesperson_id
         WHERE e.portal_token=$1`,
        [token]
      );
      if (!rows.length) return res.status(404).json({ message: "Portal link not found or expired" });

      const estimate = rows[0];

      // Mark viewed on first load
      if (!estimate.viewed_at) {
        await pool.query(
          `UPDATE sales_estimates SET viewed_at=NOW(), status=CASE WHEN status='sent' THEN 'viewed' ELSE status END, updated_at=NOW() WHERE portal_token=$1`,
          [token]
        );
        estimate.viewed_at = new Date().toISOString();
        if (estimate.status === "sent") estimate.status = "viewed";
      }

      // Attach work areas
      const { rows: areas } = await pool.query(
        `SELECT wa.*, wat.name AS type_name
         FROM estimate_work_areas wa
         LEFT JOIN work_area_types wat ON wat.id = wa.work_area_type_id
         WHERE wa.estimate_id=$1 ORDER BY wa.sort_order, wa.id`,
        [estimate.id]
      );
      for (const area of areas) {
        const { rows: items } = await pool.query(
          `SELECT * FROM estimate_line_items WHERE estimate_work_area_id=$1 ORDER BY sort_order, id`,
          [area.id]
        );
        area.line_items = items;
      }
      estimate.work_areas = areas;

      res.json(estimate);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: "Error loading portal" });
    }
  });

  // PATCH /api/estimates/:id/terms — update T&C override + deposit percentage
  app.patch("/api/estimates/:id/terms", requireAuth, requireRole(...STAFF_ROLES), async (req, res) => {
    try {
      const { terms_and_conditions_override, deposit_percentage } = req.body;
      await pool.query(
        `UPDATE sales_estimates
         SET terms_and_conditions_override=$1, deposit_percentage=COALESCE($2, deposit_percentage), updated_at=NOW()
         WHERE id=$3`,
        [terms_and_conditions_override ?? null, deposit_percentage ?? null, req.params.id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/portal/:token/respond — public, customer approves/declines with optional signature
  app.post("/api/portal/:token/respond", async (req, res) => {
    try {
      const { token } = req.params;
      const { action, note, signature_data, initials } = req.body;

      if (!["approved", "declined"].includes(action)) {
        return res.status(400).json({ message: "action must be 'approved' or 'declined'" });
      }

      const { rows } = await pool.query(
        `SELECT e.*, c.first_name || ' ' || c.last_name AS customer_name
         FROM sales_estimates e
         LEFT JOIN customers c ON c.id = e.customer_id
         WHERE e.portal_token=$1`,
        [token]
      );
      if (!rows.length) return res.status(404).json({ message: "Portal link not found" });

      const estimate = rows[0];
      const status = action === "approved" ? "approved" : "declined";

      await pool.query(
        `UPDATE sales_estimates
         SET status=$1, customer_response=$2, customer_response_at=NOW(),
             customer_response_note=$3, signature_data=$4, initials=$5,
             approved_at=CASE WHEN $2='approved' THEN NOW() ELSE approved_at END,
             updated_at=NOW()
         WHERE portal_token=$6`,
        [status, action, note || null, signature_data || null, initials || null, token]
      );

      if (action === "approved") {
        // ── Notify admin/assigned salesperson ──────────────────────────────
        const estimateNum = estimate.estimate_number || estimate.id.slice(0, 8).toUpperCase();
        const estimateTitle = estimate.title || "Untitled Estimate";
        const customerName = estimate.customer_name || "Customer";
        const notifMsg = `Customer ${customerName} approved estimate #${estimateNum} - ${estimateTitle}`;
        const notifLink = `/estimates/${estimate.id}`;

        // Notify salesperson if assigned, otherwise all admins
        const recipientRows = await (async () => {
          if (estimate.salesperson_id) {
            const { rows: r } = await pool.query(
              `SELECT id FROM users WHERE id=$1`, [estimate.salesperson_id]
            );
            return r;
          }
          const { rows: r } = await pool.query(
            `SELECT id FROM users WHERE role IN ('Admin','Master Admin')`
          );
          return r;
        })();

        for (const recipient of recipientRows) {
          await pool.query(
            `INSERT INTO staff_notifications (user_id, type, title, message, link)
             VALUES ($1, 'estimate_approved', 'Estimate Approved', $2, $3)`,
            [recipient.id, notifMsg, notifLink]
          );
        }

        // ── Auto-create down payment invoice ──────────────────────────────
        const depositPct = estimate.deposit_percentage ?? 50;
        const total = parseFloat(estimate.total ?? "0");
        const depositAmount = (total * depositPct) / 100;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        const dueDateStr = dueDate.toISOString().split("T")[0];

        // Generate invoice number
        const { rows: seqRows } = await pool.query(
          `SELECT nextval('invoice_number_seq') AS n`
        );
        const invoiceNumber = `INV-${String(seqRows[0].n).padStart(4, "0")}`;

        await pool.query(
          `INSERT INTO invoices
             (id, invoice_number, customer_id, estimate_id, invoice_type, status, issued_date, due_date,
              subtotal, total, balance_due, notes)
           VALUES (gen_random_uuid()::text, $1, $2::uuid, $3::text, 'down_payment', 'pending',
                   CURRENT_DATE, $4, $5, $5, $5, $6)`,
          [
            invoiceNumber,
            estimate.customer_id || null,
            estimate.id,
            dueDateStr,
            depositAmount.toFixed(2),
            `${depositPct}% Deposit - ${estimateTitle}`,
          ]
        );
      }

      res.json({ success: true, status });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: "Error saving response" });
    }
  });
}
