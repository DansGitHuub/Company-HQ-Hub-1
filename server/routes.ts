import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireAdmin, hashPassword } from "./auth";

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
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { password: _, ...safeUser } = user;
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

  return httpServer;
}
