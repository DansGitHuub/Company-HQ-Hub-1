import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
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
  app.get("/api/customer-hub/jobs", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const links = await storage.getCustomerJobs(req.user.id);
      const jobsWithDetails = [];
      for (const link of links) {
        const job = await storage.getJob(link.jobId);
        if (job) {
          const docs = await storage.getJobDocuments(link.jobId);
          jobsWithDetails.push({
            ...job,
            documents: docs,
            crewNotesCustomerVisible: job.crewNotesCustomerVisible || null,
            crewLeadName: job.crewLeadName || null,
            scopeOfWork: job.scopeOfWork || null,
            materialsUsed: job.materialsUsed || null,
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
        ...job,
        documents: docs,
        customerDocuments: jobCustomerDocs,
        crewNotesCustomerVisible: job.crewNotesCustomerVisible || null,
        crewLeadName: job.crewLeadName || null,
        scopeOfWork: job.scopeOfWork || null,
        materialsUsed: job.materialsUsed || null,
      });
    } catch (err: any) {
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
        status: "open",
        priority: "normal",
      });
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
        status: "open",
        priority: "normal",
      });
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
        await sendCustomerWelcomeEmail(email, name, tempPassword);
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
}
