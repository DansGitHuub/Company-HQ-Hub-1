import type { Express } from "express";
import { pool } from "./db";
import { sendEmail, escapeHtml, getAppUrl } from "./emailService";
import { MESSAGE_BLAST_TEMPLATES, getTemplate, substituteVariables } from "./messageBlastTemplates";
import { resolveRecipients, resolveRecipientsQuery, type MessageBlastFilters } from "./messageBlastFilters";

function formatDate(d: string | Date | null): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatCurrency(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  const num = Number(v);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export async function registerMessageBlastRoutes(app: Express, requireAuth: any, requireRole: any) {
  const requireAdminOrManager = requireRole(["Admin", "Manager"]);

  // ── List all blasts (history + drafts)
  app.get("/api/message-blasts", requireAuth, requireAdminOrManager, async (_req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT b.*, u.name AS created_by_name,
          COUNT(r.id) FILTER (WHERE r.status = 'sent') AS sent_count,
          COUNT(r.id) FILTER (WHERE r.status = 'failed') AS failed_count,
          COUNT(r.id) FILTER (WHERE r.status = 'pending') AS pending_count
        FROM message_blasts b
        LEFT JOIN users u ON u.id = b.created_by
        LEFT JOIN message_blast_recipients r ON r.blast_id = b.id
        GROUP BY b.id, u.name
        ORDER BY b.created_at DESC
      `);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── List templates
  app.get("/api/message-blasts/templates", requireAuth, requireAdminOrManager, async (_req, res) => {
    res.json(MESSAGE_BLAST_TEMPLATES);
  });

  // ── Preview recipient count/sample for a given filter set (no DB write)
  app.post("/api/message-blasts/preview", requireAuth, requireAdminOrManager, async (req, res) => {
    try {
      const filters: MessageBlastFilters = req.body?.filters ?? {};
      const recipients = await resolveRecipients(filters);
      res.json({
        count: recipients.length,
        sample: recipients.slice(0, 10).map((r) => ({ id: r.id, name: r.name, email: r.email })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Create draft blast
  app.post("/api/message-blasts", requireAuth, requireAdminOrManager, async (req, res) => {
    try {
      const { name, subject, templateKey, body, filters } = req.body ?? {};
      if (!body || !String(body).trim()) {
        return res.status(400).json({ error: "Message body is required" });
      }
      const userId = (req.user as any)?.id ?? null;
      const { rows } = await pool.query(
        `INSERT INTO message_blasts (name, subject, template_key, body, filters, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [name ?? null, subject ?? null, templateKey ?? null, body, filters ? JSON.stringify(filters) : null, userId]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get single blast + recipients
  app.get("/api/message-blasts/:id", requireAuth, requireAdminOrManager, async (req, res) => {
    try {
      const blast = await pool.query(`SELECT b.*, u.name AS created_by_name FROM message_blasts b LEFT JOIN users u ON u.id = b.created_by WHERE b.id = $1`, [req.params.id]);
      if (!blast.rows[0]) return res.status(404).json({ error: "Blast not found" });
      const recipients = await pool.query(
        `SELECT * FROM message_blast_recipients WHERE blast_id = $1 ORDER BY customer_name ASC`,
        [req.params.id]
      );
      res.json({ ...blast.rows[0], recipients: recipients.rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Update draft (subject, body, filters, name) — not allowed once sent
  app.patch("/api/message-blasts/:id", requireAuth, requireAdminOrManager, async (req, res) => {
    try {
      const existing = await pool.query(`SELECT * FROM message_blasts WHERE id = $1`, [req.params.id]);
      if (!existing.rows[0]) return res.status(404).json({ error: "Blast not found" });
      if (existing.rows[0].sent_at) return res.status(409).json({ error: "Cannot edit a blast that has already been sent" });

      const { name, subject, templateKey, body, filters } = req.body ?? {};
      const { rows } = await pool.query(
        `UPDATE message_blasts SET
          name = COALESCE($1, name),
          subject = COALESCE($2, subject),
          template_key = COALESCE($3, template_key),
          body = COALESCE($4, body),
          filters = COALESCE($5, filters)
         WHERE id = $6 RETURNING *`,
        [name ?? null, subject ?? null, templateKey ?? null, body ?? null, filters ? JSON.stringify(filters) : null, req.params.id]
      );
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Delete draft (not sent blasts)
  app.delete("/api/message-blasts/:id", requireAuth, requireAdminOrManager, async (req, res) => {
    try {
      const existing = await pool.query(`SELECT * FROM message_blasts WHERE id = $1`, [req.params.id]);
      if (!existing.rows[0]) return res.status(404).json({ error: "Blast not found" });
      if (existing.rows[0].sent_at) return res.status(409).json({ error: "Cannot delete a blast that has already been sent" });
      await pool.query(`DELETE FROM message_blasts WHERE id = $1`, [req.params.id]);
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Send a blast
  app.post("/api/message-blasts/:id/send", requireAuth, requireAdminOrManager, async (req, res) => {
    try {
      const existing = await pool.query(`SELECT * FROM message_blasts WHERE id = $1`, [req.params.id]);
      const blast = existing.rows[0];
      if (!blast) return res.status(404).json({ error: "Blast not found" });
      if (blast.sent_at) return res.status(409).json({ error: "This blast has already been sent" });

      const filters: MessageBlastFilters = blast.filters ?? {};
      const manualValues: Record<string, string> = req.body?.manualValues ?? {};
      const recipients = await resolveRecipients(filters);

      if (recipients.length === 0) {
        return res.status(400).json({ error: "No customers match the selected filters" });
      }

      // Mark as sending — set sent_at now, then process each recipient.
      await pool.query(
        `UPDATE message_blasts SET sent_at = NOW(), recipient_count = $1 WHERE id = $2`,
        [recipients.length, blast.id]
      );

      const template = blast.template_key ? getTemplate(blast.template_key) : undefined;
      const results: { customerId: string; status: string; error?: string }[] = [];

      for (const r of recipients) {
        const recipientInsert = await pool.query(
          `INSERT INTO message_blast_recipients (blast_id, customer_id, customer_name, channel, status)
           VALUES ($1, $2, $3, 'email', 'pending') RETURNING id`,
          [blast.id, r.id, r.name]
        );
        const recipientId = recipientInsert.rows[0].id;

        if (!r.email) {
          await pool.query(
            `UPDATE message_blast_recipients SET status = 'failed', error = $1 WHERE id = $2`,
            ["No primary email on file", recipientId]
          );
          results.push({ customerId: r.id, status: "failed", error: "No primary email on file" });
          continue;
        }

        const values: Record<string, string> = {
          ...manualValues,
          customer_name: r.name || "Customer",
          job_title: r.job_title || "",
          schedule_date: formatDate(r.scheduled_date),
          completion_date: formatDate(r.completion_date),
          invoice_amount: formatCurrency(r.invoice_amount),
          due_date: formatDate(r.due_date),
          portal_link: `${getAppUrl()}/customer`,
        };

        const subject = substituteVariables(blast.subject || template?.subject || "Update from Chapin Landscapes", values);
        const html = substituteVariables(blast.body, values);

        try {
          const sent = await sendEmail(r.email, subject, html);
          if (sent) {
            await pool.query(
              `UPDATE message_blast_recipients SET status = 'sent', sent_at = NOW() WHERE id = $1`,
              [recipientId]
            );
            results.push({ customerId: r.id, status: "sent" });
          } else {
            await pool.query(
              `UPDATE message_blast_recipients SET status = 'failed', error = $1 WHERE id = $2`,
              ["Email provider rejected the message", recipientId]
            );
            results.push({ customerId: r.id, status: "failed", error: "Email provider rejected the message" });
          }
        } catch (err: any) {
          await pool.query(
            `UPDATE message_blast_recipients SET status = 'failed', error = $1 WHERE id = $2`,
            [err.message, recipientId]
          );
          results.push({ customerId: r.id, status: "failed", error: err.message });
        }
      }

      const sentCount = results.filter((r) => r.status === "sent").length;
      const failedCount = results.filter((r) => r.status === "failed").length;
      res.json({ sent: sentCount, failed: failedCount, total: results.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Resend only failed recipients for an already-sent blast
  app.post("/api/message-blasts/:id/resend-failed", requireAuth, requireAdminOrManager, async (req, res) => {
    try {
      const blastResult = await pool.query(`SELECT * FROM message_blasts WHERE id = $1`, [req.params.id]);
      const blast = blastResult.rows[0];
      if (!blast) return res.status(404).json({ error: "Blast not found" });
      if (!blast.sent_at) return res.status(400).json({ error: "This blast has not been sent yet" });

      const manualValues: Record<string, string> = req.body?.manualValues ?? {};
      const failedResult = await pool.query(
        `SELECT r.*, ce.email AS resolved_email
         FROM message_blast_recipients r
         LEFT JOIN customer_emails ce ON ce.customer_id = r.customer_id AND ce.is_primary = true
         WHERE r.blast_id = $1 AND r.status = 'failed'`,
        [req.params.id]
      );

      if (failedResult.rows.length === 0) {
        return res.json({ sent: 0, failed: 0, total: 0 });
      }

      const template = blast.template_key ? getTemplate(blast.template_key) : undefined;
      let sentCount = 0;
      let failedCount = 0;

      for (const r of failedResult.rows) {
        const email = r.resolved_email;
        if (!email) {
          failedCount++;
          continue;
        }
        const values: Record<string, string> = {
          ...manualValues,
          customer_name: r.customer_name || "Customer",
          portal_link: `${getAppUrl()}/customer`,
        };
        const subject = substituteVariables(blast.subject || template?.subject || "Update from Chapin Landscapes", values);
        const html = substituteVariables(blast.body, values);
        try {
          const sent = await sendEmail(email, subject, html);
          if (sent) {
            await pool.query(`UPDATE message_blast_recipients SET status = 'sent', sent_at = NOW(), error = NULL WHERE id = $1`, [r.id]);
            sentCount++;
          } else {
            await pool.query(`UPDATE message_blast_recipients SET error = $1 WHERE id = $2`, ["Email provider rejected the message", r.id]);
            failedCount++;
          }
        } catch (err: any) {
          await pool.query(`UPDATE message_blast_recipients SET error = $1 WHERE id = $2`, [err.message, r.id]);
          failedCount++;
        }
      }

      res.json({ sent: sentCount, failed: failedCount, total: failedResult.rows.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
