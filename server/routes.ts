import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireAdmin, hashPassword } from "./auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerChatRoutes } from "./replit_integrations/chat/routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const safeUsers = users.map(({ password, ...u }) => u);
      res.json(safeUsers);
    } catch (err) {
      res.status(500).json({ message: "Error fetching users" });
    }
  });

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const { username, password, email, name, role } = req.body;
      
      if (role === "Admin" && !req.user?.isMasterAdmin) {
        return res.status(403).json({ message: "Only the master admin can create Admin users" });
      }
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        email,
        name,
        role: role || "Crew",
      });
      
      const { password: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (err) {
      res.status(500).json({ message: "Error creating user" });
    }
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { name, email, role, isActive, password } = req.body;
      
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (targetUser.isMasterAdmin && req.user?.id !== id) {
        return res.status(403).json({ message: "Cannot modify the master admin account" });
      }
      
      if (role === "Admin" && !req.user?.isMasterAdmin) {
        return res.status(403).json({ message: "Only the master admin can grant Admin access" });
      }
      
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (role !== undefined && ["Admin", "Manager", "Crew", "Customer"].includes(role)) {
        updates.role = role;
      }
      if (isActive !== undefined) updates.isActive = Boolean(isActive);
      if (password) {
        updates.password = await hashPassword(password);
      }
      
      const user = await storage.updateUser(id, updates);
      const { password: _, ...safeUser } = user!;
      res.json(safeUser);
    } catch (err) {
      res.status(500).json({ message: "Error updating user" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      
      if (req.user?.id === id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (targetUser.isMasterAdmin) {
        return res.status(403).json({ message: "Cannot delete the master admin account" });
      }
      
      await storage.deleteUser(id);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Error deleting user" });
    }
  });

  app.get("/api/sops", requireAuth, async (req, res) => {
    try {
      const sops = await storage.getSops();
      res.json(sops);
    } catch (err) {
      res.status(500).json({ message: "Error fetching SOPs" });
    }
  });

  app.post("/api/sops", requireAuth, async (req, res) => {
    try {
      const sop = await storage.createSop({
        ...req.body,
        ownerId: req.user?.id,
      });
      res.status(201).json(sop);
    } catch (err) {
      res.status(500).json({ message: "Error creating SOP" });
    }
  });

  app.patch("/api/sops/:id", requireAuth, async (req, res) => {
    try {
      const sop = await storage.updateSop(req.params.id as string, req.body);
      if (!sop) return res.status(404).json({ message: "SOP not found" });
      res.json(sop);
    } catch (err) {
      res.status(500).json({ message: "Error updating SOP" });
    }
  });

  app.delete("/api/sops/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteSop(req.params.id as string);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Error deleting SOP" });
    }
  });

  app.get("/api/materials", requireAuth, async (req, res) => {
    try {
      const materials = await storage.getMaterials();
      res.json(materials);
    } catch (err) {
      res.status(500).json({ message: "Error fetching materials" });
    }
  });

  app.post("/api/materials", requireAuth, async (req, res) => {
    try {
      const material = await storage.createMaterial(req.body);
      res.status(201).json(material);
    } catch (err) {
      res.status(500).json({ message: "Error creating material" });
    }
  });

  app.get("/api/candidates", requireAuth, async (req, res) => {
    try {
      const candidates = await storage.getCandidates();
      res.json(candidates);
    } catch (err) {
      res.status(500).json({ message: "Error fetching candidates" });
    }
  });

  app.post("/api/candidates", requireAuth, async (req, res) => {
    try {
      const candidate = await storage.createCandidate(req.body);
      res.status(201).json(candidate);
    } catch (err) {
      res.status(500).json({ message: "Error creating candidate" });
    }
  });

  app.patch("/api/candidates/:id", requireAuth, async (req, res) => {
    try {
      const candidate = await storage.updateCandidate(req.params.id as string, req.body);
      if (!candidate) return res.status(404).json({ message: "Candidate not found" });
      res.json(candidate);
    } catch (err) {
      res.status(500).json({ message: "Error updating candidate" });
    }
  });

  app.get("/api/campaigns", requireAuth, async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (err) {
      res.status(500).json({ message: "Error fetching campaigns" });
    }
  });

  app.get("/api/jobs", requireAuth, async (req, res) => {
    try {
      const jobs = await storage.getJobs();
      res.json(jobs);
    } catch (err) {
      res.status(500).json({ message: "Error fetching jobs" });
    }
  });

  app.post("/api/jobs", requireAuth, async (req, res) => {
    try {
      const job = await storage.createJob(req.body);
      res.status(201).json(job);
    } catch (err) {
      res.status(500).json({ message: "Error creating job" });
    }
  });

  app.patch("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const job = await storage.updateJob(req.params.id as string, req.body);
      if (!job) return res.status(404).json({ message: "Job not found" });
      res.json(job);
    } catch (err) {
      res.status(500).json({ message: "Error updating job" });
    }
  });

  app.post("/api/feature-requests", requireAuth, async (req, res) => {
    try {
      const request = await storage.createFeatureRequest({
        userId: req.user?.id,
        request: req.body.request,
      });
      res.status(201).json(request);
    } catch (err) {
      res.status(500).json({ message: "Error creating feature request" });
    }
  });

  app.get("/api/feature-requests", requireAdmin, async (req, res) => {
    try {
      const requests = await storage.getFeatureRequests();
      res.json(requests);
    } catch (err) {
      res.status(500).json({ message: "Error fetching feature requests" });
    }
  });

  app.post("/api/messages", requireAuth, async (req, res) => {
    try {
      const message = await storage.createCustomerMessage({
        customerId: req.user!.id,
        subject: req.body.subject,
        message: req.body.message,
      });
      res.status(201).json(message);
    } catch (err) {
      res.status(500).json({ message: "Error sending message" });
    }
  });

  app.get("/api/messages", requireAuth, async (req, res) => {
    try {
      if (req.user?.role === "Admin" || req.user?.role === "Manager") {
        const messages = await storage.getCustomerMessages();
        res.json(messages);
      } else {
        const messages = await storage.getCustomerMessagesByUser(req.user!.id);
        res.json(messages);
      }
    } catch (err) {
      res.status(500).json({ message: "Error fetching messages" });
    }
  });

  app.patch("/api/messages/:id", requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== "Admin" && req.user?.role !== "Manager") {
        return res.status(403).json({ message: "Not authorized to update messages" });
      }
      const { status, adminReply } = req.body;
      const updates: any = {};
      if (status) updates.status = status;
      if (adminReply) {
        updates.adminReply = adminReply;
        updates.repliedAt = new Date();
        updates.repliedBy = req.user!.id;
      }
      const message = await storage.updateCustomerMessage(req.params.id as string, updates);
      if (!message) return res.status(404).json({ message: "Message not found" });
      res.json(message);
    } catch (err) {
      res.status(500).json({ message: "Error updating message" });
    }
  });

  app.post("/api/work-requests", requireAuth, async (req, res) => {
    try {
      const request = await storage.createWorkRequest({
        customerId: req.user!.id,
        title: req.body.title,
        description: req.body.description,
        serviceType: req.body.serviceType,
        propertyAddress: req.body.propertyAddress,
        preferredDate: req.body.preferredDate ? new Date(req.body.preferredDate) : undefined,
        urgency: req.body.urgency,
        photos: req.body.photos || [],
      });
      res.status(201).json(request);
    } catch (err) {
      res.status(500).json({ message: "Error creating work request" });
    }
  });

  app.get("/api/work-requests", requireAuth, async (req, res) => {
    try {
      if (req.user?.role === "Admin" || req.user?.role === "Manager") {
        const requests = await storage.getWorkRequests();
        res.json(requests);
      } else {
        const requests = await storage.getWorkRequestsByUser(req.user!.id);
        res.json(requests);
      }
    } catch (err) {
      res.status(500).json({ message: "Error fetching work requests" });
    }
  });

  app.patch("/api/work-requests/:id", requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== "Admin" && req.user?.role !== "Manager") {
        return res.status(403).json({ message: "Not authorized to update work requests" });
      }
      const { status, assignedTo, estimatedValue, notes } = req.body;
      const updates: any = {};
      if (status) updates.status = status;
      if (assignedTo !== undefined) updates.assignedTo = assignedTo;
      if (estimatedValue !== undefined) updates.estimatedValue = estimatedValue;
      if (notes !== undefined) updates.notes = notes;
      
      const request = await storage.updateWorkRequest(req.params.id as string, updates);
      if (!request) return res.status(404).json({ message: "Work request not found" });
      res.json(request);
    } catch (err) {
      res.status(500).json({ message: "Error updating work request" });
    }
  });

  app.post("/api/access-requests", requireAuth, async (req, res) => {
    try {
      const request = await storage.createAccessRequest({
        userId: req.user!.id,
        requestedRole: req.body.requestedRole,
        reason: req.body.reason,
      });
      res.status(201).json(request);
    } catch (err) {
      res.status(500).json({ message: "Error creating access request" });
    }
  });

  app.get("/api/access-requests", requireAuth, async (req, res) => {
    try {
      if (req.user?.role === "Admin") {
        const requests = await storage.getAccessRequests();
        res.json(requests);
      } else {
        const requests = await storage.getAccessRequestsByUser(req.user!.id);
        res.json(requests);
      }
    } catch (err) {
      res.status(500).json({ message: "Error fetching access requests" });
    }
  });

  app.patch("/api/access-requests/:id", requireAdmin, async (req, res) => {
    try {
      const { status, reviewNotes } = req.body;
      const request = await storage.updateAccessRequest(req.params.id as string, {
        status,
        reviewNotes,
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
      });
      if (!request) return res.status(404).json({ message: "Access request not found" });
      
      if (status === "approved") {
        const targetUser = await storage.getUser(request.userId);
        if (targetUser) {
          if (request.requestedRole === "Admin" && !req.user?.isMasterAdmin) {
            return res.status(403).json({ message: "Only the master admin can grant Admin access" });
          }
          await storage.updateUser(request.userId, { role: request.requestedRole });
        }
      }
      res.json(request);
    } catch (err) {
      res.status(500).json({ message: "Error updating access request" });
    }
  });

  app.get("/api/forms", requireAuth, async (req, res) => {
    try {
      const forms = await storage.getCustomForms();
      res.json(forms);
    } catch (err) {
      res.status(500).json({ message: "Error fetching forms" });
    }
  });

  app.get("/api/forms/:id", requireAuth, async (req, res) => {
    try {
      const form = await storage.getCustomForm(req.params.id as string);
      if (!form) return res.status(404).json({ message: "Form not found" });
      res.json(form);
    } catch (err) {
      res.status(500).json({ message: "Error fetching form" });
    }
  });

  app.post("/api/forms", requireAdmin, async (req, res) => {
    try {
      const form = await storage.createCustomForm({
        ...req.body,
        createdBy: req.user!.id,
      });
      res.status(201).json(form);
    } catch (err) {
      res.status(500).json({ message: "Error creating form" });
    }
  });

  app.patch("/api/forms/:id", requireAdmin, async (req, res) => {
    try {
      const form = await storage.updateCustomForm(req.params.id as string, req.body);
      if (!form) return res.status(404).json({ message: "Form not found" });
      res.json(form);
    } catch (err) {
      res.status(500).json({ message: "Error updating form" });
    }
  });

  app.delete("/api/forms/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteCustomForm(req.params.id as string);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Error deleting form" });
    }
  });

  app.get("/api/forms/:id/submissions", requireAdmin, async (req, res) => {
    try {
      const submissions = await storage.getFormSubmissions(req.params.id as string);
      res.json(submissions);
    } catch (err) {
      res.status(500).json({ message: "Error fetching submissions" });
    }
  });

  app.post("/api/forms/:id/submissions", requireAuth, async (req, res) => {
    try {
      const submission = await storage.createFormSubmission({
        formId: req.params.id as string,
        submittedBy: req.user!.id,
        data: req.body.data,
      });
      res.status(201).json(submission);
    } catch (err) {
      res.status(500).json({ message: "Error submitting form" });
    }
  });

  app.patch("/api/submissions/:id", requireAdmin, async (req, res) => {
    try {
      const submission = await storage.updateFormSubmission(req.params.id as string, {
        ...req.body,
        reviewedBy: req.user!.id,
      });
      if (!submission) return res.status(404).json({ message: "Submission not found" });
      res.json(submission);
    } catch (err) {
      res.status(500).json({ message: "Error updating submission" });
    }
  });

  app.get("/api/profile", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, recoveryToken, recoveryExpires, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      res.status(500).json({ message: "Error fetching profile" });
    }
  });

  app.patch("/api/profile", requireAuth, async (req, res) => {
    try {
      const { name, email, bio, phone, profilePicture } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (bio !== undefined) updates.bio = bio;
      if (phone !== undefined) updates.phone = phone;
      if (profilePicture !== undefined) updates.profilePicture = profilePicture;
      
      const user = await storage.updateUser(req.user!.id, updates);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, recoveryToken, recoveryExpires, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      res.status(500).json({ message: "Error updating profile" });
    }
  });

  // One-time master admin setup endpoint
  app.post("/api/setup-master-admin", requireAuth, async (req, res) => {
    try {
      const { setupCode } = req.body;
      const expectedCode = process.env.ADMIN_SETUP_CODE;
      
      if (!expectedCode) {
        return res.status(403).json({ message: "Setup not available" });
      }
      
      if (setupCode !== expectedCode) {
        return res.status(403).json({ message: "Invalid setup code" });
      }
      
      // Promote current user to master admin
      await storage.updateUser(req.user!.id, {
        role: "Admin",
        isMasterAdmin: true,
      });
      
      res.json({ message: "You are now the master admin!" });
    } catch (err) {
      res.status(500).json({ message: "Error during setup" });
    }
  });

  registerObjectStorageRoutes(app, requireAuth);
  registerChatRoutes(app);

  return httpServer;
}
