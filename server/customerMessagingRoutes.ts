import { Express } from "express";
import { pool } from "./db";
import { requireRole } from "./auth";
import {
  segmentCustomers, sendToCustomer, renderTemplate, buildTemplateVars, SegmentFilters,
  sendContextualMessage, ContextualMessageType,
} from "./customerMessagingService";

const JOB_NOTIFY_TYPES: ContextualMessageType[] = ["start_reminder", "weather_delay", "completion"];

export function registerCustomerMessagingRoutes(app: Express, requireAuth: any) {
  const requireStaff = requireRole("Admin", "Manager");

  // ── SEGMENT: find customers matching filters + reachable channel ──────────
  app.post("/api/customers/segment", requireAuth, requireStaff, async (req, res) => {
    try {
      const body = req.body ?? {};
      const filters: SegmentFilters = {
        zone: body.zone || undefined,
        serviceType: body.serviceType || undefined,
        jobStage: body.jobStage || undefined,
        scheduledFrom: body.scheduledFrom || undefined,
        scheduledTo: body.scheduledTo || undefined,
        overdueInvoice: body.overdueInvoice === true,
      };
      const results = await segmentCustomers(filters);
      res.json({
        count: results.length,
        reachable: results.filter(r => r.channel !== "none").length,
        unreachable: results.filter(r => r.channel === "none").length,
        customers: results,
      });
    } catch (err: any) {
      console.error("[customerMessaging] segment error:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── BLAST: create + send a message blast to a segment (or explicit customer id list) ──
  app.post("/api/message-blasts", requireAuth, requireStaff, async (req: any, res) => {
    try {
      const { subject, body, templateKey, filters, customerIds } = req.body ?? {};
      if (!body || typeof body !== "string") {
        return res.status(400).json({ message: "Message body is required" });
      }

      let targets = Array.isArray(customerIds) && customerIds.length
        ? await segmentCustomers({}).then(all => all.filter(c => customerIds.includes(c.customerId)))
        : await segmentCustomers(filters ?? {});

      const { rows: blastRows } = await pool.query(
        `INSERT INTO message_blasts (subject, template_key, body, filters, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [subject ?? null, templateKey ?? null, body, filters ? JSON.stringify(filters) : null, req.user.id]
      );
      const blastId = blastRows[0].id;

      let sentCount = 0;
      let skippedCount = 0;
      for (const target of targets) {
        if (target.channel === "none") {
          skippedCount++;
          await pool.query(
            `INSERT INTO message_blast_recipients (blast_id, customer_id, channel, status, error)
             VALUES ($1, $2, 'none', 'skipped', 'No reachable channel')`,
            [blastId, target.customerId]
          );
          continue;
        }

        const vars = buildTemplateVars({
          customerName: `${target.firstName} ${target.lastName}`.trim(),
        });
        const renderedBody = renderTemplate(body, vars);
        const renderedSubject = subject ? renderTemplate(subject, vars) : "Message from Chapin Landscapes";

        const result = await sendToCustomer(target.customerId, renderedSubject, renderedBody, req.user.id);

        await pool.query(
          `INSERT INTO message_blast_recipients (blast_id, customer_id, channel, status, error, sent_at)
           VALUES ($1, $2, $3, $4, $5, ${result.success ? "NOW()" : "NULL"})`,
          [blastId, target.customerId, result.channel, result.success ? "sent" : "failed", result.error ?? null]
        );

        if (result.success) sentCount++;
        else skippedCount++;
      }

      await pool.query(`UPDATE message_blasts SET sent_at = NOW() WHERE id = $1`, [blastId]);

      res.status(201).json({ blastId, total: targets.length, sent: sentCount, skipped: skippedCount });
    } catch (err: any) {
      console.error("[customerMessaging] blast send error:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── BLAST HISTORY ───────────────────────────────────────────────────────────
  app.get("/api/message-blasts", requireAuth, requireStaff, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          mb.id, mb.subject, mb.template_key, mb.body, mb.filters, mb.created_at, mb.sent_at,
          u.name AS created_by_name,
          COUNT(mbr.id) AS recipient_count,
          COUNT(mbr.id) FILTER (WHERE mbr.status = 'sent') AS sent_count,
          COUNT(mbr.id) FILTER (WHERE mbr.status = 'failed') AS failed_count,
          COUNT(mbr.id) FILTER (WHERE mbr.status = 'skipped') AS skipped_count
        FROM message_blasts mb
        LEFT JOIN users u ON u.id = mb.created_by
        LEFT JOIN message_blast_recipients mbr ON mbr.blast_id = mb.id
        GROUP BY mb.id, u.name
        ORDER BY mb.created_at DESC
      `);
      res.json(rows);
    } catch (err: any) {
      console.error("[customerMessaging] blast history error:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── BLAST DETAIL: per-recipient status ─────────────────────────────────────
  app.get("/api/message-blasts/:id", requireAuth, requireStaff, async (req, res) => {
    try {
      const { rows: blastRows } = await pool.query(`SELECT * FROM message_blasts WHERE id = $1`, [req.params.id]);
      if (!blastRows.length) return res.status(404).json({ message: "Blast not found" });

      const { rows: recipients } = await pool.query(`
        SELECT
          mbr.id, mbr.customer_id, mbr.channel, mbr.status, mbr.error, mbr.sent_at,
          c.first_name, c.last_name
        FROM message_blast_recipients mbr
        LEFT JOIN customers c ON c.id = mbr.customer_id
        WHERE mbr.blast_id = $1
        ORDER BY c.last_name ASC
      `, [req.params.id]);

      res.json({ ...blastRows[0], recipients });
    } catch (err: any) {
      console.error("[customerMessaging] blast detail error:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── JOB: contextual one-click customer notification (start/weather/completion) ──
  app.post("/api/jobs/:id/notify-customer", requireAuth, requireStaff, async (req: any, res) => {
    try {
      const { type } = req.body ?? {};
      if (!JOB_NOTIFY_TYPES.includes(type)) {
        return res.status(400).json({ message: `type must be one of: ${JOB_NOTIFY_TYPES.join(", ")}` });
      }

      const { rows } = await pool.query(
        `SELECT id, customer_id, title, client, scheduled_date FROM jobs WHERE id = $1`,
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ message: "Job not found" });
      const job = rows[0];
      if (!job.customer_id) {
        return res.status(400).json({ message: "This job has no linked customer to notify" });
      }

      const result = await sendContextualMessage({
        customerId: job.customer_id,
        type,
        extraVars: { jobTitle: job.title || job.client, scheduledDate: job.scheduled_date },
        context: { jobId: job.id },
        senderId: req.user.id,
      });

      res.json(result);
    } catch (err: any) {
      console.error("[customerMessaging] job notify error:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── JOB CLOSEOUT: send review request ──────────────────────────────────────
  app.post("/api/jobs/:id/closeout/send-review-request", requireAuth, requireStaff, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, customer_id, title, client FROM jobs WHERE id = $1`,
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ message: "Job not found" });
      const job = rows[0];
      if (!job.customer_id) {
        return res.status(400).json({ message: "This job has no linked customer to notify" });
      }

      const result = await sendContextualMessage({
        customerId: job.customer_id,
        type: "review_request",
        extraVars: { jobTitle: job.title || job.client },
        context: { jobId: job.id },
        senderId: req.user.id,
      });

      if (result.success) {
        await pool.query(
          `UPDATE job_closeouts SET review_requested_at = NOW() WHERE job_id = $1`,
          [job.id]
        );
      }

      res.json(result);
    } catch (err: any) {
      console.error("[customerMessaging] closeout review request error:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── INVOICE: send payment reminder (overdue only) ───────────────────────────
  app.post("/api/invoices/:id/send-payment-reminder", requireAuth, requireStaff, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, customer_id, invoice_number, status, balance_due, due_date FROM invoices WHERE id = $1`,
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ message: "Invoice not found" });
      const invoice = rows[0];
      if (!invoice.customer_id) {
        return res.status(400).json({ message: "This invoice has no linked customer to notify" });
      }
      const isOverdue = invoice.status === "overdue" ||
        (invoice.due_date && new Date(invoice.due_date) < new Date() && parseFloat(invoice.balance_due ?? "0") > 0);
      if (!isOverdue) {
        return res.status(400).json({ message: "Payment reminders can only be sent for overdue invoices" });
      }

      const result = await sendContextualMessage({
        customerId: invoice.customer_id,
        type: "payment_reminder",
        extraVars: { invoiceNumber: invoice.invoice_number, balanceDue: invoice.balance_due },
        context: { invoiceId: invoice.id },
        senderId: req.user.id,
      });

      res.json(result);
    } catch (err: any) {
      console.error("[customerMessaging] invoice payment reminder error:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  });
}
