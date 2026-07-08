import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import { pool } from "./db";
import { sendCustomerWelcomeEmail, sendCustomerNotificationEmail } from "./email";
import { hashPassword } from "./auth";
import crypto from "crypto";

function generateTempPassword(): string {
  return crypto.randomBytes(4).toString("hex") + "A1!";
}

export function registerCustomerHubRoutes(app: Express, requireAuth: RequestHandler) {
  const requireCustomer: RequestHandler = (req: any, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    if (req.user.role !== "Customer") return res.status(403).json({ message: "Customer access only" });
    next();
  };

  const requireStaff: RequestHandler = (req: any, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const role = req.user.role;
    if (role === "Customer") return res.status(403).json({ message: "Staff access only" });
    next();
  };

  const requireManager: RequestHandler = (req: any, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const role = req.user.role;
    const isMaster = req.user.isMasterAdmin;
    if (!["Admin", "Manager"].includes(role) && !isMaster) return res.status(403).json({ message: "Not authorized" });
    next();
  };

  // ===== CUSTOMER DASHBOARD =====
  app.get("/api/customer-hub/dashboard", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const customerJobLinks = await storage.getCustomerJobs(userId);
      const allJobs = [];
      for (const link of customerJobLinks) {
        const job = await storage.getJob(link.jobId);
        if (job) allJobs.push(job);
      }

      const activeJob = allJobs.find(j => j.stage !== "Completed" && j.stage !== "Cancelled");
      const docs = await storage.getCustomerDocuments(userId);
      const actionItems = docs.filter(d => d.status === "Needs Review" || d.status === "Needs Signature");
      const unreadCount = await storage.getUnreadNotificationCount(userId);

      const month = new Date().getMonth();
      const seasonalTips: Record<number, { title: string; tip: string }> = {
        0: { title: "Winter Care", tip: "Keep walkways clear of ice and avoid salt near landscape beds. Consider protective covers for delicate plants." },
        1: { title: "Late Winter Prep", tip: "Start planning your spring landscape projects. Now is a great time to schedule early-season cleanups." },
        2: { title: "Spring Awakening", tip: "Time for spring cleanup! Remove debris, check irrigation, and apply fresh mulch to beds." },
        3: { title: "Spring Planting", tip: "Ideal time for planting trees, shrubs, and perennials. Ensure soil is properly amended before planting." },
        4: { title: "Early Summer", tip: "Adjust irrigation schedules as temperatures rise. Watch for signs of pest activity in your landscape." },
        5: { title: "Summer Maintenance", tip: "Water deeply but less frequently. Mow high to reduce stress on your lawn during the heat." },
        6: { title: "Mid-Summer", tip: "Focus on deadheading flowers and keeping beds weeded. Deep water during dry spells." },
        7: { title: "Late Summer", tip: "Perfect time to plan fall plantings. Start addressing any drainage issues before autumn rains." },
        8: { title: "Fall Prep", tip: "Begin fall cleanup. This is the best time for aeration and overseeding your lawn." },
        9: { title: "Autumn Care", tip: "Keep leaves off your lawn to prevent disease. Plant fall bulbs for spring color." },
        10: { title: "Winter Prep", tip: "Winterize your irrigation system and apply fall fertilizer. Protect tender plants from frost." },
        11: { title: "Holiday Season", tip: "Ensure walkways are safe and well-lit. Consider professional snow removal for worry-free winters." },
      };

      res.json({
        user: { name: req.user.name, email: req.user.email },
        activeJob: activeJob || null,
        totalJobs: allJobs.length,
        unreadMessages: unreadCount,
        actionItems: actionItems.length,
        seasonalTip: seasonalTips[month],
        recentDocuments: docs.slice(0, 3),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== CUSTOMER JOBS =====

  // Whitelist of fields a customer is allowed to see on a job object.
  // Internal fields (value, price, estimatedHours, totalHours, notes, crewNotes,
  // contactName/Phone/Email, zone, IDs, integration keys, timestamps) are intentionally omitted.
  function toCustomerJob(job: any) {
    return {
      id:                       job.id,
      type:                     job.type,
      title:                    job.title,
      client:                   job.client,
      stage:                    job.stage,
      status:                   job.status,
      division:                 job.division,
      description:              job.description,
      scheduledDate:            job.scheduledDate,
      completionDate:           job.completionDate,
      scheduledStartTime:       job.scheduledStartTime,
      scheduledEndTime:         job.scheduledEndTime,
      address:                  job.address,
      city:                     job.city,
      state:                    job.state,
      zip:                      job.zip,
      crewLeadName:                  job.crewLeadName                  || null,
      crewNotesCustomerVisible:      job.crewNotesCustomerVisible      || null,
      scopeOfWork:                   job.scopeOfWork                   || null,
      materialsUsed:                 job.materialsUsed                 || null,
      customerSatisfactionRating:    job.customerSatisfactionRating    ?? null,
      customerSatisfactionFeedback:  job.customerSatisfactionFeedback  ?? null,
      customerSatisfactionAt:        job.customerSatisfactionAt        ?? null,
    };
  }

  app.get("/api/customer-hub/jobs", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const links = await storage.getCustomerJobs(req.user.id);
      const jobsWithDetails = [];
      for (const link of links) {
        const job = await storage.getJob(link.jobId);
        if (job) {
          const docs = await storage.getJobDocuments(link.jobId);
          jobsWithDetails.push({
            ...toCustomerJob(job),
            documents: docs,
          });
        }
      }
      res.json(jobsWithDetails);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/customer-hub/jobs/:id", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const links = await storage.getCustomerJobs(req.user.id);
      const hasAccess = links.some(l => l.jobId === req.params.id);
      if (!hasAccess) return res.status(403).json({ message: "Not authorized" });

      const job = await storage.getJob(req.params.id);
      if (!job) return res.status(404).json({ message: "Job not found" });

      const docs = await storage.getJobDocuments(req.params.id);
      const customerDocs = await storage.getCustomerDocuments(req.user.id);
      const jobCustomerDocs = customerDocs.filter(d => d.jobId === req.params.id);

      res.json({
        ...toCustomerJob(job),
        documents: docs,
        customerDocuments: jobCustomerDocs,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== CUSTOMER CHANGE-ORDER APPROVAL =====
  // Returns change orders in 'pending_approval' status for a job the customer owns.
  app.get("/api/customer-hub/jobs/:id/change-orders", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const links = await storage.getCustomerJobs(req.user.id);
      const hasAccess = links.some((l: any) => l.jobId === req.params.id);
      if (!hasAccess) return res.status(403).json({ message: "Not authorized" });

      const { rows } = await pool.query(
        `SELECT co.id, co.co_number, co.title, co.description, co.notes,
                co.subtotal, co.tax_rate, co.tax_amount, co.total,
                co.status, co.created_at, co.updated_at
         FROM   job_change_orders co
         WHERE  co.job_id = $1
           AND  co.status = 'pending_approval'
         ORDER BY co.created_at DESC`,
        [req.params.id]
      );

      // Attach line items for each CO
      const coIds = rows.map((r: any) => r.id);
      let itemsByCoId: Record<string, any[]> = {};
      if (coIds.length) {
        const { rows: items } = await pool.query(
          `SELECT id, change_order_id, item_type, description, quantity, unit, unit_price, amount
           FROM   job_change_order_items
           WHERE  change_order_id = ANY($1::uuid[])
           ORDER BY sort_order`,
          [coIds]
        );
        for (const item of items) {
          if (!itemsByCoId[item.change_order_id]) itemsByCoId[item.change_order_id] = [];
          itemsByCoId[item.change_order_id].push(item);
        }
      }

      res.json(rows.map((r: any) => ({ ...r, items: itemsByCoId[r.id] ?? [] })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Customer approves a pending change order (digital signature optional).
  app.post("/api/customer-hub/change-orders/:id/approve", requireAuth, requireCustomer, async (req: any, res) => {
    const { signature_data, approved_by_name } = req.body;
    try {
      // Verify customer owns the job linked to this CO
      const { rows: coRows } = await pool.query(
        `SELECT co.id, co.job_id, co.status, co.total, co.co_number, co.title
         FROM   job_change_orders co WHERE co.id = $1`,
        [req.params.id]
      );
      if (!coRows.length) return res.status(404).json({ message: "Change order not found" });
      if (coRows[0].status !== "pending_approval") {
        return res.status(400).json({ message: "Change order is not pending approval" });
      }
      const links = await storage.getCustomerJobs(req.user.id);
      if (!links.some((l: any) => l.jobId === coRows[0].job_id)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { rows: updated } = await pool.query(
        `UPDATE job_change_orders
         SET status = 'approved', approval_type = 'customer_portal',
             signature_data = $1, approved_by_name = $2,
             approved_at = NOW(), updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [signature_data || null, approved_by_name || null, req.params.id]
      );

      // Add CO total to job price
      await pool.query(
        `UPDATE jobs SET price = COALESCE(price::numeric, 0) + $1, updated_at = NOW()
         WHERE id = $2`,
        [coRows[0].total, coRows[0].job_id]
      );

      // Notify admin/manager via staff_notifications
      const custName = (req.user as any).name ?? req.user.username ?? "Customer";
      await pool.query(
        `INSERT INTO staff_notifications (type, title, message, link, created_at, seen_by)
         VALUES ('change_order_approved', $1, $2, $3, NOW(), '[]'::jsonb)`,
        [
          `Change Order Approved by Customer`,
          `${custName} approved change order ${coRows[0].co_number} "${coRows[0].title}" — $${Number(coRows[0].total).toFixed(2)}`,
          `/jobs/${coRows[0].job_id}`,
        ]
      );

      res.json(updated[0]);
    } catch (err: any) {
      console.error("[customer-hub/change-orders] approve error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // Customer rejects a pending change order.
  app.post("/api/customer-hub/change-orders/:id/reject", requireAuth, requireCustomer, async (req: any, res) => {
    const { reason } = req.body;
    try {
      const { rows: coRows } = await pool.query(
        `SELECT co.id, co.job_id, co.status, co.co_number, co.title
         FROM   job_change_orders co WHERE co.id = $1`,
        [req.params.id]
      );
      if (!coRows.length) return res.status(404).json({ message: "Change order not found" });
      if (coRows[0].status !== "pending_approval") {
        return res.status(400).json({ message: "Change order is not pending approval" });
      }
      const links = await storage.getCustomerJobs(req.user.id);
      if (!links.some((l: any) => l.jobId === coRows[0].job_id)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { rows: updated } = await pool.query(
        `UPDATE job_change_orders
         SET status = 'rejected',
             internal_notes = CASE WHEN $1::text IS NOT NULL
               THEN COALESCE(internal_notes || E'\\n', '') || 'Customer rejection reason: ' || $1
               ELSE internal_notes END,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [reason || null, req.params.id]
      );

      const custName = (req.user as any).name ?? req.user.username ?? "Customer";
      await pool.query(
        `INSERT INTO staff_notifications (type, title, message, link, created_at, seen_by)
         VALUES ('change_order_rejected', $1, $2, $3, NOW(), '[]'::jsonb)`,
        [
          `Change Order Rejected by Customer`,
          `${custName} rejected change order ${coRows[0].co_number} "${coRows[0].title}"${reason ? `: ${reason}` : ""}`,
          `/jobs/${coRows[0].job_id}`,
        ]
      );

      res.json(updated[0]);
    } catch (err: any) {
      console.error("[customer-hub/change-orders] reject error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // ===== CUSTOMER SATISFACTION / JOB SIGN-OFF =====
  // Lets a customer submit a 1-5 star rating + optional comment on a completed job.
  // One-time: once satisfied_at is set the endpoint returns 409 to prevent duplicates.
  app.post("/api/customer-hub/jobs/:id/satisfaction", requireAuth, requireCustomer, async (req: any, res) => {
    const { rating, feedback } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating must be 1–5" });
    }
    try {
      const links = await storage.getCustomerJobs(req.user.id);
      if (!links.some((l: any) => l.jobId === req.params.id)) {
        return res.status(403).json({ message: "Access denied" });
      }
      // Only allow one submission
      const { rows: existing } = await pool.query(
        `SELECT customer_satisfaction_at FROM jobs WHERE id = $1`,
        [req.params.id]
      );
      if (!existing.length) return res.status(404).json({ message: "Job not found" });
      if (existing[0].customer_satisfaction_at) {
        return res.status(409).json({ message: "Satisfaction already submitted for this job" });
      }

      const { rows } = await pool.query(
        `UPDATE jobs
         SET customer_satisfaction_rating = $1,
             customer_satisfaction_feedback = $2,
             customer_satisfaction_at = NOW(),
             updated_at = NOW()
         WHERE id = $3
         RETURNING customer_satisfaction_rating, customer_satisfaction_feedback, customer_satisfaction_at`,
        [rating, feedback || null, req.params.id]
      );

      // Notify staff
      const custName = (req.user as any).name ?? req.user.username ?? "Customer";
      const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
      await pool.query(
        `INSERT INTO staff_notifications (type, title, message, link, created_at, seen_by)
         VALUES ('customer_satisfaction', $1, $2, $3, NOW(), '[]'::jsonb)`,
        [
          `Job Review Received — ${stars}`,
          `${custName} rated their job ${rating}/5${feedback ? `: "${feedback}"` : ""}`,
          `/jobs/${req.params.id}`,
        ]
      );

      res.json(rows[0]);
    } catch (err: any) {
      console.error("[customer-hub/satisfaction] error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // ===== JOB PHOTOS (before/after — customer-facing) =====
  // Returns worksheet photos tagged before/after for a job the customer owns.
  app.get("/api/customer-hub/jobs/:id/photos", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const links = await storage.getCustomerJobs(req.user.id);
      const hasAccess = links.some((l: any) => l.jobId === req.params.id);
      if (!hasAccess) return res.status(403).json({ message: "Not authorized" });

      const { rows } = await pool.query(
        `SELECT wp.id, wp.photo_type, wp.caption, wp.created_at
         FROM   worksheet_photos wp
         JOIN   worksheet_sessions ws ON ws.id = wp.session_id
         WHERE  ws.job_id = $1
           AND  wp.photo_type IN ('before', 'after')
         ORDER BY wp.photo_type DESC, wp.created_at ASC`,
        [req.params.id]
      );
      const photos = rows.map((r: any) => ({
        id: r.id,
        photo_type: r.photo_type,
        caption: r.caption,
        created_at: r.created_at,
        photo_url: `/api/customer-hub/photos/${r.id}/download`,
      }));
      res.json(photos);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Streams a single job photo from object storage — only for customers who own the job.
  app.get("/api/customer-hub/photos/:photoId/download", requireAuth, requireCustomer, async (req: any, res) => {
    const photoId = parseInt(req.params.photoId, 10);
    if (isNaN(photoId)) return res.status(400).json({ message: "Invalid photo ID" });
    try {
      // Verify this customer owns the job linked to the photo
      const { rows } = await pool.query(
        `SELECT wp.photo_url, ws.job_id
         FROM   worksheet_photos wp
         JOIN   worksheet_sessions ws ON ws.id = wp.session_id
         WHERE  wp.id = $1`,
        [photoId]
      );
      if (!rows.length) return res.status(404).json({ message: "Photo not found" });

      const { photo_url, job_id } = rows[0];
      const links = await storage.getCustomerJobs(req.user.id);
      if (!links.some((l: any) => l.jobId === job_id)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { ObjectStorageService } = await import(
        "./replit_integrations/object_storage/objectStorage"
      );
      const svc = new ObjectStorageService();
      const file = await svc.getObjectEntityFile(photo_url);
      const buffer = Buffer.from(await file.arrayBuffer());

      const ext = (photo_url as string).split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeMap: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
        gif: "image/gif", webp: "image/webp", heic: "image/heic",
      };
      res.setHeader("Content-Type", mimeMap[ext] ?? "image/jpeg");
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.send(buffer);
    } catch (err: any) {
      console.error("[customer-hub/photos] download error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // ===== CUSTOMER DOCUMENTS =====
  app.get("/api/customer-hub/documents", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const docs = await storage.getCustomerDocuments(req.user.id);
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/customer-hub/documents/request", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const { documentType, message } = req.body;
      const thread = await storage.createMessagingThread({
        customerId: req.user.id,
        subject: `Document Request: ${documentType || "General"}`,
        priority: "normal",
      } as any);
      await storage.createThreadMessage({
        threadId: thread.id,
        senderId: req.user.id,
        senderRole: "customer",
        content: message || `I would like to request: ${documentType}`,
      });
      res.status(201).json({ ok: true, threadId: thread.id });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== CARE GUIDES (Customer view) =====
  app.get("/api/customer-hub/care-guides", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const guides = await storage.getPublishedCareGuides();
      const saved = await storage.getCustomerSavedGuides(req.user.id);
      const savedIds = new Set(saved.map(s => s.guideId));
      const enriched = guides.map(g => ({ ...g, isSaved: savedIds.has(g.id) }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/customer-hub/care-guides/:id", requireAuth, requireCustomer, async (req, res) => {
    try {
      const guide = await storage.getCareGuide(req.params.id);
      if (!guide || !guide.isPublished) return res.status(404).json({ message: "Guide not found" });
      res.json(guide);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/customer-hub/care-guides/:id/save", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      await storage.createCustomerSavedGuide({ customerId: req.user.id, guideId: req.params.id });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/customer-hub/care-guides/:id/save", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      await storage.deleteCustomerSavedGuide(req.user.id, req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== CUSTOMER MESSAGES (uses existing messaging_threads) =====
  app.get("/api/customer-hub/messages", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const threads = await storage.getMessagingThreads({ customerId: req.user.id });
      res.json(threads);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/customer-hub/messages", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const { topic, message } = req.body;
      const thread = await storage.createMessagingThread({
        customerId: req.user.id,
        subject: topic || "General Inquiry",
        priority: "normal",
      } as any);
      await storage.createThreadMessage({
        threadId: thread.id,
        senderId: req.user.id,
        senderRole: "customer",
        content: message,
      });
      res.status(201).json(thread);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/customer-hub/messages/:threadId", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const thread = await storage.getMessagingThread(req.params.threadId);
      if (!thread || thread.customerId !== req.user.id) {
        return res.status(404).json({ message: "Thread not found" });
      }
      const messages = await storage.getThreadMessages(req.params.threadId);
      const visibleMessages = messages.filter(m => !m.isInternalNote);
      await storage.markMessagesAsRead(req.params.threadId, req.user.id);
      res.json({ thread, messages: visibleMessages });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/customer-hub/messages/:threadId/reply", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const thread = await storage.getMessagingThread(req.params.threadId);
      if (!thread || thread.customerId !== req.user.id) {
        return res.status(404).json({ message: "Thread not found" });
      }
      const msg = await storage.createThreadMessage({
        threadId: req.params.threadId,
        senderId: req.user.id,
        senderRole: "customer",
        content: req.body.content,
      });
      await storage.updateMessagingThread(req.params.threadId, {
        lastMessageAt: new Date(),
        unreadByEmployee: true,
        status: thread.status === "resolved" ? "open" : thread.status,
      });
      res.status(201).json(msg);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== CUSTOMER NOTIFICATIONS =====
  app.get("/api/customer-hub/notifications", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const notifications = await storage.getCustomerNotifications(req.user.id);
      res.json(notifications);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/customer-hub/notifications/unread-count", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.user.id);
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/customer-hub/notifications/:id/read", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const notifications = await storage.getCustomerNotifications(req.user.id);
      const owns = notifications.some((n: any) => n.id === req.params.id);
      if (!owns) return res.status(404).json({ message: "Notification not found" });
      await storage.markNotificationRead(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/customer-hub/notifications/mark-all-read", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      await storage.markAllNotificationsRead(req.user.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== ADMIN: CARE GUIDE MANAGEMENT =====
  app.get("/api/care-guides", requireAuth, requireStaff, async (req, res) => {
    try {
      const guides = await storage.getCareGuides();
      res.json(guides);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/care-guides", requireAuth, requireManager, async (req: any, res) => {
    try {
      const guide = await storage.createCareGuide({
        ...req.body,
        createdBy: req.user.id,
      });
      res.status(201).json(guide);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/care-guides/:id", requireAuth, requireManager, async (req, res) => {
    try {
      const updated = await storage.updateCareGuide(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Guide not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/care-guides/:id", requireAuth, requireManager, async (req, res) => {
    try {
      const deleted = await storage.deleteCareGuide(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Guide not found" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== ADMIN: CUSTOMER ACCOUNT MANAGEMENT =====
  app.get("/api/customer-accounts", requireAuth, requireStaff, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const customers = allUsers.filter(u => u.role === "Customer");
      const result = await Promise.all(customers.map(async (c) => {
        const jobLinks = await storage.getCustomerJobs(c.id);
        return {
          id: c.id,
          name: c.name,
          email: c.email,
          username: c.username,
          isActive: c.isActive,
          createdAt: c.createdAt,
          jobCount: jobLinks.length,
        };
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/customer-accounts/invite", requireAuth, requireStaff, async (req: any, res) => {
    try {
      const { name, email, jobId } = req.body;
      if (!name || !email) return res.status(400).json({ message: "Name and email required" });

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        if (jobId) {
          const existingLinks = await storage.getCustomerJobsByJobId(jobId);
          const alreadyLinked = existingLinks.some(l => l.customerId === existing.id);
          if (!alreadyLinked) {
            await storage.createCustomerJob({ customerId: existing.id, jobId });
          }
        }
        return res.json({ message: "Customer already exists, job linked", customerId: existing.id });
      }

      const tempPassword = generateTempPassword();
      const hashedPassword = await hashPassword(tempPassword);
      const username = email.split("@")[0] + "_customer";

      const customer = await storage.createUser({
        username,
        password: hashedPassword,
        email,
        name,
        role: "Customer",
      });

      if (jobId) {
        await storage.createCustomerJob({ customerId: customer.id, jobId });
      }

      try {
        await sendCustomerWelcomeEmail(email, name, tempPassword, "en");
      } catch (emailErr: any) {
        console.error("Failed to send welcome email:", emailErr.message);
      }

      res.status(201).json({ customerId: customer.id, message: "Customer invited" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/customer-accounts/:id", requireAuth, requireManager, async (req, res) => {
    try {
      const updated = await storage.updateUser(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Customer not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== ADMIN: CUSTOMER DOCUMENTS MANAGEMENT =====
  app.post("/api/customer-documents/upload", requireAuth, requireStaff, async (req: any, res) => {
    try {
      const { customerId, name, folder, url, jobId } = req.body;
      if (!customerId || !name) return res.status(400).json({ message: "Customer ID and name required" });

      const doc = await storage.createCustomerDocument({
        customerId,
        name,
        folder: folder || "Other",
        url: url || null,
        jobId: jobId || null,
        uploadedBy: req.user.id,
        status: "Available",
      });

      await storage.createCustomerNotification({
        customerId,
        type: "document",
        title: "New Document Available",
        message: `A new document "${name}" has been uploaded to your account.`,
        link: "/customer-hub/documents",
      });

      const customer = await storage.getUser(customerId);
      if (customer?.email) {
        try {
          await sendCustomerNotificationEmail(
            customer.email,
            customer.name,
            `New Document: ${name}`,
            `A new document "${name}" has been uploaded to your Chapin Landscapes customer portal.`,
            "View Document",
            "/customer-hub/documents"
          );
        } catch (emailErr: any) {
          console.error("Failed to send doc notification:", emailErr.message);
        }
      }

      res.status(201).json(doc);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== ADMIN: LINK CUSTOMER TO JOB =====
  app.post("/api/customer-jobs/link", requireAuth, requireStaff, async (req: any, res) => {
    try {
      const { customerId, jobId } = req.body;
      const existing = await storage.getCustomerJobsByJobId(jobId);
      const alreadyLinked = existing.some(l => l.customerId === customerId);
      if (alreadyLinked) return res.json({ message: "Already linked" });

      const link = await storage.createCustomerJob({ customerId, jobId });
      res.status(201).json(link);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== STAFF: GET DOCUMENTS FOR A CUSTOMER (by customers.id) =====
  app.get("/api/customers/:id/documents", requireAuth, requireStaff, async (req: any, res) => {
    try {
      const { rows: userRows } = await pool.query(
        `SELECT u.id FROM users u
         JOIN customer_emails ce ON LOWER(ce.email) = LOWER(u.email)
         WHERE ce.customer_id = $1 AND u.role = 'Customer'
         LIMIT 1`,
        [req.params.id]
      );
      if (!userRows.length) return res.json([]);
      const docs = await storage.getCustomerDocuments(userRows[0].id);
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== STAFF: GET PORTAL MESSAGE THREADS FOR A CUSTOMER (by customers.id) =====
  app.get("/api/customers/:id/messages", requireAuth, requireStaff, async (req: any, res) => {
    try {
      const { rows: userRows } = await pool.query(
        `SELECT u.id FROM users u
         JOIN customer_emails ce ON LOWER(ce.email) = LOWER(u.email)
         WHERE ce.customer_id = $1 AND u.role = 'Customer'
         LIMIT 1`,
        [req.params.id]
      );
      if (!userRows.length) return res.json([]);
      const threads = await storage.getMessagingThreads({ customerId: userRows[0].id });
      res.json(threads);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/customer-jobs/by-job/:jobId", requireAuth, requireStaff, async (req, res) => {
    try {
      const links = await storage.getCustomerJobsByJobId(req.params.jobId);
      const customersWithDetails = [];
      for (const link of links) {
        const customer = await storage.getUser(link.customerId);
        if (customer) {
          customersWithDetails.push({
            linkId: link.id,
            customerId: customer.id,
            name: customer.name,
            email: customer.email,
          });
        }
      }
      res.json(customersWithDetails);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── CUSTOMER INVOICE HISTORY ──────────────────────────────────────────────

  /** Link portal user → CRM customer via primary email match. */
  async function resolveCustomerCrmId(userId: string): Promise<string | null> {
    const { rows } = await pool.query(`
      SELECT c.id
      FROM customers c
      JOIN customer_emails ce ON ce.customer_id = c.id AND ce.is_primary = true
      JOIN users u ON lower(u.email) = lower(ce.email)
      WHERE u.id = $1 AND c.is_active = true
      LIMIT 1
    `, [userId]);
    return rows[0]?.id ?? null;
  }

  app.get("/api/customer-hub/invoices", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const crmId = await resolveCustomerCrmId(req.user.id);
      if (!crmId) return res.json([]);

      const { rows } = await pool.query(`
        SELECT inv.id, inv.invoice_number, inv.status,
               inv.issued_date, inv.due_date,
               inv.subtotal, inv.tax_amount, inv.total,
               inv.amount_paid, inv.balance_due, inv.created_at,
               j.title AS job_title
        FROM invoices inv
        LEFT JOIN jobs j ON j.id = inv.job_id
        WHERE inv.customer_id = $1
          AND inv.status != 'void'
        ORDER BY inv.issued_date DESC, inv.created_at DESC
      `, [crmId]);

      return res.json(rows);
    } catch (err: any) {
      console.error("[customer-hub] GET invoices:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/customer-hub/invoices/:id", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const crmId = await resolveCustomerCrmId(req.user.id);
      if (!crmId) return res.status(403).json({ message: "Not authorized" });

      const ownerCheck = await pool.query(
        `SELECT id FROM invoices WHERE id = $1 AND customer_id = $2 AND status != 'void'`,
        [req.params.id, crmId]
      );
      if (ownerCheck.rows.length === 0) return res.status(403).json({ message: "Not authorized" });

      const [invRes, itemsRes] = await Promise.all([
        pool.query(`
          SELECT inv.id, inv.invoice_number, inv.status,
                 inv.issued_date, inv.due_date,
                 inv.subtotal, inv.tax_rate, inv.tax_amount, inv.discount_amount,
                 inv.total, inv.amount_paid, inv.balance_due,
                 inv.notes, inv.terms, inv.customer_message, inv.created_at,
                 j.title AS job_title
          FROM invoices inv
          LEFT JOIN jobs j ON j.id = inv.job_id
          WHERE inv.id = $1
        `, [req.params.id]),
        pool.query(
          `SELECT description, quantity, unit_price, amount, sort_order
           FROM invoice_line_items WHERE invoice_id = $1 ORDER BY sort_order, id`,
          [req.params.id]
        ),
      ]);

      return res.json({ ...invRes.rows[0], line_items: itemsRes.rows });
    } catch (err: any) {
      console.error("[customer-hub] GET invoice/:id:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });
}
