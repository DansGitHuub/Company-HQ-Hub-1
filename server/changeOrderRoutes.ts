import { pool } from "./db";
import type { Express } from "express";
import { requireRole } from "./auth";

function logAudit(actorId: string | null, eventType: string, description: string, link = "/") {
  pool.query(
    `INSERT INTO activity_log (id, user_id, event_type, description, link, seen_by, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, '[]'::jsonb, now())`,
    [actorId, eventType, description, link]
  ).catch((e: any) => console.error(`[audit] ${eventType}:`, e.message));
}

async function nextCONumber(): Promise<string> {
  const { rows } = await pool.query(`SELECT nextval('co_number_seq') AS n`);
  const n = Number(rows[0].n);
  return `CO-${String(n).padStart(5, "0")}`;
}

export function registerChangeOrderRoutes(app: Express, requireAuth: any) {

  // ── List change orders for a job ─────────────────────────────────────────
  app.get("/api/jobs/:jobId/change-orders", requireAuth, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT co.*,
                u.name AS created_by_name
         FROM job_change_orders co
         LEFT JOIN users u ON u.id = co.created_by
         WHERE co.job_id = $1
         ORDER BY co.created_at DESC`,
        [req.params.jobId]
      );
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Manager: All pending change orders across all jobs ────────────────────
  app.get("/api/manager/pending-change-orders", requireAuth, async (req: any, res) => {
    const user = req.user;
    const isAdmin = user?.role === "Admin" || user?.role === "Manager" || user?.isMasterAdmin;
    if (!isAdmin) return res.status(403).json({ message: "Forbidden" });

    try {
      const { rows } = await pool.query(`
        SELECT
          co.id, co.co_number, co.title, co.status, co.total_amount,
          co.tax_rate, co.created_at, co.updated_at, co.job_id,
          j.client   AS job_name,
          j.title    AS job_title,
          j.address  AS job_address,
          u.name     AS created_by_name
        FROM job_change_orders co
        LEFT JOIN jobs j ON j.id = co.job_id
        LEFT JOIN users u ON u.id = co.created_by
        WHERE co.status IN ('pending_approval', 'sent')
        ORDER BY co.created_at DESC
      `);
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Get single change order with items ───────────────────────────────────
  app.get("/api/change-orders/:id", requireAuth, async (req: any, res) => {
    try {
      const { rows: coRows } = await pool.query(
        `SELECT co.*, u.name AS created_by_name
         FROM job_change_orders co
         LEFT JOIN users u ON u.id = co.created_by
         WHERE co.id = $1`,
        [req.params.id]
      );
      if (!coRows.length) return res.status(404).json({ message: "Change order not found" });

      const { rows: items } = await pool.query(
        `SELECT * FROM job_change_order_items WHERE change_order_id = $1 ORDER BY sort_order`,
        [req.params.id]
      );
      return res.json({ ...coRows[0], items });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Create change order ──────────────────────────────────────────────────
  app.post("/api/jobs/:jobId/change-orders", requireAuth, requireRole("Admin", "Manager"), async (req: any, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const {
        title, description, notes, internal_notes,
        source_estimate_id, tax_rate = 0, items = [],
      } = req.body;

      const { rows: jobRows } = await client.query(
        `SELECT customer_id FROM jobs WHERE id = $1`, [req.params.jobId]
      );
      if (!jobRows.length) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Job not found" }); }

      const coNum = await nextCONumber();

      let subtotal = 0;
      for (const item of items) {
        subtotal += Number(item.amount ?? (item.quantity ?? 1) * (item.unit_price ?? 0));
      }
      const tax = subtotal * Number(tax_rate);
      const total = subtotal + tax;

      const { rows: coRows } = await client.query(
        `INSERT INTO job_change_orders
           (job_id, customer_id, source_estimate_id, co_number, title, description,
            notes, internal_notes, status, subtotal, tax_rate, tax_amount, total, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10,$11,$12,$13)
         RETURNING id`,
        [req.params.jobId, jobRows[0].customer_id || null, source_estimate_id || null,
         coNum, title, description || null, notes || null, internal_notes || null,
         subtotal, tax_rate, tax, total, req.user.id]
      );
      const coId = coRows[0].id;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const amt = Number(item.amount ?? (Number(item.quantity ?? 1) * Number(item.unit_price ?? 0)));
        await client.query(
          `INSERT INTO job_change_order_items
             (change_order_id, item_type, description, quantity, unit, unit_price, amount, catalog_item_id, markup_pct, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [coId, item.item_type || "labor", item.description, item.quantity ?? 1,
           item.unit || null, item.unit_price ?? 0, amt, item.catalog_item_id ?? null,
           item.markup_pct != null ? item.markup_pct : null, i]
        );
      }

      await client.query("COMMIT");

      const { rows: full } = await pool.query(
        `SELECT * FROM job_change_orders WHERE id = $1`, [coId]
      );
      const { rows: fullItems } = await pool.query(
        `SELECT * FROM job_change_order_items WHERE change_order_id = $1 ORDER BY sort_order`, [coId]
      );
      logAudit(
        (req.user as any).id,
        "change_order_create",
        `${(req.user as any).name ?? "Staff"} created change order ${full[0].co_number} "${full[0].title}" ($${Number(full[0].total).toFixed(2)})`,
        `/jobs/${req.params.jobId}`
      );
      return res.status(201).json({ ...full[0], items: fullItems });
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("[change-orders] create error:", err.message);
      return res.status(500).json({ message: err.message });
    } finally {
      client.release();
    }
  });

  // ── Update change order ──────────────────────────────────────────────────
  app.patch("/api/change-orders/:id", requireAuth, requireRole("Admin", "Manager"), async (req: any, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { title, description, notes, internal_notes, tax_rate, items } = req.body;

      const { rows: existing } = await client.query(
        `SELECT * FROM job_change_orders WHERE id = $1`, [req.params.id]
      );
      if (!existing.length) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Not found" }); }
      if (existing[0].status === "approved") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Approved change orders cannot be edited" });
      }

      // Recalculate if items provided
      let subtotal = existing[0].subtotal;
      let taxAmt = existing[0].tax_amount;
      let total = existing[0].total;
      const rate = tax_rate ?? existing[0].tax_rate;

      if (items !== undefined) {
        subtotal = 0;
        for (const item of items) {
          subtotal += Number(item.amount ?? (item.quantity ?? 1) * (item.unit_price ?? 0));
        }
        taxAmt = subtotal * Number(rate);
        total = subtotal + taxAmt;

        await client.query(`DELETE FROM job_change_order_items WHERE change_order_id = $1`, [req.params.id]);
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const amt = Number(item.amount ?? (Number(item.quantity ?? 1) * Number(item.unit_price ?? 0)));
          await client.query(
            `INSERT INTO job_change_order_items
               (change_order_id, item_type, description, quantity, unit, unit_price, amount, catalog_item_id, markup_pct, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [req.params.id, item.item_type || "labor", item.description, item.quantity ?? 1,
             item.unit || null, item.unit_price ?? 0, amt, item.catalog_item_id ?? null,
             item.markup_pct != null ? item.markup_pct : null, i]
          );
        }
      }

      await client.query(
        `UPDATE job_change_orders SET
           title = COALESCE($1, title),
           description = COALESCE($2, description),
           notes = COALESCE($3, notes),
           internal_notes = COALESCE($4, internal_notes),
           tax_rate = $5,
           tax_amount = $6,
           subtotal = $7,
           total = $8,
           updated_at = NOW()
         WHERE id = $9`,
        [title, description, notes, internal_notes, rate, taxAmt, subtotal, total, req.params.id]
      );

      await client.query("COMMIT");

      const { rows: full } = await pool.query(`SELECT * FROM job_change_orders WHERE id = $1`, [req.params.id]);
      const { rows: fullItems } = await pool.query(
        `SELECT * FROM job_change_order_items WHERE change_order_id = $1 ORDER BY sort_order`, [req.params.id]
      );
      logAudit(
        (req.user as any).id,
        "change_order_edit",
        `${(req.user as any).name ?? "Staff"} edited change order ${full[0].co_number} "${full[0].title}" (total: $${Number(full[0].total).toFixed(2)})`,
        `/jobs/${full[0].job_id}`
      );
      return res.json({ ...full[0], items: fullItems });
    } catch (err: any) {
      await client.query("ROLLBACK");
      return res.status(500).json({ message: err.message });
    } finally {
      client.release();
    }
  });

  // ── Send for approval (status → pending_approval) ──────────────────────
  app.post("/api/change-orders/:id/send-for-approval", requireAuth, requireRole("Admin", "Manager"), async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `UPDATE job_change_orders SET status = 'pending_approval', updated_at = NOW() WHERE id = $1
         RETURNING co_number, title, job_id`,
        [req.params.id]
      );
      if (rows.length) {
        logAudit(
          req.user.id,
          "change_order_sent_for_approval",
          `${req.user.name ?? "Staff"} sent change order ${rows[0].co_number} "${rows[0].title}" for customer approval`,
          `/jobs/${rows[0].job_id}`
        );
      }
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Approve change order ─────────────────────────────────────────────────
  app.post("/api/change-orders/:id/approve", requireAuth, requireRole("Admin", "Manager"), async (req: any, res) => {
    const { approval_type, signature_data, approved_by_name } = req.body;
    if (!approval_type) return res.status(400).json({ message: "approval_type required" });
    try {
      const { rows } = await pool.query(
        `UPDATE job_change_orders
         SET status = 'approved', approval_type = $1, signature_data = $2,
             approved_by_name = $3, approved_at = NOW(), updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [approval_type, signature_data || null, approved_by_name || null, req.params.id]
      );
      if (!rows.length) return res.status(404).json({ message: "Not found" });

      // Update job price: add CO total to job value
      await pool.query(
        `UPDATE jobs SET price = COALESCE(price::numeric, 0) + $1, updated_at = NOW() WHERE id = $2`,
        [rows[0].total, rows[0].job_id]
      );
      logAudit(
        (req.user as any).id,
        "change_order_approved",
        `${(req.user as any).name ?? "Staff"} approved change order ${rows[0].co_number} "${rows[0].title}" ($${Number(rows[0].total).toFixed(2)})${approved_by_name ? ` — signed by: ${approved_by_name}` : ""}`,
        `/jobs/${rows[0].job_id}`
      );
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Reject change order ──────────────────────────────────────────────────
  app.post("/api/change-orders/:id/reject", requireAuth, requireRole("Admin", "Manager"), async (req: any, res) => {
    const { reason } = req.body;
    try {
      const { rows } = await pool.query(
        `UPDATE job_change_orders
         SET status = 'rejected', internal_notes = COALESCE($1, internal_notes), updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [reason || null, req.params.id]
      );
      if (rows.length) {
        logAudit(
          req.user.id,
          "change_order_rejected",
          `${req.user.name ?? "Staff"} rejected change order ${rows[0].co_number} "${rows[0].title}"${reason ? `: ${reason}` : ""}`,
          `/jobs/${rows[0].job_id}`
        );
      }
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Delete change order (draft only) ────────────────────────────────────
  app.delete("/api/change-orders/:id", requireAuth, requireRole("Admin", "Manager"), async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT status, co_number, title, job_id FROM job_change_orders WHERE id = $1`,
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ message: "Not found" });
      if (rows[0].status === "approved") {
        return res.status(400).json({ message: "Cannot delete an approved change order" });
      }
      await pool.query(`DELETE FROM job_change_orders WHERE id = $1`, [req.params.id]);
      logAudit(
        req.user.id,
        "change_order_delete",
        `${req.user.name ?? "Staff"} deleted change order ${rows[0].co_number} "${rows[0].title}"`,
        `/jobs/${rows[0].job_id}`
      );
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
