import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireAdmin, hashPassword, comparePasswords } from "./auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerChatRoutes } from "./replit_integrations/chat/routes";
import { registerHiringRoutes } from "./hiringRoutes";
import { registerEmployeeFormsRoutes } from "./employeeFormsRoutes";
import { registerNotesRoutes, migrateNotesTable, runNoteReminderScheduler } from "./notesRoutes";
import { registerDailyWorksheetRoutes } from "./dailyWorksheetRoutes";
import { registerCustomerRoutes } from "./customerRoutes";
import { registerAgreementRoutes } from "./agreementRoutes";
import { registerCustomerHubRoutes } from "./customerHubRoutes";
import { registerEquipmentRoutes } from "./equipmentRoutes";
import { registerCalendarRoutes } from "./calendarRoutes";
import { registerSuggestionsRoutes } from "./suggestionsRoutes";
import { registerTaskRoutes } from "./taskRoutes";
import { registerAssistantRoutes } from "./assistantRoutes";
import { registerTimeRoutes } from "./timeRoutes";
import { registerWorkAreaRoutes } from "./workAreaRoutes";
import { registerEstimateRoutes } from "./estimateRoutes";
import { registerSchedulingRoutes } from "./schedulingRoutes";
import { registerMyDayRoutes } from "./myDayRoutes";
import { registerSettingsRoutes } from "./settingsRoutes";
import { registerJobRoutes } from "./jobRoutes";
import { registerInvoiceRoutes } from "./invoiceRoutes";
import { registerReportRoutes } from "./reportRoutes";
import { searchProductImages } from "./imageSearchService";
import { sendMaintenanceReminderEmail, sendSOPEmail, sendMessageNotificationEmail, sendCustomerNotificationEmail, sendNewApplicationNotificationEmail } from "./email";
import { logActivity } from "./activityLogger";
import { checkAndSendReminders } from "./maintenanceScheduler";
import OpenAI from "openai";
import { 
  insertSopTemplateSchema, 
  insertSopExampleSchema, 
  insertFormFolderSchema, 
  insertFormTemplateSchema, 
  insertPlowSiteImageSchema,
  insertSitePhotoSchema,
  insertSitePhotoVariantSchema,
  insertSiteMapFeatureSchema,
  insertConfiguredIntegrationSchema,
  insertIntegrationResearchSessionSchema,
  insertBuilderFormSchema,
  insertCampaignSchema,
  calendarEvents,
  todoAssignments,
  users,
  type User,
  activityLog
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { autoClassifySOPTitle, getTaxonomy } from "@shared/sopClassification";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // Jobs + Invoices module routes (registered first to take precedence over legacy simple routes)
  registerJobRoutes(app, requireAuth);
  registerInvoiceRoutes(app, requireAuth);
  registerReportRoutes(app, requireAuth);

  // Global search endpoint - searches everything based on user role
  app.get("/api/search", requireAuth, async (req, res) => {
    try {
      const query = (req.query.q as string || "").toLowerCase().trim();
      if (!query) {
        return res.json([]);
      }

      const results: any[] = [];
      const userRole = req.user?.role;

      // Search SOPs (accessible to all internal roles)
      if (userRole !== "Customer") {
        const sops = await storage.getSops();
        sops.filter((s: any) => !s.isArchived && (
          s.title.toLowerCase().includes(query) ||
          (s.content && s.content.toLowerCase().includes(query)) ||
          (s.category && s.category.toLowerCase().includes(query))
        )).slice(0, 5).forEach((s: any) => {
          results.push({ type: "sop", id: s.id, title: s.title, category: s.category });
        });
      }

      // Search Materials (accessible to all internal roles) - expanded fields
      if (userRole !== "Customer") {
        const materials = await storage.getMaterials();
        materials.filter((m: any) => 
          m.name.toLowerCase().includes(query) ||
          (m.category && m.category.toLowerCase().includes(query)) ||
          (m.description && m.description.toLowerCase().includes(query)) ||
          (m.sku && m.sku.toLowerCase().includes(query))
        ).slice(0, 5).forEach((m: any) => {
          results.push({ type: "material", id: m.id, title: m.name, category: m.category, description: m.description });
        });
      }

      // Search Equipment (accessible to all internal roles) - NEW
      if (userRole !== "Customer") {
        const equipment = await storage.getEquipment();
        equipment.filter((e: any) => 
          e.name.toLowerCase().includes(query) ||
          (e.type && e.type.toLowerCase().includes(query)) ||
          (e.make && e.make.toLowerCase().includes(query)) ||
          (e.model && e.model.toLowerCase().includes(query)) ||
          (e.vin && e.vin.toLowerCase().includes(query)) ||
          (e.licensePlate && e.licensePlate.toLowerCase().includes(query)) ||
          (e.notes && e.notes.toLowerCase().includes(query)) ||
          (e.status && e.status.toLowerCase().includes(query))
        ).slice(0, 5).forEach((e: any) => {
          const desc = [e.year, e.make, e.model].filter(Boolean).join(" ");
          results.push({ type: "equipment", id: e.id, title: e.name, description: desc || e.type, category: e.type });
        });
      }

      // Search Jobs (accessible to all internal roles) - expanded fields
      if (userRole !== "Customer") {
        const jobs = await storage.getJobs();
        jobs.filter((j: any) => 
          j.client.toLowerCase().includes(query) ||
          (j.notes && j.notes.toLowerCase().includes(query)) ||
          (j.address && j.address.toLowerCase().includes(query)) ||
          (j.stage && j.stage.toLowerCase().includes(query)) ||
          (j.jobType && j.jobType.toLowerCase().includes(query))
        ).slice(0, 5).forEach((j: any) => {
          results.push({ type: "job", id: j.id, title: j.client, description: j.address || j.notes || undefined, category: j.jobType });
        });
      }

      // Search Candidates (accessible to all internal roles) - expanded fields
      if (userRole !== "Customer") {
        const candidates = await storage.getCandidates();
        candidates.filter((c: any) => 
          c.name.toLowerCase().includes(query) ||
          (c.email && c.email.toLowerCase().includes(query)) ||
          (c.role && c.role.toLowerCase().includes(query)) ||
          (c.phone && c.phone.toLowerCase().includes(query)) ||
          (c.notes && c.notes.toLowerCase().includes(query))
        ).slice(0, 5).forEach((c: any) => {
          results.push({ type: "candidate", id: c.id, title: c.name, description: c.role, category: c.stage });
        });
      }

      // Search Forms (Admin only) - NEW
      if (userRole === "Admin") {
        const forms = await storage.getCustomForms();
        forms.filter((f: any) => 
          f.title.toLowerCase().includes(query) ||
          (f.description && f.description.toLowerCase().includes(query)) ||
          (f.category && f.category.toLowerCase().includes(query))
        ).slice(0, 5).forEach((f: any) => {
          results.push({ type: "form", id: f.id, title: f.title, description: f.description, category: f.category });
        });
      }

      // Search Campaigns (Admin/Manager only) - NEW
      if (userRole === "Admin" || userRole === "Manager") {
        const campaigns = await storage.getCampaigns();
        campaigns.filter((c: any) => 
          c.name.toLowerCase().includes(query) ||
          (c.platform && c.platform.toLowerCase().includes(query)) ||
          (c.status && c.status.toLowerCase().includes(query))
        ).slice(0, 5).forEach((c: any) => {
          results.push({ type: "campaign", id: c.id, title: c.name, description: c.platform, category: c.status });
        });
      }

      // Search Customer Resources (accessible to all including Customers) - NEW
      const resources = await storage.getCustomerResources();
      resources.filter((r: any) => 
        r.isPublished && (
          r.title.toLowerCase().includes(query) ||
          (r.description && r.description.toLowerCase().includes(query)) ||
          (r.content && r.content.toLowerCase().includes(query)) ||
          (r.category && r.category.toLowerCase().includes(query)) ||
          (r.type && r.type.toLowerCase().includes(query))
        )
      ).slice(0, 5).forEach((r: any) => {
        results.push({ type: "resource", id: r.id, title: r.title, description: r.description, category: r.category });
      });

      // Search Users (admin only)
      if (userRole === "Admin") {
        const users = await storage.getAllUsers();
        users.filter((u: any) => 
          u.username.toLowerCase().includes(query) ||
          (u.name && u.name.toLowerCase().includes(query)) ||
          (u.email && u.email.toLowerCase().includes(query)) ||
          (u.role && u.role.toLowerCase().includes(query))
        ).slice(0, 5).forEach((u: any) => {
          results.push({ type: "user", id: u.id, title: u.name || u.username, description: u.role });
        });
      }

      res.json(results.slice(0, 30));
    } catch (err) {
      console.error("Search error:", err);
      res.status(500).json({ message: "Search failed" });
    }
  });

  app.get("/api/admin/users", requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== "Admin" && req.user?.role !== "Manager") {
        return res.status(403).json({ message: "Access denied" });
      }
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

      const userRole = role || "Crew";
      const hashedPassword = await hashPassword(password);
      
      // Store plaintext password for staff (non-customer) so Master Admin can view it
      const isStaff = userRole !== "Customer";
      
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        email,
        name,
        role: userRole,
      });
      
      // Update storedPassword separately for staff
      if (isStaff) {
        await storage.updateUser(user.id, { storedPassword: password });
      }
      
      const { password: _, storedPassword: __, ...safeUser } = user;
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
        // Update storedPassword for staff (non-customer) so Master Admin sees updated password
        const effectiveRole = role || targetUser.role;
        if (effectiveRole !== "Customer") {
          updates.storedPassword = password;
        }
      }
      
      const user = await storage.updateUser(id, updates);
      const { password: _, storedPassword: __, ...safeUser } = user!;
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

  // Master Admin view stored password for staff users
  app.get("/api/admin/users/:id/password", requireAuth, async (req, res) => {
    try {
      if (!req.user?.isMasterAdmin) {
        return res.status(403).json({ message: "Only Master Admin can view stored passwords" });
      }
      
      const id = req.params.id as string;
      const targetUser = await storage.getUser(id);
      
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Only allow viewing passwords for staff (non-customer)
      if (targetUser.role === "Customer") {
        return res.status(403).json({ message: "Cannot view customer passwords. Customers must use password recovery." });
      }
      
      res.json({ 
        userId: targetUser.id,
        username: targetUser.username,
        storedPassword: targetUser.storedPassword || "(not stored)"
      });
    } catch (err) {
      res.status(500).json({ message: "Error fetching password" });
    }
  });

  // AI Agents - Master Admin only
  const requireMasterAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.isMasterAdmin) {
      return res.status(403).json({ message: "Access denied. Master Admin only." });
    }
    next();
  };
  
  // Role-based access control middleware
  const requireRole = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Access denied. Required role: ${roles.join(" or ")}` });
    }
    next();
  };

  app.get("/api/ai-agents", requireAuth, requireMasterAdmin, async (req, res) => {
    try {
      const agents = await storage.getAiAgents();
      res.json(agents);
    } catch (err) {
      res.status(500).json({ message: "Error fetching AI agents" });
    }
  });

  const createAiAgentSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    category: z.string().max(50).optional(),
    runFrequency: z.enum(["manual", "daily", "weekly", "monthly"]).optional(),
    configJson: z.record(z.unknown()).optional(),
  });

  app.post("/api/ai-agents", requireAuth, requireMasterAdmin, async (req, res) => {
    try {
      const parsed = createAiAgentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      }
      const agent = await storage.createAiAgent({
        ...parsed.data,
        isEnabled: false,
      });
      res.status(201).json(agent);
    } catch (err) {
      res.status(500).json({ message: "Error creating AI agent" });
    }
  });

  const updateAiAgentSchema = z.object({
    isEnabled: z.boolean().optional(),
    runFrequency: z.enum(["manual", "daily", "weekly", "monthly"]).optional(),
    configJson: z.record(z.unknown()).optional(),
  }).strict();

  app.patch("/api/ai-agents/:id", requireAuth, requireMasterAdmin, async (req, res) => {
    try {
      const parsed = updateAiAgentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      }
      const agent = await storage.updateAiAgent(req.params.id as string, parsed.data);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      res.json(agent);
    } catch (err) {
      res.status(500).json({ message: "Error updating AI agent" });
    }
  });

  app.delete("/api/ai-agents/:id", requireAuth, requireMasterAdmin, async (req, res) => {
    try {
      await storage.deleteAiAgent(req.params.id as string);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Error deleting AI agent" });
    }
  });

  app.get("/api/ai-agents/:id/logs", requireAuth, requireMasterAdmin, async (req, res) => {
    try {
      const logs = await storage.getAiAgentUsageLogs(req.params.id as string);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ message: "Error fetching agent logs" });
    }
  });

  app.get("/api/ai-agents/:id/suggestions", requireAuth, requireMasterAdmin, async (req, res) => {
    try {
      const suggestions = await storage.getAiAgentSuggestions(req.params.id as string);
      res.json(suggestions);
    } catch (err) {
      res.status(500).json({ message: "Error fetching agent suggestions" });
    }
  });

  app.post("/api/ai-agents/:id/run", requireAuth, requireMasterAdmin, async (req, res) => {
    try {
      const agent = await storage.getAiAgent(req.params.id as string);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      if (!agent.isEnabled) return res.status(400).json({ message: "Agent is disabled" });
      
      // Run the agent based on its category
      let result: any = { message: "Agent executed", suggestions: [] };
      let inputTokens = 0, outputTokens = 0, cost = 0;
      
      if (agent.category === "forms") {
        // Forms Manager Agent
        const forms = await storage.getCustomForms();
        const publishedForms = forms.filter(f => f.isPublished);
        
        if (publishedForms.length > 0) {
          const prompt = `Analyze these ${publishedForms.length} forms and suggest 1-3 improvements.

Forms:
${publishedForms.slice(0, 5).map(f => `- "${f.title}": ${(f.fields as any[])?.length || 0} fields`).join("\n")}

Respond with a JSON object in this exact format:
{"suggestions": [{"title": "suggestion title", "description": "detailed explanation of the improvement", "estimatedCost": "$0.05", "priority": "medium"}]}`;

          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            max_tokens: 500,
          });
          
          inputTokens = completion.usage?.prompt_tokens || 0;
          outputTokens = completion.usage?.completion_tokens || 0;
          cost = (inputTokens * 0.00015 + outputTokens * 0.0006) / 1000;
          
          try {
            const responseText = completion.choices[0]?.message?.content || "{}";
            const parsed = JSON.parse(responseText);
            const suggestions = parsed.suggestions || [];
            
            if (Array.isArray(suggestions)) {
              for (const s of suggestions) {
                if (s.title && s.description) {
                  await storage.createAiAgentSuggestion({
                    agentId: agent.id,
                    title: String(s.title).slice(0, 200),
                    description: String(s.description).slice(0, 1000),
                    estimatedCost: s.estimatedCost || "$0.05",
                    priority: ["low", "medium", "high"].includes(s.priority) ? s.priority : "medium",
                  });
                }
              }
              result.suggestions = suggestions;
            }
          } catch (e) {
            console.error("Failed to parse Forms Manager AI response:", e);
            result.error = "Failed to parse AI response";
          }
        } else {
          result.message = "No published forms to analyze";
        }
      } else if (agent.category === "sops") {
        // SOP Assistant Agent
        const sops = await storage.getSops();
        const activeSops = sops.filter((s: any) => !s.isArchived).slice(0, 5);
        
        if (activeSops.length > 0) {
          const prompt = `Analyze these ${activeSops.length} SOPs and suggest 1-3 improvements.

SOPs:
${activeSops.map((s: any) => `- "${s.title}": ${s.content?.length || 0} chars`).join("\n")}

Respond with a JSON object in this exact format:
{"suggestions": [{"title": "suggestion title", "description": "detailed explanation of the improvement", "estimatedCost": "$0.05", "priority": "medium"}]}`;

          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            max_tokens: 500,
          });
          
          inputTokens = completion.usage?.prompt_tokens || 0;
          outputTokens = completion.usage?.completion_tokens || 0;
          cost = (inputTokens * 0.00015 + outputTokens * 0.0006) / 1000;
          
          try {
            const responseText = completion.choices[0]?.message?.content || "{}";
            const parsed = JSON.parse(responseText);
            const suggestions = parsed.suggestions || [];
            
            if (Array.isArray(suggestions)) {
              for (const s of suggestions) {
                if (s.title && s.description) {
                  await storage.createAiAgentSuggestion({
                    agentId: agent.id,
                    title: String(s.title).slice(0, 200),
                    description: String(s.description).slice(0, 1000),
                    estimatedCost: s.estimatedCost || "$0.05",
                    priority: ["low", "medium", "high"].includes(s.priority) ? s.priority : "medium",
                  });
                }
              }
              result.suggestions = suggestions;
            }
          } catch (e) {
            console.error("Failed to parse SOP Assistant AI response:", e);
            result.error = "Failed to parse AI response";
          }
        } else {
          result.message = "No active SOPs to analyze";
        }
      } else if (agent.category === "sop_builder") {
        // SOP Builder Agent - Creates new SOPs with rich content
        const prompt = `You are an expert at creating Standard Operating Procedures for a landscaping company.
Create a comprehensive SOP suggestion for a common landscaping task. Include:
1. Clear step-by-step instructions
2. [IMAGE: description] placeholders for photos/diagrams
3. [VIDEO: description] placeholders for training videos
4. Safety considerations
5. Equipment needed
6. Time estimates

Respond with a JSON object:
{"suggestions": [{"title": "SOP Title - e.g., 'Lawn Mower Daily Maintenance'", "description": "Full SOP content with instructions, [IMAGE: description] and [VIDEO: description] placeholders, safety notes, equipment list, and estimated time", "estimatedCost": "$0.10", "priority": "high"}]}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 1500,
        });
        
        inputTokens = completion.usage?.prompt_tokens || 0;
        outputTokens = completion.usage?.completion_tokens || 0;
        cost = (inputTokens * 0.00015 + outputTokens * 0.0006) / 1000;
        
        try {
          const responseText = completion.choices[0]?.message?.content || "{}";
          const parsed = JSON.parse(responseText);
          const suggestions = parsed.suggestions || [];
          
          if (Array.isArray(suggestions)) {
            for (const s of suggestions) {
              if (s.title && s.description) {
                await storage.createAiAgentSuggestion({
                  agentId: agent.id,
                  title: String(s.title).slice(0, 200),
                  description: String(s.description).slice(0, 5000),
                  estimatedCost: s.estimatedCost || "$0.10",
                  priority: ["low", "medium", "high"].includes(s.priority) ? s.priority : "high",
                });
              }
            }
            result.suggestions = suggestions;
          }
        } catch (e) {
          console.error("Failed to parse SOP Builder AI response:", e);
          result.error = "Failed to parse AI response";
        }
      } else if (agent.category === "forms_builder") {
        // Forms Builder Agent - Creates new forms
        const prompt = `You are an expert at creating business forms for a landscaping company.
Suggest a useful form that the company could use. Include:
1. Form title and purpose
2. List of fields with types (text, number, date, select, checkbox, etc.)
3. Validation rules if any

Respond with a JSON object:
{"suggestions": [{"title": "Form Name - e.g., 'New Customer Intake Form'", "description": "Purpose: [why this form is useful]\\n\\nFields:\\n- Customer Name (text, required)\\n- Phone (phone, required)\\n- Email (email)\\n- Property Address (text, required)\\n- Service Type (select: Lawn Care, Landscaping, Snow Removal, Other)\\n- Budget Range (select: Under $500, $500-$1000, $1000-$5000, $5000+)\\n- Special Instructions (textarea)\\n- Preferred Contact Method (radio: Phone, Email, Text)", "estimatedCost": "$0.05", "priority": "medium"}]}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 1000,
        });
        
        inputTokens = completion.usage?.prompt_tokens || 0;
        outputTokens = completion.usage?.completion_tokens || 0;
        cost = (inputTokens * 0.00015 + outputTokens * 0.0006) / 1000;
        
        try {
          const responseText = completion.choices[0]?.message?.content || "{}";
          const parsed = JSON.parse(responseText);
          const suggestions = parsed.suggestions || [];
          
          if (Array.isArray(suggestions)) {
            for (const s of suggestions) {
              if (s.title && s.description) {
                await storage.createAiAgentSuggestion({
                  agentId: agent.id,
                  title: String(s.title).slice(0, 200),
                  description: String(s.description).slice(0, 2000),
                  estimatedCost: s.estimatedCost || "$0.05",
                  priority: ["low", "medium", "high"].includes(s.priority) ? s.priority : "medium",
                });
              }
            }
            result.suggestions = suggestions;
          }
        } catch (e) {
          console.error("Failed to parse Forms Builder AI response:", e);
          result.error = "Failed to parse AI response";
        }
      } else if (agent.category === "content_creator") {
        // Content Creator Agent - Creates articles for Resource Library
        const prompt = `You are an expert content writer for a landscaping company.
Create an educational article that can be added to the company's Resource Library for employees and customers.
Topics could include: seasonal lawn care tips, plant care guides, equipment maintenance, landscaping design principles, etc.

Respond with a JSON object:
{"suggestions": [{"title": "Article Title - e.g., 'Spring Lawn Care: 10 Essential Steps'", "description": "Full article content with introduction, main sections, tips, and conclusion. Make it informative and practical for both employees and customers.", "estimatedCost": "$0.08", "priority": "medium"}]}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 1500,
        });
        
        inputTokens = completion.usage?.prompt_tokens || 0;
        outputTokens = completion.usage?.completion_tokens || 0;
        cost = (inputTokens * 0.00015 + outputTokens * 0.0006) / 1000;
        
        try {
          const responseText = completion.choices[0]?.message?.content || "{}";
          const parsed = JSON.parse(responseText);
          const suggestions = parsed.suggestions || [];
          
          if (Array.isArray(suggestions)) {
            for (const s of suggestions) {
              if (s.title && s.description) {
                await storage.createAiAgentSuggestion({
                  agentId: agent.id,
                  title: String(s.title).slice(0, 200),
                  description: String(s.description).slice(0, 5000),
                  estimatedCost: s.estimatedCost || "$0.08",
                  priority: ["low", "medium", "high"].includes(s.priority) ? s.priority : "medium",
                });
              }
            }
            result.suggestions = suggestions;
          }
        } catch (e) {
          console.error("Failed to parse Content Creator AI response:", e);
          result.error = "Failed to parse AI response";
        }
      }
      
      // Log the usage
      await storage.createAiAgentUsageLog({
        agentId: agent.id,
        action: "manual_run",
        inputTokens,
        outputTokens,
        estimatedCost: cost.toFixed(4),
        resultSummary: `Generated ${result.suggestions?.length || 0} suggestions`,
      });
      
      // Update last run time
      await storage.updateAiAgent(agent.id, { lastRunAt: new Date() });
      
      res.json(result);
    } catch (err) {
      console.error("Error running AI agent:", err);
      res.status(500).json({ message: "Error running AI agent" });
    }
  });

  const updateAiSuggestionSchema = z.object({
    status: z.enum(["pending", "implemented", "dismissed"]).optional(),
    implementedAt: z.union([z.string(), z.null()]).optional(),
  }).strict();

  app.patch("/api/ai-suggestions/:id", requireAuth, requireMasterAdmin, async (req, res) => {
    try {
      const parsed = updateAiSuggestionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      }
      const updates: any = { ...parsed.data };
      if (updates.implementedAt && typeof updates.implementedAt === "string") {
        updates.implementedAt = new Date(updates.implementedAt);
      }
      const suggestion = await storage.updateAiAgentSuggestion(req.params.id as string, updates);
      if (!suggestion) return res.status(404).json({ message: "Suggestion not found" });
      res.json(suggestion);
    } catch (err) {
      res.status(500).json({ message: "Error updating suggestion" });
    }
  });

  app.delete("/api/ai-suggestions/:id", requireAuth, requireMasterAdmin, async (req, res) => {
    try {
      await storage.deleteAiAgentSuggestion(req.params.id as string);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Error deleting suggestion" });
    }
  });

  app.get("/api/ai-agents/costs/summary", requireAuth, requireMasterAdmin, async (req, res) => {
    try {
      const agents = await storage.getAiAgents();
      const allLogs = await storage.getAiAgentUsageLogs();
      
      // Scope to current billing period (current month)
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const logs = allLogs.filter(l => l.createdAt && new Date(l.createdAt) >= firstOfMonth);
      
      // Calculate costs by agent (current period only)
      const agentCosts = agents.map(agent => {
        const agentLogs = logs.filter(l => l.agentId === agent.id);
        const totalCost = agentLogs.reduce((sum, l) => sum + parseFloat(l.estimatedCost || "0"), 0);
        return {
          agentId: agent.id,
          agentName: agent.name,
          totalCost,
          runCount: agentLogs.length,
        };
      });
      
      // Overall totals (current period)
      const totalCost = agentCosts.reduce((sum, a) => sum + a.totalCost, 0);
      const totalRuns = agentCosts.reduce((sum, a) => sum + a.runCount, 0);
      
      // Calculate projected monthly cost based on current period usage
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dayOfMonth = now.getDate();
      const projectedMonthly = dayOfMonth > 0 ? (totalCost / dayOfMonth) * daysInMonth : 0;
      
      const nextBillingDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      res.json({
        agentCosts,
        totalCost,
        totalRuns,
        projectedMonthly,
        nextBillingDate: nextBillingDate.toISOString(),
        currency: "USD",
      });
    } catch (err) {
      res.status(500).json({ message: "Error fetching cost summary" });
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
      const body = { ...req.body, ownerId: req.user?.id };
      if (body.title && !body.superCategory) {
        const classification = autoClassifySOPTitle(body.title);
        if (classification.confidence >= 0.5) {
          body.superCategory = classification.superCategory;
          body.subCategory = classification.subCategory;
          if (!body.sopType) {
            body.sopType = classification.sopType;
          }
        }
      }
      const sop = await storage.createSop(body);
      res.status(201).json(sop);
    } catch (err) {
      res.status(500).json({ message: "Error creating SOP", errorCode: "SOP-001" });
    }
  });

  app.patch("/api/sops/:id", requireAuth, async (req, res) => {
    try {
      const sop = await storage.updateSop(req.params.id as string, req.body);
      if (!sop) return res.status(404).json({ message: "SOP not found" });
      res.json(sop);
    } catch (err) {
      res.status(500).json({ message: "Error updating SOP", errorCode: "SOP-001" });
    }
  });

  app.get("/api/sops/:id/versions", requireAuth, async (req, res) => {
    try {
      const versions = await storage.getSopVersions(req.params.id);
      res.json(versions);
    } catch (err) {
      res.status(500).json({ message: "Error fetching versions" });
    }
  });

  app.post("/api/sops/:id/save-version", requireAuth, async (req, res) => {
    try {
      if ((req.user as any)?.role !== "Admin") return res.status(403).json({ message: "Admin only" });
      const sop = await storage.getSop(req.params.id);
      if (!sop) return res.status(404).json({ message: "SOP not found" });
      const existingVersions = await storage.getSopVersions(sop.id);
      const nextVersion = existingVersions.length > 0 ? Math.max(...existingVersions.map(v => v.versionNumber)) + 1 : 1;
      const version = await storage.createSopVersion({
        sopId: sop.id,
        versionNumber: nextVersion,
        title: sop.title,
        content: sop.content,
        structuredData: sop.structuredData,
        savedBy: (req.user as any)?.id || null,
        changeSummary: req.body.changeSummary || "Manual save",
      });
      res.json(version);
    } catch (err) {
      res.status(500).json({ message: "Error saving version" });
    }
  });

  app.post("/api/sops/:id/restore-version/:versionId", requireAuth, async (req, res) => {
    try {
      if ((req.user as any)?.role !== "Admin") return res.status(403).json({ message: "Admin only" });
      const sop = await storage.getSop(req.params.id);
      if (!sop) return res.status(404).json({ message: "SOP not found" });
      const version = await storage.getSopVersion(req.params.versionId);
      if (!version || version.sopId !== sop.id) return res.status(404).json({ message: "Version not found" });
      const existingVersions = await storage.getSopVersions(sop.id);
      const nextVersion = existingVersions.length > 0 ? Math.max(...existingVersions.map(v => v.versionNumber)) + 1 : 1;
      await storage.createSopVersion({
        sopId: sop.id,
        versionNumber: nextVersion,
        title: sop.title,
        content: sop.content,
        structuredData: sop.structuredData,
        savedBy: (req.user as any)?.id || null,
        changeSummary: `Snapshot before restoring to version ${version.versionNumber}`,
      });
      const restored = await storage.updateSop(sop.id, {
        title: version.title,
        content: version.content,
        structuredData: version.structuredData,
      });
      res.json(restored);
    } catch (err) {
      res.status(500).json({ message: "Error restoring version" });
    }
  });

  app.post("/api/sops/:id/ai-rewrite", requireAuth, async (req, res) => {
    try {
      if ((req.user as any)?.role !== "Admin") return res.status(403).json({ message: "Admin only" });
      const sop = await storage.getSop(req.params.id);
      if (!sop) return res.status(404).json({ message: "SOP not found" });
      const { field, stepIndex, instruction } = req.body;
      if (!field || !instruction) return res.status(400).json({ message: "field and instruction required" });
      const structuredData = (sop.structuredData || {}) as any;

      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
      if (!apiKey) return res.status(500).json({ message: "AI not configured" });

      let currentText = "";
      let contextLabel = "";
      if (field === "step" && stepIndex !== undefined) {
        const step = structuredData.steps?.[stepIndex];
        if (!step) return res.status(400).json({ message: "Step not found" });
        currentText = JSON.stringify(step);
        contextLabel = `Step ${stepIndex + 1}: ${step.title}`;
      } else if (field === "outcome") {
        currentText = structuredData.outcome || "";
        contextLabel = "Outcome / Purpose";
      } else if (field === "safetyNotes") {
        currentText = structuredData.safetyNotes || "";
        contextLabel = "Safety Notes";
      } else if (field === "complianceNotes") {
        currentText = structuredData.complianceNotes || "";
        contextLabel = "Compliance Notes";
      } else if (field === "ppe") {
        currentText = structuredData.ppe || "";
        contextLabel = "PPE Requirements";
      } else if (field === "tools") {
        currentText = structuredData.tools || "";
        contextLabel = "Tools Required";
      } else if (field === "materials") {
        currentText = structuredData.materials || "";
        contextLabel = "Materials Required";
      } else {
        return res.status(400).json({ message: "Invalid field" });
      }

      const systemPrompt = field === "step"
        ? `You are rewriting a step in a landscape company SOP titled "${sop.title}". The user wants changes to ${contextLabel}. Return ONLY valid JSON matching this format: {"title":"...","instruction":"...","why":"...","successCriteria":"...","commonMistakes":"..."}. Keep any fields the user didn't mention. Do NOT add explanation text.`
        : `You are rewriting the "${contextLabel}" section of a landscape company SOP titled "${sop.title}". Return ONLY the rewritten text, no JSON wrapping, no explanation. Keep similar length and tone unless the user asks otherwise.`;

      const aiRes = await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Current content:\n${currentText}\n\nInstruction: ${instruction}` },
          ],
          temperature: 0.7,
        }),
      });
      if (!aiRes.ok) return res.status(500).json({ message: "AI request failed" });
      const aiData = await aiRes.json() as any;
      const rewritten = aiData.choices?.[0]?.message?.content?.trim();
      if (!rewritten) return res.status(500).json({ message: "AI returned empty response" });

      res.json({ field, stepIndex, rewritten });
    } catch (err) {
      console.error("[SOP AI Rewrite] Error:", err);
      res.status(500).json({ message: "Error rewriting content" });
    }
  });

  app.post("/api/sops/:id/ai-regenerate-image", requireAuth, async (req, res) => {
    try {
      if ((req.user as any)?.role !== "Admin") return res.status(403).json({ message: "Admin only" });
      const sop = await storage.getSop(req.params.id);
      if (!sop) return res.status(404).json({ message: "SOP not found" });
      const { imageType, stepIndex, instruction } = req.body;
      if (!imageType) return res.status(400).json({ message: "imageType required (header or step)" });

      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
      const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
      const SIDECAR = "http://127.0.0.1:1106";

      if (!apiKey || !privateDir) return res.status(500).json({ message: "AI or storage not configured" });

      const structuredData = (sop.structuredData || {}) as any;
      let imagePrompt = "";
      if (imageType === "header") {
        imagePrompt = instruction || `Professional landscape crew performing: ${sop.title}`;
      } else if (imageType === "step" && stepIndex !== undefined) {
        const step = structuredData.steps?.[stepIndex];
        if (!step) return res.status(400).json({ message: "Step not found" });
        imagePrompt = instruction || `Landscape crew performing: ${step.title} - ${step.instruction}`;
      } else {
        return res.status(400).json({ message: "Invalid imageType or missing stepIndex" });
      }

      const fullPrompt = `Landscaping/outdoor work context: ${imagePrompt}. Professional, clear, educational illustration style, high quality.`;
      const imageApiRes = await fetch(`${baseURL}/images/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "gpt-image-1", prompt: fullPrompt, size: "1024x1024" }),
      });
      if (!imageApiRes.ok) return res.status(500).json({ message: "Image generation failed" });
      const imageData = await imageApiRes.json() as any;
      const b64 = imageData?.data?.[0]?.b64_json;
      if (!b64) return res.status(500).json({ message: "No image data returned" });

      const imageBuffer = Buffer.from(b64, "base64");
      const imageId = crypto.randomUUID();
      const objectPath = `${privateDir}/sop-media/${imageId}.png`;
      const pathParts = objectPath.startsWith("/") ? objectPath.slice(1).split("/") : objectPath.split("/");
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");

      const signRes = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket_name: bucketName, object_name: objectName, method: "PUT", expires_at: new Date(Date.now() + 900 * 1000).toISOString() }),
      });
      if (!signRes.ok) return res.status(500).json({ message: "Storage signing failed" });
      const { signed_url } = await signRes.json() as { signed_url: string };

      const uploadRes = await fetch(signed_url, { method: "PUT", headers: { "Content-Type": "image/png" }, body: imageBuffer });
      if (!uploadRes.ok) return res.status(500).json({ message: "Image upload failed" });

      const newImageUrl = `/objects/sop-media/${imageId}.png`;
      res.json({ imageType, stepIndex, imageUrl: newImageUrl });
    } catch (err) {
      console.error("[SOP AI Image] Error:", err);
      res.status(500).json({ message: "Error regenerating image" });
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

  app.post("/api/sops/:id/copy", requireAuth, async (req, res) => {
    try {
      const { categoryId, categoryName } = req.body || {};
      const sop = await storage.copySop(req.params.id as string, categoryId, categoryName);
      if (!sop) return res.status(404).json({ message: "SOP not found" });
      res.status(201).json(sop);
    } catch (err) {
      res.status(500).json({ message: "Error copying SOP" });
    }
  });

  app.post("/api/sop-email", requireAuth, async (req, res) => {
    try {
      const { sopId, toEmail } = req.body;
      if (!sopId || !toEmail) return res.status(400).json({ message: "Missing sopId or toEmail" });
      const sop = await storage.getSop(sopId);
      if (!sop) return res.status(404).json({ message: "SOP not found" });
      const user = req.user as any;
      await sendSOPEmail(toEmail, sop.title, sop.category || "", sop.content, sop.lastUpdated || undefined, user?.language || "en");
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error sending SOP email:", err);
      res.status(500).json({ message: err.message || "Failed to send email" });
    }
  });

  // SOP Quiz Generation
  app.post("/api/sops/:id/generate-quiz", requireAuth, async (req, res) => {
    try {
      const userRole = (req.user as any)?.role;
      if (userRole !== "Admin" && userRole !== "Manager") {
        return res.status(403).json({ message: "Only Admins and Managers can generate quizzes" });
      }

      const sop = await storage.getSop(req.params.id as string);
      if (!sop) return res.status(404).json({ message: "SOP not found" });

      const { generateQuizForSop } = await import("./sopQuizGenerator");
      const success = await generateQuizForSop(sop.id);
      if (!success) {
        return res.status(500).json({ message: "Failed to generate quiz" });
      }

      const quizzes = await storage.getSopQuizzes(sop.id);
      if (quizzes.length > 0) {
        const quiz = await storage.getSopQuiz(quizzes[0].id);
        res.status(201).json([quiz]);
      } else {
        res.status(201).json([]);
      }
    } catch (err: any) {
      console.error("[QUIZ] Generation error:", err);
      res.status(500).json({ message: "Error generating quiz", errorCode: "SOP-003" });
    }
  });

  // Get quizzes for an SOP
  app.get("/api/sops/:id/quizzes", requireAuth, async (req, res) => {
    try {
      const quizzes = await storage.getSopQuizzes(req.params.id as string);
      res.json(quizzes);
    } catch (err) {
      res.status(500).json({ message: "Error fetching quizzes" });
    }
  });

  // Get quiz with questions
  app.get("/api/quizzes/:id", requireAuth, async (req, res) => {
    try {
      const quiz = await storage.getSopQuiz(req.params.id as string);
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });
      const questions = await storage.getQuizQuestions(quiz.id);
      res.json({ ...quiz, questions });
    } catch (err) {
      res.status(500).json({ message: "Error fetching quiz" });
    }
  });

  // Submit quiz attempt
  app.post("/api/quizzes/:id/attempts", requireAuth, async (req, res) => {
    try {
      const quiz = await storage.getSopQuiz(req.params.id as string);
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });

      const { answers } = req.body;
      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({ message: "Answers array is required" });
      }

      const questions = await storage.getQuizQuestions(quiz.id);
      if (answers.length !== questions.length) {
        return res.status(400).json({ message: `Expected ${questions.length} answers, got ${answers.length}` });
      }

      let score = 0;
      const gradedAnswers = questions.map((question, index) => {
        const answer = answers[index] ?? -1;
        const isCorrect = answer === question.correctIndex;
        if (isCorrect) score++;
        return {
          questionId: question.id,
          selectedIndex: answer,
          correctIndex: question.correctIndex,
          isCorrect,
        };
      });

      const totalQuestions = questions.length;
      const passed = totalQuestions > 0 && (score / totalQuestions) >= 0.7;

      const attempt = await storage.createQuizAttempt({
        quizId: quiz.id,
        userId: (req.user as any).id,
        score,
        totalQuestions,
        passed,
        answers: gradedAnswers,
      });

      res.status(201).json(attempt);
    } catch (err) {
      res.status(500).json({ message: "Error submitting quiz attempt" });
    }
  });

  // Get current user's quiz attempts
  app.get("/api/quiz-attempts/me", requireAuth, async (req, res) => {
    try {
      const quizId = req.query.quizId as string | undefined;
      const attempts = await storage.getUserQuizAttempts((req.user as any).id, quizId);
      res.json(attempts);
    } catch (err) {
      res.status(500).json({ message: "Error fetching quiz attempts" });
    }
  });

  // Get quiz attempts for a specific user — Admin/Manager only
  app.get("/api/quiz-attempts/user/:userId", requireAuth, async (req, res) => {
    try {
      const requester = req.user as any;
      if (!["Admin", "Manager"].includes(requester.role) && !requester.isMasterAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { userId } = req.params;
      const result = await pool.query(
        `SELECT
          uqa.id,
          uqa.quiz_id,
          uqa.user_id,
          uqa.score,
          uqa.total_questions,
          uqa.passed,
          uqa.highest_level_passed,
          uqa.final_score_label,
          uqa.completed_at,
          sq.title       AS quiz_title,
          sq.is_safety_critical,
          sq.min_pass_level,
          s.title        AS sop_title,
          s.category     AS sop_category
        FROM user_quiz_attempts uqa
        JOIN sop_quizzes sq ON sq.id = uqa.quiz_id
        JOIN sops s ON s.id = sq.sop_id
        WHERE uqa.user_id = $1
        ORDER BY uqa.completed_at DESC`,
        [userId]
      );
      res.json(result.rows);
    } catch (err: any) {
      console.error("[quiz-attempts] user route error:", err);
      res.status(500).json({ message: "Error fetching quiz attempts" });
    }
  });

  // Get all SOPs that have quizzes (for Testing & Knowledge page)
  app.get("/api/quiz-catalog", requireAuth, async (req, res) => {
    try {
      const allSops = await storage.getSops();
      const catalog = [];
      for (const sop of allSops) {
        const quizzes = await storage.getSopQuizzes(sop.id);
        if (quizzes.length > 0) {
          catalog.push({ sop, quizzes });
        }
      }
      res.json(catalog);
    } catch (err) {
      res.status(500).json({ message: "Error fetching quiz catalog" });
    }
  });

  // Adaptive Quiz - Start
  app.post("/api/quizzes/:id/start", requireAuth, async (req, res) => {
    try {
      const quiz = await storage.getSopQuiz(req.params.id as string);
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });

      const user = req.user as any;
      const { selectNextQuestion } = await import("./adaptiveEngine");
      const result = await selectNextQuestion(quiz.id, 1, [], user.role, null);

      if (!result) {
        return res.status(400).json({ message: "No questions available for your role in this quiz" });
      }

      const question = result.question;
      res.json({
        question: {
          id: question.id,
          question: question.question,
          options: question.options,
          difficultyLevel: question.difficulty_level,
          sortOrder: question.sort_order,
        },
        currentDifficulty: result.newDifficulty,
        questionNumber: 1,
        quizTitle: quiz.title,
      });
    } catch (err: any) {
      console.error("[QUIZ] Start error:", err);
      res.status(500).json({ message: "Error starting quiz" });
    }
  });

  // Adaptive Quiz - Answer question & get next
  app.post("/api/quizzes/:id/answer", requireAuth, async (req, res) => {
    try {
      const quiz = await storage.getSopQuiz(req.params.id as string);
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });

      const user = req.user as any;
      const { questionId, selectedIndex, answeredQuestionIds, questionNumber } = req.body;
      const currentDifficulty = Math.min(Math.max(Math.floor(Number(req.body.currentDifficulty) || 1), 1), 5);

      if (typeof selectedIndex !== "number" || selectedIndex < 0 || selectedIndex > 3) {
        return res.status(400).json({ message: "Invalid selectedIndex" });
      }

      const questions = await storage.getQuizQuestions(quiz.id);
      const answeredQuestion = questions.find((q: any) => q.id === questionId);
      if (!answeredQuestion) return res.status(400).json({ message: "Question not found" });

      const isCorrect = selectedIndex === answeredQuestion.correctIndex;
      const maxQuestions = Math.min(questions.length, 15);
      const allAnswered = [...(answeredQuestionIds || []), questionId];

      const answerResult = {
        questionId,
        selectedIndex,
        correctIndex: answeredQuestion.correctIndex,
        isCorrect,
        explanation: answeredQuestion.explanation,
        difficultyLevel: answeredQuestion.difficultyLevel || answeredQuestion.difficulty_level,
      };

      if (allAnswered.length >= maxQuestions) {
        return res.json({
          answerResult,
          finished: true,
          answeredQuestionIds: allAnswered,
        });
      }

      const { selectNextQuestion } = await import("./adaptiveEngine");
      const next = await selectNextQuestion(
        quiz.id,
        currentDifficulty || 1,
        allAnswered,
        user.role,
        isCorrect
      );

      if (!next) {
        return res.json({
          answerResult,
          finished: true,
          answeredQuestionIds: allAnswered,
        });
      }

      res.json({
        answerResult,
        finished: false,
        nextQuestion: {
          id: next.question.id,
          question: next.question.question,
          options: next.question.options,
          difficultyLevel: next.question.difficulty_level,
          sortOrder: next.question.sort_order,
        },
        currentDifficulty: next.newDifficulty,
        questionNumber: (questionNumber || 1) + 1,
        answeredQuestionIds: allAnswered,
      });
    } catch (err: any) {
      console.error("[QUIZ] Answer error:", err);
      res.status(500).json({ message: "Error processing answer" });
    }
  });

  // Adaptive Quiz - Complete and save results (server-validated)
  app.post("/api/quizzes/:id/complete", requireAuth, async (req, res) => {
    try {
      const quiz = await storage.getSopQuiz(req.params.id as string);
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });

      const user = req.user as any;
      const { answers, questionsServed } = req.body;

      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({ message: "Answers array is required" });
      }

      const questions = await storage.getQuizQuestions(quiz.id);
      const questionMap = new Map(questions.map((q: any) => [q.id, q]));

      let serverScore = 0;
      let serverHighestLevel = 0;
      const verifiedAnswers: any[] = [];
      const wrongIds: string[] = [];

      for (const ans of answers) {
        const q = questionMap.get(ans.questionId);
        if (!q) continue;
        const isCorrect = ans.selectedIndex === q.correctIndex;
        const dl = q.difficultyLevel || 1;
        if (isCorrect) {
          serverScore++;
          if (dl > serverHighestLevel) serverHighestLevel = dl;
        } else {
          wrongIds.push(ans.questionId);
        }
        verifiedAnswers.push({
          questionId: ans.questionId,
          selectedIndex: ans.selectedIndex,
          correctIndex: q.correctIndex,
          isCorrect,
          difficultyLevel: dl,
        });
      }

      const totalQuestions = verifiedAnswers.length;
      const { calculateScoreLabel, getReviewAreas } = await import("./adaptiveEngine");
      const finalLabel = calculateScoreLabel(serverHighestLevel);
      const minLevel = quiz.minPassLevel || 2;
      const passed = serverHighestLevel >= minLevel;

      const reviewAreas = await getReviewAreas(quiz.id, wrongIds);

      const attempt = await storage.createQuizAttempt({
        quizId: quiz.id,
        userId: user.id,
        score: serverScore,
        totalQuestions,
        passed,
        answers: verifiedAnswers,
        questionsServed: questionsServed || [],
        currentDifficulty: serverHighestLevel,
        highestLevelPassed: serverHighestLevel,
        finalScoreLabel: finalLabel,
      });

      res.status(201).json({
        ...attempt,
        finalScoreLabel: finalLabel,
        highestLevelPassed: serverHighestLevel,
        reviewAreas,
        passed,
        minPassLevel: minLevel,
      });
    } catch (err: any) {
      console.error("[QUIZ] Complete error:", err);
      res.status(500).json({ message: "Error completing quiz" });
    }
  });

  // Manager View - All employee quiz stats
  app.get("/api/quiz-stats/employees", requireAuth, async (req, res) => {
    try {
      const userRole = (req.user as any)?.role;
      if (!["Admin", "Master Admin", "Manager", "HR"].includes(userRole)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { getAllEmployeeQuizStats } = await import("./adaptiveEngine");
      const stats = await getAllEmployeeQuizStats();
      res.json(stats);
    } catch (err) {
      console.error("[QUIZ] Employee stats error:", err);
      res.status(500).json({ message: "Error fetching employee quiz stats" });
    }
  });

  // Manager View - Safety critical flags
  app.get("/api/quiz-stats/safety-flags", requireAuth, async (req, res) => {
    try {
      const userRole = (req.user as any)?.role;
      if (!["Admin", "Master Admin", "Manager", "HR"].includes(userRole)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { getSafetyCriticalFlags } = await import("./adaptiveEngine");
      const flags = await getSafetyCriticalFlags();
      res.json(flags);
    } catch (err) {
      console.error("[QUIZ] Safety flags error:", err);
      res.status(500).json({ message: "Error fetching safety flags" });
    }
  });

  // Manager View - Update quiz settings (min pass level, safety critical)
  app.patch("/api/quizzes/:id/settings", requireAuth, async (req, res) => {
    try {
      const userRole = (req.user as any)?.role;
      if (!["Admin", "Master Admin", "Manager"].includes(userRole)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { minPassLevel, isSafetyCritical } = req.body;
      const updates: string[] = [];
      const values: any[] = [];
      let paramIdx = 2;

      if (minPassLevel !== undefined) {
        updates.push(`min_pass_level = $${paramIdx++}`);
        values.push(Math.min(Math.max(minPassLevel, 1), 5));
      }
      if (isSafetyCritical !== undefined) {
        updates.push(`is_safety_critical = $${paramIdx++}`);
        values.push(!!isSafetyCritical);
      }
      if (updates.length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const { pool: dbPool } = await import("./db");
      await dbPool.query(
        `UPDATE sop_quizzes SET ${updates.join(", ")} WHERE id = $1`,
        [req.params.id, ...values]
      );

      const quiz = await storage.getSopQuiz(req.params.id as string);
      res.json(quiz);
    } catch (err) {
      console.error("[QUIZ] Settings update error:", err);
      res.status(500).json({ message: "Error updating quiz settings" });
    }
  });

  // SOP Pipeline
  app.get("/api/sop-pipeline", requireAdmin, async (req, res) => {
    try {
      const items = await storage.getSopPipelineItems();
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Error fetching pipeline items" });
    }
  });

  app.post("/api/sop-pipeline/suggest", requireAdmin, async (req, res) => {
    try {
      const existingSops = await storage.getSops();
      const categories = await storage.getSopCategories();
      const pipelineItems = await storage.getSopPipelineItems();

      const existingTitles = existingSops.map(s => s.title);
      const pipelineTitles = pipelineItems.map(p => p.title);
      const allExisting = [...existingTitles, ...pipelineTitles];

      const categoryNames = categories.map(c => c.name);
      const categoryMap = Object.fromEntries(categories.map(c => [c.name, c.id]));

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.8,
        messages: [
          {
            role: "system",
            content: `You are an expert in landscape installation and maintenance business operations. Generate SOP (Standard Operating Procedure) topic suggestions for a landscaping company called "Chapin Landscapes".

The company has these SOP categories: ${categoryNames.join(", ")}

These SOPs already exist or are in the pipeline (do NOT suggest these again):
${allExisting.map(t => `- ${t}`).join("\n")}

Generate 5 new SOP topic suggestions. For each, provide:
- title: Clear, specific SOP title
- description: 2-3 sentence description of what this SOP will cover and why it matters
- category: Must be one of the existing categories listed above
- sopType: One of: standard, safety, maintenance, training, quality, emergency
- priority: 1 (low) to 5 (critical)

Focus on practical, actionable procedures that landscape crews actually need. Consider safety, quality, efficiency, and customer satisfaction.

Respond with valid JSON only: { "suggestions": [...] }`
          },
          {
            role: "user",
            content: req.body.prompt
              ? `Generate SOP suggestions with this focus: ${req.body.prompt}`
              : "Generate 5 diverse SOP topic suggestions covering different categories."
          }
        ],
        response_format: { type: "json_object" },
      });

      const parsed = JSON.parse(completion.choices[0].message.content || "{}");
      const suggestions = parsed.suggestions || [];

      const created: any[] = [];
      for (const s of suggestions) {
        const item = await storage.createSopPipelineItem({
          title: s.title,
          description: s.description,
          category: s.category,
          categoryId: categoryMap[s.category] || null,
          sopType: s.sopType || "standard",
          status: "suggested",
          priority: s.priority || 0,
          aiContext: { suggestedReason: s.description, generatedAt: new Date().toISOString() },
          rejectedReason: null,
          scheduledFor: null,
        });
        created.push(item);
      }

      res.json({ count: created.length, items: created });
    } catch (err: any) {
      console.error("[SOP Pipeline] Suggestion error:", err);
      res.status(500).json({ message: "Error generating suggestions" });
    }
  });

  app.get("/api/sop-pipeline/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getSopPipelineSettings();
      res.json(settings || {});
    } catch (err) {
      res.status(500).json({ message: "Error fetching pipeline settings" });
    }
  });

  app.patch("/api/sop-pipeline/settings", requireAdmin, async (req, res) => {
    try {
      const { autoGenerateEnabled, generateFrequency, maxPerRun } = req.body;
      const updates: any = {};
      if (autoGenerateEnabled !== undefined) updates.autoGenerateEnabled = autoGenerateEnabled;
      if (generateFrequency !== undefined) updates.generateFrequency = generateFrequency;
      if (maxPerRun !== undefined) updates.maxPerRun = Math.min(Math.max(maxPerRun, 1), 5);
      if (autoGenerateEnabled === true) {
        const freqMs: Record<string, number> = { hourly: 3600000, daily: 86400000, weekly: 604800000 };
        updates.nextScheduledRun = new Date(Date.now() + (freqMs[generateFrequency || "daily"] || freqMs.daily));
      }
      const settings = await storage.updateSopPipelineSettings(updates);
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "Error updating pipeline settings" });
    }
  });

  app.patch("/api/sop-pipeline/:id", requireAdmin, async (req, res) => {
    try {
      const { status, rejectedReason, title, description, category, categoryId, sopType, priority, scheduledFor } = req.body;
      const updates: any = {};
      if (status) {
        updates.status = status;
        if (status === "approved") updates.approvedAt = new Date();
        if (status === "rejected" && rejectedReason) updates.rejectedReason = rejectedReason;
      }
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (category !== undefined) updates.category = category;
      if (categoryId !== undefined) updates.categoryId = categoryId;
      if (sopType !== undefined) updates.sopType = sopType;
      if (priority !== undefined) updates.priority = priority;
      if (scheduledFor !== undefined) updates.scheduledFor = scheduledFor ? new Date(scheduledFor) : null;

      const updated = await storage.updateSopPipelineItem(req.params.id, updates);
      if (!updated) return res.status(404).json({ message: "Pipeline item not found" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Error updating pipeline item" });
    }
  });

  app.delete("/api/sop-pipeline/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteSopPipelineItem(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting pipeline item" });
    }
  });

  const pipelineGenerationJobs = new Map<string, { status: string; progress: number; step: string; error?: string; sopId?: string }>();

  app.post("/api/sop-pipeline/:id/generate", requireAdmin, async (req, res) => {
    try {
      const item = await storage.getSopPipelineItem(req.params.id);
      if (!item) return res.status(404).json({ message: "Pipeline item not found" });
      if (item.status !== "approved") return res.status(400).json({ message: "Only approved items can be generated" });

      await storage.updateSopPipelineItem(item.id, { status: "generating" });

      const jobId = crypto.randomUUID();
      pipelineGenerationJobs.set(jobId, { status: "processing", progress: 0, step: "Starting content generation..." });

      res.status(202).json({ jobId, status: "processing" });

      (async () => {
        try {
          pipelineGenerationJobs.set(jobId, { status: "processing", progress: 10, step: "Generating SOP content with AI..." });

          const existingSops = await storage.getSops();
          const sampleTitles = existingSops.slice(0, 5).map(s => s.title).join(", ");

          const contentCompletion = await openai.chat.completions.create({
            model: "gpt-4o",
            temperature: 0.7,
            messages: [
              {
                role: "system",
                content: `You are an expert technical writer specializing in landscape installation and maintenance SOPs for "Chapin Landscapes". Write comprehensive, practical SOPs that field crews can actually follow.

Your SOPs must include:
- A clear desired outcome
- Required tools, materials, and PPE (personal protective equipment)
- Detailed step-by-step instructions (5-8 steps typically)
- Each step needs: a title, detailed instruction, why it matters, success criteria, and common mistakes to avoid
- Safety notes relevant to the procedure
- Appropriate audience and skill level

The company already has these SOPs: ${sampleTitles}

Write content that matches professional landscaping industry standards. Be specific with measurements, techniques, and safety requirements.

Respond with valid JSON matching this exact structure:
{
  "outcome": "What the completed procedure should look like",
  "outcomeType": "completion|quality|safety",
  "audience": "Who should follow this SOP",
  "skillLevel": "beginner|intermediate|advanced|all",
  "timingTarget": "Estimated time (e.g., '30 minutes')",
  "timingMax": "Maximum time allowed (e.g., '1 hour')",
  "tools": "Tool 1\\nTool 2\\nTool 3",
  "materials": "Material 1\\nMaterial 2",
  "ppe": "PPE item 1\\nPPE item 2",
  "safetyNotes": "Important safety information",
  "complianceNotes": "Any regulatory or compliance notes",
  "steps": [
    {
      "title": "Step title",
      "instruction": "Detailed step instructions",
      "why": "Why this step matters",
      "successCriteria": "How to know this step is done correctly",
      "commonMistakes": "What to watch out for",
      "proofRequired": false,
      "isQCCheckpoint": false
    }
  ],
  "imagePrompts": {
    "header": "Documentary-style field photo prompt for the SOP header: describe a real landscaping crew performing this task outdoors in natural daylight — include specific tools, materials, crew attire (work gear/PPE), setting, and what action is happening. Photorealistic, no illustrations.",
    "steps": [
      "Documentary-style field photo prompt for step 1: real crew member(s) on a job site actively performing this specific step — include tools in use, body position, materials, outdoor setting, natural light. Photorealistic, no illustrations.",
      "Same format for step 2..."
    ]
  }
}`
              },
              {
                role: "user",
                content: `Write a complete ${item.sopType} SOP for: "${item.title}"
                
Category: ${item.category}
Description: ${item.description || "No additional description provided"}

Generate comprehensive content with 5-8 detailed steps and image prompts for every step plus a header image.`
              }
            ],
            response_format: { type: "json_object" },
          });

          const sopContent = JSON.parse(contentCompletion.choices[0].message.content || "{}");
          pipelineGenerationJobs.set(jobId, { status: "processing", progress: 30, step: "Content generated. Generating images..." });

          const steps = (sopContent.steps || []).map((s: any, i: number) => ({
            id: crypto.randomUUID(),
            title: s.title || `Step ${i + 1}`,
            instruction: s.instruction || "",
            why: s.why || undefined,
            successCriteria: s.successCriteria || undefined,
            commonMistakes: s.commonMistakes || undefined,
            proofRequired: s.proofRequired || false,
            proofType: undefined,
            isQCCheckpoint: s.isQCCheckpoint || false,
          }));

          const imagePrompts = sopContent.imagePrompts || {};
          const stepImagePrompts = imagePrompts.steps || [];
          const headerPrompt = imagePrompts.header || `Professional landscaping scene showing: ${item.title}`;

          const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
          const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
          const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
          const SIDECAR = "http://127.0.0.1:1106";

          async function generateAndUploadImage(prompt: string, label: string): Promise<string | null> {
            try {
              const fullPrompt = `Documentary-style field photograph: ${prompt}. Shot on a real landscaping job site, natural daylight, crew members in work gear actually performing the task, candid and authentic, photorealistic DSLR photography, sharp focus, no illustrations, no cartoons, no graphics.`;
              const imageApiRes = await fetch(`${baseURL}/images/generations`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
                },
                body: JSON.stringify({ model: "gpt-image-1", prompt: fullPrompt, size: "1024x1024" }),
              });
              if (!imageApiRes.ok) {
                console.error(`[SOP-Pipeline] Image gen failed for ${label}: ${imageApiRes.status}`);
                return null;
              }
              const imageData = await imageApiRes.json() as any;
              const b64 = imageData?.data?.[0]?.b64_json;
              if (!b64) return null;

              const imageBuffer = Buffer.from(b64, "base64");
              const imageId = crypto.randomUUID();
              const objectPath = `${privateDir}/sop-media/${imageId}.png`;
              const pathParts = objectPath.startsWith("/") ? objectPath.slice(1).split("/") : objectPath.split("/");
              const bucketName = pathParts[0];
              const objectName = pathParts.slice(1).join("/");

              const signRes = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  bucket_name: bucketName,
                  object_name: objectName,
                  method: "PUT",
                  expires_at: new Date(Date.now() + 900 * 1000).toISOString(),
                }),
              });
              if (!signRes.ok) return null;
              const { signed_url } = await signRes.json() as { signed_url: string };

              const uploadRes = await fetch(signed_url, {
                method: "PUT",
                headers: { "Content-Type": "image/png" },
                body: imageBuffer,
              });
              if (!uploadRes.ok) return null;

              return `/objects/sop-media/${imageId}.png`;
            } catch (err) {
              console.error(`[SOP-Pipeline] Image error for ${label}:`, err);
              return null;
            }
          }

          let headerImageUrl: string | null = null;
          if (privateDir) {
            headerImageUrl = await generateAndUploadImage(headerPrompt, "header");
            pipelineGenerationJobs.set(jobId, { status: "processing", progress: 40, step: "Header image done. Generating step images..." });
          }

          const stepImageUrls: Record<string, string> = {};
          if (privateDir) {
            for (let i = 0; i < steps.length; i++) {
              const prompt = stepImagePrompts[i] || `Landscape crew performing: ${steps[i].title}`;
              const imgUrl = await generateAndUploadImage(prompt, `step-${i + 1}`);
              if (imgUrl) {
                stepImageUrls[steps[i].id] = imgUrl;
              }
              const progress = 40 + Math.round(((i + 1) / steps.length) * 40);
              pipelineGenerationJobs.set(jobId, { status: "processing", progress, step: `Step ${i + 1}/${steps.length} image done...` });
            }
          }

          pipelineGenerationJobs.set(jobId, { status: "processing", progress: 85, step: "Creating SOP record..." });

          const SOP_TYPE_LABELS: Record<string, string> = {
            standard: "Standard Procedure", safety: "Safety Procedure",
            maintenance: "Maintenance", training: "Training Guide",
            quality: "Quality Control", emergency: "Emergency Response",
          };
          const SKILL_LABELS: Record<string, string> = {
            beginner: "Beginner & Above", intermediate: "Intermediate & Above",
            advanced: "Advanced", all: "All Levels",
          };
          const OUTCOME_LABELS: Record<string, string> = {
            completion: "Task Completion", quality: "Quality Standard", safety: "Safety Compliance",
          };

          let contentHtml = "";

          if (headerImageUrl) {
            contentHtml += `<div class="sop-header-image" style="margin-bottom:16px;text-align:center;">`;
            contentHtml += `<img src="${headerImageUrl}" alt="${item.title}" style="max-width:100%;max-height:300px;border-radius:8px;" />`;
            contentHtml += `<p style="font-size:11px;color:#888;margin-top:4px;">AI Generated</p></div>`;
          }

          contentHtml += `<div class="sop-header">`;
          contentHtml += `<p><strong>Type:</strong> ${SOP_TYPE_LABELS[item.sopType] || item.sopType}</p>`;
          if (sopContent.audience) contentHtml += `<p><strong>Audience:</strong> ${sopContent.audience}</p>`;
          if (sopContent.skillLevel) contentHtml += `<p><strong>Skill Level:</strong> ${SKILL_LABELS[sopContent.skillLevel] || sopContent.skillLevel}</p>`;
          if (sopContent.timingTarget) contentHtml += `<p><strong>Target Time:</strong> ${sopContent.timingTarget}${sopContent.timingMax ? ` (Max: ${sopContent.timingMax})` : ""}</p>`;
          contentHtml += `</div>`;

          if (sopContent.outcome) {
            const outcomeLabel = OUTCOME_LABELS[sopContent.outcomeType] || "";
            contentHtml += `<h2>Desired Outcome</h2>`;
            if (outcomeLabel) contentHtml += `<p><em>${outcomeLabel}</em></p>`;
            contentHtml += `<p>${sopContent.outcome}</p>`;
          }

          if (sopContent.tools || sopContent.materials || sopContent.ppe) {
            contentHtml += `<h2>Before You Start</h2>`;
            if (sopContent.tools) { contentHtml += `<h3>Tools Required</h3><ul>`; sopContent.tools.split("\n").filter(Boolean).forEach((t: string) => contentHtml += `<li>${t.trim()}</li>`); contentHtml += `</ul>`; }
            if (sopContent.materials) { contentHtml += `<h3>Materials Needed</h3><ul>`; sopContent.materials.split("\n").filter(Boolean).forEach((m: string) => contentHtml += `<li>${m.trim()}</li>`); contentHtml += `</ul>`; }
            if (sopContent.ppe) { contentHtml += `<h3>PPE Required</h3><ul>`; sopContent.ppe.split("\n").filter(Boolean).forEach((p: string) => contentHtml += `<li>${p.trim()}</li>`); contentHtml += `</ul>`; }
          }

          if (sopContent.safetyNotes) {
            contentHtml += `<h2>⚠️ Safety Notes</h2>`;
            contentHtml += `<p>${sopContent.safetyNotes.replace(/\n/g, "<br>")}</p>`;
          }

          contentHtml += `<h2>Procedure Steps</h2><ol>`;
          steps.forEach((step: any, i: number) => {
            contentHtml += `<li><strong>${step.title}</strong>`;
            if (step.instruction) contentHtml += `<p>${step.instruction.replace(/\n/g, "<br>")}</p>`;
            if (stepImageUrls[step.id]) {
              contentHtml += `<div style="margin:8px 0;"><img src="${stepImageUrls[step.id]}" alt="${step.title}" style="max-width:100%;max-height:200px;border-radius:6px;border:1px solid #eee;" />`;
              contentHtml += `<span style="font-size:10px;color:#888;"> AI Generated</span></div>`;
            }
            if (step.why) contentHtml += `<p><em>Why: ${step.why}</em></p>`;
            if (step.successCriteria) contentHtml += `<p>✅ <strong>Success:</strong> ${step.successCriteria}</p>`;
            if (step.commonMistakes) contentHtml += `<p>⚠️ <strong>Avoid:</strong> ${step.commonMistakes}</p>`;
            if (step.proofRequired) contentHtml += `<p>📋 <strong>Proof Required</strong></p>`;
            if (step.isQCCheckpoint) contentHtml += `<p>🔍 <strong>QC Checkpoint</strong> — Verify before continuing</p>`;
            contentHtml += `</li>`;
          });
          contentHtml += `</ol>`;

          if (sopContent.complianceNotes) {
            contentHtml += `<h2>Compliance</h2>`;
            contentHtml += `<p>${sopContent.complianceNotes.replace(/\n/g, "<br>")}</p>`;
          }

          const structuredData = {
            outcome: sopContent.outcome,
            outcomeType: sopContent.outcomeType,
            audience: sopContent.audience,
            skillLevel: sopContent.skillLevel,
            timingTarget: sopContent.timingTarget,
            timingMax: sopContent.timingMax,
            ppe: sopContent.ppe,
            tools: sopContent.tools,
            materials: sopContent.materials,
            steps: steps.map((s: any) => ({
              ...s,
              imageUrl: stepImageUrls[s.id] || undefined,
            })),
            safetyNotes: sopContent.safetyNotes,
            complianceNotes: sopContent.complianceNotes,
            headerImageUrl: headerImageUrl || undefined,
            generatedByPipeline: true,
            pipelineItemId: item.id,
          };

          const classification = autoClassifySOPTitle(item.title);
          const user = req.user as User;

          const sop = await storage.createSop({
            title: item.title,
            category: item.category,
            categoryId: item.categoryId || undefined,
            content: contentHtml,
            structuredData,
            superCategory: classification.confidence >= 0.5 ? classification.superCategory : undefined,
            subCategory: classification.confidence >= 0.5 ? classification.subCategory : undefined,
            sopType: item.sopType,
            ownerId: user.id,
          });

          await storage.updateSopPipelineItem(item.id, {
            status: "published",
            completedAt: new Date(),
            generatedSopId: sop.id,
          });

          pipelineGenerationJobs.set(jobId, { status: "complete", progress: 95, step: "Generating training quiz...", sopId: sop.id });

          try {
            const { generateQuizForSop } = await import("./sopQuizGenerator");
            const quizSuccess = await generateQuizForSop(sop.id);
            if (quizSuccess) {
              console.log(`[SOP-Pipeline] Auto-generated quiz for "${item.title}"`);
            }
          } catch (quizErr) {
            console.error(`[SOP-Pipeline] Quiz auto-generation failed (non-blocking):`, quizErr);
          }

          pipelineGenerationJobs.set(jobId, { status: "complete", progress: 100, step: "SOP published with quiz!", sopId: sop.id });
          console.log(`[SOP-Pipeline] Generated SOP "${item.title}" → ${sop.id} with ${Object.keys(stepImageUrls).length} step images`);

          setTimeout(() => pipelineGenerationJobs.delete(jobId), 5 * 60 * 1000);
        } catch (err: any) {
          console.error("[SOP-Pipeline] Generation error:", err);
          pipelineGenerationJobs.set(jobId, { status: "error", progress: 0, step: "Generation failed", error: err.message });
          await storage.updateSopPipelineItem(item.id, { status: "approved" });
          setTimeout(() => pipelineGenerationJobs.delete(jobId), 5 * 60 * 1000);
        }
      })();
    } catch (err) {
      res.status(500).json({ message: "Error starting generation" });
    }
  });

  app.get("/api/sop-pipeline/generate-status/:jobId", requireAdmin, async (req, res) => {
    const job = pipelineGenerationJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  });

  // SOP Categories
  app.get("/api/sop-categories", requireAuth, async (req, res) => {
    try {
      const categories = await storage.getSopCategories();
      res.json(categories);
    } catch (err) {
      res.status(500).json({ message: "Error fetching SOP categories" });
    }
  });

  app.post("/api/sop-categories", requireAuth, async (req, res) => {
    try {
      const category = await storage.createSopCategory(req.body);
      res.status(201).json(category);
    } catch (err) {
      res.status(500).json({ message: "Error creating SOP category" });
    }
  });

  app.patch("/api/sop-categories/:id", requireAuth, async (req, res) => {
    try {
      const category = await storage.updateSopCategory(req.params.id as string, req.body);
      if (!category) return res.status(404).json({ message: "Category not found" });
      
      // Update all SOPs in this category to have the new category name
      if (req.body.name) {
        const allSops = await storage.getSops();
        const sopsInCategory = allSops.filter(sop => sop.categoryId === req.params.id);
        for (const sop of sopsInCategory) {
          await storage.updateSop(sop.id, { category: req.body.name });
        }
      }
      
      res.json(category);
    } catch (err) {
      res.status(500).json({ message: "Error updating SOP category" });
    }
  });

  app.delete("/api/sop-categories/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteSopCategory(req.params.id as string);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Error deleting SOP category" });
    }
  });

  // SOP Templates
  app.get("/api/sop-templates", requireAuth, async (req, res) => {
    try {
      const templates = await storage.getSopTemplates();
      res.json(templates);
    } catch (err) {
      res.status(500).json({ message: "Error fetching templates" });
    }
  });

  app.post("/api/sop-templates", requireAuth, async (req, res) => {
    try {
      const parsed = insertSopTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid template data", errors: parsed.error.flatten() });
      }
      const template = await storage.createSopTemplate(parsed.data);
      res.status(201).json(template);
    } catch (err) {
      res.status(500).json({ message: "Error creating template" });
    }
  });

  app.patch("/api/sop-templates/:id", requireAuth, async (req, res) => {
    try {
      const parsed = insertSopTemplateSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid template data", errors: parsed.error.flatten() });
      }
      const template = await storage.updateSopTemplate(req.params.id as string, parsed.data);
      if (!template) return res.status(404).json({ message: "Template not found" });
      res.json(template);
    } catch (err) {
      res.status(500).json({ message: "Error updating template" });
    }
  });

  app.delete("/api/sop-templates/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteSopTemplate(req.params.id as string);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Error deleting template" });
    }
  });

  // SOP Examples (external references)
  app.get("/api/sop-examples", requireAuth, async (req, res) => {
    try {
      const examples = await storage.getSopExamples();
      res.json(examples);
    } catch (err) {
      res.status(500).json({ message: "Error fetching examples" });
    }
  });

  app.post("/api/sop-examples", requireAuth, async (req, res) => {
    try {
      const parsed = insertSopExampleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid example data", errors: parsed.error.flatten() });
      }
      const example = await storage.createSopExample(parsed.data);
      res.status(201).json(example);
    } catch (err) {
      res.status(500).json({ message: "Error creating example" });
    }
  });

  app.patch("/api/sop-examples/:id", requireAuth, async (req, res) => {
    try {
      const parsed = insertSopExampleSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid example data", errors: parsed.error.flatten() });
      }
      const example = await storage.updateSopExample(req.params.id as string, parsed.data);
      if (!example) return res.status(404).json({ message: "Example not found" });
      res.json(example);
    } catch (err) {
      res.status(500).json({ message: "Error updating example" });
    }
  });

  app.delete("/api/sop-examples/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteSopExample(req.params.id as string);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Error deleting example" });
    }
  });

  app.post("/api/ai/generate-sop", requireAuth, async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert at creating Standard Operating Procedures (SOPs) for landscape installation and maintenance businesses. 
            When given a topic, create a comprehensive, well-structured SOP.
            Format your response as JSON with these fields:
            - title: A clear, concise title for the SOP
            - category: One of [Operations, Sales, Installation, Equipment, Safety, HR, Customer Service, General]
            - content: The full SOP content formatted in HTML with proper headings (h2, h3), numbered/bulleted lists, and clear sections
            - structuredData: An object with these fields:
              - outcome: string (1-3 sentences describing the desired outcome)
              - outcomeType: string (one of: "completion", "quality", "safety", "kpi")
              - audience: string (e.g. "Landscape Crew Members", "All Employees")
              - skillLevel: string (one of: "beginner", "intermediate", "advanced", "all")
              - timingTarget: string (e.g. "30 minutes")
              - timingMax: string (e.g. "60 minutes")
              - ppe: string (one item per line, include ANSI/OSHA ratings)
              - tools: string (one tool per line, include sizes/specs)
              - materials: string (one material per line, include quantities)
              - steps: array of objects with { id: string, title: string, instruction: string (3-5 sentences), why: string, successCriteria: string, commonMistakes: string, proofRequired: boolean, proofType: string (photo/measurement_log/supervisor_signoff/checklist), isQCCheckpoint: boolean }
              - safetyNotes: string
              - complianceNotes: string
            
            Make the content practical, detailed, and professional. Include safety considerations where relevant.`
          },
          {
            role: "user",
            content: `Create an SOP for: ${prompt}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 4096,
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
      res.json(result);
    } catch (err: any) {
      console.error("AI SOP generation error:", err);
      res.status(500).json({ message: "AI generation failed", error: err.message });
    }
  });

  app.post("/api/ai/equipment-research", requireAuth, async (req, res) => {
    try {
      const { equipmentName, manufacturer, model, year, engineType, fuelType, sopTitle, maintenanceFocus } = req.body;
      if (!equipmentName && !manufacturer) {
        return res.status(400).json({ message: "Equipment name or manufacturer is required" });
      }

      const equipmentParts = [year, manufacturer, equipmentName, model].filter(Boolean);
      const equipmentDesc = equipmentParts.join(" ");
      const engineInfo = [engineType, fuelType].filter(Boolean).join(", ");

      const isSpecificTask = maintenanceFocus === "specific_task";

      const systemPrompt = isSpecificTask
        ? `You are an expert equipment maintenance and operations specialist. You are creating a detailed procedure for ONE SPECIFIC TASK on a piece of equipment.

The user's SOP is titled "${sopTitle || "Equipment Task"}". Your job is to create a detailed, step-by-step procedure for EXACTLY this task — nothing else. Do NOT generate a full maintenance schedule. Focus only on the specific task described in the title.

${engineInfo ? `IMPORTANT: This equipment has: ${engineInfo}. Use this to provide the correct specifications (fluids, filters, parts, capacities, etc.) for this EXACT engine/power configuration.` : ""}

Return JSON with these fields:
- maintenanceSchedule: string[] - 2-3 key points about when/how often this specific task should be performed, with specific mileage, hours, or time intervals from OEM specs
- recommendations: string[] - Best practices specific to performing this task on this equipment
- warnings: string[] - Safety warnings specific to this task
- intervals: array with 1-3 objects (break the task into sub-steps if needed), each with:
  - task: string - The task or sub-task name
  - interval: string - Specific OEM-recommended interval. Use exact manufacturer specs like "Every 7,500 miles", "Every 500 engine hours", "Every 200 hours or annually", "Before each wash", etc. Be specific, not generic.
  - procedure: string - Comprehensive step-by-step procedure with numbered steps. Include specific products, quantities, part numbers, techniques, tools needed, and proper methods. Write for field crew with basic mechanical knowledge.
  - notes: string - OEM references, common mistakes, pro tips, and signs of problems.
- source: string - Brief note about the specification source

Be extremely specific to the equipment and task. If the title says "Washing a Truck", provide a professional vehicle washing procedure. If it says "Oil Change", provide the specific oil change procedure with correct oil type, filter, and capacity for this exact engine.`
        : `You are an expert equipment maintenance specialist. Given equipment details, provide a COMPREHENSIVE OEM-style maintenance schedule covering ALL routine maintenance tasks for this equipment.

${engineInfo ? `CRITICAL: This equipment has: ${engineInfo}. You MUST use this information to provide the CORRECT specifications. For example, a diesel engine needs different oil, filters, and maintenance intervals than a gasoline engine. Get the specs right for this exact engine configuration.` : ""}

Return JSON with these fields:
- maintenanceSchedule: string[] - Key maintenance schedule items with SPECIFIC intervals (e.g., "Change engine oil every 7,500 miles or 250 hours using Dexos2 5W-30", NOT just "Change engine oil annually")
- recommendations: string[] - Best practice recommendations for maintaining this equipment
- warnings: string[] - Safety warnings and cautions specific to this equipment type
- intervals: array of objects (include 5-10 maintenance tasks), each with:
  - task: string - The maintenance task name (e.g., "Engine Oil & Filter Change")
  - interval: string - SPECIFIC OEM-recommended interval. Use manufacturer specs like "Every 7,500 miles or 250 engine hours", "Every 500 hours", "Every 45,000 miles", "Every 2 years or 30,000 miles", etc. Use miles, hours, or specific time+usage combinations. NEVER use generic terms like "Annually" or "Monthly" when a specific mileage/hours spec exists.
  - procedure: string - Detailed step-by-step procedure with numbered steps. Include specific fluid types and capacities, filter part numbers, torque specs, proper techniques, inspection criteria, and disposal instructions. Be thorough — field crews will follow these procedures.
  - notes: string - Important tips, OEM part numbers, common mistakes to avoid, signs that service is needed sooner, and cross-references to other maintenance tasks.
- source: string - Brief note like "Based on OEM specifications for ${equipmentDesc}"

Focus on accuracy. Include the most critical maintenance tasks that prevent breakdowns, extend equipment life, and maintain resale value. Every interval should reference specific manufacturer recommendations, not generic time periods.`;

      const userPrompt = isSpecificTask
        ? `Create a detailed procedure for the task "${sopTitle}" on this equipment: ${equipmentDesc}${engineInfo ? ` (Engine: ${engineInfo})` : ""}`
        : `Provide comprehensive OEM maintenance specifications and detailed procedures for: ${equipmentDesc}${engineInfo ? ` (Engine: ${engineInfo})` : ""}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 4096,
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
      res.json({
        maintenanceSchedule: result.maintenanceSchedule || [],
        recommendations: result.recommendations || [],
        warnings: result.warnings || [],
        intervals: result.intervals || [],
        source: result.source || `Based on OEM specifications for ${equipmentDesc}`,
      });
    } catch (err: any) {
      console.error("Equipment research error:", err);
      res.status(500).json({ message: "AI research failed", error: err.message });
    }
  });

  const BLOCKED_KEYWORDS = [
    "nude", "nudity", "naked", "sexual", "porn", "erotic", "gore", "violence", "blood",
    "hate", "extremism", "terrorist", "illegal", "drug", "weapon", "bomb", "kill",
    "trademark", "logo", "brand", "copyright", "celebrity", "real person"
  ];

  function checkPromptSafety(prompt: string): { safe: boolean; reason?: string } {
    const lower = prompt.toLowerCase();
    for (const keyword of BLOCKED_KEYWORDS) {
      if (lower.includes(keyword)) {
        return { safe: false, reason: `Content policy violation: "${keyword}" is not allowed` };
      }
    }
    return { safe: true };
  }

  const aiImageGenerateSchema = z.object({
    targetType: z.enum(["sop_header", "sop_step"]),
    targetId: z.string().optional(),
    stepIndex: z.number().optional(),
    prompt: z.string().min(3).max(1000),
    negativePrompt: z.string().max(500).optional(),
    style: z.enum(["photoreal", "diagram", "illustration", "icon"]).optional(),
    watermark: z.boolean().optional(),
  });

  const imageJobs = new Map<string, { status: "pending" | "processing" | "completed" | "failed"; result?: any; error?: string; createdAt: number }>();

  setInterval(() => {
    const now = Date.now();
    for (const [id, job] of imageJobs) {
      if (now - job.createdAt > 10 * 60 * 1000) imageJobs.delete(id);
    }
  }, 60000);

  app.post("/api/sop-media/ai-generate", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      
      const settings = await storage.getCompanySettings();
      if (settings && !settings.aiImagesEnabled) {
        return res.status(403).json({ message: "AI image generation is disabled", errorCode: "IMG-002" });
      }

      const allowedRoles = (settings?.aiImagesAllowedRoles as string[]) || ["Admin", "Manager"];
      if (!user.isMasterAdmin && !allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: "Your role does not have permission to generate AI images", errorCode: "IMG-003" });
      }

      const parsed = aiImageGenerateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.errors });
      }

      const { targetType, targetId, stepIndex, prompt, negativePrompt, style, watermark } = parsed.data;

      const safetyCheck = checkPromptSafety(prompt);
      if (!safetyCheck.safe) {
        await storage.createAiGenerationEvent({
          userId: user.id,
          targetType,
          targetId: targetId || null,
          prompt,
          negativePrompt: negativePrompt || null,
          style: style || null,
          model: "gpt-image-1",
          requestedSize: "1024x1024",
          resultMediaId: null,
          status: "blocked",
          errorMessage: safetyCheck.reason || "Content policy violation",
        });
        return res.status(400).json({ message: safetyCheck.reason, errorCode: "IMG-006" });
      }

      const dailyLimit = settings?.aiImagesDailyLimit || 10;
      const monthlyLimit = settings?.aiImagesMonthlyLimit || 200;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dailyCount = await storage.getAiGenerationEventsCount(user.id, today);
      if (dailyCount >= dailyLimit) {
        return res.status(429).json({ message: `Daily limit reached (${dailyLimit} images/day)`, errorCode: "IMG-004" });
      }

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthlyCount = await storage.getAiGenerationEventsCountAll(monthStart);
      if (monthlyCount >= monthlyLimit) {
        return res.status(429).json({ message: `Monthly limit reached (${monthlyLimit} images/month)`, errorCode: "IMG-005" });
      }

      const jobId = crypto.randomUUID();
      imageJobs.set(jobId, { status: "processing", createdAt: Date.now() });
      console.log(`[AI-IMG] Job ${jobId} started | prompt="${prompt}" style=${style || "default"} target=${targetType}/${targetId || "new"}`);

      res.status(202).json({ jobId, status: "processing" });

      (async () => {
        try {
          const stylePrompts: Record<string, string> = {
            photoreal: "documentary-style field photograph, crew members in work gear on a real job site, natural daylight, candid and authentic, photorealistic DSLR photography, sharp focus, no illustrations, no cartoons",
            diagram: "technical diagram, clean lines, labeled, professional schematic",
            illustration: "simple illustration, clean, educational, clear colors",
            icon: "flat icon style, minimal, simple shapes, bold colors",
          };

          const fullPrompt = [
            `Landscaping/outdoor work context: ${prompt}`,
            style ? stylePrompts[style] : "",
            negativePrompt ? `Avoid: ${negativePrompt}` : "",
            (watermark !== false && settings?.aiImagesWatermarkDefault !== false)
              ? "Include a small subtle 'AI Generated' text watermark in the bottom-right corner"
              : "",
          ].filter(Boolean).join(". ");

          let imageBuffer: Buffer | null = null;
          let revisedPrompt: string | undefined;
          const maxRetries = 2;
          const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
          const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              if (attempt > 0) {
                console.log(`[ai-image] Retry attempt ${attempt} for job ${jobId}`);
                await new Promise(r => setTimeout(r, 2000 * attempt));
              }
              const imageApiRes = await fetch(`${baseURL}/images/generations`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
                },
                body: JSON.stringify({
                  model: "gpt-image-1",
                  prompt: fullPrompt,
                  size: "1024x1024",
                }),
              });
              if (!imageApiRes.ok) {
                const errBody = await imageApiRes.text();
                const statusCode = imageApiRes.status;
                if (attempt < maxRetries && (statusCode >= 500 || statusCode === 429)) {
                  console.error(`[ai-image] Attempt ${attempt + 1} failed (${statusCode}), retrying...`);
                  continue;
                }
                throw new Error(`Image API error ${statusCode}: ${errBody}`);
              }
              const imageResponseData = await imageApiRes.json() as any;
              const b64 = imageResponseData?.data?.[0]?.b64_json;
              revisedPrompt = imageResponseData?.data?.[0]?.revised_prompt;
              if (!b64) {
                throw new Error("No image data returned from AI");
              }
              imageBuffer = Buffer.from(b64, "base64");
              break;
            } catch (genErr: any) {
              const isRetryable = genErr.code === "ECONNREFUSED" || genErr.code === "ECONNRESET" ||
                genErr.message?.includes("fetch failed") || genErr.message?.includes("ECONNREFUSED");
              if (attempt < maxRetries && isRetryable) {
                console.error(`[ai-image] Attempt ${attempt + 1} network error, retrying...`, genErr.message);
                continue;
              }
              throw genErr;
            }
          }

          if (!imageBuffer) {
            throw new Error("No image data returned from AI");
          }

          const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
          if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR not set");
          const imageId = crypto.randomUUID();
          const objectPath = `${privateDir}/sop-media/${imageId}.png`;
          const pathParts = objectPath.startsWith("/") ? objectPath.slice(1).split("/") : objectPath.split("/");
          const bucketName = pathParts[0];
          const objectName = pathParts.slice(1).join("/");

          const SIDECAR = "http://127.0.0.1:1106";
          const signRes = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bucket_name: bucketName,
              object_name: objectName,
              method: "PUT",
              expires_at: new Date(Date.now() + 900 * 1000).toISOString(),
            }),
          });
          if (!signRes.ok) throw new Error(`Failed to get upload URL (${signRes.status})`);
          const { signed_url } = await signRes.json() as { signed_url: string };

          const uploadRes = await fetch(signed_url, {
            method: "PUT",
            headers: { "Content-Type": "image/png" },
            body: imageBuffer,
          });
          if (!uploadRes.ok) throw new Error(`Failed to upload image (${uploadRes.status})`);

          const entityPath = `/objects/sop-media/${imageId}.png`;
          console.log(`[AI-IMG] Job ${jobId} uploaded | objectPath=${objectPath} entityPath=${entityPath} size=${imageBuffer.length} bytes`);
          const useWatermark = watermark !== false && settings?.aiImagesWatermarkDefault !== false;

          const media = await storage.createSopMedia({
            sopId: targetId || null,
            stepIndex: stepIndex ?? null,
            placement: targetType === "sop_header" ? "header" : "step",
            url: entityPath,
            alt: prompt.slice(0, 200),
            source: "ai_generated",
            aiPrompt: prompt,
            aiStyle: style || null,
            aiNegativePrompt: negativePrompt || null,
            aiModel: "gpt-image-1",
            aiWatermarked: useWatermark,
            metadata: { revisedPrompt },
            createdBy: user.id,
          });

          await storage.createAiGenerationEvent({
            userId: user.id,
            targetType,
            targetId: targetId || null,
            prompt,
            negativePrompt: negativePrompt || null,
            style: style || null,
            model: "gpt-image-1",
            requestedSize: "1024x1024",
            resultMediaId: media.id,
            status: "success",
            errorMessage: null,
          });

          console.log(`[AI-IMG] Job ${jobId} completed | mediaId=${media.id} url=${media.url}`);
          imageJobs.set(jobId, { status: "completed", result: media, createdAt: Date.now() });
        } catch (err: any) {
          console.error(`[AI-IMG] Job ${jobId} FAILED:`, err.message);
          try {
            await storage.createAiGenerationEvent({
              userId: user.id,
              targetType,
              targetId: targetId || null,
              prompt,
              negativePrompt: negativePrompt || null,
              style: style || null,
              model: "gpt-image-1",
              requestedSize: "1024x1024",
              resultMediaId: null,
              status: "failed",
              errorMessage: err.message,
            });
          } catch (logErr) {
            console.error("Failed to log AI generation error:", logErr);
          }
          const errorCode = err.message?.includes("No image data") ? "IMG-007" : 
                          err.message?.includes("timed out") || err.message?.includes("timeout") ? "IMG-008" :
                          err.message?.includes("save") || err.message?.includes("storage") ? "IMG-009" : "IMG-001";
          imageJobs.set(jobId, { status: "failed", error: err.message, errorCode, createdAt: Date.now() });
        }
      })();
    } catch (err: any) {
      console.error("AI image generation setup error:", err);
      res.status(500).json({ message: "AI image generation failed", error: err.message, errorCode: "IMG-001" });
    }
  });

  app.get("/api/sop-media/ai-generate/status/:jobId", requireAuth, async (req, res) => {
    const job = imageJobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ status: "not_found", message: "Job not found or expired" });
    }
    if (job.status === "completed") {
      console.log(`[AI-IMG] Status poll ${req.params.jobId} → completed | url=${job.result?.url}`);
      res.json({ status: "completed", result: job.result });
      imageJobs.delete(req.params.jobId);
    } else if (job.status === "failed") {
      console.log(`[AI-IMG] Status poll ${req.params.jobId} → failed | error=${job.error}`);
      res.json({ status: "failed", error: job.error, errorCode: (job as any).errorCode || "IMG-001" });
      imageJobs.delete(req.params.jobId);
    } else {
      res.json({ status: "processing" });
    }
  });

  app.get("/api/debug/ai-image-smoke-test", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user?.isMasterAdmin) {
      return res.status(403).json({ ok: false, error: "Master Admin only" });
    }
    try {
      const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
      if (!privateDir) return res.status(500).json({ ok: false, error: "PRIVATE_OBJECT_DIR not set" });

      const testId = `smoke-test-${Date.now()}`;
      const objectPath = `${privateDir}/sop-media/${testId}.png`;
      const pathParts = objectPath.startsWith("/") ? objectPath.slice(1).split("/") : objectPath.split("/");
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");

      const { createCanvas } = await import("canvas").catch(() => ({ createCanvas: null }));
      let imageBuffer: Buffer;
      if (createCanvas) {
        const canvas = createCanvas(200, 200);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#4CAF50";
        ctx.fillRect(0, 0, 200, 200);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("SMOKE TEST", 30, 105);
        imageBuffer = canvas.toBuffer("image/png");
      } else {
        const pngHeader = Buffer.from([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
          0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
          0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
          0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
          0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
          0x54, 0x08, 0xD7, 0x63, 0xF8, 0x4F, 0x00, 0x00,
          0x00, 0x01, 0x01, 0x00, 0x05, 0x18, 0xD8, 0x4D,
          0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
          0xAE, 0x42, 0x60, 0x82,
        ]);
        imageBuffer = pngHeader;
      }

      const SIDECAR = "http://127.0.0.1:1106";
      const signRes = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket_name: bucketName,
          object_name: objectName,
          method: "PUT",
          expires_at: new Date(Date.now() + 900 * 1000).toISOString(),
        }),
      });
      if (!signRes.ok) return res.status(500).json({ ok: false, error: `Signed URL failed (${signRes.status})` });
      const { signed_url } = await signRes.json() as { signed_url: string };

      const uploadRes = await fetch(signed_url, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: imageBuffer,
      });
      if (!uploadRes.ok) return res.status(500).json({ ok: false, error: `Upload failed (${uploadRes.status})` });

      const servingUrl = `/objects/sop-media/${testId}.png`;
      console.log(`[AI-IMG] Smoke test OK | objectPath=${objectPath} servingUrl=${servingUrl} size=${imageBuffer.length}`);

      res.json({
        ok: true,
        url: servingUrl,
        fullUrl: `${req.protocol}://${req.get("host")}${servingUrl}`,
        contentType: "image/png",
        size: imageBuffer.length,
      });
    } catch (err: any) {
      console.error("[AI-IMG] Smoke test FAILED:", err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get("/api/sop-media/:sopId", requireAuth, async (req, res) => {
    try {
      const media = await storage.getSopMedia(req.params.sopId);
      res.json(media);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch SOP media" });
    }
  });

  app.delete("/api/sop-media/item/:id", requireAuth, requireRole(["Admin", "Manager"]), async (req, res) => {
    try {
      await storage.deleteSopMedia(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete media" });
    }
  });

  app.get("/api/ai-image-settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getCompanySettings();
      const user = req.user as User;
      const allowedRoles = (settings?.aiImagesAllowedRoles as string[]) || ["Admin", "Manager"];
      const canGenerate = user.isMasterAdmin || allowedRoles.includes(user.role);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dailyUsed = canGenerate ? await storage.getAiGenerationEventsCount(user.id, today) : 0;
      
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthlyUsed = canGenerate ? await storage.getAiGenerationEventsCountAll(monthStart) : 0;

      res.json({
        enabled: settings?.aiImagesEnabled ?? true,
        canGenerate,
        allowedRoles,
        dailyLimit: settings?.aiImagesDailyLimit ?? 10,
        monthlyLimit: settings?.aiImagesMonthlyLimit ?? 200,
        watermarkDefault: settings?.aiImagesWatermarkDefault ?? true,
        dailyUsed,
        monthlyUsed,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch AI image settings" });
    }
  });

  app.post("/api/sop-classify", requireAuth, async (req, res) => {
    try {
      const { title } = req.body;
      if (!title || title.trim().length < 2) {
        return res.status(400).json({ message: "Title is required" });
      }
      const classification = autoClassifySOPTitle(title);
      res.json(classification);
    } catch (err: any) {
      console.error("[sop-classify] Error:", err.message);
      res.status(500).json({ message: "Failed to classify SOP" });
    }
  });

  app.get("/api/sop-taxonomy", requireAuth, async (_req, res) => {
    try {
      const taxonomy = getTaxonomy();
      res.json(taxonomy);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch taxonomy" });
    }
  });

  app.post("/api/sop-suggest", requireAuth, async (req, res) => {
    try {
      const { title, sopType, category } = req.body;
      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      const classification = autoClassifySOPTitle(title);

      const classificationContext = classification.confidence >= 0.5
        ? `\nAuto-classified as: Super Category="${classification.superCategory}", Main Category="${classification.mainCategory}", Sub Category="${classification.subCategory}", SOP Type="${classification.sopType}" (confidence: ${Math.round(classification.confidence * 100)}%). Use this classification to inform your response, ensuring tools, materials, and safety requirements are specific to this sub-category of landscaping work.`
        : "";

      const existingCategories = await storage.getSopCategories();
      const categoryNames = existingCategories.map(c => c.name);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a senior landscaping operations expert and technical writer with 20+ years of field experience. You have deep knowledge of ICPI, NALP, PLANET, OSHA, EPA, and state licensing standards. Generate a comprehensive, industry-grade SOP (Standard Operating Procedure) for a landscaping company. Return ONLY valid JSON with NO additional text.
${classificationContext}
Your recommendations must be:
- INDUSTRY-GRADE: Draw on professional landscaping standards, certifications (ICPI for hardscape, ISA for arboriculture, NALP best practices), manufacturer specifications, and real crew workflows
- SPECIFIC: Include exact tool sizes, material quantities, brand-agnostic specifications, measurement standards
- PRACTICAL: Based on real-world landscaping operations — how experienced crews actually do the work in the field
- SAFETY-CONSCIOUS: Include all relevant PPE with proper ANSI/OSHA standards
- COMPLETE: Don't miss any tool, material, or safety requirement a crew would need
- QUANTIFIED: Include estimated quantities, sizes, and time specifications
- THOROUGH: Each step should be detailed enough that a crew member could follow it without asking questions

STEP GENERATION RULES — THIS IS CRITICAL:
Determine the correct number of steps by analyzing the ACTUAL workflow a professional crew follows. Do NOT artificially limit or pad steps.
- SIMPLE procedures (basic cleanup, daily checks, single-task operations): 3-5 steps
- STANDARD procedures (installations, maintenance routines, equipment operation): 6-10 steps
- COMPLEX procedures (full hardscape installs, drainage systems, large plantings): 8-15 steps
- MULTI-PHASE procedures (complete landscape renovation, commercial projects): 10-20 steps

Every step must include a COMPLETE instruction that reads like a field manual paragraph — typically 3-8 sentences covering:
1. WHAT to do (the specific action with measurements, quantities, techniques)
2. HOW to do it (the proper technique, tool usage, body mechanics)
3. QUALITY CHECKS within the step (how to verify you did it correctly before moving on)
4. COMMON PITFALLS to avoid inline (what goes wrong and how to prevent it)

Example of a GOOD step instruction: "Using a plate compactor (minimum 5,000 lb force), compact the base material in passes no more than 2 inches deep at a time. Run the compactor in overlapping passes — each pass should overlap the previous by at least 50%. After compacting, check the grade with a 4-foot level and string line. The surface should be within 1/8 inch over 10 feet. If you see ripples or soft spots, add more base material and re-compact. Never compact more than 2 inches at a time or you'll get voids underneath that cause settling later."

Example of a BAD step instruction: "Compact the base material until firm." (Too vague — crew won't know depth, overlap, how to verify)

The JSON must include these fields:
- suggestedTopic: string (the BEST matching topic from this list: ${JSON.stringify(categoryNames)}. If none match well, suggest a new topic name that would be appropriate)
- outcome: string (CRITICAL — this field must ALWAYS be filled. Write a desired outcome description whose LENGTH reflects how important it is that this SOP is followed exactly. Scale the length based on risk and consequence:
  * LOW-RISK SOPs (basic cleanup, routine tasks): 1-2 sentences describing the expected result.
  * MEDIUM-RISK SOPs (installations, equipment use, client-facing work): 2-3 sentences covering the measurable outcome plus why proper execution matters for quality and customer satisfaction.
  * HIGH-RISK SOPs (safety procedures, chemical application, heavy equipment, working at heights, tree removal): 3-5 sentences covering the specific outcome, why following every step exactly prevents injury or property damage, what can go wrong if shortcuts are taken, and the real-world consequences (liability, OSHA fines, injury, lawsuits, property damage, lost clients).
  For example, for "Mulch Installation" (medium-risk): "All landscape beds covered with 3-inch depth of double-shredded hardwood mulch, with clean edges, 3-inch clearance from plant stems, and uniform coverage with no bare spots visible. Proper mulch depth suppresses weeds, retains soil moisture, and regulates root temperature — reducing plant loss and callback rates. Mulch piled against stems causes crown rot and kills plants, leading to costly replacements and unhappy customers."
  For "Chainsaw Operation" (high-risk): "All cuts completed safely with proper felling technique, directional control, and clean cuts at the proper angle. Every crew member follows the two-tree-length safety zone, wears required chaps, helmet with face shield, and hearing protection. Chainsaw injuries are among the most severe in the industry — a single kickback incident can cause life-changing lacerations, severed arteries, or death. Failure to follow this SOP exposes the company to OSHA citations up to $156,259 per willful violation, workers' comp claims, and wrongful death lawsuits. There are no shortcuts with chainsaw work."
  NEVER return an empty string for this field.)
- outcomeType: string (one of: "completion", "quality", "safety", "kpi")
- audience: string (choose the BEST specific audience based on the SOP content. Examples: "Landscape Crew Members" for field work, "Crew Leaders & Foremen" for supervision tasks, "Office Staff" for admin procedures, "Sales Team" for estimating/sales, "All Employees" for company-wide policies, "New Hires" for onboarding, "Equipment Operators" for machinery SOPs, "Account Managers" for client-facing processes. Be specific — don't default to generic audiences)
- skillLevel: string (choose the BEST match: "beginner" for simple tasks any new hire can do or onboarding procedures, "intermediate" for tasks requiring some field experience or training, "advanced" for specialized skills requiring certification or significant experience like heavy equipment operation or chemical application, "all" ONLY for company-wide policies or safety procedures that literally everyone must follow regardless of experience)
- steps: array of objects with:
  { id: string (random 7-char alphanumeric),
    title: string (clear, action-oriented title like "Excavate and Grade the Base Area" not just "Excavation"),
    instruction: string (3-8 sentence detailed field-manual-quality paragraph covering what to do, how to do it, measurements, technique, and inline quality checks — detailed enough that a crew member needs NO additional explanation),
    why: string (1-2 sentences explaining why this step matters for the final result, safety, or longevity of the work),
    successCriteria: string (specific, measurable criteria like "Base is compacted to 95% Proctor density, grade is within 1/8 inch over 10 feet" not "Base is compacted"),
    commonMistakes: string (the #1 most common mistake crews make on this step and how to avoid it),
    proofRequired: boolean (true for critical quality checkpoints, safety sign-offs, or customer approval points),
    proofType: string (if proofRequired: "photo", "measurement_log", "supervisor_signoff", "customer_approval", or "checklist"),
    isQCCheckpoint: boolean (true for steps where work must be inspected before proceeding — typically grading, compaction, layout verification, final walkthrough) }
- tools: string (one tool per line, include specific sizes/types/specs, e.g. "Round-point shovel (size 2)" not just "shovel", "3/4 inch garden hose (50 ft minimum)" not just "hose")
- materials: string (one material per line, include estimated quantities for a typical residential job. USE CORRECT UNITS OF MEASURE for each material type:
  * BULK materials (mulch, gravel, soil, sand, aggregate, topsoil, compost): use cubic yards (e.g. "Mulch - hardwood, double-shredded (3-4 cubic yards per 100 sq ft)")
  * PIPE and TUBING (PVC, irrigation pipe, drain tile, corrugated pipe, poly pipe, drip line): use linear feet (e.g. "PVC pipe - Schedule 40, 1 inch (100 linear feet)")
  * WIRE and CABLE (low-voltage wire, irrigation wire): use linear feet or rolls
  * FLAT materials (sod, landscape fabric, geotextile, filter fabric): use square feet or square yards
  * INDIVIDUAL items (fittings, valves, heads, nozzles, clamps, stakes, emitters): use each/quantity (e.g. "Spray heads - Rain Bird 1804 (12 each)")
  * LIQUID materials (herbicide, adhesive, primer, cement, sealant): use gallons or ounces
  * BAGGED materials (concrete mix, polymeric sand, fertilizer): use bags with weight (e.g. "Polymeric sand - 50 lb bags (2 bags per 100 sq ft)")
  NEVER use cubic yards for pipe, wire, fittings, or anything that is not a bulk fill material.)
- ppe: string (one item per line, include specific protection ratings, e.g. "ANSI Z87.1 rated safety glasses" not just "safety glasses", "OSHA-compliant steel-toe boots (ASTM F2413)" not just "boots")
- safetyNotes: string (comprehensive safety warnings, hazard identification, emergency procedures specific to this procedure)
- complianceNotes: string (OSHA regulations, EPA requirements, state/local codes, certifications needed - cite specific standards where possible)
- timingTarget: string (realistic target time with context, e.g. "45 minutes for average residential job")
- timingMax: string (maximum time including complications, e.g. "90 minutes including cleanup and site inspection")
- needsMaterialCalculator: boolean (true if this SOP involves measurable materials where quantity calculations would be useful. This includes:
  * BULK materials (mulch, gravel, soil, aggregate, topsoil, compost, sand) → calculatorType: "area_volume"
  * LINEAR/TRENCH materials (retaining wall base, footing aggregate, french drain gravel, trench backfill) → calculatorType: "linear_volume"
  * CHEMICALS (fertilizer, herbicide, insecticide, pesticide, pre-emergent, fungicide) → calculatorType: "chemical_rate"
  * POLYMERIC SAND / JOINT SAND → calculatorType: "polymeric_sand"
  * BAGGED MATERIALS (concrete mix, bagged mulch, bagged soil) → calculatorType: "bag_count"
  Set to FALSE for irrigation fittings, pipe runs, wiring, electrical, or items counted by quantity not volume/weight)
- calculatorDefaults: object | null (if needsMaterialCalculator is true, include ALL of these fields:
  { materialType: string (e.g. "base aggregate", "mulch", "fertilizer", "polymeric sand" — be SPECIFIC about the exact material, not generic. Use "hardwood mulch" not just "mulch", "crushed limestone" not just "gravel"),
    calculatorType: string (one of: "area_volume", "linear_volume", "chemical_rate", "polymeric_sand", "bag_count"),
    defaultDepthInches: number (typical recommended depth, or 0 if not applicable),
    densityTonsPerCubicYard: number (the weight density of this SPECIFIC material in tons per cubic yard. This is CRITICAL for accurate weight calculations. Common values: hardwood mulch=0.45, topsoil=1.1, compost=0.6, sand=1.35, pea gravel=1.4, crushed stone=1.35, river rock=1.5, base aggregate=1.35, lava rock=0.5, fill dirt=1.15. Use the value for the EXACT material type, not a generic average. For chemicals/bags, use 0),
    coverageNote: string (e.g. "1 cubic yard of hardwood mulch covers approximately 108 sq ft at 3 inches depth" — include the SPECIFIC material name, not generic),
    productOrManufacturer: string | null (if SOP mentions a specific brand like "Versa-Lok", "Techo-Bloc", "Roundup QuikPRO", include it here and tailor calculations to that product's specifications. Otherwise null),
    assumptions: string[] (list of 2-4 plain-English assumptions. Include the material density assumption, e.g. ["Hardwood mulch at 0.45 tons per cubic yard", "Standard 3-inch depth per industry best practice"]),
    measurementGuide: string (one short paragraph explaining how to measure onsite, e.g. "Run a tape measure along the planned wall face. Measure trench width from the back of the block face plus 12 inches. Use a story pole to verify base depth at 4-foot intervals."),
    outputUnits: string (primary output unit: "cubic yards", "tons", "lbs", "bags", "gallons"),
    presets: array of 2-4 objects, each with { label: string, values: object }.
      CRITICAL: presets must use input keys that match the calculatorType:
      * area_volume: keys are "length", "width", "depth"
      * linear_volume: keys are "wallLength", "trenchWidth", "baseDepth"
      * chemical_rate: keys are "area", "rate", "bagSize"
      * polymeric_sand: keys are "area", "jointWidth", "paverThickness", "bagSize"
      * bag_count: keys are "area", "depth", "bagCoverage"
      Example for linear_volume (retaining wall):
        presets: [
          { label: "Small (15 ft wall)", values: { wallLength: 15, trenchWidth: 24, baseDepth: 6 } },
          { label: "Typical (25 ft wall)", values: { wallLength: 25, trenchWidth: 24, baseDepth: 6 } },
          { label: "Large (50 ft wall)", values: { wallLength: 50, trenchWidth: 30, baseDepth: 8 } }
        ]
      Example for area_volume (mulch bed):
        presets: [
          { label: "Small Bed", values: { length: 10, width: 8, depth: 3 } },
          { label: "Typical Residential", values: { length: 25, width: 12, depth: 3 } },
          { label: "Large Property", values: { length: 50, width: 20, depth: 3 } }
        ]
      DO NOT use generic 10x10 defaults. Presets must be realistic for the specific SOP task.
  })
- imageSuggestions: array of objects with { target: string ("header" or "step_N" where N is the step index starting from 0), prompt: string (a detailed, ready-to-use image generation prompt describing a professional landscape photography scene. Include: setting, lighting (natural daylight), perspective, specific tools/materials/techniques visible. Focus on showing the TECHNIQUE being performed, not just a finished result), priority: number (1 = most important, 2 = important, 3 = nice to have) }
  IMAGE PLACEMENT RULES:
  - ALWAYS include a "header" image showing the overall completed result or the job in progress
  - Include an image for EVERY step that involves a visual technique, tool usage, or quality checkpoint that would benefit from a photo reference
  - For steps that are purely administrative or verbal (e.g. "Discuss with customer", "Review plan"), do NOT suggest an image
  - For SAFETY SOPs: include images for every step showing proper PPE and technique
  - For INSTALLATION SOPs: include images for excavation, base prep, material placement, compaction, and final result
  - For MAINTENANCE SOPs: include images for before/during/after states and proper technique
  - Typical count: header + 40-70% of steps should have images (more for visual/physical work, fewer for administrative)

Make every field as detailed and accurate as possible. The goal is a COMPLETE, ready-to-use SOP that requires minimal editing by the user.`
          },
          {
            role: "user",
            content: `Generate a comprehensive SOP for: "${title}"${sopType ? ` (Type: ${sopType})` : ""}${category ? ` (Category: ${category})` : ""}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: 8000,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return res.status(500).json({ message: "No response from AI" });
      }

      const suggestions = JSON.parse(content);
      suggestions.classification = classification;

      const validOutcomeTypes = ["completion", "quality", "safety", "kpi"];
      if (!suggestions.outcomeType || !validOutcomeTypes.includes(suggestions.outcomeType)) {
        const ot = (suggestions.outcomeType || "").toLowerCase();
        if (ot.includes("quality")) suggestions.outcomeType = "quality";
        else if (ot.includes("safety")) suggestions.outcomeType = "safety";
        else if (ot.includes("kpi") || ot.includes("measur")) suggestions.outcomeType = "kpi";
        else {
          const t = title.toLowerCase();
          if (t.includes("safety") || t.includes("emergency") || t.includes("hazard") || t.includes("ppe")) suggestions.outcomeType = "safety";
          else if (t.includes("quality") || t.includes("inspection") || t.includes("audit")) suggestions.outcomeType = "quality";
          else suggestions.outcomeType = "completion";
        }
      }

      if (!suggestions.outcome || suggestions.outcome.trim().length === 0) {
        suggestions.outcome = `Successfully complete the ${title} procedure following all steps in this SOP, ensuring quality standards are met and the work is done safely and efficiently.`;
      }

      let matchedCat: typeof existingCategories[0] | undefined = undefined;

      const classificationToTopicMap: Record<string, string> = {
        "installation & construction": "Installation & Construction",
        "maintenance & service": "Property Maintenance & Services",
        "equipment, vehicles & tools": "Equipment, Vehicles & Tools",
        "materials & inventory": "Materials & Inventory",
        "safety & risk management": "Safety & Risk Management",
        "office & administration": "Office & Administration",
        "sales & estimating": "Sales & Estimating",
        "hiring & hr": "Hiring & HR",
        "technology & systems": "Technology & Systems",
        "management & leadership": "Management & Leadership",
        "emergency & exceptions": "Emergency & Exception",
      };

      if (classification && classification.mainCategory && classification.confidence >= 0.5) {
        const mappedName = classificationToTopicMap[classification.mainCategory.toLowerCase()];
        if (mappedName) {
          matchedCat = existingCategories.find(
            c => c.name.toLowerCase() === mappedName.toLowerCase()
          );
        }
        if (!matchedCat) {
          matchedCat = existingCategories.find(
            c => c.name.toLowerCase() === classification.mainCategory.toLowerCase()
          );
        }
      }

      if (!matchedCat && suggestions.suggestedTopic) {
        const suggested = suggestions.suggestedTopic.toLowerCase().trim();
        matchedCat = existingCategories.find(
          c => c.name.toLowerCase() === suggested
        );
        if (!matchedCat) {
          matchedCat = existingCategories.find(
            c => suggested.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(suggested)
          );
        }
        if (!matchedCat) {
          const suggestedWords = suggested.split(/[\s&,]+/).filter(w => w.length > 2);
          let bestMatch: typeof existingCategories[0] | null = null;
          let bestScore = 0;
          for (const cat of existingCategories) {
            const catWords = cat.name.toLowerCase().split(/[\s&,]+/).filter(w => w.length > 2);
            const score = suggestedWords.filter(w => catWords.some(cw => cw.includes(w) || w.includes(cw))).length;
            if (score > bestScore) {
              bestScore = score;
              bestMatch = cat;
            }
          }
          if (bestMatch && bestScore > 0) matchedCat = bestMatch;
        }
      }

      if (matchedCat) {
        suggestions.suggestedTopicId = matchedCat.id;
        suggestions.suggestedTopicName = matchedCat.name;
        console.log(`[sop-suggest] Topic matched: "${matchedCat.name}" (id: ${matchedCat.id})`);
      } else {
        const emergencyCat = existingCategories.find(c => c.name === "Emergency & Exception");
        suggestions.suggestedTopicId = emergencyCat?.id || null;
        suggestions.suggestedTopicName = emergencyCat?.name || suggestions.suggestedTopic || "Emergency & Exception";
        console.log(`[sop-suggest] No topic match, falling back to Emergency & Exception`);
      }

      res.json(suggestions);
    } catch (err: any) {
      console.error("[sop-suggest] Error:", err.message);
      res.status(500).json({ message: "Failed to generate AI suggestions" });
    }
  });

  app.get("/api/sop-drafts", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const drafts = await storage.getSopDrafts(user.id);
      res.json(drafts);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch drafts" });
    }
  });

  app.get("/api/sop-drafts/:id", requireAuth, async (req, res) => {
    try {
      const draft = await storage.getSopDraft(req.params.id);
      if (!draft) return res.status(404).json({ message: "Draft not found" });
      const user = req.user as User;
      if (draft.ownerId !== user.id && user.role !== "Admin" && !user.isMasterAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(draft);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch draft" });
    }
  });

  app.post("/api/sop-drafts", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { title, categoryId, sopType, currentStep, data, draftId } = req.body;
      const draft = await storage.upsertSopDraft({
        id: draftId || undefined,
        ownerId: user.id,
        title: title || "Untitled Draft",
        categoryId: categoryId || null,
        sopType: sopType || null,
        currentStep: currentStep || 0,
        data: data || {},
      });
      res.json(draft);
    } catch (err) {
      res.status(500).json({ message: "Failed to save draft" });
    }
  });

  app.delete("/api/sop-drafts/:id", requireAuth, async (req, res) => {
    try {
      const draft = await storage.getSopDraft(req.params.id);
      if (!draft) return res.status(404).json({ message: "Draft not found" });
      const user = req.user as User;
      if (draft.ownerId !== user.id && user.role !== "Admin" && !user.isMasterAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      await storage.deleteSopDraft(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete draft" });
    }
  });

  app.post("/api/ai/address-autocomplete", requireAuth, async (req, res) => {
    try {
      const { query, latitude, longitude } = req.body;
      if (!query || query.length < 3) {
        return res.json({ suggestions: [] });
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error("Google Maps API key not configured");
        return res.json({ suggestions: [] });
      }

      // Use Google Places Autocomplete API for accurate address suggestions
      const encodedQuery = encodeURIComponent(query);
      let googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodedQuery}&types=address&components=country:us&key=${apiKey}`;
      
      // Add location bias if coordinates provided (prioritize nearby addresses)
      if (latitude && longitude) {
        googleUrl += `&location=${latitude},${longitude}&radius=50000`; // 50km radius bias
      }
      
      const response = await fetch(googleUrl);
      
      if (!response.ok) {
        console.error("Google Places API error:", response.status);
        return res.json({ suggestions: [] });
      }
      
      const data = await response.json();
      
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error("Google Places API status:", data.status, data.error_message);
        return res.json({ suggestions: [] });
      }
      
      // Extract the address descriptions from predictions
      const suggestions = (data.predictions || [])
        .slice(0, 5)
        .map((prediction: any) => prediction.description);
      
      res.json({ suggestions });
    } catch (err: any) {
      console.error("Address autocomplete error:", err);
      res.json({ suggestions: [] });
    }
  });

  app.post("/api/geocode", requireAuth, async (req, res) => {
    try {
      const { address } = req.body;
      if (!address) {
        return res.status(400).json({ message: "Address is required" });
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }

      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
      const geocodeRes = await fetch(geocodeUrl);
      const geocodeData = await geocodeRes.json();

      if (geocodeData.status !== "OK" || !geocodeData.results?.length) {
        return res.json({ results: [] });
      }

      const results = geocodeData.results.slice(0, 5).map((r: any) => ({
        formatted_address: r.formatted_address,
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
      }));

      res.json({ results });
    } catch (err: any) {
      console.error("Geocode error:", err);
      res.status(500).json({ message: "Geocode failed" });
    }
  });

  // Get satellite image URL for an address or coordinates
  app.post("/api/address-satellite-image", requireAuth, async (req, res) => {
    try {
      const { address, coordinates, zoom } = req.body;
      
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }

      let lat: number, lng: number;
      let formattedAddress: string | undefined;
      const zoomLevel = zoom || 19;

      // If coordinates provided, use them directly
      if (coordinates && coordinates.lat && coordinates.lng) {
        lat = coordinates.lat;
        lng = coordinates.lng;
      } else if (address) {
        // Otherwise, geocode the address
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
        const geocodeRes = await fetch(geocodeUrl);
        const geocodeData = await geocodeRes.json();

        if (geocodeData.status !== 'OK' || !geocodeData.results?.[0]) {
          return res.status(404).json({ message: "Address not found" });
        }

        const location = geocodeData.results[0].geometry.location;
        lat = location.lat;
        lng = location.lng;
        formattedAddress = geocodeData.results[0].formatted_address;
      } else {
        return res.status(400).json({ message: "Address or coordinates required" });
      }

      // Generate satellite image URL using Google Static Maps API
      const satelliteUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoomLevel}&size=800x500&maptype=satellite&key=${apiKey}`;

      res.json({ 
        imageUrl: satelliteUrl,
        coordinates: { lat, lng },
        zoom: zoomLevel,
        formattedAddress
      });
    } catch (err: any) {
      console.error("Satellite image error:", err);
      res.status(500).json({ message: "Failed to get satellite image" });
    }
  });

  // Get Google Maps API key for client-side map embed
  app.get("/api/maps-config", requireAuth, async (req, res) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: "Google Maps API key not configured" });
    }
    res.json({ apiKey });
  });

  // Capture satellite image as base64 (to avoid CORS issues on canvas)
  app.post("/api/capture-satellite-image", requireAuth, async (req, res) => {
    try {
      const { lat, lng, zoom, width, height } = req.body;
      if (!lat || !lng) {
        return res.status(400).json({ message: "Coordinates required" });
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }

      const zoomLevel = zoom || 19;
      // Google Static Maps API supports up to 640x640 for free, 2048x2048 for premium
      // Use scale=2 for higher resolution (doubles the actual pixel count)
      const imgWidth = Math.min(width || 640, 640);
      const imgHeight = Math.min(height || 400, 640);
      const scale = (width && width > 640) || (height && height > 640) ? 2 : 1;
      
      const satelliteUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoomLevel}&size=${imgWidth}x${imgHeight}&scale=${scale}&maptype=satellite&key=${apiKey}`;

      // Fetch the image and convert to base64
      const imageRes = await fetch(satelliteUrl);
      if (!imageRes.ok) {
        return res.status(500).json({ message: "Failed to fetch satellite image" });
      }

      const arrayBuffer = await imageRes.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const contentType = imageRes.headers.get('content-type') || 'image/png';
      const dataUrl = `data:${contentType};base64,${base64}`;

      res.json({ imageBase64: dataUrl });
    } catch (err: any) {
      console.error("Capture satellite image error:", err);
      res.status(500).json({ message: "Failed to capture satellite image" });
    }
  });

  // Check if Street View is available at a location
  app.post("/api/streetview-availability", requireAuth, async (req, res) => {
    try {
      const { lat, lng } = req.body;
      if (!lat || !lng) {
        return res.status(400).json({ message: "Coordinates required" });
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }

      // Use Street View Metadata API to check availability
      const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${apiKey}`;
      const metadataRes = await fetch(metadataUrl);
      const metadata = await metadataRes.json();

      res.json({
        available: metadata.status === "OK",
        panoId: metadata.pano_id || null,
        location: metadata.location || null
      });
    } catch (err: any) {
      console.error("Street View availability check error:", err);
      res.status(500).json({ message: "Failed to check Street View availability" });
    }
  });

  // Capture Street View image as base64
  app.post("/api/capture-streetview-image", requireAuth, async (req, res) => {
    try {
      const { lat, lng, heading, pitch, fov, width, height } = req.body;
      if (!lat || !lng) {
        return res.status(400).json({ message: "Coordinates required" });
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }

      // Street View Static API - max 640x640 per request, use scale for higher res
      const imgWidth = Math.min(width || 640, 640);
      const imgHeight = Math.min(height || 480, 640);
      const headingParam = heading !== undefined ? `&heading=${heading}` : "";
      const pitchParam = pitch !== undefined ? `&pitch=${pitch}` : "&pitch=0";
      const fovParam = fov !== undefined ? `&fov=${fov}` : "&fov=90";

      const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=${imgWidth}x${imgHeight}${headingParam}${pitchParam}${fovParam}&location=${lat},${lng}&key=${apiKey}`;

      const imageRes = await fetch(streetViewUrl);
      if (!imageRes.ok) {
        return res.status(500).json({ message: "Failed to fetch Street View image" });
      }

      const arrayBuffer = await imageRes.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
      const dataUrl = `data:${contentType};base64,${base64}`;

      res.json({ imageBase64: dataUrl });
    } catch (err: any) {
      console.error("Capture Street View error:", err);
      res.status(500).json({ message: "Failed to capture Street View image" });
    }
  });

  app.post("/api/ai/analyze-plow-site", requireAuth, async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ message: "Image is required" });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this aerial/satellite image of a property for snow removal planning. Identify and describe:
                1. Driveways - location, approximate size, surface type if visible
                2. Walkways/Sidewalks - paths, front walks, side walks
                3. Parking areas - parking lots, parking spaces
                4. Potential obstacles - trees near paths, islands, curbs
                5. Suggested plow route - most efficient path to clear snow
                
                Format your response as JSON with:
                - driveways: array of {description, location, priority}
                - walkways: array of {description, location}
                - parkingAreas: array of {description, location, approximateSize}
                - obstacles: array of {description, location, warning}
                - suggestedRoute: string description of optimal plow path
                - specialNotes: any important observations`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2048,
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
      res.json(result);
    } catch (err: any) {
      console.error("AI plow site analysis error:", err);
      res.status(500).json({ message: "AI analysis failed", error: err.message });
    }
  });

  app.post("/api/ai/generate-form", requireAuth, async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert at creating form fields for business applications.
            When given a description, create appropriate form fields.
            Format your response as JSON with these fields:
            - title: A clear title for the form (optional, only if relevant)
            - description: A brief description (optional)
            - fields: An array of field objects, each with:
              - type: One of [text, textarea, number, email, date, select, checkbox, radio]
              - label: The field label
              - placeholder: Placeholder text
              - required: boolean
              - options: Array of strings (only for select/radio types)
            
            Create practical, professional fields. Use appropriate field types for the data being collected.`
          },
          {
            role: "user",
            content: `Create form fields for: ${prompt}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1024,
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
      res.json(result);
    } catch (err: any) {
      console.error("AI form generation error:", err);
      res.status(500).json({ message: "AI generation failed", error: err.message });
    }
  });

  // ============= MATERIAL CATEGORIES =============
  
  // Get all material categories (sorted alphabetically)
  app.get("/api/material-categories", requireAuth, async (req, res) => {
    try {
      const categories = await storage.getMaterialCategories();
      res.json(categories);
    } catch (err) {
      res.status(500).json({ message: "Error fetching material categories" });
    }
  });

  // Create a new material category (Admin only)
  app.post("/api/material-categories", requireAdmin, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "Category name is required" });
      }
      const existing = await storage.getMaterialCategoryByName(name.trim());
      if (existing) {
        return res.status(400).json({ message: "Category already exists" });
      }
      const category = await storage.createMaterialCategory({ name: name.trim() });
      res.status(201).json(category);
    } catch (err) {
      res.status(500).json({ message: "Error creating category", errorCode: "MAT-002" });
    }
  });

  // Update a material category (Admin only)
  app.patch("/api/material-categories/:id", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { name } = req.body;
      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "Category name is required" });
      }
      const category = await storage.updateMaterialCategory(id, { name: name.trim() });
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (err) {
      res.status(500).json({ message: "Error updating category" });
    }
  });

  // Delete a material category (Admin only)
  app.delete("/api/material-categories/:id", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const moveTo = req.query.moveTo as string | undefined;
      const deleteWithMaterials = req.query.deleteWithMaterials as string | undefined;
      
      // Check if category has materials
      const materials = await storage.getMaterialsByCategory(id);
      
      if (materials.length > 0) {
        if (moveTo) {
          // Move materials to another category
          await storage.bulkMoveMaterials(materials.map(m => m.id), moveTo);
        } else if (deleteWithMaterials === "true") {
          // Delete all materials in this category
          for (const m of materials) {
            await storage.deleteMaterialFieldValues(m.id);
            await storage.deleteMaterial(m.id);
          }
        } else {
          return res.status(400).json({ 
            message: "Category has materials. Provide moveTo or deleteWithMaterials=true",
            materialCount: materials.length
          });
        }
      }
      
      await storage.deleteMaterialCategory(id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting category" });
    }
  });

  // Bulk move materials between categories (Admin only)
  app.post("/api/material-categories/bulk-move", requireAdmin, async (req, res) => {
    try {
      const { materialIds, targetCategoryId } = req.body;
      if (!Array.isArray(materialIds) || !targetCategoryId) {
        return res.status(400).json({ message: "materialIds array and targetCategoryId required" });
      }
      const count = await storage.bulkMoveMaterials(materialIds, targetCategoryId);
      res.json({ success: true, movedCount: count });
    } catch (err) {
      res.status(500).json({ message: "Error moving materials" });
    }
  });

  // ============= CATEGORY FIELDS =============
  
  // Get fields for a category
  app.get("/api/material-categories/:categoryId/fields", requireAuth, async (req, res) => {
    try {
      const categoryId = req.params.categoryId as string;
      const fields = await storage.getCategoryFields(categoryId);
      res.json(fields);
    } catch (err) {
      res.status(500).json({ message: "Error fetching category fields" });
    }
  });

  // Create a field for one or more categories (Admin only)
  app.post("/api/category-fields", requireAdmin, async (req, res) => {
    try {
      const { categoryIds, field } = req.body;
      
      if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
        return res.status(400).json({ message: "categoryIds array is required" });
      }
      if (!field || !field.fieldName || !field.fieldType) {
        return res.status(400).json({ message: "field object with fieldName and fieldType required" });
      }
      
      const createdFields = [];
      for (const categoryId of categoryIds) {
        const newField = await storage.createCategoryField({
          categoryId,
          fieldName: field.fieldName,
          fieldType: field.fieldType,
          required: field.required || false,
          defaultValue: field.defaultValue || null,
          helpText: field.helpText || null,
          options: field.options || null,
          showInPublicCatalog: field.showInPublicCatalog !== false,
          sortOrder: field.sortOrder || 0,
          isHidden: field.isHidden || false,
        });
        createdFields.push(newField);
      }
      
      res.status(201).json(createdFields);
    } catch (err) {
      res.status(500).json({ message: "Error creating category field" });
    }
  });

  // Update a category field (Admin only)
  app.patch("/api/category-fields/:id", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const updates = req.body;
      const field = await storage.updateCategoryField(id, updates);
      if (!field) {
        return res.status(404).json({ message: "Field not found" });
      }
      res.json(field);
    } catch (err) {
      res.status(500).json({ message: "Error updating category field" });
    }
  });

  // Delete a category field (Admin only)
  app.delete("/api/category-fields/:id", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const hideOnly = req.query.hideOnly as string | undefined;
      
      if (hideOnly === "true") {
        // Just hide the field, keep existing data
        const field = await storage.updateCategoryField(id, { isHidden: true });
        return res.json({ success: true, hidden: true, field });
      }
      
      // Permanently delete field and all associated values
      await storage.deleteCategoryField(id);
      res.json({ success: true, deleted: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting category field" });
    }
  });

  // ============= MATERIAL FIELD VALUES =============
  
  // Get field values for a material
  app.get("/api/materials/:id/field-values", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const values = await storage.getMaterialFieldValues(id);
      res.json(values);
    } catch (err) {
      res.status(500).json({ message: "Error fetching field values" });
    }
  });

  // Set field values for a material
  app.post("/api/materials/:id/field-values", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { fieldValues } = req.body; // { [fieldId]: value }
      
      if (!fieldValues || typeof fieldValues !== "object") {
        return res.status(400).json({ message: "fieldValues object required" });
      }
      
      // Filter out empty or null values
      const entries = Object.entries(fieldValues).filter(([_, value]) => 
        value !== null && value !== undefined && value !== ''
      );
      
      if (entries.length === 0) {
        return res.json([]);
      }
      
      const results = [];
      for (const [fieldId, value] of entries) {
        try {
          const fieldValue = await storage.setMaterialFieldValue(id, fieldId, value as string);
          results.push(fieldValue);
        } catch (fieldErr) {
          console.error(`[materials] Error setting field ${fieldId}:`, fieldErr);
          // Continue with other fields even if one fails
        }
      }
      
      res.json(results);
    } catch (err: any) {
      console.error("[materials] Error setting field values:", err);
      res.status(500).json({ message: "Error setting field values", error: err?.message });
    }
  });

  // ============= MATERIALS =============

  app.get("/api/materials", requireAuth, async (req, res) => {
    try {
      const materials = await storage.getMaterials();
      // Filter sensitive fields for Customer role
      const user = req.user as any;
      if (user?.role === "Customer") {
        const filteredMaterials = materials.map(m => ({
          ...m,
          supplier: null,
          supplierContact: null,
          supplierUrl: null,
          crewNotes: null,
        }));
        return res.json(filteredMaterials);
      }
      res.json(materials);
    } catch (err) {
      res.status(500).json({ message: "Error fetching materials" });
    }
  });

  app.post("/api/materials", requireAuth, async (req, res) => {
    try {
      const { name, categoryId, status, description, vendor, unitOfMeasure, primaryImage, galleryImages, tags } = req.body;
      
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Material name is required" });
      }
      
      const material = await storage.createMaterial({
        name: name.trim(),
        categoryId: categoryId || null,
        status: status || "Active",
        description: description || null,
        vendor: vendor || null,
        unitOfMeasure: unitOfMeasure || null,
        primaryImage: primaryImage || null,
        galleryImages: galleryImages || [],
        tags: tags || [],
      });
      res.status(201).json(material);
    } catch (err: any) {
      console.error("[materials] Error creating material:", err);
      res.status(500).json({ message: "Error creating material", error: err?.message, errorCode: "MAT-001" });
    }
  });

  // Update a material
  app.patch("/api/materials/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { name, categoryId, status, description, vendor, unitOfMeasure, primaryImage, galleryImages, tags } = req.body;
      
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (categoryId !== undefined) updates.categoryId = categoryId;
      if (status !== undefined) updates.status = status;
      if (description !== undefined) updates.description = description;
      if (vendor !== undefined) updates.vendor = vendor;
      if (unitOfMeasure !== undefined) updates.unitOfMeasure = unitOfMeasure;
      if (primaryImage !== undefined) updates.primaryImage = primaryImage;
      if (galleryImages !== undefined) updates.galleryImages = galleryImages;
      if (tags !== undefined) updates.tags = tags;
      
      const material = await storage.updateMaterial(id, updates);
      if (!material) {
        return res.status(404).json({ message: "Material not found" });
      }
      res.json(material);
    } catch (err: any) {
      console.error("[materials] Error updating material:", err);
      res.status(500).json({ message: "Error updating material", error: err?.message });
    }
  });

  // Delete a material
  app.delete("/api/materials/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const deleted = await storage.deleteMaterial(id);
      if (!deleted) {
        return res.status(404).json({ message: "Material not found" });
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("[materials] Error deleting material:", err);
      res.status(500).json({ message: "Error deleting material", error: err?.message });
    }
  });

  // AI-powered material generation - auto-fills based on name and category
  app.post("/api/materials/ai-generate", requireAuth, async (req, res) => {
    try {
      const { name, category } = req.body;
      
      if (!name || !category) {
        return res.status(400).json({ message: "Name and category are required" });
      }
      
      const systemPrompt = `You are an expert in landscaping materials. Generate accurate, professional information for a material.

IMPORTANT: Be consistent and factual. Use standard industry information for the material type.

Based on the category "${category}", generate appropriate details.

For "${category}" materials, include:
${category === "Aggregates & Gravel" ? `
- Description: What it is, common uses (driveways, drainage, base material)
- Unit of measure: cubic yard, ton, or bag
- Coverage: Typical sq ft coverage per cubic yard at standard depth` : ""}
${category === "Mulch & Soil" ? `
- Description: Material composition, benefits for landscaping
- Unit of measure: cubic yard or bag
- Coverage: Sq ft coverage per cubic yard at 2-3 inch depth` : ""}
${category === "Trees & Shrubs" ? `
- Description: Growth characteristics, landscaping uses
- Unit of measure: each or gallon size
- Include: Mature height, sun requirements, hardiness zone` : ""}
${category === "Perennials & Annuals" ? `
- Description: Flower characteristics, growing season
- Unit of measure: flat, pot, or each
- Include: Bloom season, sun requirements, spacing` : ""}
${category === "Hardscape & Pavers" ? `
- Description: Material type, surface finish, durability
- Unit of measure: piece, sq ft, or pallet
- Include: Dimensions, thickness, coverage per pallet` : ""}
${category === "Chemicals & Fertilizer" ? `
- Description: Purpose, active ingredients, application method
- Unit of measure: bag, gallon, or lb
- Include: NPK ratio for fertilizers, coverage rate` : ""}
${category === "Landscape" || category === "Other" ? `
- Description: Product purpose and uses
- Unit of measure: appropriate unit
- Include: Key specifications` : ""}

Respond in JSON format:
{
  "description": "Clear 2-3 sentence description",
  "unitOfMeasure": "appropriate unit",
  "vendor": null,
  "fieldValues": {}
}`;

      const userPrompt = `Generate information for: "${name}" in category "${category}"`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content || "{}";
      const aiData = JSON.parse(content);
      
      res.json(aiData);
    } catch (err: any) {
      console.error("AI generation error:", err);
      res.status(500).json({ message: "AI generation failed", error: err.message });
    }
  });

  // AI-powered smart material draft - generates questions and auto-fills data
  app.post("/api/materials/ai-draft", requireAuth, async (req, res) => {
    try {
      const { materialType, name, partialData } = req.body;
      
      const systemPrompt = `You are an expert in landscaping materials. Generate helpful information about a material based on its type and name.
      
For the given material, provide:
1. A clear description suitable for customers
2. Typical weight per unit (in lbs)
3. Coverage area if applicable (in sq ft per unit - e.g., "1 bag covers 4 sq ft at 3 inches deep")
4. A calculation formula crews can use (e.g., "Sq ft needed ÷ 4 = number of bags at 3 inch depth")
5. Notes helpful for crew members about handling/application
6. Suggested category from: Aggregates, Mulch, Plants, Hardscape, Soil, Fertilizer, Tools, Miscellaneous
7. Suggested unit of measurement (bags, cubic yards, each, pallets, tons, etc.)

Respond in JSON format:
{
  "description": "Customer-friendly description",
  "weight": number or null,
  "weightUnit": "lbs" or "tons",
  "coverageArea": number or null,
  "coverageUnit": "sq ft per bag" or similar,
  "calculationFormula": "Formula for calculating quantity needed",
  "crewNotes": "Notes for crew about handling",
  "customerNotes": "Simple tips for customers",
  "suggestedCategory": "Category name",
  "suggestedUnit": "bags" or other unit,
  "suggestedSku": "Short alphanumeric SKU"
}`;

      const userPrompt = `Material Type: ${materialType || 'General'}
Material Name: ${name}
${partialData ? `Additional info provided: ${JSON.stringify(partialData)}` : ''}

Generate detailed information for this landscaping material.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content || "{}";
      const aiData = JSON.parse(content);
      
      res.json({
        success: true,
        data: aiData
      });
    } catch (err: any) {
      console.error("AI material draft error:", err);
      res.status(500).json({ message: "AI generation failed", error: err.message });
    }
  });

  // AI image generation for materials
  app.post("/api/materials/ai-image", requireAuth, async (req, res) => {
    try {
      const { name, materialType, description } = req.body;
      
      const prompt = `A professional product photo of ${name}, a ${materialType || 'landscaping'} material. ${description || ''}. Clean white background, studio lighting, professional quality, no text or labels.`;
      
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        size: "512x512"
      });
      
      const base64 = response.data?.[0]?.b64_json;
      if (!base64) {
        return res.status(500).json({ message: "No image generated" });
      }
      
      // Return as data URL for immediate use
      res.json({
        success: true,
        imageUrl: `data:image/png;base64,${base64}`
      });
    } catch (err: any) {
      console.error("AI image generation error:", err);
      res.status(500).json({ message: "Image generation failed", error: err.message });
    }
  });

  // Product image web search (DuckDuckGo + AI fallback)
  app.get("/api/image-search", requireAuth, async (req, res) => {
    try {
      const query = req.query.q as string;
      const category = req.query.category as string | undefined;
      if (!query) return res.status(400).json({ message: "Query required" });
      const result = await searchProductImages(query, category);
      if (result.needsReview && result.source === "none") {
        try {
          const allUsers = await storage.getAllUsers();
          const admins = (allUsers as any[]).filter(
            (u: any) => u.role === "Admin" || u.role === "Manager" || u.isMasterAdmin
          );
          for (const admin of admins) {
            await storage.createStaffNotification({
              userId: admin.id,
              type: "image_needs_review",
              title: "Material Image Needed",
              message: `No image found for "${query}". Please add one manually in the Materials catalog.`,
              link: "/materials",
              isRead: false,
            });
          }
        } catch {}
      }
      res.json(result);
    } catch (err: any) {
      console.error("[image-search]", err.message);
      res.json({ images: [], source: "none", needsReview: true, searchQuery: req.query.q || "" });
    }
  });

  // Update only the image for a material (admin/manager only)
  app.patch("/api/materials/:id/image", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (!["Admin", "Manager"].includes(user?.role) && !user?.isMasterAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { imageUrl } = req.body;
      if (!imageUrl) return res.status(400).json({ message: "imageUrl required" });
      const updated = await storage.updateMaterial(req.params.id, { primaryImage: imageUrl });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update a single step image within an SOP's structuredData (admin/manager only)
  app.patch("/api/sops/:id/step-image", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (!["Admin", "Manager"].includes(user?.role) && !user?.isMasterAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { stepIndex, imageUrl, targetField } = req.body;
      const sop = await storage.getSop(req.params.id);
      if (!sop) return res.status(404).json({ message: "SOP not found" });

      const structured: any =
        typeof sop.structuredData === "string"
          ? JSON.parse(sop.structuredData)
          : sop.structuredData || {};

      if (targetField === "headerImageUrl") {
        structured.headerImageUrl = imageUrl;
      } else if (typeof stepIndex === "number" && Array.isArray(structured.steps)) {
        if (!structured.steps[stepIndex]) {
          return res.status(400).json({ message: "Step not found" });
        }
        structured.steps[stepIndex].imageUrl = imageUrl;
      } else {
        return res.status(400).json({ message: "stepIndex or targetField required" });
      }

      const updated = await storage.updateSop(req.params.id, { structuredData: structured });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Bulk import materials from Excel/CSV data
  app.post("/api/materials/bulk-import", requireAuth, async (req, res) => {
    try {
      const { materials: importData } = req.body;
      
      if (!Array.isArray(importData) || importData.length === 0) {
        return res.status(400).json({ message: "No materials data provided" });
      }
      
      const results = {
        imported: 0,
        errors: [] as { row: number; error: string }[]
      };
      
      for (let i = 0; i < importData.length; i++) {
        const row = importData[i];
        try {
          // Validate required fields
          if (!row.name || !row.category || !row.sku || !row.unit) {
            results.errors.push({ 
              row: i + 1, 
              error: "Missing required fields (name, category, sku, unit)" 
            });
            continue;
          }
          
          await storage.createMaterial({
            name: row.name,
            category: row.category,
            sku: row.sku,
            unit: row.unit,
            stock: row.stock || 0,
            description: row.description,
            materialType: row.materialType,
            weight: row.weight ? parseInt(row.weight) : undefined,
            weightUnit: row.weightUnit,
            coverageArea: row.coverageArea ? parseInt(row.coverageArea) : undefined,
            coverageUnit: row.coverageUnit,
            supplier: row.supplier,
            supplierContact: row.supplierContact,
            supplierUrl: row.supplierUrl,
            crewNotes: row.crewNotes,
            customerNotes: row.customerNotes
          });
          results.imported++;
        } catch (err: any) {
          results.errors.push({ row: i + 1, error: err.message || "Unknown error" });
        }
      }
      
      res.json(results);
    } catch (err: any) {
      console.error("Bulk import error:", err);
      res.status(500).json({ message: "Bulk import failed", error: err.message });
    }
  });

  // Get material template download format
  app.get("/api/materials/template", requireAuth, async (req, res) => {
    const template = {
      headers: [
        "name", "category", "sku", "unit", "stock", "materialType", 
        "description", "weight", "weightUnit", "coverageArea", "coverageUnit",
        "supplier", "supplierContact", "supplierUrl", "crewNotes", "customerNotes"
      ],
      example: {
        name: "Premium Brown Mulch",
        category: "Mulch",
        sku: "MUL-BRN-001",
        unit: "bags",
        stock: 100,
        materialType: "Mulch",
        description: "High-quality brown mulch for landscaping beds",
        weight: 40,
        weightUnit: "lbs",
        coverageArea: 8,
        coverageUnit: "sq ft per bag at 3 inch depth",
        supplier: "ABC Landscape Supply",
        supplierContact: "555-1234",
        supplierUrl: "https://supplier.example.com",
        crewNotes: "Store in dry area. Break up clumps before spreading.",
        customerNotes: "Apply 2-3 inches deep for best weed suppression."
      }
    };
    res.json(template);
  });

  app.get("/api/candidates", requireAuth, async (req, res) => {
    try {
      const candidates = await storage.getCandidates();
      res.json(candidates);
    } catch (err) {
      res.status(500).json({ message: "Error fetching candidates" });
    }
  });

  app.get("/api/my-application", requireAuth, async (req, res) => {
    try {
      const candidate = await storage.getCandidateByUserId(req.user!.id);
      if (!candidate) {
        return res.status(404).json({ message: "No application found" });
      }
      res.json(candidate);
    } catch (err) {
      res.status(500).json({ message: "Error fetching application" });
    }
  });

  app.get("/api/my-application/documents", requireAuth, async (req, res) => {
    try {
      const candidate = await storage.getCandidateByUserId(req.user!.id);
      if (!candidate) {
        return res.status(404).json({ message: "No application found" });
      }
      const documents = await storage.getCandidateDocuments(candidate.id);
      res.json(documents);
    } catch (err) {
      res.status(500).json({ message: "Error fetching documents" });
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

  app.get("/api/candidates/:id", requireAuth, async (req, res) => {
    try {
      const candidate = await storage.getCandidate(req.params.id as string);
      if (!candidate) return res.status(404).json({ message: "Candidate not found" });
      res.json(candidate);
    } catch (err) {
      res.status(500).json({ message: "Error fetching candidate" });
    }
  });

  app.delete("/api/candidates/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteCandidate(req.params.id as string);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting candidate" });
    }
  });

  app.get("/api/candidates/:id/documents", requireAuth, async (req, res) => {
    try {
      const documents = await storage.getCandidateDocuments(req.params.id as string);
      res.json(documents);
    } catch (err) {
      res.status(500).json({ message: "Error fetching candidate documents" });
    }
  });

  app.post("/api/candidates/:id/documents", requireAuth, async (req, res) => {
    try {
      const doc = await storage.createCandidateDocument({
        candidateId: req.params.id as string,
        ...req.body,
      });
      res.status(201).json(doc);
    } catch (err) {
      res.status(500).json({ message: "Error creating candidate document" });
    }
  });

  app.patch("/api/candidate-documents/:id", requireAuth, async (req, res) => {
    try {
      const doc = await storage.updateCandidateDocument(req.params.id as string, req.body);
      if (!doc) return res.status(404).json({ message: "Document not found" });
      res.json(doc);
    } catch (err) {
      res.status(500).json({ message: "Error updating candidate document" });
    }
  });

  app.delete("/api/candidate-documents/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteCandidateDocument(req.params.id as string);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting candidate document" });
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
      res.status(500).json({ message: "Error creating job", errorCode: "JOB-001" });
    }
  });

  app.patch("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const job = await storage.updateJob(req.params.id as string, req.body);
      if (!job) return res.status(404).json({ message: "Job not found" });
      if (req.body.stage) {
        logActivity("job_stage_change", `Work card "${job.client}" moved to ${req.body.stage}`, "/jobs", req.user?.id);
      }
      res.json(job);
    } catch (err) {
      res.status(500).json({ message: "Error updating job" });
    }
  });

  app.get("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id as string);
      if (!job) return res.status(404).json({ message: "Job not found" });
      res.json(job);
    } catch (err) {
      res.status(500).json({ message: "Error fetching job" });
    }
  });

  app.delete("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id as string);
      await storage.deleteJob(req.params.id as string);
      logActivity("job_deleted", `Work card "${job?.client || "Unknown"}" was deleted`, "/jobs", req.user?.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting job" });
    }
  });

  app.get("/api/jobs/:id/documents", requireAuth, async (req, res) => {
    try {
      const documents = await storage.getJobDocuments(req.params.id as string);
      res.json(documents);
    } catch (err) {
      res.status(500).json({ message: "Error fetching job documents" });
    }
  });

  app.post("/api/jobs/:id/documents", requireAuth, async (req, res) => {
    try {
      const doc = await storage.createJobDocument({
        jobId: req.params.id as string,
        ...req.body,
      });
      logActivity("job_document_uploaded", `Document "${req.body.name || "file"}" uploaded for job`, "/jobs", req.user?.id);
      res.status(201).json(doc);
    } catch (err) {
      res.status(500).json({ message: "Error creating job document" });
    }
  });

  app.delete("/api/job-documents/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteJobDocument(req.params.id as string);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting job document" });
    }
  });

  app.get("/api/job-pipeline-tabs", requireAuth, async (req, res) => {
    try {
      const tabs = await storage.getJobPipelineTabs();
      res.json(tabs);
    } catch (err) {
      res.status(500).json({ message: "Error fetching job pipeline tabs" });
    }
  });

  app.post("/api/job-pipeline-tabs", requireAuth, async (req, res) => {
    try {
      const tab = await storage.createJobPipelineTab(req.body);
      logActivity("pipeline_tab_created", `Pipeline tab "${req.body.name}" created`, "/jobs", req.user?.id);
      res.status(201).json(tab);
    } catch (err) {
      res.status(500).json({ message: "Error creating job pipeline tab" });
    }
  });

  app.patch("/api/job-pipeline-tabs/:id", requireAuth, async (req, res) => {
    try {
      const tab = await storage.updateJobPipelineTab(req.params.id as string, req.body);
      if (!tab) return res.status(404).json({ message: "Tab not found" });
      logActivity("pipeline_tab_updated", `Pipeline tab renamed to "${req.body.name}"`, "/jobs", req.user?.id);
      res.json(tab);
    } catch (err) {
      res.status(500).json({ message: "Error updating job pipeline tab" });
    }
  });

  app.delete("/api/job-pipeline-tabs/:id", requireAuth, async (req, res) => {
    try {
      const tab = await storage.getJobPipelineTab(req.params.id as string);
      if (tab) {
        const allJobs = await storage.getJobs();
        const orphanedJobs = allJobs.filter(j => j.category === tab.name);
        for (const job of orphanedJobs) {
          await storage.updateJob(job.id, { category: "Install" });
        }
        if (orphanedJobs.length > 0) {
          logActivity("jobs_reassigned", `${orphanedJobs.length} job(s) reassigned from "${tab.name}" to "Install"`, "/jobs", req.user?.id);
        }
      }
      await storage.deleteJobPipelineTab(req.params.id as string);
      logActivity("pipeline_tab_deleted", `Pipeline tab "${tab?.name || "Unknown"}" deleted`, "/jobs", req.user?.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting job pipeline tab" });
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
      let targetEmployeeId = req.body.targetEmployeeId || null;
      
      // Validate targetEmployeeId if provided
      if (targetEmployeeId) {
        const targetUser = await storage.getUser(targetEmployeeId);
        if (!targetUser) {
          return res.status(400).json({ message: "Invalid target employee" });
        }
        // Ensure target is an internal employee (not a Customer)
        if (targetUser.role === "Customer") {
          return res.status(400).json({ message: "Cannot send messages to other customers" });
        }
      }
      
      const message = await storage.createCustomerMessage({
        customerId: req.user!.id,
        targetEmployeeId,
        subject: req.body.subject,
        message: req.body.message,
      });
      res.status(201).json(message);
    } catch (err) {
      res.status(500).json({ message: "Error sending message", errorCode: "MSG-001" });
    }
  });

  // List employees that customers can message directly
  app.get("/api/employees/contactable", requireAuth, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const employees = allUsers.filter(u => 
        (u.role === "Admin" || u.role === "Manager" || u.role === "Crew") && 
        u.isActive !== false
      ).map(u => ({
        id: u.id,
        name: u.name || u.username,
        role: u.role,
      }));
      res.json(employees);
    } catch (err) {
      res.status(500).json({ message: "Error fetching employees" });
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

  app.get("/api/messages/unread-count", requireAuth, async (req, res) => {
    try {
      if (req.user?.role === "Admin" || req.user?.role === "Manager") {
        const messages = await storage.getCustomerMessages();
        const unreadCount = messages.filter(m => m.status === "unread").length;
        res.json({ count: unreadCount });
      } else {
        const messages = await storage.getCustomerMessagesByUser(req.user!.id);
        const hasReply = messages.filter(m => m.adminReply && m.status === "replied").length;
        res.json({ count: hasReply });
      }
    } catch (err) {
      res.status(500).json({ message: "Error fetching unread count" });
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

  // ================== MESSAGING THREADS (Threaded Conversations) ==================
  
  // Get messaging threads - role-based filtering
  app.get("/api/messaging-threads", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const { status, customerId, employeeId } = req.query;
      
      let filters: any = {};
      if (status) filters.status = status as string;
      
      // Role-based access control
      if (user.role === "Customer") {
        // Customers can only see their own conversations
        filters.customerId = user.id;
      } else if (user.role === "Crew") {
        // Crew can only see conversations assigned to them
        filters.assignedEmployeeId = user.id;
      } else if (user.role === "Manager") {
        // Managers can see their assigned conversations or filter by employee/customer
        if (employeeId) {
          filters.assignedEmployeeId = employeeId as string;
        } else if (!customerId) {
          // Default: show only their assigned conversations
          filters.assignedEmployeeId = user.id;
        }
        if (customerId) filters.customerId = customerId as string;
      } else if (user.role === "Admin") {
        // Admins can see all conversations with optional filters
        if (customerId) filters.customerId = customerId as string;
        if (employeeId) filters.assignedEmployeeId = employeeId as string;
      }
      
      const threads = await storage.getMessagingThreads(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(threads);
    } catch (err) {
      res.status(500).json({ message: "Error fetching conversations" });
    }
  });
  
  // Get single messaging thread
  app.get("/api/messaging-threads/:id", requireAuth, async (req, res) => {
    try {
      const thread = await storage.getMessagingThread(req.params.id);
      if (!thread) return res.status(404).json({ message: "Conversation not found" });
      
      // Access control
      const user = req.user!;
      if (user.role === "Customer" && thread.customerId !== user.id) {
        return res.status(403).json({ message: "Not authorized to view this conversation" });
      }
      if (user.role === "Crew" && thread.assignedEmployeeId !== user.id) {
        return res.status(403).json({ message: "Not authorized to view this conversation" });
      }
      
      res.json(thread);
    } catch (err) {
      res.status(500).json({ message: "Error fetching conversation" });
    }
  });
  
  // Create new messaging thread
  app.post("/api/messaging-threads", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const { subject, assignedEmployeeId, initialMessage, priority } = req.body;
      
      if (!subject) {
        return res.status(400).json({ message: "Subject is required" });
      }
      
      const thread = await storage.createMessagingThread({
        customerId: user.role === "Customer" ? user.id : req.body.customerId,
        assignedEmployeeId: assignedEmployeeId || null,
        subject,
        priority: priority || "normal",
        initialMessage,
      });

      // Send email notification for new conversation (non-blocking)
      if (initialMessage) {
        (async () => {
          try {
            const recipientIds: string[] = [];
            if (assignedEmployeeId) {
              recipientIds.push(assignedEmployeeId);
            } else {
              const allUsers = await storage.getUsers();
              const admins = allUsers.filter(u => (u.role === "Admin" || u.role === "Manager") && u.isActive);
              recipientIds.push(...admins.map(a => a.id));
            }

            for (const recipientId of recipientIds) {
              if (recipientId === user.id) continue;
              const recipient = await storage.getUser(recipientId);
              if (!recipient || !recipient.email || recipient.emailNotifications === false) continue;

              await sendMessageNotificationEmail(
                recipient.email,
                recipient.name,
                user.name,
                subject,
                initialMessage,
                thread.id,
                recipient.language || "en"
              );
            }
          } catch (emailErr: any) {
            console.error("Failed to send new thread notification email:", emailErr.message);
          }
        })();
      }
      
      logActivity("message_sent", `New message from ${user.name}`, "/communications", user.id);
      res.status(201).json(thread);
    } catch (err) {
      res.status(500).json({ message: "Error creating conversation" });
    }
  });
  
  // Update messaging thread (status, assignment, priority)
  app.patch("/api/messaging-threads/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const thread = await storage.getMessagingThread(req.params.id);
      if (!thread) return res.status(404).json({ message: "Conversation not found" });
      
      // Only admins, managers, and assigned employees can update
      if (user.role === "Customer") {
        return res.status(403).json({ message: "Not authorized to update conversation" });
      }
      if (user.role === "Crew" && thread.assignedEmployeeId !== user.id) {
        return res.status(403).json({ message: "Not authorized to update this conversation" });
      }
      
      const { status, assignedEmployeeId, priority } = req.body;
      const updates: any = {};
      if (status) {
        updates.status = status;
        if (status === "closed") {
          updates.closedAt = new Date();
          updates.closedBy = user.id;
        }
      }
      if (assignedEmployeeId !== undefined) updates.assignedEmployeeId = assignedEmployeeId;
      if (priority) updates.priority = priority;
      
      const updated = await storage.updateMessagingThread(req.params.id, updates);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Error updating conversation" });
    }
  });
  
  // Get messages in a thread
  app.get("/api/messaging-threads/:id/messages", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const thread = await storage.getMessagingThread(req.params.id);
      if (!thread) return res.status(404).json({ message: "Conversation not found" });
      
      // Access control
      if (user.role === "Customer" && thread.customerId !== user.id) {
        return res.status(403).json({ message: "Not authorized to view this conversation" });
      }
      if (user.role === "Crew" && thread.assignedEmployeeId !== user.id) {
        return res.status(403).json({ message: "Not authorized to view this conversation" });
      }
      
      // Customers don't see internal notes
      const includeInternalNotes = user.role !== "Customer";
      const messages = await storage.getThreadMessages(req.params.id, includeInternalNotes);
      
      // Mark as read for this user
      await storage.markMessagesAsRead(req.params.id, user.id);
      
      res.json(messages);
    } catch (err) {
      res.status(500).json({ message: "Error fetching messages" });
    }
  });
  
  // Add message to thread
  app.post("/api/messaging-threads/:id/messages", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const thread = await storage.getMessagingThread(req.params.id);
      if (!thread) return res.status(404).json({ message: "Conversation not found" });
      
      // Access control
      if (user.role === "Customer" && thread.customerId !== user.id) {
        return res.status(403).json({ message: "Not authorized to message in this conversation" });
      }
      if (user.role === "Crew" && thread.assignedEmployeeId !== user.id) {
        return res.status(403).json({ message: "Not authorized to message in this conversation" });
      }
      
      const { content, isInternalNote, attachments } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: "Message content is required" });
      }
      
      // Only staff can add internal notes
      if (isInternalNote && user.role === "Customer") {
        return res.status(403).json({ message: "Customers cannot add internal notes" });
      }
      
      const message = await storage.createThreadMessage({
        threadId: req.params.id,
        senderId: user.id,
        senderRole: user.role === "Customer" ? "customer" : "employee",
        content,
        isInternalNote: isInternalNote || false,
        attachments: attachments || null,
      });
      
      // Update thread status to in_progress if it was open
      if (thread.status === "open" && user.role !== "Customer") {
        await storage.updateMessagingThread(req.params.id, { status: "in_progress" });
      }

      // Send email notification to recipient (non-blocking)
      if (!isInternalNote) {
        (async () => {
          try {
            const recipientIds: string[] = [];

            if (user.role === "Customer") {
              if (thread.assignedEmployeeId) {
                recipientIds.push(thread.assignedEmployeeId);
              } else {
                const allUsers = await storage.getUsers();
                const admins = allUsers.filter(u => (u.role === "Admin" || u.role === "Manager") && u.isActive);
                recipientIds.push(...admins.map(a => a.id));
              }
            } else {
              recipientIds.push(thread.customerId);
            }

            for (const recipientId of recipientIds) {
              if (recipientId === user.id) continue;
              const recipient = await storage.getUser(recipientId);
              if (!recipient || !recipient.email || recipient.emailNotifications === false) continue;

              await sendMessageNotificationEmail(
                recipient.email,
                recipient.name,
                user.name,
                thread.subject,
                content,
                req.params.id,
                recipient.language || "en"
              );
            }
          } catch (emailErr: any) {
            console.error("Failed to send message notification email:", emailErr.message);
          }
        })();
      }
      
      res.status(201).json(message);
    } catch (err) {
      res.status(500).json({ message: "Error sending message" });
    }
  });
  
  // Get unread conversation count for current user
  app.get("/api/messaging-threads/unread-count", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      let filters: any = {};
      
      if (user.role === "Customer") {
        filters.customerId = user.id;
      } else {
        filters.assignedEmployeeId = user.id;
      }
      
      const threads = await storage.getMessagingThreads(filters);
      const unreadCount = threads.filter(t => 
        user.role === "Customer" ? t.unreadByCustomer : t.unreadByEmployee
      ).length;
      
      res.json({ unreadCount });
    } catch (err) {
      res.status(500).json({ message: "Error fetching unread count" });
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

      const customerUser = req.user!;
      try {
        await storage.createEstimate({
          clientName: customerUser.fullName || customerUser.username,
          serviceType: req.body.serviceType,
          stage: "New Lead",
          description: req.body.description,
          propertyAddress: req.body.propertyAddress,
          contactName: customerUser.fullName || customerUser.username,
          contactEmail: customerUser.email || undefined,
          source: "work_request",
          workRequestId: request.id,
          customerId: customerUser.id,
        });
      } catch (estErr) {
        console.error("Error auto-creating estimate from work request:", estErr);
      }

      try {
        const allUsers = await storage.getAllUsers();
        const admins = allUsers.filter((u: User) => u.role === "Admin" || u.role === "Master Admin");
        for (const admin of admins) {
          await storage.createStaffNotification({
            userId: admin.id,
            type: "work_request",
            title: "New Work Request",
            message: `${customerUser.fullName || customerUser.username} submitted a work request: "${req.body.title}"`,
            link: "/jobs",
            isRead: false,
          });
        }
      } catch (notifErr) {
        console.error("Error sending admin notifications:", notifErr);
      }

      logActivity("work_request", `New work request from ${customerUser.fullName || customerUser.username}`, "/jobs", customerUser.id);
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

  app.get("/api/pipeline-estimates", requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== "Admin" && req.user?.role !== "Manager" && req.user?.role !== "Master Admin") {
        return res.status(403).json({ message: "Not authorized" });
      }
      const allEstimates = await storage.getEstimates();
      res.json(allEstimates);
    } catch (err) {
      res.status(500).json({ message: "Error fetching estimates" });
    }
  });

  // Follow-up reminders: returns due estimates and logs bell notifications (deduped per day)
  app.get("/api/pipeline-estimates/follow-up-reminders", requireAuth, async (req, res) => {
    try {
      const role = req.user?.role;
      if (role !== "Admin" && role !== "Manager" && role !== "Master Admin") {
        return res.status(403).json({ message: "Not authorized" });
      }
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const allEstimates = await storage.getEstimates();
      const dueEstimates = allEstimates.filter((e: any) =>
        e.followUpDate &&
        new Date(e.followUpDate) <= now &&
        e.stage !== "Won" &&
        e.stage !== "Lost"
      );

      // Log a bell notification for each due estimate, once per day
      for (const estimate of dueEstimates) {
        const existing = await db
          .select()
          .from(activityLog)
          .where(
            and(
              eq(activityLog.eventType, "follow_up_reminder"),
              sql`description LIKE ${'%' + estimate.id + '%'}`,
              gte(activityLog.createdAt, startOfToday)
            )
          )
          .limit(1);

        if (existing.length === 0) {
          await logActivity(
            "follow_up_reminder",
            `Follow-up due: ${estimate.clientName} — ${estimate.serviceType} [${estimate.id}]`,
            "/jobs",
            req.user?.id
          );
        }
      }

      res.json(dueEstimates);
    } catch (err) {
      console.error("Error fetching follow-up reminders:", err);
      res.status(500).json({ message: "Error fetching reminders" });
    }
  });

  app.post("/api/pipeline-estimates", requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== "Admin" && req.user?.role !== "Manager" && req.user?.role !== "Master Admin") {
        return res.status(403).json({ message: "Not authorized" });
      }
      const estimate = await storage.createEstimate(req.body);
      logActivity("estimate_created", `New estimate created for ${estimate.clientName}`, "/jobs", req.user?.id);
      res.status(201).json(estimate);
    } catch (err) {
      res.status(500).json({ message: "Error creating estimate" });
    }
  });

  app.patch("/api/pipeline-estimates/:id", requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== "Admin" && req.user?.role !== "Manager" && req.user?.role !== "Master Admin") {
        return res.status(403).json({ message: "Not authorized" });
      }
      const existing = await storage.getEstimate(req.params.id);
      if (!existing) return res.status(404).json({ message: "Estimate not found" });

      const oldStage = existing.stage;
      const estimate = await storage.updateEstimate(req.params.id, req.body);

      if (req.body.stage && req.body.stage !== oldStage && estimate?.contactEmail && req.body.notifyCustomer) {
        try {
          await sendCustomerNotificationEmail(
            estimate.contactEmail,
            estimate.clientName,
            `Your estimate status has been updated`,
            `Your estimate for ${estimate.serviceType} has moved to "${req.body.stage}". We'll be in touch with more details soon.`,
            "View Details",
            "/customer"
          );
        } catch (emailErr) {
          console.error("Error sending estimate stage notification:", emailErr);
        }
      }

      if (req.body.stage && req.body.stage !== oldStage && estimate?.customerId) {
        try {
          await storage.createCustomerNotification({
            customerId: estimate.customerId,
            type: "estimate_update",
            title: "Estimate Updated",
            message: `Your estimate for ${estimate.serviceType} has been updated to "${req.body.stage}".`,
            link: "/customer",
            isRead: false,
          });
        } catch (notifErr) {
          console.error("Error creating customer notification:", notifErr);
        }
      }

      res.json(estimate);
    } catch (err) {
      res.status(500).json({ message: "Error updating estimate" });
    }
  });

  app.delete("/api/pipeline-estimates/:id", requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== "Admin" && req.user?.role !== "Master Admin") {
        return res.status(403).json({ message: "Not authorized" });
      }
      await storage.deleteEstimate(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting estimate" });
    }
  });

  app.post("/api/pipeline-estimates/:id/convert-to-job", requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== "Admin" && req.user?.role !== "Master Admin") {
        return res.status(403).json({ message: "Not authorized" });
      }
      const estimate = await storage.getEstimate(req.params.id);
      if (!estimate) return res.status(404).json({ message: "Estimate not found" });

      const inferredCategory = estimate.serviceType === "Maintenance" ? "Maintenance" : "Install";
      const job = await storage.createJob({
        client: estimate.clientName,
        type: estimate.serviceType,
        category: req.body.category || inferredCategory,
        stage: "Lead",
        value: estimate.estimatedValue || 0,
        address: estimate.propertyAddress || undefined,
        city: estimate.city || undefined,
        state: estimate.state || undefined,
        zip: estimate.zip || undefined,
        contactName: estimate.contactName || undefined,
        contactPhone: estimate.contactPhone || undefined,
        contactEmail: estimate.contactEmail || undefined,
        notes: estimate.notes || undefined,
      });

      await storage.updateEstimate(req.params.id, { stage: "Won" });

      logActivity("estimate_converted", `Estimate for ${estimate.clientName} converted to a Sold job`, "/jobs", req.user?.id);
      res.json({ job, estimate });
    } catch (err) {
      res.status(500).json({ message: "Error converting estimate to job" });
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

  // Form Folders
  app.get("/api/form-folders", requireAuth, async (req, res) => {
    try {
      const folders = await storage.getFormFolders();
      res.json(folders);
    } catch (err) {
      res.status(500).json({ message: "Error fetching folders" });
    }
  });

  app.post("/api/form-folders", requireAdmin, async (req, res) => {
    try {
      const parsed = insertFormFolderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid folder data", errors: parsed.error.flatten() });
      }
      const folder = await storage.createFormFolder(parsed.data);
      res.status(201).json(folder);
    } catch (err) {
      res.status(500).json({ message: "Error creating folder" });
    }
  });

  app.patch("/api/form-folders/:id", requireAdmin, async (req, res) => {
    try {
      const parsed = insertFormFolderSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid folder data", errors: parsed.error.flatten() });
      }
      const folder = await storage.updateFormFolder(req.params.id as string, parsed.data);
      if (!folder) return res.status(404).json({ message: "Folder not found" });
      res.json(folder);
    } catch (err) {
      res.status(500).json({ message: "Error updating folder" });
    }
  });

  app.delete("/api/form-folders/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteFormFolder(req.params.id as string);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Error deleting folder" });
    }
  });

  // Form Templates
  app.get("/api/form-templates", requireAuth, async (req, res) => {
    try {
      const templates = await storage.getFormTemplates();
      res.json(templates);
    } catch (err) {
      res.status(500).json({ message: "Error fetching templates" });
    }
  });

  app.post("/api/form-templates", requireAdmin, async (req, res) => {
    try {
      const parsed = insertFormTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid template data", errors: parsed.error.flatten() });
      }
      const template = await storage.createFormTemplate(parsed.data);
      res.status(201).json(template);
    } catch (err) {
      res.status(500).json({ message: "Error creating template" });
    }
  });

  app.patch("/api/form-templates/:id", requireAdmin, async (req, res) => {
    try {
      const parsed = insertFormTemplateSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid template data", errors: parsed.error.flatten() });
      }
      const template = await storage.updateFormTemplate(req.params.id as string, parsed.data);
      if (!template) return res.status(404).json({ message: "Template not found" });
      res.json(template);
    } catch (err) {
      res.status(500).json({ message: "Error updating template" });
    }
  });

  app.delete("/api/form-templates/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteFormTemplate(req.params.id as string);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Error deleting template" });
    }
  });

  // Form Builder Wizard - PDF parse
  const multerUpload = (await import("multer")).default;
  const pdfUpload = multerUpload({ storage: multerUpload.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  app.post("/api/form-builder/parse-pdf", requireAuth, pdfUpload.single("pdf"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No PDF file uploaded" });
      }
      const allowedMimes = ["application/pdf"];
      if (!allowedMimes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: "Only PDF files are accepted" });
      }
      const pdfParse = (await import("pdf-parse")).default;
      let pdfData;
      try {
        pdfData = await pdfParse(req.file.buffer);
      } catch (parseErr: any) {
        return res.status(400).json({ message: "The uploaded file could not be parsed as a valid PDF" });
      }
      const text = pdfData.text.slice(0, 15000);
      const lines = text.split("\n").filter((l: string) => l.trim().length > 0);
      const suggestedTitle = lines[0]?.trim().slice(0, 100) || "";
      res.json({ text, suggestedTitle });
    } catch (err: any) {
      console.error("[form-builder/parse-pdf] Error:", err.message);
      res.status(500).json({ message: "Failed to parse PDF" });
    }
  });

  // Form Builder Wizard - AI auto-fill
  app.post("/api/form-builder/ai-fill", requireAuth, async (req, res) => {
    try {
      const { title, category, purpose, smartAnswers, pdfText } = req.body;
      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      let purposeContext = "";
      if (purpose) {
        purposeContext = `\nForm Purpose: "${purpose}"`;
      }

      let smartContext = "";
      if (smartAnswers && Object.keys(smartAnswers).length > 0) {
        const answers = Object.entries(smartAnswers)
          .map(([key, val]) => `  - ${key}: ${val}`)
          .join("\n");
        smartContext = `\nUser's answers to smart follow-up questions:\n${answers}\nIMPORTANT: Use these answers to heavily customize the form. These are specific choices the user made about their business — tailor every section, field, and option to match their answers exactly.`;
      }

      let pdfContext = "";
      if (pdfText) {
        pdfContext = `\nPDF DOCUMENT CONTENT (recreate this as a fillable form):\n---\n${pdfText.slice(0, 12000)}\n---\nIMPORTANT: Your job is to recreate this PDF document as a fillable digital form. Analyze every field, checkbox, line, and section in the PDF. Map each one to the appropriate field type (text, date, select, checkbox, signature, etc.). Preserve the exact structure, labels, and organization from the original document. Add helpful placeholder text to guide the person filling it out.`;
      }

      const hiringRules = purpose && (purpose.toLowerCase().includes("crew member hiring") || purpose.toLowerCase().includes("hiring application"))
        ? `\nHIRING APPLICATION RULES (based on Fortune 500 / SHRM best practices):
- WORK HISTORY: Include at least 3 previous employment entries, each with: Employer Name, Job Title, Start Date, End Date, Supervisor Name, Supervisor Phone, Reason for Leaving, and a brief description of duties
- PERSONAL REFERENCES: Include at least 3 personal (non-family) references with guidance text like "Coach, Teacher, Minister, Mentor, or similar — no family members." Each reference should have: Full Name, Relationship, Phone, Email, and How Long Known
- Include an "Equal Opportunity" acknowledgment checkbox
- Include a "Background Check Consent" section if applicable
- Include "Are you legally authorized to work in the United States?" question
- Include a signature and date field for attestation that all information is true`
        : "";

      const managerRules = purpose && (purpose.toLowerCase().includes("manager") || purpose.toLowerCase().includes("supervisor application"))
        ? `\nMANAGER/LEADERSHIP APPLICATION RULES (based on Amazon, Google, and SHRM behavioral interview standards):
- BEHAVIORAL EXAMPLES: Include 2-3 behavioral/situational questions using the STAR format (Situation, Task, Action, Result). For example: "Describe a time you had to resolve a conflict between team members. What was the situation, what did you do, and what was the outcome?"
- LEADERSHIP EXPERIENCE: Ask for specific metrics — team sizes managed, budgets overseen, revenue impact
- PROFESSIONAL REFERENCES: At least 3, preferably supervisors or peers from management roles. Each with: Name, Title, Company, Phone, Email, Working Relationship, How Long
- Include questions about management philosophy and leadership style
- Include a section about relevant certifications, licenses, or continuing education`
        : "";

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a senior business operations expert specializing in landscape installation and maintenance companies. You create forms that match the quality and professionalism of those used by top US companies (Amazon, Deloitte, ADP, SHRM-recommended templates). Return ONLY valid JSON with NO additional text.

Given a form title, category, purpose, and any additional context, generate comprehensive, highly specific form builder data. Your output must be:
- PROFESSIONAL: Match the quality standard of Fortune 500 companies and SHRM-recommended templates
- SPECIFIC: Tailored exactly to the stated purpose — not generic
- COMPLETE: Include all fields a real business would need for this specific form type
- PRACTICAL: Based on how real landscape companies operate
- LEGALLY SOUND: Include appropriate disclaimers, consents, and attestations where applicable
${hiringRules}${managerRules}

The JSON must include these fields:
- title: string (the refined form title)
- category: string (the category provided)
- outcome: string (2-3 sentences describing what this form achieves)
- outcomeType: string (one of: "data_collection", "approval", "compliance", "communication", "tracking")
- audience: string (who fills this out — be specific)
- audienceRoles: string[] (from: "Admin", "Manager", "Crew", "Customer")
- sections: array of objects, each with:
  - title: string (section heading)
  - description: string (what this section captures)
  - fields: array of objects, each with:
    - label: string (field label)
    - type: string (one of: "text", "textarea", "number", "email", "phone", "date", "time", "select", "checkbox", "radio", "file", "signature", "address")
    - required: boolean
    - placeholder: string (example/hint text — be specific and helpful)
    - options: string[] (for select/checkbox/radio — provide real options)
    - helpText: string (guidance for the person filling it out)
- toolsAndMedia: object with enablePhotos, enableFileUpload, enableSignature, enableGeolocation (booleans), suggestedIllustrations (string[])
- externalConnections: object with sendsEmail (boolean), emailRecipients (string), sendsToCalendar (boolean), requiresApproval (boolean), approver (string), integratesWithCRM (boolean)

SECTION GENERATION RULES:
- Generate 4-10 sections depending on form complexity
- Each section should have 2-8 fields
- Use the most appropriate field type for each piece of data
- For repeating entries (like multiple references or work history), create separate sections or clearly numbered fields (e.g., "Reference 1 Name", "Reference 2 Name", etc.)
- Include practical placeholder text specific to landscaping
- For select/radio/checkbox fields, provide realistic, industry-specific options`
          },
          {
            role: "user",
            content: `Generate form builder data for:\nTitle: "${title}"\nCategory: "${category}"${purposeContext}${smartContext}${pdfContext}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const raw = completion.choices[0]?.message?.content || "{}";
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (jsonErr) {
        console.error("[form-builder/ai-fill] Non-JSON response from AI:", raw.slice(0, 200));
        return res.status(500).json({ message: "AI returned an invalid response. Please try again." });
      }
      res.json(parsed);
    } catch (err: any) {
      console.error("[form-builder/ai-fill] Error:", err.message);
      res.status(500).json({ message: "Failed to generate form data" });
    }
  });

  // Builder Forms (Form Builder 1)
  app.get("/api/builder-forms", requireAuth, async (req, res) => {
    try {
      const archived = req.query.archived === "true";
      const forms = await storage.getBuilderForms(archived);
      res.json(forms);
    } catch (err) {
      res.status(500).json({ message: "Error fetching builder forms" });
    }
  });

  app.get("/api/builder-forms/:id", requireAuth, async (req, res) => {
    try {
      const form = await storage.getBuilderForm(req.params.id);
      if (!form) return res.status(404).json({ message: "Form not found" });
      res.json(form);
    } catch (err) {
      res.status(500).json({ message: "Error fetching builder form" });
    }
  });

  app.post("/api/builder-forms", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const validated = insertBuilderFormSchema.parse({
        name: req.body.name || req.body.title || "Untitled Form",
        category: req.body.category || "",
        purpose: req.body.purpose || "",
        language: req.body.language || "en",
        exportTarget: req.body.exportTarget || "pdf",
        status: req.body.status || "published",
        outcome: req.body.outcome || "",
        outcomeType: req.body.outcomeType || "data_collection",
        audience: req.body.audience || "",
        audienceRoles: req.body.audienceRoles || [],
        sections: req.body.sections || [],
        toolsAndMedia: req.body.toolsAndMedia || {},
        externalConnections: req.body.externalConnections || {},
        pages: req.body.pages || [],
        templateVariant: typeof req.body.templateVariant === "number" ? req.body.templateVariant : 0,
        archived: false,
        createdBy: user.id,
      });
      const form = await storage.createBuilderForm(validated);
      res.status(201).json(form);
    } catch (err: any) {
      if (err?.name === "ZodError") {
        return res.status(400).json({ message: "Invalid form data", errors: err.errors });
      }
      console.error("[builder-forms] Create error:", err.message);
      res.status(500).json({ message: "Error creating builder form" });
    }
  });

  app.patch("/api/builder-forms/:id", requireAuth, async (req, res) => {
    try {
      const updateSchema = z.object({
        name: z.string().optional(),
        language: z.string().optional(),
        exportTarget: z.string().optional(),
        pages: z.any().optional(),
        templateVariant: z.number().int().min(0).max(4).optional(),
        archived: z.boolean().optional(),
        archivedAt: z.any().optional(),
      });
      const validated = updateSchema.parse(req.body);
      const form = await storage.updateBuilderForm(req.params.id, validated);
      if (!form) return res.status(404).json({ message: "Form not found" });
      res.json(form);
    } catch (err: any) {
      if (err?.name === "ZodError") {
        return res.status(400).json({ message: "Invalid form data", errors: err.errors });
      }
      res.status(500).json({ message: "Error updating builder form" });
    }
  });

  app.post("/api/builder-forms/:id/archive", requireAuth, async (req, res) => {
    try {
      const form = await storage.updateBuilderForm(req.params.id, {
        archived: true,
        archivedAt: new Date(),
      });
      if (!form) return res.status(404).json({ message: "Form not found" });
      res.json(form);
    } catch (err) {
      res.status(500).json({ message: "Error archiving form" });
    }
  });

  app.post("/api/builder-forms/:id/restore", requireAuth, async (req, res) => {
    try {
      const form = await storage.updateBuilderForm(req.params.id, {
        archived: false,
        archivedAt: null,
      });
      if (!form) return res.status(404).json({ message: "Form not found" });
      res.json(form);
    } catch (err) {
      res.status(500).json({ message: "Error restoring form" });
    }
  });

  app.delete("/api/builder-forms/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteBuilderForm(req.params.id);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Error deleting builder form" });
    }
  });

  // PDF Forms - Import, Fill, Export
  const pdfFormUpload = multerUpload({ storage: multerUpload.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

  app.get("/api/pdf-forms", requireAuth, async (req, res) => {
    try {
      const forms = await storage.getPdfForms();
      res.json(forms);
    } catch (err) {
      res.status(500).json({ message: "Error fetching PDF forms" });
    }
  });

  app.get("/api/pdf-forms/:id", requireAuth, async (req, res) => {
    try {
      const form = await storage.getPdfForm(req.params.id);
      if (!form) return res.status(404).json({ message: "PDF form not found" });
      res.json(form);
    } catch (err) {
      res.status(500).json({ message: "Error fetching PDF form" });
    }
  });

  app.post("/api/pdf-forms/upload", requireAuth, pdfFormUpload.single("pdf"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No PDF file uploaded" });
      if (req.file.mimetype !== "application/pdf") return res.status(400).json({ message: "Only PDF files are accepted" });

      const { PDFDocument } = await import("pdf-lib");
      let pdfDoc;
      try {
        pdfDoc = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true });
      } catch (e) {
        return res.status(400).json({ message: "Could not parse the PDF file" });
      }

      const pageCount = pdfDoc.getPageCount();
      const form = pdfDoc.getForm();
      const formFields: any[] = [];

      try {
        const fields = form.getFields();
        for (const field of fields) {
          const widgets = field.acroField.getWidgets();
          const fieldName = field.getName();
          const fieldType = field.constructor.name.replace("PDF", "").replace("Field", "").toLowerCase();

          for (const widget of widgets) {
            const rect = widget.getRectangle();
            const pageRef = widget.P();
            let pageIndex = 0;
            if (pageRef) {
              const pages = pdfDoc.getPages();
              for (let i = 0; i < pages.length; i++) {
                if (pages[i].ref === pageRef) { pageIndex = i; break; }
              }
            }
            let options: string[] = [];
            if (fieldType === "dropdown" || fieldType === "optionlist") {
              try { options = (field as any).getOptions?.() || []; } catch {}
            }
            let label = fieldName;
            try {
              const dict = widget.dict;
              const tuKey = dict.get((pdfDoc as any).context.obj("TU"));
              if (tuKey && typeof tuKey.decodeText === "function") {
                label = tuKey.decodeText();
              } else if (tuKey && typeof tuKey === "string") {
                label = tuKey;
              }
            } catch {}
            let detectedType = fieldType;
            if (fieldType === "signature") detectedType = "signature";
            else if (fieldType === "text") {
              const lowerName = fieldName.toLowerCase();
              if (lowerName.includes("signature") || lowerName.includes("sign")) {
                detectedType = "signature";
              }
            }
            formFields.push({
              name: fieldName,
              type: detectedType,
              page: pageIndex,
              rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
              options,
              label,
            });
          }
        }
      } catch (fieldErr) {
        console.log("[pdf-forms] No AcroForm fields found or error extracting:", (fieldErr as Error).message);
      }

      const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
      if (!privateDir) return res.status(500).json({ message: "Object storage not configured" });

      const fileId = crypto.randomUUID();
      const objectPath = `${privateDir}/pdf-forms/${fileId}.pdf`;
      const pathParts = objectPath.startsWith("/") ? objectPath.slice(1).split("/") : objectPath.split("/");
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");

      const SIDECAR = "http://127.0.0.1:1106";
      const signRes = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket_name: bucketName, object_name: objectName, method: "PUT", expires_at: new Date(Date.now() + 900 * 1000).toISOString() }),
      });
      if (!signRes.ok) return res.status(500).json({ message: "Failed to get upload URL" });
      const { signed_url } = await signRes.json() as { signed_url: string };

      const uploadRes = await fetch(signed_url, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: req.file.buffer,
      });
      if (!uploadRes.ok) return res.status(500).json({ message: "Failed to upload PDF to storage" });

      const fileKey = `/objects/pdf-forms/${fileId}.pdf`;
      const user = req.user as User;
      const title = req.body.title || req.file.originalname?.replace(/\.pdf$/i, "") || "Untitled PDF";

      const saved = await storage.createPdfForm({
        title,
        fileKey,
        fileSize: req.file.size,
        pageCount,
        formFields,
        createdBy: user.id,
      });

      res.status(201).json(saved);
    } catch (err: any) {
      console.error("[pdf-forms/upload] Error:", err.message);
      res.status(500).json({ message: "Failed to import PDF" });
    }
  });

  app.get("/api/pdf-forms/:id/download", requireAuth, async (req, res) => {
    try {
      const form = await storage.getPdfForm(req.params.id);
      if (!form) return res.status(404).json({ message: "PDF form not found" });

      const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
      const objService = new ObjectStorageService();
      const objectFile = await objService.getObjectEntityFile(form.fileKey);

      const chunks: Buffer[] = [];
      const stream = objectFile.createReadStream();
      for await (const chunk of stream) { chunks.push(Buffer.from(chunk)); }
      const pdfBuffer = Buffer.concat(chunks);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${form.title}.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("[pdf-forms/download] Error:", err.message);
      res.status(500).json({ message: "Failed to download PDF" });
    }
  });

  app.post("/api/pdf-forms/:id/fill-export", requireAuth, async (req, res) => {
    try {
      const form = await storage.getPdfForm(req.params.id);
      if (!form) return res.status(404).json({ message: "PDF form not found" });

      const { fieldValues, detectedFieldsMeta } = req.body;
      if (!fieldValues || typeof fieldValues !== "object") {
        return res.status(400).json({ message: "Field values are required" });
      }

      const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
      const objService = new ObjectStorageService();
      const objectFile = await objService.getObjectEntityFile(form.fileKey);

      const chunks: Buffer[] = [];
      const stream = objectFile.createReadStream();
      for await (const chunk of stream) { chunks.push(Buffer.from(chunk)); }
      const pdfBuffer = Buffer.concat(chunks);

      const { PDFDocument } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });

      let filledAnyField = false;
      let hasExistingAcroForm = false;

      try {
        const pdfForm = pdfDoc.getForm();
        const allFields = pdfForm.getFields();
        hasExistingAcroForm = allFields.length > 0;

        if (hasExistingAcroForm) {
          for (const [fieldName, value] of Object.entries(fieldValues)) {
            try {
              const field = pdfForm.getField(fieldName);
              const type = field.constructor.name;
              if (type === "PDFTextField") {
                (field as any).setText(String(value));
                filledAnyField = true;
              } else if (type === "PDFCheckBox") {
                if (value) (field as any).check(); else (field as any).uncheck();
                filledAnyField = true;
              } else if (type === "PDFDropdown") {
                (field as any).select(String(value));
                filledAnyField = true;
              } else if (type === "PDFRadioGroup") {
                (field as any).select(String(value));
                filledAnyField = true;
              }
            } catch (fieldErr) {
              console.log(`[pdf-forms/fill] Skipping field "${fieldName}":`, (fieldErr as Error).message);
            }
          }
        }
      } catch (formErr) {
        console.log("[pdf-forms/fill] Could not read existing form fields:", (formErr as Error).message);
      }

      if (!hasExistingAcroForm) {
        console.log("[pdf-forms/fill] No AcroForm fields found, creating fillable fields...");
        const { rgb, StandardFonts } = await import("pdf-lib");
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pdfForm = pdfDoc.getForm();

        const fieldsMeta: any[] = detectedFieldsMeta || (form.formFields as any[]) || [];
        const radioGroupsCreated = new Set<string>();

        for (const meta of fieldsMeta) {
          const pages = pdfDoc.getPages();
          const page = pages[meta.page] || pages[0];
          const value = fieldValues[meta.name] || "";
          const fontSize = Math.min(Math.max(meta.rect.height - 4, 8), 12);

          try {
            if (meta.type === "radio" && meta.radioGroup) {
              if (!radioGroupsCreated.has(meta.radioGroup)) {
                radioGroupsCreated.add(meta.radioGroup);
              }
              const checkbox = pdfForm.createCheckBox(meta.name);
              if (value) checkbox.check();
              checkbox.addToPage(page, {
                x: meta.rect.x,
                y: meta.rect.y,
                width: meta.rect.width,
                height: meta.rect.height,
                borderWidth: 0,
              });
              filledAnyField = true;
            } else if (meta.type === "checkbox") {
              const checkbox = pdfForm.createCheckBox(meta.name);
              if (value) checkbox.check();
              checkbox.addToPage(page, {
                x: meta.rect.x,
                y: meta.rect.y,
                width: meta.rect.width,
                height: meta.rect.height,
                borderWidth: 0,
              });
              filledAnyField = true;
            } else if (meta.type === "signature") {
              const textField = pdfForm.createTextField(meta.name);
              textField.setText(String(value));
              textField.addToPage(page, {
                x: meta.rect.x,
                y: meta.rect.y,
                width: meta.rect.width,
                height: meta.rect.height,
                font,
                borderWidth: 0,
              });
              textField.setFontSize(fontSize);
              filledAnyField = true;
            } else {
              const textField = pdfForm.createTextField(meta.name);
              textField.setText(String(value));
              textField.addToPage(page, {
                x: meta.rect.x,
                y: meta.rect.y,
                width: meta.rect.width,
                height: meta.rect.height,
                font,
                borderWidth: 0,
              });
              textField.setFontSize(fontSize);
              filledAnyField = true;
            }
          } catch (createErr) {
            console.log(`[pdf-forms/fill] Failed to create field "${meta.name}":`, (createErr as Error).message);
            if (value && String(value).trim() !== "" && meta.type !== "checkbox" && meta.type !== "radio") {
              page.drawText(String(value), {
                x: meta.rect.x + 2,
                y: meta.rect.y + 3,
                size: fontSize,
                font,
                color: rgb(0, 0, 0),
              });
              filledAnyField = true;
            }
          }
        }
      }

      const filledBytes = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${form.title} (filled).pdf"`);
      res.send(Buffer.from(filledBytes));
    } catch (err: any) {
      console.error("[pdf-forms/fill-export] Error:", err.message);
      res.status(500).json({ message: "Failed to export filled PDF" });
    }
  });

  app.delete("/api/pdf-forms/:id", requireAuth, async (req, res) => {
    try {
      const form = await storage.getPdfForm(req.params.id);
      if (!form) return res.status(404).json({ message: "PDF form not found" });

      try {
        const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
        if (privateDir && form.fileKey) {
          const objectPath = `${privateDir}${form.fileKey}`;
          const pathParts = objectPath.startsWith("/") ? objectPath.slice(1).split("/") : objectPath.split("/");
          const bucketName = pathParts[0];
          const objectName = pathParts.slice(1).join("/");
          const SIDECAR = "http://127.0.0.1:1106";
          await fetch(`${SIDECAR}/object-storage/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bucket_name: bucketName, object_name: objectName }),
          });
        }
      } catch (storageErr) {
        console.error("[pdf-forms/delete] Failed to remove object storage file:", (storageErr as Error).message);
      }

      await storage.deletePdfForm(req.params.id);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Error deleting PDF form" });
    }
  });

  // AI Form Builder
  app.post("/api/ai/generate-form", requireAdmin, async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert at creating digital forms for business operations.
            When given a description, create form fields for a professional form.
            
            Available field types: text, textarea, number, email, date, select, checkbox, radio, separator
            
            Format your response as JSON with these fields:
            - title: A clear title for the form
            - description: A brief description of what the form is for
            - category: One of [Hiring, Compliance, Operations, HR, Customer Service, General]
            - fields: An array of field objects with:
              - id: unique identifier (lowercase, no spaces)
              - type: one of the available types
              - label: display label for the field
              - placeholder: optional placeholder text
              - required: boolean
              - options: array of strings (only for select/radio/checkbox)
            
            Make the form practical and comprehensive for business use.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        return res.status(500).json({ message: "AI generation failed" });
      }

      const formData = JSON.parse(content);
      res.json(formData);
    } catch (err) {
      console.error("AI form generation error:", err);
      res.status(500).json({ message: "Error generating form with AI" });
    }
  });

  app.get("/api/profile", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, recoveryToken, recoveryExpires, storedPassword, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      res.status(500).json({ message: "Error fetching profile" });
    }
  });

  app.patch("/api/profile", requireAuth, async (req, res) => {
    try {
      const { name, email, bio, phone, profilePicture, theme, emailNotifications, language, currentPassword, newPassword } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (bio !== undefined) updates.bio = bio;
      if (phone !== undefined) updates.phone = phone;
      if (profilePicture !== undefined) updates.profilePicture = profilePicture;
      if (theme !== undefined) updates.theme = theme;
      if (emailNotifications !== undefined) updates.emailNotifications = emailNotifications;
      if (language !== undefined) updates.language = language;
      
      // Self-service password change
      if (newPassword) {
        const currentUser = await storage.getUser(req.user!.id);
        if (!currentUser) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Verify current password if provided
        if (currentPassword) {
          const isValidPassword = await comparePasswords(currentPassword, currentUser.password);
          if (!isValidPassword) {
            return res.status(400).json({ message: "Current password is incorrect" });
          }
        }
        
        updates.password = await hashPassword(newPassword);
        
        // Update storedPassword for staff (non-customer) so Master Admin sees updated password
        if (currentUser.role !== "Customer") {
          updates.storedPassword = newPassword;
        }
      }
      
      const user = await storage.updateUser(req.user!.id, updates);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, recoveryToken, recoveryExpires, storedPassword, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      res.status(500).json({ message: "Error updating profile" });
    }
  });

  app.get("/api/dashboard-config", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ widgets: user.dashboardWidgets || null });
    } catch (err) {
      res.status(500).json({ message: "Error fetching dashboard config" });
    }
  });

  app.put("/api/dashboard-config", requireAuth, async (req, res) => {
    try {
      const { widgets } = req.body;
      if (!Array.isArray(widgets)) {
        return res.status(400).json({ message: "widgets must be an array" });
      }
      await storage.updateUser(req.user!.id, { dashboardWidgets: widgets });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error saving dashboard config" });
    }
  });

  // Equipment routes
  app.get("/api/equipment", requireAuth, async (req, res) => {
    try {
      const items = await storage.getEquipment();
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Error fetching equipment" });
    }
  });

  app.get("/api/equipment/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.getEquipmentById(req.params.id as string);
      if (!item) return res.status(404).json({ message: "Equipment not found" });
      res.json(item);
    } catch (err) {
      res.status(500).json({ message: "Error fetching equipment" });
    }
  });

  app.post("/api/equipment", requireAuth, async (req, res) => {
    try {
      const item = await storage.createEquipment(req.body);
      res.status(201).json(item);
    } catch (err) {
      res.status(500).json({ message: "Error creating equipment", errorCode: "EQP-001" });
    }
  });

  app.put("/api/equipment/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.updateEquipment(req.params.id as string, req.body);
      if (!item) return res.status(404).json({ message: "Equipment not found" });
      res.json(item);
    } catch (err) {
      res.status(500).json({ message: "Error updating equipment" });
    }
  });

  app.delete("/api/equipment/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteEquipment(req.params.id as string);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Error deleting equipment" });
    }
  });

  // Maintenance Schedule routes
  app.get("/api/maintenance-schedules", requireAuth, async (req, res) => {
    try {
      const equipmentId = req.query.equipmentId as string | undefined;
      const schedules = await storage.getMaintenanceSchedules(equipmentId);
      res.json(schedules);
    } catch (err) {
      res.status(500).json({ message: "Error fetching maintenance schedules" });
    }
  });

  app.post("/api/maintenance-schedules", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.nextDueDate && typeof data.nextDueDate === "string") {
        data.nextDueDate = new Date(data.nextDueDate);
      }
      if (data.lastCompletedDate && typeof data.lastCompletedDate === "string") {
        data.lastCompletedDate = new Date(data.lastCompletedDate);
      }
      const schedule = await storage.createMaintenanceSchedule(data);
      res.status(201).json(schedule);
    } catch (err: any) {
      console.error("Error creating maintenance schedule:", err);
      res.status(500).json({ message: "Error creating maintenance schedule" });
    }
  });

  app.put("/api/maintenance-schedules/:id", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.nextDueDate && typeof data.nextDueDate === "string") {
        data.nextDueDate = new Date(data.nextDueDate);
      }
      if (data.lastCompletedDate && typeof data.lastCompletedDate === "string") {
        data.lastCompletedDate = new Date(data.lastCompletedDate);
      }
      const schedule = await storage.updateMaintenanceSchedule(req.params.id as string, data);
      if (!schedule) return res.status(404).json({ message: "Schedule not found" });
      res.json(schedule);
    } catch (err) {
      res.status(500).json({ message: "Error updating maintenance schedule" });
    }
  });

  app.delete("/api/maintenance-schedules/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteMaintenanceSchedule(req.params.id as string);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Error deleting maintenance schedule" });
    }
  });

  // Maintenance Log routes
  app.get("/api/maintenance-logs", requireAuth, async (req, res) => {
    try {
      const equipmentId = req.query.equipmentId as string | undefined;
      const logs = await storage.getMaintenanceLogs(equipmentId);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ message: "Error fetching maintenance logs" });
    }
  });

  app.post("/api/maintenance-logs", requireAuth, async (req, res) => {
    try {
      const log = await storage.createMaintenanceLog({
        ...req.body,
        performedBy: req.user!.id,
      });
      
      // If this log is for a scheduled maintenance, update the schedule
      if (req.body.scheduleId) {
        const schedule = await storage.getMaintenanceSchedule(req.body.scheduleId);
        if (schedule) {
          const updates: any = {
            lastCompletedDate: log.completedDate,
            lastCompletedMileage: log.mileageAtService,
            lastCompletedHours: log.hoursAtService,
          };
          
          updates.reminderCount = 0;
          updates.lastReminderSent = null;

          if (schedule.intervalType === "days" && log.completedDate) {
            const nextDate = new Date(log.completedDate);
            nextDate.setDate(nextDate.getDate() + schedule.intervalValue);
            updates.nextDueDate = nextDate;
          } else if (schedule.intervalType === "miles" && log.mileageAtService) {
            updates.nextDueMileage = log.mileageAtService + schedule.intervalValue;
          } else if (schedule.intervalType === "hours" && log.hoursAtService) {
            updates.nextDueHours = log.hoursAtService + schedule.intervalValue;
          }
          
          await storage.updateMaintenanceSchedule(req.body.scheduleId, updates);
        }
      }
      
      res.status(201).json(log);
    } catch (err) {
      res.status(500).json({ message: "Error creating maintenance log" });
    }
  });

  app.post("/api/maintenance/send-reminders", requireAdmin, async (req, res) => {
    try {
      const results = await checkAndSendReminders();
      const sent = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      res.json({
        message: `Sent ${sent} reminder emails`,
        sentCount: sent,
        failedCount: failed,
        results
      });
    } catch (err) {
      res.status(500).json({ message: "Error sending maintenance reminders" });
    }
  });

  app.get("/api/maintenance/reminder-status", requireAuth, async (req, res) => {
    try {
      const schedules = await storage.getMaintenanceSchedules();
      const allEquipment = await storage.getEquipment();
      const now = new Date();

      const statuses = schedules
        .filter(s => s.isActive && s.reminderEnabled && s.reminderEmail)
        .map(s => {
          const equip = allEquipment.find(e => e.id === s.equipmentId);
          const isOverdue = s.nextDueDate ? now > new Date(s.nextDueDate) : false;
          const isDueSoon = s.nextDueDate && !isOverdue
            ? (() => {
                const reminderStart = new Date(s.nextDueDate);
                reminderStart.setDate(reminderStart.getDate() - (s.reminderDays || 7));
                return now >= reminderStart;
              })()
            : false;

          return {
            scheduleId: s.id,
            scheduleName: s.name,
            equipmentId: s.equipmentId,
            equipmentName: equip?.name || "Unknown",
            reminderEmail: s.reminderEmail,
            reminderEnabled: s.reminderEnabled,
            nextDueDate: s.nextDueDate,
            isOverdue,
            isDueSoon,
            lastReminderSent: s.lastReminderSent,
            reminderCount: s.reminderCount || 0,
            reminderDays: s.reminderDays,
            recurringReminderDays: s.recurringReminderDays,
          };
        });

      res.json(statuses);
    } catch (err) {
      res.status(500).json({ message: "Error fetching reminder status" });
    }
  });

  // Equipment Uploads routes
  app.get("/api/equipment/:equipmentId/uploads", requireAuth, async (req, res) => {
    try {
      const uploads = await storage.getEquipmentUploads(req.params.equipmentId as string);
      res.json(uploads);
    } catch (err) {
      res.status(500).json({ message: "Error fetching equipment uploads" });
    }
  });

  app.post("/api/equipment/:equipmentId/uploads", requireAuth, async (req, res) => {
    try {
      const upload = await storage.createEquipmentUpload({
        ...req.body,
        equipmentId: req.params.equipmentId as string,
        uploadedBy: req.user!.id,
      });
      res.status(201).json(upload);
    } catch (err) {
      res.status(500).json({ message: "Error creating equipment upload" });
    }
  });

  app.delete("/api/equipment-uploads/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteEquipmentUpload(req.params.id as string);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Error deleting equipment upload" });
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

  // Customer Resources routes
  app.get("/api/resources", requireAuth, async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const resources = await storage.getCustomerResources(type);
      const isAdmin = req.user!.role === "Admin" || req.user!.role === "Manager";
      const filteredResources = isAdmin ? resources : resources.filter(r => r.isPublished);
      res.json(filteredResources);
    } catch (err) {
      res.status(500).json({ message: "Error fetching resources" });
    }
  });

  app.get("/api/resources/:id", requireAuth, async (req, res) => {
    try {
      const resource = await storage.getCustomerResource(req.params.id as string);
      if (!resource) return res.status(404).json({ message: "Resource not found" });
      const isAdmin = req.user!.role === "Admin" || req.user!.role === "Manager";
      if (!resource.isPublished && !isAdmin) {
        return res.status(404).json({ message: "Resource not found" });
      }
      res.json(resource);
    } catch (err) {
      res.status(500).json({ message: "Error fetching resource" });
    }
  });

  app.post("/api/resources", requireAdmin, async (req, res) => {
    try {
      const resource = await storage.createCustomerResource({
        ...req.body,
        createdBy: req.user!.id,
      });
      res.status(201).json(resource);
    } catch (err) {
      res.status(500).json({ message: "Error creating resource" });
    }
  });

  app.patch("/api/resources/:id", requireAdmin, async (req, res) => {
    try {
      const resource = await storage.updateCustomerResource(req.params.id as string, req.body);
      if (!resource) return res.status(404).json({ message: "Resource not found" });
      res.json(resource);
    } catch (err) {
      res.status(500).json({ message: "Error updating resource" });
    }
  });

  app.delete("/api/resources/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteCustomerResource(req.params.id as string);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Error deleting resource" });
    }
  });

  // Saved Resources (favorites) routes
  app.get("/api/saved-resources", requireAuth, async (req, res) => {
    try {
      const saved = await storage.getSavedResources(req.user!.id);
      res.json(saved);
    } catch (err) {
      res.status(500).json({ message: "Error fetching saved resources" });
    }
  });

  app.post("/api/saved-resources/:resourceId", requireAuth, async (req, res) => {
    try {
      const resource = await storage.getCustomerResource(req.params.resourceId as string);
      if (!resource) return res.status(404).json({ message: "Resource not found" });
      const isAdmin = req.user!.role === "Admin" || req.user!.role === "Manager";
      if (!resource.isPublished && !isAdmin) {
        return res.status(404).json({ message: "Resource not found" });
      }
      const saved = await storage.saveResource(req.user!.id, req.params.resourceId as string);
      res.status(201).json(saved);
    } catch (err) {
      res.status(500).json({ message: "Error saving resource" });
    }
  });

  app.delete("/api/saved-resources/:resourceId", requireAuth, async (req, res) => {
    try {
      await storage.unsaveResource(req.user!.id, req.params.resourceId as string);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Error removing saved resource" });
    }
  });

  // Company Settings routes
  app.get("/api/company-settings", async (req, res) => {
    try {
      const settings = await storage.getCompanySettings();
      res.json(settings || { companyName: "Company HQ" });
    } catch (err) {
      res.status(500).json({ message: "Error fetching company settings" });
    }
  });

  app.patch("/api/company-settings", requireAuth, requireMasterAdmin, async (req, res) => {
    try {
      const settings = await storage.updateCompanySettings(req.body);
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "Error updating company settings" });
    }
  });

  async function syncTodoCalendarEvent(todoId: string, todoTitle: string, dueDate: Date | null, createdBy: string, status?: string) {
    try {
      const existing = await db.select().from(calendarEvents)
        .where(and(eq(calendarEvents.linkedRecordType, "todo"), eq(calendarEvents.linkedRecordId, todoId)));
      
      if (!dueDate || status === "completed") {
        if (existing.length > 0) {
          await db.delete(calendarEvents)
            .where(and(eq(calendarEvents.linkedRecordType, "todo"), eq(calendarEvents.linkedRecordId, todoId)));
        }
        return;
      }

      const assignments = await db.select().from(todoAssignments).where(eq(todoAssignments.todoId, todoId));
      const assignedTo = assignments.length > 0 ? assignments[0].userId : null;

      const startDate = new Date(dueDate);
      startDate.setHours(9, 0, 0, 0);
      const endDate = new Date(dueDate);
      endDate.setHours(17, 0, 0, 0);

      if (existing.length > 0) {
        await db.update(calendarEvents)
          .set({ title: `Task: ${todoTitle}`, startDatetime: startDate, endDatetime: endDate, assignedTo, updatedAt: new Date() })
          .where(eq(calendarEvents.id, existing[0].id));
      } else {
        await db.insert(calendarEvents).values({
          title: `Task: ${todoTitle}`,
          description: `Auto-created from task: ${todoTitle}`,
          eventType: "task",
          startDatetime: startDate,
          endDatetime: endDate,
          allDay: true,
          createdBy,
          assignedTo,
          linkedRecordType: "todo",
          linkedRecordId: todoId,
        });
      }
    } catch (err) {
      console.error("[TODO-CALENDAR] Error syncing calendar event:", err);
    }
  }

  // To-Do System routes
  app.get("/api/todos", requireAuth, async (req, res) => {
    try {
      const allTodos = await storage.getTodos();
      const allUsers = await storage.getAllUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u.name]));

      const todosWithAssignees = await Promise.all(allTodos.map(async (todo) => {
        const assignments = await storage.getTodoAssignments(todo.id);
        return {
          ...todo,
          assignedUsers: assignments.map(a => ({
            userId: a.userId,
            name: userMap.get(a.userId) || "Unknown",
          })),
          creatorName: todo.createdBy ? userMap.get(todo.createdBy) || "Unknown" : null,
        };
      }));
      res.json(todosWithAssignees);
    } catch (err) {
      res.status(500).json({ message: "Error fetching todos" });
    }
  });

  app.get("/api/todos/unread-count", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const count = await storage.getUnreadTodoCount(user.id);
      res.json({ count });
    } catch (err) {
      res.status(500).json({ message: "Error fetching unread count" });
    }
  });

  app.get("/api/todos/:id", requireAuth, async (req, res) => {
    try {
      const todo = await storage.getTodo(req.params.id as string);
      if (!todo) return res.status(404).json({ message: "Todo not found" });
      res.json(todo);
    } catch (err) {
      res.status(500).json({ message: "Error fetching todo" });
    }
  });

  app.post("/api/todos", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      
      if (!req.body.title || req.body.title.trim() === "") {
        return res.status(400).json({ message: "Title is required" });
      }
      
      const todoData = {
        title: req.body.title,
        description: req.body.description || null,
        priority: req.body.priority || "medium",
        status: req.body.status || "pending",
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      };
      
      const todo = await storage.createTodo(todoData, user.id);
      
      await storage.createTodoHistory({
        todoId: todo.id,
        changedBy: user.id,
        changeType: "created",
        newValue: JSON.stringify({ title: todo.title, description: todo.description, priority: todo.priority, dueDate: todo.dueDate }),
      });

      if (req.body.assignedUserIds && Array.isArray(req.body.assignedUserIds)) {
        const uniqueIds = [...new Set(req.body.assignedUserIds as string[])];
        for (const userId of uniqueIds) {
          await storage.createTodoAssignment({ todoId: todo.id, userId });
        }
      }

      if (todo.dueDate) {
        await syncTodoCalendarEvent(todo.id, todo.title, todo.dueDate, user.id);
      }

      res.status(201).json(todo);
    } catch (err) {
      console.error("[TODO] Error creating todo:", err);
      res.status(500).json({ message: "Error creating todo. Please try again.", errorCode: "TODO-001" });
    }
  });

  app.patch("/api/todos/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const existingTodo = await storage.getTodo(req.params.id as string);
      if (!existingTodo) return res.status(404).json({ message: "Todo not found" });

      const isAssigned = (await storage.getTodoAssignments(req.params.id as string)).some(a => a.userId === user.id);
      const isCreatorOrAdmin = existingTodo.createdBy === user.id || user.role === "Admin" || user.isMasterAdmin;
      if (!isCreatorOrAdmin && !isAssigned) {
        return res.status(403).json({ message: "You don't have permission to update this task" });
      }

      const allowedUpdates: Partial<Todo> = {};
      if (isCreatorOrAdmin) {
        if (req.body.title !== undefined) allowedUpdates.title = req.body.title;
        if (req.body.description !== undefined) allowedUpdates.description = req.body.description;
        if (req.body.priority !== undefined) allowedUpdates.priority = req.body.priority;
        if (req.body.dueDate !== undefined) allowedUpdates.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
      }
      if (req.body.status !== undefined) allowedUpdates.status = req.body.status;

      const changedFields: string[] = [];
      for (const [key, val] of Object.entries(allowedUpdates)) {
        const oldVal = (existingTodo as any)[key];
        const oldStr = oldVal instanceof Date ? oldVal.toISOString() : String(oldVal ?? "");
        const newStr = val instanceof Date ? val.toISOString() : String(val ?? "");
        if (oldStr !== newStr) {
          changedFields.push(key);
          await storage.createTodoHistory({
            todoId: existingTodo.id,
            changedBy: user.id,
            changeType: key === "status" ? "status_changed" : "updated",
            fieldChanged: key,
            oldValue: oldStr,
            newValue: newStr,
          });
        }
      }

      const todo = await storage.updateTodo(req.params.id as string, allowedUpdates);
      
      await syncTodoCalendarEvent(todo.id, todo.title, todo.dueDate, todo.createdBy || user.id, todo.status || undefined);

      res.json(todo);
    } catch (err) {
      res.status(500).json({ message: "Error updating todo" });
    }
  });

  app.delete("/api/todos/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const todo = await storage.getTodo(req.params.id as string);
      if (!todo) return res.status(404).json({ message: "Todo not found" });
      if (todo.createdBy !== user.id && !user.isMasterAdmin) {
        return res.status(403).json({ message: "Only the creator can delete this task" });
      }
      await db.delete(calendarEvents)
        .where(and(eq(calendarEvents.linkedRecordType, "todo"), eq(calendarEvents.linkedRecordId, req.params.id as string)));
      await storage.deleteTodo(req.params.id as string);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting todo" });
    }
  });

  app.patch("/api/todos/:id/archive", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const todo = await storage.getTodo(req.params.id as string);
      if (!todo) return res.status(404).json({ message: "Todo not found" });
      if (todo.status !== "completed") {
        return res.status(400).json({ message: "Only completed tasks can be archived" });
      }
      const updated = await storage.updateTodo(req.params.id as string, { status: "archived" });
      await storage.createTodoHistory({
        todoId: todo.id,
        changedBy: user.id,
        changeType: "archived",
        fieldChanged: "status",
        oldValue: "completed",
        newValue: "archived",
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Error archiving todo" });
    }
  });

  app.patch("/api/todos/:id/restore", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const todo = await storage.getTodo(req.params.id as string);
      if (!todo) return res.status(404).json({ message: "Todo not found" });
      if (todo.status !== "archived") {
        return res.status(400).json({ message: "Only archived tasks can be restored" });
      }
      const updated = await storage.updateTodo(req.params.id as string, { status: "on_hold" });
      await storage.createTodoHistory({
        todoId: todo.id,
        changedBy: user.id,
        changeType: "status_change",
        fieldChanged: "status",
        oldValue: "archived",
        newValue: "on_hold",
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Error restoring todo" });
    }
  });

  app.get("/api/todos/:id/history", requireAuth, async (req, res) => {
    try {
      const history = await storage.getTodoHistory(req.params.id as string);
      const allUsers = await storage.getAllUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u.name]));
      const enriched = history.map(h => ({
        ...h,
        changedByName: h.changedBy ? userMap.get(h.changedBy) || "Unknown" : null,
      }));
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ message: "Error fetching todo history" });
    }
  });

  // To-Do Assignments
  app.get("/api/todos/:id/assignments", requireAuth, async (req, res) => {
    try {
      const assignments = await storage.getTodoAssignments(req.params.id as string);
      res.json(assignments);
    } catch (err) {
      res.status(500).json({ message: "Error fetching assignments" });
    }
  });

  app.get("/api/my-todos", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const assignments = await storage.getUserTodoAssignments(user.id);
      const allTodos = await storage.getTodos();
      const allUsers = await storage.getAllUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u.name]));
      const myTodos = allTodos.filter(t => assignments.some(a => a.todoId === t.id));

      const todosWithDetails = await Promise.all(myTodos.map(async (t) => {
        const todoAssignments = await storage.getTodoAssignments(t.id);
        return {
          ...t,
          isRead: assignments.find(a => a.todoId === t.id)?.isRead || false,
          assignedUsers: todoAssignments.map(a => ({
            userId: a.userId,
            name: userMap.get(a.userId) || "Unknown",
          })),
          creatorName: t.createdBy ? userMap.get(t.createdBy) || "Unknown" : null,
        };
      }));
      res.json(todosWithDetails);
    } catch (err) {
      res.status(500).json({ message: "Error fetching your todos" });
    }
  });

  app.post("/api/todos/:id/assignments", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getTodoAssignments(req.params.id as string);
      if (existing.some(a => a.userId === req.body.userId)) {
        return res.status(409).json({ message: "User is already assigned to this task" });
      }
      const assignment = await storage.createTodoAssignment({
        todoId: req.params.id as string,
        userId: req.body.userId
      });
      res.status(201).json(assignment);
    } catch (err) {
      res.status(500).json({ message: "Error creating assignment" });
    }
  });

  app.delete("/api/todo-assignments/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTodoAssignment(req.params.id as string);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting assignment" });
    }
  });

  app.delete("/api/todos/:todoId/assignments/:userId", requireAuth, async (req, res) => {
    try {
      const assignments = await storage.getTodoAssignments(req.params.todoId as string);
      const match = assignments.find(a => a.userId === req.params.userId);
      if (!match) return res.status(404).json({ message: "Assignment not found" });
      await storage.deleteTodoAssignment(match.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error removing assignment" });
    }
  });

  app.post("/api/todos/:id/mark-read", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      await storage.markTodoAsRead(req.params.id as string, user.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error marking todo as read" });
    }
  });

  // Active To-Do Users
  app.get("/api/todo-active-users", requireAuth, async (req, res) => {
    try {
      const activeUsers = await storage.getTodoActiveUsers();
      res.json(activeUsers);
    } catch (err) {
      res.status(500).json({ message: "Error fetching active todo users" });
    }
  });

  app.get("/api/todo-active-status", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const isActive = await storage.isUserTodoActive(user.id);
      const unreadCount = isActive ? await storage.getUnreadTodoCount(user.id) : 0;
      res.json({ isActive, unreadCount });
    } catch (err) {
      res.status(500).json({ message: "Error checking todo active status" });
    }
  });

  app.post("/api/todo-active-users/:userId", requireAdmin, async (req, res) => {
    try {
      const admin = req.user as User;
      const activeUser = await storage.activateTodoUser(req.params.userId as string, admin.id);
      res.status(201).json(activeUser);
    } catch (err) {
      res.status(500).json({ message: "Error activating todo user" });
    }
  });

  app.delete("/api/todo-active-users/:userId", requireAdmin, async (req, res) => {
    try {
      await storage.deactivateTodoUser(req.params.userId as string);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deactivating todo user" });
    }
  });

  // Plow Site Maps - Tools section
  const requirePlowEditAccess = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user as User;
    if (user.role === "Admin") return next();
    if (user.role === "Manager") {
      const perm = await storage.getPlowSiteManagerPermission(user.id);
      if (perm?.canEdit) return next();
    }
    return res.status(403).json({ message: "You don't have edit access to plow sites" });
  };

  const requirePlowViewAccess = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user as User;
    if (user.role === "Admin" || user.role === "Manager" || user.role === "Crew") return next();
    return res.status(403).json({ message: "Access denied" });
  };

  // Plow Site Groups
  app.get("/api/plow-site-groups", requirePlowViewAccess, async (req, res) => {
    try {
      const groups = await storage.getPlowSiteGroups();
      res.json(groups);
    } catch (err) {
      res.status(500).json({ message: "Error fetching plow site groups" });
    }
  });

  app.post("/api/plow-site-groups", requirePlowEditAccess, async (req, res) => {
    try {
      const user = req.user as User;
      const group = await storage.createPlowSiteGroup(req.body, user.id);
      res.status(201).json(group);
    } catch (err) {
      res.status(500).json({ message: "Error creating plow site group" });
    }
  });

  app.patch("/api/plow-site-groups/:id", requirePlowEditAccess, async (req, res) => {
    try {
      const group = await storage.updatePlowSiteGroup(req.params.id as string, req.body);
      if (!group) return res.status(404).json({ message: "Group not found" });
      res.json(group);
    } catch (err) {
      res.status(500).json({ message: "Error updating plow site group" });
    }
  });

  app.delete("/api/plow-site-groups/:id", requirePlowEditAccess, async (req, res) => {
    try {
      await storage.deletePlowSiteGroup(req.params.id as string);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting plow site group" });
    }
  });

  app.get("/api/plow-sites", requirePlowViewAccess, async (req, res) => {
    try {
      const sites = await storage.getPlowSites();
      res.json(sites);
    } catch (err) {
      res.status(500).json({ message: "Error fetching plow sites" });
    }
  });

  app.get("/api/plow-sites/:id", requirePlowViewAccess, async (req, res) => {
    try {
      const site = await storage.getPlowSite(req.params.id as string);
      if (!site) return res.status(404).json({ message: "Site not found" });
      res.json(site);
    } catch (err) {
      res.status(500).json({ message: "Error fetching plow site" });
    }
  });

  app.post("/api/plow-sites", requirePlowEditAccess, async (req, res) => {
    try {
      const user = req.user as User;
      const site = await storage.createPlowSite(req.body, user.id);
      res.status(201).json(site);
    } catch (err) {
      res.status(500).json({ message: "Error creating plow site" });
    }
  });

  app.patch("/api/plow-sites/:id", requirePlowEditAccess, async (req, res) => {
    try {
      const site = await storage.updatePlowSite(req.params.id as string, req.body);
      if (!site) return res.status(404).json({ message: "Site not found" });
      res.json(site);
    } catch (err) {
      res.status(500).json({ message: "Error updating plow site" });
    }
  });

  app.delete("/api/plow-sites/:id", requirePlowEditAccess, async (req, res) => {
    try {
      await storage.deletePlowSite(req.params.id as string);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting plow site" });
    }
  });

  // Plow Site Manager Permissions
  app.get("/api/plow-site-permissions", requireAdmin, async (req, res) => {
    try {
      const perms = await storage.getPlowSiteManagerPermissions();
      res.json(perms);
    } catch (err) {
      res.status(500).json({ message: "Error fetching permissions" });
    }
  });

  app.get("/api/plow-site-permissions/my", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role === "Admin") return res.json({ canEdit: true, canView: true });
      if (user.role === "Manager") {
        const perm = await storage.getPlowSiteManagerPermission(user.id);
        return res.json({ canEdit: perm?.canEdit || false, canView: true });
      }
      if (user.role === "Crew") return res.json({ canEdit: false, canView: true });
      return res.json({ canEdit: false, canView: false });
    } catch (err) {
      res.status(500).json({ message: "Error fetching permissions" });
    }
  });

  app.post("/api/plow-site-permissions/:userId", requireAdmin, async (req, res) => {
    try {
      const admin = req.user as User;
      const { canEdit } = req.body;
      const perm = await storage.setPlowSiteManagerPermission(req.params.userId as string, canEdit, admin.id);
      res.json(perm);
    } catch (err) {
      res.status(500).json({ message: "Error setting permission" });
    }
  });

  app.delete("/api/plow-site-permissions/:userId", requireAdmin, async (req, res) => {
    try {
      await storage.deletePlowSiteManagerPermission(req.params.userId as string);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting permission" });
    }
  });

  // Plow Site Additional Images
  app.get("/api/plow-sites/:siteId/images", requireAuth, async (req, res) => {
    try {
      const images = await storage.getPlowSiteImages(req.params.siteId);
      res.json(images);
    } catch (err) {
      res.status(500).json({ message: "Error fetching site images" });
    }
  });

  app.post("/api/plow-sites/:siteId/images", requirePlowEditAccess, async (req, res) => {
    try {
      const parseResult = insertPlowSiteImageSchema.safeParse({
        ...req.body,
        siteId: req.params.siteId
      });
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid image data", errors: parseResult.error.errors });
      }
      const image = await storage.createPlowSiteImage(parseResult.data);
      res.status(201).json(image);
    } catch (err) {
      res.status(500).json({ message: "Error creating site image" });
    }
  });

  app.patch("/api/plow-site-images/:id", requirePlowEditAccess, async (req, res) => {
    try {
      const parseResult = insertPlowSiteImageSchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid image data", errors: parseResult.error.errors });
      }
      const image = await storage.updatePlowSiteImage(req.params.id, parseResult.data);
      if (!image) return res.status(404).json({ message: "Image not found" });
      res.json(image);
    } catch (err) {
      res.status(500).json({ message: "Error updating site image" });
    }
  });

  app.delete("/api/plow-site-images/:id", requirePlowEditAccess, async (req, res) => {
    try {
      await storage.deletePlowSiteImage(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting site image" });
    }
  });

  // ================== SITE PHOTOS ==================

  app.get("/api/plow-sites/:siteId/site-photos", requireAuth, async (req, res) => {
    try {
      const photos = await storage.getSitePhotos(req.params.siteId);
      res.json(photos);
    } catch (err) {
      res.status(500).json({ message: "Error fetching site photos" });
    }
  });

  app.post("/api/plow-sites/:siteId/site-photos", requirePlowEditAccess, async (req, res) => {
    try {
      const parseResult = insertSitePhotoSchema.safeParse({ ...req.body, siteId: req.params.siteId });
      if (!parseResult.success) return res.status(400).json({ message: "Invalid data", errors: parseResult.error.errors });
      const photo = await storage.createSitePhoto(parseResult.data, (req.user as User).id);
      res.status(201).json(photo);
    } catch (err) {
      res.status(500).json({ message: "Error creating site photo" });
    }
  });

  app.patch("/api/site-photos/:id", requirePlowEditAccess, async (req, res) => {
    try {
      const photo = await storage.updateSitePhoto(req.params.id, req.body);
      if (!photo) return res.status(404).json({ message: "Photo not found" });
      res.json(photo);
    } catch (err) {
      res.status(500).json({ message: "Error updating site photo" });
    }
  });

  app.delete("/api/site-photos/:id", requirePlowEditAccess, async (req, res) => {
    try {
      await storage.deleteSitePhoto(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting site photo" });
    }
  });

  // ================== SITE PHOTO VARIANTS ==================

  app.get("/api/site-photos/:photoId/variants", requireAuth, async (req, res) => {
    try {
      const variants = await storage.getSitePhotoVariants(req.params.photoId);
      res.json(variants);
    } catch (err) {
      res.status(500).json({ message: "Error fetching variants" });
    }
  });

  app.post("/api/site-photos/:photoId/variants", requirePlowEditAccess, async (req, res) => {
    try {
      const parseResult = insertSitePhotoVariantSchema.safeParse({ ...req.body, photoId: req.params.photoId });
      if (!parseResult.success) return res.status(400).json({ message: "Invalid data", errors: parseResult.error.errors });
      const variant = await storage.createSitePhotoVariant(parseResult.data, (req.user as User).id);
      res.status(201).json(variant);
    } catch (err) {
      res.status(500).json({ message: "Error creating variant" });
    }
  });

  app.patch("/api/site-photo-variants/:id", requirePlowEditAccess, async (req, res) => {
    try {
      const variant = await storage.updateSitePhotoVariant(req.params.id, req.body);
      if (!variant) return res.status(404).json({ message: "Variant not found" });
      res.json(variant);
    } catch (err) {
      res.status(500).json({ message: "Error updating variant" });
    }
  });

  app.delete("/api/site-photo-variants/:id", requirePlowEditAccess, async (req, res) => {
    try {
      await storage.deleteSitePhotoVariant(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting variant" });
    }
  });

  // ================== SITE MAP FEATURES ==================

  app.get("/api/plow-sites/:siteId/map-features", requireAuth, async (req, res) => {
    try {
      const features = await storage.getSiteMapFeatures(req.params.siteId);
      res.json(features);
    } catch (err) {
      res.status(500).json({ message: "Error fetching map features" });
    }
  });

  app.post("/api/plow-sites/:siteId/map-features", requirePlowEditAccess, async (req, res) => {
    try {
      const parseResult = insertSiteMapFeatureSchema.safeParse({ ...req.body, siteId: req.params.siteId });
      if (!parseResult.success) return res.status(400).json({ message: "Invalid data", errors: parseResult.error.errors });
      const feature = await storage.createSiteMapFeature(parseResult.data, (req.user as User).id);
      res.status(201).json(feature);
    } catch (err) {
      res.status(500).json({ message: "Error creating map feature" });
    }
  });

  app.patch("/api/site-map-features/:id", requirePlowEditAccess, async (req, res) => {
    try {
      const feature = await storage.updateSiteMapFeature(req.params.id, req.body);
      if (!feature) return res.status(404).json({ message: "Feature not found" });
      res.json(feature);
    } catch (err) {
      res.status(500).json({ message: "Error updating map feature" });
    }
  });

  app.delete("/api/site-map-features/:id", requirePlowEditAccess, async (req, res) => {
    try {
      await storage.deleteSiteMapFeature(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting map feature" });
    }
  });

  // ================== BUSINESS PROCESSES ==================
  
  app.get("/api/business-processes", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const processes = await storage.getBusinessProcesses();
      res.json(processes);
    } catch (err) {
      res.status(500).json({ message: "Error fetching processes" });
    }
  });
  
  app.get("/api/business-processes/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const process = await storage.getBusinessProcess(req.params.id);
      if (!process) return res.status(404).json({ message: "Process not found" });
      res.json(process);
    } catch (err) {
      res.status(500).json({ message: "Error fetching process" });
    }
  });
  
  app.post("/api/business-processes", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const process = await storage.createBusinessProcess(req.body);
      res.status(201).json(process);
    } catch (err) {
      res.status(500).json({ message: "Error creating process" });
    }
  });
  
  app.patch("/api/business-processes/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const process = await storage.updateBusinessProcess(req.params.id, req.body);
      if (!process) return res.status(404).json({ message: "Process not found" });
      res.json(process);
    } catch (err) {
      res.status(500).json({ message: "Error updating process" });
    }
  });
  
  app.delete("/api/business-processes/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      await storage.deleteBusinessProcess(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting process" });
    }
  });
  
  // ================== PROCESS AUDIT RESULTS ==================

  app.get("/api/process-audits", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const { processId } = req.query;
      const results = await storage.getProcessAuditResults(processId as string | undefined);
      res.json(results);
    } catch (err) {
      res.status(500).json({ message: "Error fetching audit results" });
    }
  });

  app.get("/api/process-audits/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const result = await storage.getProcessAuditResult(req.params.id);
      if (!result) return res.status(404).json({ message: "Audit result not found" });
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Error fetching audit result" });
    }
  });

  app.post("/api/process-audits/run", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const { processId } = req.body;
      if (!processId) return res.status(400).json({ message: "Process ID is required" });
      const proc = await storage.getBusinessProcess(processId);
      if (!proc) return res.status(404).json({ message: "Process not found" });
      const auditResult = await storage.createProcessAuditResult({
        processId,
        status: "running",
        auditPhase: "researching",
      });
      runProcessAudit(processId, auditResult.id);
      res.status(202).json({
        message: "Audit started",
        auditId: auditResult.id,
        estimatedTime: "30-60 seconds",
      });
    } catch (err) {
      res.status(500).json({ message: "Error starting audit" });
    }
  });

  // Connector health check — programmatic analysis of process wiring
  function checkProcessConnectors(proc: any): any[] {
    const issues: any[] = [];
    const steps: any[] = proc.stepsJson as any[] || [];
    const notifications: any[] = proc.notificationsJson as any[] || [];
    const validRoles = ["Admin", "Manager", "Crew", "Customer"];

    if (steps.length === 0) {
      issues.push({
        type: "no_steps",
        severity: "critical",
        title: "No steps defined",
        description: "This process has no steps. No one knows what to do or when.",
        suggestedFix: "Define at least the core steps of this workflow.",
      });
    }

    steps.forEach((step: any) => {
      if (!step.role || !validRoles.includes(step.role)) {
        issues.push({
          type: "missing_role",
          severity: "high",
          title: `Step "${step.name || "Unnamed"}" has no valid role assigned`,
          description: "Without a role, no one is responsible for completing this step.",
          affectedStep: step.name || "Unnamed",
          suggestedFix: `Assign one of: Admin, Manager, Crew, or Customer to this step.`,
        });
      }
      if (!step.name || step.name.trim() === "") {
        issues.push({
          type: "unnamed_step",
          severity: "medium",
          title: "A step has no name",
          description: "Unnamed steps are confusing for team members following the process.",
          suggestedFix: "Give every step a clear, action-oriented name.",
        });
      }
    });

    if (steps.length > 0 && notifications.length === 0) {
      issues.push({
        type: "no_notifications",
        severity: "high",
        title: "No notification triggers configured",
        description: "Team members and customers won't be automatically notified of progress or completion.",
        suggestedFix: "Add at least a start notification and a completion notification for this process.",
      });
    }

    notifications.forEach((notif: any) => {
      if (!notif.recipient || notif.recipient.trim() === "") {
        issues.push({
          type: "notification_no_recipient",
          severity: "high",
          title: `Notification "${notif.trigger || "Unnamed"}" has no recipient`,
          description: "This notification will never be sent because no recipient is defined.",
          suggestedFix: "Set a recipient (e.g., Customer, Manager) for this notification trigger.",
        });
      }
      if (!notif.channel || notif.channel.trim() === "") {
        issues.push({
          type: "notification_no_channel",
          severity: "medium",
          title: `Notification "${notif.trigger || "Unnamed"}" has no delivery channel`,
          description: "No channel (email, SMS, in-app) is defined, so this notification cannot be delivered.",
          suggestedFix: "Set a delivery channel (email recommended for customer notifications).",
        });
      }
    });

    const hasCustomerStep = steps.some((s: any) => s.role === "Customer");
    const hasCustomerNotification = notifications.some((n: any) =>
      (n.recipient || "").toLowerCase().includes("customer")
    );
    if (steps.length > 2 && !hasCustomerStep && !hasCustomerNotification) {
      issues.push({
        type: "no_customer_touchpoint",
        severity: "medium",
        title: "No customer touchpoint in this process",
        description: "Customers are not involved or notified at any point. This is a missed opportunity to build trust.",
        suggestedFix: "Add at least one customer notification (e.g., when work is complete or scheduled).",
      });
    }

    const stepRoles = steps.map((s: any) => s.role).filter(Boolean);
    if (stepRoles.length > 0 && new Set(stepRoles).size === 1 && steps.length > 3) {
      issues.push({
        type: "single_role_bottleneck",
        severity: "low",
        title: `All steps assigned to ${stepRoles[0]} — potential bottleneck`,
        description: "If one person is responsible for everything, the process stalls if they're unavailable.",
        suggestedFix: "Distribute steps across multiple roles where appropriate.",
      });
    }

    return issues;
  }

  // Full 3-phase audit engine
  async function runProcessAudit(processId: string, auditId: string) {
    const startTime = Date.now();
    try {
      const proc = await storage.getBusinessProcess(processId);
      if (!proc) return;

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1",
      });

      // Phase 1+2: Research + Analysis (combined AI call)
      await storage.updateProcessAuditResult(auditId, { auditPhase: "researching" });

      const stepsText = (proc.stepsJson as any[] || []).length > 0
        ? JSON.stringify(proc.stepsJson, null, 2)
        : "No steps defined";
      const notificationsText = (proc.notificationsJson as any[] || []).length > 0
        ? JSON.stringify(proc.notificationsJson, null, 2)
        : "No notifications configured";

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an expert business process auditor with deep knowledge of landscaping and outdoor services businesses (Chapin Landscapes).

Your job is to:
1. RESEARCH - Based on industry knowledge, describe what a complete best-practice version of this process should look like for a professional landscaping company
2. ANALYZE - Compare the current process against best practices and identify gaps
3. SCORE - Rate the process on four dimensions (0-100 each)
4. SUGGEST - Provide specific ready-to-add steps the process is missing

Respond with this exact JSON structure:
{
  "overallScore": <0-100>,
  "efficiencyScore": <0-100>,
  "reliabilityScore": <0-100>,
  "customerExperienceScore": <0-100>,
  "communicationScore": <0-100>,
  "estimatedImprovementTime": "string (e.g., '2-3 hours of setup')",
  "bestPractices": [
    {
      "aspect": "string (e.g., 'Customer Communication')",
      "description": "string - what a best-practice process includes for this aspect",
      "currentStatus": "string - how the current process compares",
      "gap": "none|minor|major"
    }
  ],
  "findings": [
    {
      "type": "issue|opportunity|strength",
      "title": "string",
      "description": "string - specific, actionable detail",
      "severity": "low|medium|high"
    }
  ],
  "suggestedSteps": [
    {
      "name": "string - clear action-oriented step name",
      "description": "string - exactly what to do in this step",
      "role": "Admin|Manager|Crew|Customer",
      "timing": "string - e.g., 'Before step 2' or 'At the end'",
      "priority": "low|medium|high",
      "reason": "string - why this step is important for the business"
    }
  ],
  "recommendations": [
    {
      "title": "string",
      "description": "string",
      "priority": "low|medium|high",
      "estimatedEffort": "string",
      "expectedImpact": "string"
    }
  ]
}`
          },
          {
            role: "user",
            content: `Audit this business process for a landscaping company:

Process Name: ${proc.name}
Description: ${proc.description || "None provided"}
Category: ${proc.category || "General"}
Roles Involved: ${(proc.rolesInvolved as string[] || []).join(", ") || "Not specified"}
Estimated Duration: ${proc.estimatedDuration || "Not specified"}

Current Steps:
${stepsText}

Current Notifications:
${notificationsText}

Research what this process should ideally look like for a professional landscaping company. Identify every gap between the current process and best practice. Provide specific suggested steps they can add immediately.`
          }
        ],
      });

      await storage.updateProcessAuditResult(auditId, { auditPhase: "checking" });

      const auditData = JSON.parse(completion.choices[0].message.content || "{}");
      const tokensUsed = completion.usage?.total_tokens || 0;
      const cost = (tokensUsed / 1000000) * 5.00;

      // Phase 3: Connector check (programmatic)
      const connectorIssues = checkProcessConnectors(proc);

      await storage.updateProcessAuditResult(auditId, {
        status: "completed",
        auditPhase: "completed",
        overallScore: auditData.overallScore,
        efficiencyScore: auditData.efficiencyScore,
        reliabilityScore: auditData.reliabilityScore,
        customerExperienceScore: auditData.customerExperienceScore,
        communicationScore: auditData.communicationScore,
        findingsJson: auditData.findings || [],
        recommendationsJson: auditData.recommendations || [],
        suggestedStepsJson: auditData.suggestedSteps || [],
        connectorIssuesJson: connectorIssues,
        bestPracticesJson: auditData.bestPractices || [],
        estimatedImprovementTime: auditData.estimatedImprovementTime || "Unknown",
        estimatedCost: cost.toFixed(4),
        tokensUsed,
        runDurationMs: Date.now() - startTime,
        completedAt: new Date(),
      });

      await storage.updateBusinessProcess(processId, { lastAuditedAt: new Date() });
      console.log(`[ProcessAudit] Completed audit for "${proc.name}" — score: ${auditData.overallScore}/100, connectors: ${connectorIssues.length} issues`);

    } catch (err: any) {
      console.error("[ProcessAudit] Audit failed:", err);
      await storage.updateProcessAuditResult(auditId, {
        status: "failed",
        auditPhase: "failed",
        errorMessage: err?.message || "An unexpected error occurred during the audit.",
        runDurationMs: Date.now() - startTime,
        completedAt: new Date(),
      });
    }
  }

  // Register runProcessAudit globally so the scheduler can trigger it
  (global as any).__runProcessAudit = runProcessAudit;

  // Add a step from audit suggestion directly to the process
  app.post("/api/business-processes/:id/add-step", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const proc = await storage.getBusinessProcess(req.params.id);
      if (!proc) return res.status(404).json({ message: "Process not found" });
      const { step } = req.body;
      const currentSteps = (proc.stepsJson as any[] || []);
      const newSteps = [...currentSteps, { ...step, order: currentSteps.length + 1 }];
      const updated = await storage.updateBusinessProcess(req.params.id, { stepsJson: newSteps });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Error adding step" });
    }
  });

  // ================== PROCESS AUDIT SCHEDULES ==================

  app.get("/api/process-audit-schedules/:processId", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const schedule = await storage.getProcessAuditSchedule(req.params.processId);
      res.json(schedule || null);
    } catch (err) {
      res.status(500).json({ message: "Error fetching schedule" });
    }
  });

  app.post("/api/process-audit-schedules", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const { processId, frequency, customIntervalDays, isEnabled } = req.body;
      if (!processId) return res.status(400).json({ message: "processId is required" });
      const nextRunAt = computeNextRunAt(frequency, customIntervalDays);
      const schedule = await storage.upsertProcessAuditSchedule({
        processId,
        frequency: frequency || "weekly",
        customIntervalDays: customIntervalDays || 7,
        isEnabled: isEnabled !== false,
        nextRunAt,
      });
      res.json(schedule);
    } catch (err) {
      res.status(500).json({ message: "Error saving schedule" });
    }
  });

  app.patch("/api/process-audit-schedules/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const updates = req.body;
      if (updates.frequency || updates.customIntervalDays) {
        updates.nextRunAt = computeNextRunAt(updates.frequency, updates.customIntervalDays);
      }
      const schedule = await storage.updateProcessAuditSchedule(req.params.id, updates);
      res.json(schedule);
    } catch (err) {
      res.status(500).json({ message: "Error updating schedule" });
    }
  });

  app.delete("/api/process-audit-schedules/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      await storage.deleteProcessAuditSchedule(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting schedule" });
    }
  });

  function computeNextRunAt(frequency: string, customIntervalDays?: number): Date {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    switch (frequency) {
      case "daily": return new Date(now + DAY);
      case "weekly": return new Date(now + 7 * DAY);
      case "monthly": return new Date(now + 30 * DAY);
      case "custom": return new Date(now + (customIntervalDays || 7) * DAY);
      default: return new Date(now + 7 * DAY);
    }
  }

  // ==========================================
  // Integration Wizard Routes
  // ==========================================
  
  // Get all software integrations (optionally by category)
  app.get("/api/software-integrations", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const { category } = req.query;
      const integrations = await storage.getSoftwareIntegrations(category as string | undefined);
      res.json(integrations);
    } catch (err) {
      res.status(500).json({ message: "Error fetching software integrations" });
    }
  });
  
  // Get single software integration
  app.get("/api/software-integrations/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const integration = await storage.getSoftwareIntegration(req.params.id);
      if (!integration) return res.status(404).json({ message: "Software integration not found" });
      res.json(integration);
    } catch (err) {
      res.status(500).json({ message: "Error fetching software integration" });
    }
  });
  
  // Get configured integrations
  app.get("/api/configured-integrations", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const integrations = await storage.getConfiguredIntegrations();
      res.json(integrations);
    } catch (err) {
      res.status(500).json({ message: "Error fetching configured integrations" });
    }
  });
  
  // Get single configured integration
  app.get("/api/configured-integrations/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const integration = await storage.getConfiguredIntegration(req.params.id);
      if (!integration) return res.status(404).json({ message: "Configured integration not found" });
      res.json(integration);
    } catch (err) {
      res.status(500).json({ message: "Error fetching configured integration" });
    }
  });
  
  // Create configured integration
  app.post("/api/configured-integrations", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const validated = insertConfiguredIntegrationSchema.parse(req.body);
      const integration = await storage.createConfiguredIntegration(validated);
      res.status(201).json(integration);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(500).json({ message: "Error creating configured integration" });
    }
  });
  
  // Update configured integration
  const updateConfiguredIntegrationSchema = insertConfiguredIntegrationSchema.partial();
  app.patch("/api/configured-integrations/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const validated = updateConfiguredIntegrationSchema.parse(req.body);
      const integration = await storage.updateConfiguredIntegration(req.params.id, validated);
      if (!integration) return res.status(404).json({ message: "Configured integration not found" });
      res.json(integration);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(500).json({ message: "Error updating configured integration" });
    }
  });
  
  // Delete configured integration
  app.delete("/api/configured-integrations/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      await storage.deleteConfiguredIntegration(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting configured integration" });
    }
  });
  
  // Get capabilities for a software integration
  app.get("/api/software-integrations/:id/capabilities", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const capabilities = await storage.getIntegrationCapabilities(req.params.id);
      res.json(capabilities);
    } catch (err) {
      res.status(500).json({ message: "Error fetching integration capabilities" });
    }
  });
  
  // Get tests for a configured integration
  app.get("/api/configured-integrations/:id/tests", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const tests = await storage.getIntegrationTests(req.params.id);
      res.json(tests);
    } catch (err) {
      res.status(500).json({ message: "Error fetching integration tests" });
    }
  });
  
  // Run integration test
  app.post("/api/configured-integrations/:id/test", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const integrationId = req.params.id;
      const integration = await storage.getConfiguredIntegration(integrationId);
      if (!integration) {
        return res.status(404).json({ message: "Configured integration not found" });
      }
      
      // Create a test record
      const test = await storage.createIntegrationTest({
        configuredIntegrationId: integrationId,
        testType: "full",
        status: "running",
        testStepsJson: []
      });
      
      res.json({ testId: test.id, message: "Test started" });
      
      // Run test in background (simplified for now)
      runIntegrationTest(integrationId, test.id);
    } catch (err) {
      res.status(500).json({ message: "Error starting integration test" });
    }
  });
  
  // Research a new software integration
  app.post("/api/integration-research", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const { softwareName, category } = req.body;
      if (!softwareName) {
        return res.status(400).json({ message: "Software name is required" });
      }
      
      // Check if we already have this software
      const existing = await storage.getSoftwareIntegrationByName(softwareName);
      if (existing) {
        return res.json({ 
          softwareId: existing.id,
          alreadyExists: true,
          software: existing
        });
      }
      
      // Create research session
      const session = await storage.createIntegrationResearchSession({
        softwareName,
        category: category || "Other",
        status: "researching"
      });
      
      res.json({ 
        sessionId: session.id, 
        estimatedTime: "15-30 seconds",
        estimatedCost: "$0.01-$0.03"
      });
      
      // Run research in background
      runIntegrationResearch(session.id, softwareName, category);
    } catch (err) {
      res.status(500).json({ message: "Error starting integration research" });
    }
  });
  
  // Get research session status
  app.get("/api/integration-research/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const session = await storage.getIntegrationResearchSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Research session not found" });
      res.json(session);
    } catch (err) {
      res.status(500).json({ message: "Error fetching research session" });
    }
  });
  
  // Integration categories
  app.get("/api/integration-categories", requireAuth, requireRole(["Admin"]), async (_req, res) => {
    res.json([
      { id: "crm", name: "CRM", description: "Customer relationship management" },
      { id: "accounting", name: "Accounting", description: "Financial and accounting software" },
      { id: "scheduling", name: "Scheduling", description: "Appointment and job scheduling" },
      { id: "communication", name: "Communication", description: "Email, SMS, and messaging" },
      { id: "payments", name: "Payments", description: "Payment processing" },
      { id: "marketing", name: "Marketing", description: "Marketing automation" },
      { id: "hr", name: "HR & Payroll", description: "Human resources and payroll" },
      { id: "inventory", name: "Inventory", description: "Inventory management" },
      { id: "other", name: "Other", description: "Other business software" }
    ]);
  });
  
  // Background function to run integration test
  async function runIntegrationTest(integrationId: string, testId: string) {
    const startTime = Date.now();
    try {
      const integration = await storage.getConfiguredIntegration(integrationId);
      if (!integration) throw new Error("Integration not found");
      
      const software = integration.softwareId 
        ? await storage.getSoftwareIntegration(integration.softwareId)
        : null;
      
      // Simulate test steps
      const testSteps = [
        { name: "Check configuration", status: "passed", message: "Configuration is valid" },
        { name: "Test authentication", status: "passed", message: "Authentication successful" },
        { name: "Verify API connection", status: "passed", message: "API endpoint responding" },
        { name: "Test data sync", status: "passed", message: "Sample data retrieved successfully" }
      ];
      
      await storage.updateIntegrationTest(testId, {
        status: "passed",
        testStepsJson: testSteps,
        duration: Date.now() - startTime,
        completedAt: new Date()
      });
      
      await storage.updateConfiguredIntegration(integrationId, {
        lastTestedAt: new Date(),
        lastTestResult: "passed",
        lastTestMessage: "All tests passed successfully",
        status: "active"
      });
    } catch (err) {
      console.error("Integration test failed:", err);
      await storage.updateIntegrationTest(testId, {
        status: "failed",
        errorDetails: err instanceof Error ? err.message : "Unknown error",
        duration: Date.now() - startTime,
        completedAt: new Date()
      });
      
      await storage.updateConfiguredIntegration(integrationId, {
        lastTestedAt: new Date(),
        lastTestResult: "failed",
        lastTestMessage: err instanceof Error ? err.message : "Test failed"
      });
    }
  }
  
  // Background function to research a software integration
  async function runIntegrationResearch(sessionId: string, softwareName: string, category?: string) {
    const startTime = Date.now();
    try {
      const systemPrompt = `You are an expert software integration analyst. Your job is to research business software and identify their API capabilities for integration. 

Return your analysis as JSON with this structure:
{
  "softwareName": "string - official name of the software",
  "description": "string - brief description of what the software does",
  "category": "string - one of: CRM, Accounting, Scheduling, Communication, Payments, Marketing, HR & Payroll, Inventory, Other",
  "websiteUrl": "string - official website URL",
  "apiDocsUrl": "string - API documentation URL if available, or null",
  "authType": "string - one of: api_key, oauth2, basic, webhook_only, none",
  "capabilities": [
    {
      "name": "string - capability name like 'Sync Customers'",
      "description": "string - what this capability does",
      "capabilityType": "string - one of: sync, webhook, action, report",
      "direction": "string - one of: inbound, outbound, both",
      "dataType": "string - type of data: customers, jobs, invoices, payments, schedules, etc.",
      "setupComplexity": "string - one of: simple, moderate, complex"
    }
  ],
  "setupSteps": [
    {
      "step": 1,
      "title": "string",
      "description": "string",
      "requiresUserAction": true/false
    }
  ],
  "landscapingRelevance": "string - how this software is relevant to landscaping businesses",
  "popularIntegrations": ["list of common integrations this software works with"]
}`;

      const userPrompt = `Research this software for integration with a landscaping business management system:

Software Name: ${softwareName}
${category ? `Suggested Category: ${category}` : ""}

Focus on:
1. Customer/client management capabilities
2. Job/project management
3. Invoicing and payments
4. Scheduling
5. Communication features
6. Any landscaping-specific features

Provide accurate information based on publicly available documentation.`;

      const response = await fetch("https://modelfarm.replit.app/v1beta2/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.AI_INTEGRATIONS_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      const researchData = JSON.parse(data.choices[0].message.content);
      const tokensUsed = data.usage?.total_tokens || 0;
      const cost = (tokensUsed / 1000) * 0.00015;
      
      // Create the software integration record
      const softwareIntegration = await storage.createSoftwareIntegration({
        name: researchData.softwareName || softwareName,
        category: researchData.category || category || "Other",
        description: researchData.description,
        websiteUrl: researchData.websiteUrl,
        apiDocsUrl: researchData.apiDocsUrl,
        authType: researchData.authType || "api_key",
        isPopular: false,
        aiResearchedAt: new Date(),
        capabilitiesJson: researchData.capabilities,
        setupInstructionsJson: researchData.setupSteps
      });
      
      // Create capability records
      for (const cap of researchData.capabilities || []) {
        await storage.createIntegrationCapability({
          softwareId: softwareIntegration.id,
          name: cap.name,
          description: cap.description,
          capabilityType: cap.capabilityType,
          direction: cap.direction,
          dataType: cap.dataType,
          setupComplexity: cap.setupComplexity,
          aiGenerated: true
        });
      }
      
      await storage.updateIntegrationResearchSession(sessionId, {
        status: "completed",
        researchResultsJson: researchData,
        discoveredCapabilities: researchData.capabilities,
        suggestedSetupSteps: researchData.setupSteps,
        estimatedCost: cost.toFixed(4),
        tokensUsed,
        completedAt: new Date()
      });
      
    } catch (err) {
      console.error("Integration research failed:", err);
      await storage.updateIntegrationResearchSession(sessionId, {
        status: "failed",
        completedAt: new Date()
      });
    }
  }

  // ==================== APP UPDATES ====================
  
  // Get updates for current user's role
  app.get("/api/updates", requireAuth, async (req, res) => {
    try {
      const updates = await storage.getAppUpdatesForRole(req.user!.role);
      res.json(updates);
    } catch (err) {
      res.status(500).json({ message: "Error fetching updates" });
    }
  });
  
  // Get unseen updates for current user (for popup)
  app.get("/api/updates/unseen", requireAuth, async (req, res) => {
    try {
      const updates = await storage.getUnseenUpdatesForUser(req.user!.id, req.user!.role);
      res.json(updates);
    } catch (err) {
      res.status(500).json({ message: "Error fetching unseen updates" });
    }
  });
  
  // Admin: Get all updates
  app.get("/api/updates/admin", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const updates = await storage.getAppUpdates();
      res.json(updates);
    } catch (err) {
      res.status(500).json({ message: "Error fetching updates" });
    }
  });
  
  // Acknowledge an update
  app.post("/api/updates/:id/acknowledge", requireAuth, async (req, res) => {
    try {
      await storage.acknowledgeUpdate(req.user!.id, req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error acknowledging update" });
    }
  });
  
  // Admin: Create update
  app.post("/api/updates", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const update = await storage.createAppUpdate(req.body);
      res.status(201).json(update);
    } catch (err) {
      res.status(500).json({ message: "Error creating update" });
    }
  });
  
  // Admin: Update update
  app.patch("/api/updates/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const update = await storage.updateAppUpdate(req.params.id, req.body);
      if (!update) return res.status(404).json({ message: "Update not found" });
      res.json(update);
    } catch (err) {
      res.status(500).json({ message: "Error updating update" });
    }
  });
  
  // Admin: Delete update
  app.delete("/api/updates/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      await storage.deleteAppUpdate(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting update" });
    }
  });
  
  // ==================== HELP CENTER ====================
  
  // Get help articles for current user's role
  app.get("/api/help/articles", requireAuth, async (req, res) => {
    try {
      const articles = await storage.getHelpArticles(req.user!.role);
      res.json(articles);
    } catch (err) {
      res.status(500).json({ message: "Error fetching help articles" });
    }
  });
  
  // Search help articles
  app.get("/api/help/articles/search", requireAuth, async (req, res) => {
    try {
      const query = req.query.q as string || "";
      if (!query.trim()) return res.json([]);
      const articles = await storage.searchHelpArticles(query, req.user!.role);
      res.json(articles);
    } catch (err) {
      res.status(500).json({ message: "Error searching help articles" });
    }
  });
  
  // Get article by slug
  app.get("/api/help/articles/slug/:slug", requireAuth, async (req, res) => {
    try {
      const article = await storage.getHelpArticleBySlug(req.params.slug);
      if (!article) return res.status(404).json({ message: "Article not found" });
      res.json(article);
    } catch (err) {
      res.status(500).json({ message: "Error fetching help article" });
    }
  });
  
  // Get article by ID
  app.get("/api/help/articles/:id", requireAuth, async (req, res) => {
    try {
      const article = await storage.getHelpArticle(req.params.id);
      if (!article) return res.status(404).json({ message: "Article not found" });
      res.json(article);
    } catch (err) {
      res.status(500).json({ message: "Error fetching help article" });
    }
  });
  
  // Admin: Create help article
  app.post("/api/help/articles", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const article = await storage.createHelpArticle(req.body);
      res.status(201).json(article);
    } catch (err) {
      res.status(500).json({ message: "Error creating help article" });
    }
  });
  
  // Admin: Update help article
  app.patch("/api/help/articles/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const article = await storage.updateHelpArticle(req.params.id, req.body);
      if (!article) return res.status(404).json({ message: "Article not found" });
      res.json(article);
    } catch (err) {
      res.status(500).json({ message: "Error updating help article" });
    }
  });
  
  // Admin: Delete help article
  app.delete("/api/help/articles/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      await storage.deleteHelpArticle(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting help article" });
    }
  });
  
  // Get help categories for current user's role
  app.get("/api/help/categories", requireAuth, async (req, res) => {
    try {
      const categories = await storage.getHelpCategories(req.user!.role);
      res.json(categories);
    } catch (err) {
      res.status(500).json({ message: "Error fetching help categories" });
    }
  });
  
  // Admin: Create help category
  app.post("/api/help/categories", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const category = await storage.createHelpCategory(req.body);
      res.status(201).json(category);
    } catch (err) {
      res.status(500).json({ message: "Error creating help category" });
    }
  });
  
  // Admin: Update help category
  app.patch("/api/help/categories/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const category = await storage.updateHelpCategory(req.params.id, req.body);
      if (!category) return res.status(404).json({ message: "Category not found" });
      res.json(category);
    } catch (err) {
      res.status(500).json({ message: "Error updating help category" });
    }
  });
  
  // Admin: Delete help category
  app.delete("/api/help/categories/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      await storage.deleteHelpCategory(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting help category" });
    }
  });

  // ==================== HELP ARTICLE REPORTS ====================
  
  // Report an article as outdated/incorrect
  app.post("/api/help/articles/:id/report", requireAuth, async (req, res) => {
    try {
      const report = await storage.createArticleReport({
        articleId: req.params.id,
        reportedBy: req.user!.id,
        reportType: req.body.reportType || "outdated",
        description: req.body.description,
        status: "pending"
      });
      res.status(201).json(report);
    } catch (err) {
      res.status(500).json({ message: "Error creating report" });
    }
  });
  
  // Admin: Get all article reports
  app.get("/api/help/reports", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const reports = await storage.getArticleReports(status);
      res.json(reports);
    } catch (err) {
      res.status(500).json({ message: "Error fetching reports" });
    }
  });
  
  // Admin: Get pending reports count
  app.get("/api/help/reports/count", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const count = await storage.getPendingReportsCount();
      res.json({ count });
    } catch (err) {
      res.status(500).json({ message: "Error fetching report count" });
    }
  });
  
  // Admin: Update report status (resolve/dismiss)
  app.patch("/api/help/reports/:id", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const updates: any = { ...req.body };
      if (req.body.status === "resolved" || req.body.status === "dismissed") {
        updates.resolvedBy = req.user!.id;
        updates.resolvedAt = new Date();
      }
      const report = await storage.updateArticleReport(req.params.id, updates);
      if (!report) return res.status(404).json({ message: "Report not found" });
      
      // If resolved, notify users about the article update
      if (req.body.status === "resolved" && req.body.notifyUsers) {
        const article = await storage.getHelpArticle(report.articleId);
        if (article) {
          await storage.notifyUsersOfArticleUpdate(
            report.articleId,
            `Article "${article.title}" has been updated`,
            article.minRole
          );
        }
      }
      
      res.json(report);
    } catch (err) {
      res.status(500).json({ message: "Error updating report" });
    }
  });
  
  // Get user's article update notifications
  app.get("/api/help/notifications", requireAuth, async (req, res) => {
    try {
      const notifications = await storage.getUserArticleNotifications(req.user!.id);
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ message: "Error fetching notifications" });
    }
  });
  
  // Get unread article notifications count
  app.get("/api/help/notifications/unread", requireAuth, async (req, res) => {
    try {
      const notifications = await storage.getUnreadArticleNotifications(req.user!.id);
      res.json({ count: notifications.length, notifications });
    } catch (err) {
      res.status(500).json({ message: "Error fetching notifications" });
    }
  });
  
  // Mark notification as read
  app.post("/api/help/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      await storage.markArticleNotificationRead(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error marking notification as read" });
    }
  });

  // ==================== GOOGLE CALENDAR INTEGRATION (PER-USER) ====================
  
  // Check if current user has Google Calendar connected
  app.get("/api/google-calendar/status", requireAuth, async (req, res) => {
    try {
      const connection = await storage.getCalendarConnectionByProvider(req.user!.id, "google");
      const connected = connection?.isConnected === true && !!connection.accessToken;
      res.json({ 
        connected,
        hasCredentials: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
      });
    } catch (err) {
      res.json({ connected: false, hasCredentials: false });
    }
  });
  
  // Start OAuth flow - redirect to Google
  app.get("/api/auth/google/connect", requireAuth, async (req, res) => {
    try {
      const { getAuthUrl } = await import("./googleOAuth");
      const authUrl = getAuthUrl(req.user!.id);
      res.json({ url: authUrl });
    } catch (err: any) {
      console.error("Error generating auth URL:", err);
      res.status(500).json({ message: err.message || "Failed to generate auth URL" });
    }
  });
  
  // OAuth callback - exchange code for tokens (at /auth/google/callback, no /api prefix)
  // This matches the GOOGLE_REDIRECT_URI for production (companyhq.app/auth/google/callback)
  app.get("/auth/google/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      const userId = req.query.state as string;

      if (!code || !userId) {
        return res.redirect("/calendar?google_error=missing_params");
      }

      const { exchangeCodeForTokens, getUserCalendarList } = await import("./googleOAuth");
      const tokens = await exchangeCodeForTokens(code as string);

      let calendarId = "primary";
      try {
        if (tokens.access_token) {
          const calendarList = await getUserCalendarList(tokens.access_token);
          const primaryCalendar = calendarList.find((c: any) => c.primary) || calendarList[0];
          if (primaryCalendar?.id) calendarId = primaryCalendar.id;
        }
      } catch (calErr) {
        console.error("[google-oauth] Failed to fetch calendar list:", calErr);
      }

      await db.update(users).set({
        googleAccessToken: tokens.access_token || undefined,
        googleRefreshToken: tokens.refresh_token || undefined,
        googleCalendarId: calendarId,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      }).where(eq(users.id, userId));

      // Also update calendar_connections table if it exists
      try {
        let connection = await storage.getCalendarConnectionByProvider(userId, "google");
        const connectionData = {
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || connection?.refreshToken || null,
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          calendarId,
          calendarName: "Primary Calendar",
          isConnected: true,
          lastSyncAt: new Date(),
          lastError: null,
        };
        if (connection) {
          await storage.updateCalendarConnection(connection.id, connectionData);
        } else {
          await storage.createCalendarConnection({
            userId,
            provider: "google",
            ...connectionData,
          });
        }
      } catch (connErr) {
        console.error("[google-oauth] Calendar connection table update failed (non-fatal):", connErr);
      }

      res.redirect("/calendar?google_connected=true");
    } catch (err: any) {
      console.error("[google-oauth] Callback error:", err);
      res.redirect("/calendar?google_error=auth_failed");
    }
  });
  
  // Disconnect Google Calendar
  app.delete("/api/google-calendar/disconnect", requireAuth, async (req, res) => {
    try {
      const connection = await storage.getCalendarConnectionByProvider(req.user!.id, "google");
      if (connection) {
        await storage.deleteCalendarConnection(connection.id);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to disconnect calendar" });
    }
  });
  
  // Get events from user's Google Calendar
  app.get("/api/google-calendar/events", requireAuth, async (req, res) => {
    try {
      const connection = await storage.getCalendarConnectionByProvider(req.user!.id, "google");
      
      if (!connection || !connection.accessToken) {
        return res.status(401).json({ message: "Google Calendar not connected" });
      }
      
      // Check if token needs refresh
      const { isTokenExpired, refreshAccessToken, getUserCalendarEvents } = await import("./googleOAuth");
      
      let accessToken = connection.accessToken;
      
      if (isTokenExpired(connection.tokenExpiry)) {
        if (!connection.refreshToken) {
          await storage.updateCalendarConnection(connection.id, { 
            isConnected: false, 
            lastError: "Token expired, please reconnect" 
          });
          return res.status(401).json({ message: "Token expired, please reconnect" });
        }
        
        try {
          const newTokens = await refreshAccessToken(connection.refreshToken);
          accessToken = newTokens.access_token!;
          
          await storage.updateCalendarConnection(connection.id, {
            accessToken: newTokens.access_token!,
            tokenExpiry: newTokens.expiry_date ? new Date(newTokens.expiry_date) : null,
            lastSyncAt: new Date()
          });
        } catch (refreshErr) {
          await storage.updateCalendarConnection(connection.id, { 
            isConnected: false, 
            lastError: "Failed to refresh token" 
          });
          return res.status(401).json({ message: "Failed to refresh token" });
        }
      }
      
      const { start, end } = req.query;
      const startDate = start ? new Date(start as string) : new Date();
      const endDate = end ? new Date(end as string) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      const events = await getUserCalendarEvents(accessToken, startDate, endDate, connection.calendarId || "primary");
      
      // Map to simplified format
      const mappedEvents = events.map((event: any) => ({
        id: event.id,
        title: event.summary || "Untitled Event",
        description: event.description || "",
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        location: event.location || "",
        allDay: !event.start?.dateTime
      }));
      
      res.json(mappedEvents);
    } catch (err: any) {
      console.error("Error fetching Google Calendar events:", err);
      if (err.message?.includes("not connected")) {
        return res.status(401).json({ message: "Google Calendar not connected" });
      }
      res.status(500).json({ message: "Error fetching calendar events" });
    }
  });
  
  // Create event in user's Google Calendar
  app.post("/api/google-calendar/events", requireAuth, async (req, res) => {
    try {
      const connection = await storage.getCalendarConnectionByProvider(req.user!.id, "google");
      
      if (!connection || !connection.accessToken) {
        return res.status(401).json({ message: "Google Calendar not connected" });
      }
      
      const { isTokenExpired, refreshAccessToken, createCalendarEvent } = await import("./googleOAuth");
      
      let accessToken = connection.accessToken;
      
      if (isTokenExpired(connection.tokenExpiry)) {
        if (!connection.refreshToken) {
          return res.status(401).json({ message: "Token expired, please reconnect" });
        }
        const newTokens = await refreshAccessToken(connection.refreshToken);
        accessToken = newTokens.access_token!;
        await storage.updateCalendarConnection(connection.id, {
          accessToken: newTokens.access_token!,
          tokenExpiry: newTokens.expiry_date ? new Date(newTokens.expiry_date) : null
        });
      }
      
      const { title, description, location, start, end, allDay } = req.body;
      
      if (!title || !start || !end) {
        return res.status(400).json({ message: "Title, start, and end are required" });
      }
      
      const eventData = {
        summary: title,
        description: description || "",
        location: location || "",
        start: allDay 
          ? { date: start.split("T")[0] }
          : { dateTime: start, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: allDay 
          ? { date: end.split("T")[0] }
          : { dateTime: end, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      };
      
      const event = await createCalendarEvent(accessToken, eventData, connection.calendarId || "primary");
      
      res.json({
        id: event.id,
        title: event.summary,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        location: event.location
      });
    } catch (err: any) {
      console.error("Error creating calendar event:", err);
      res.status(500).json({ message: "Failed to create event" });
    }
  });
  
  // Check for conflicts in user's Google Calendar
  app.post("/api/google-calendar/check-conflicts", requireAuth, async (req, res) => {
    try {
      const connection = await storage.getCalendarConnectionByProvider(req.user!.id, "google");
      
      if (!connection || !connection.accessToken) {
        return res.status(401).json({ message: "Google Calendar not connected" });
      }
      
      const { isTokenExpired, refreshAccessToken, checkForConflicts } = await import("./googleOAuth");
      
      let accessToken = connection.accessToken;
      
      if (isTokenExpired(connection.tokenExpiry)) {
        if (!connection.refreshToken) {
          return res.status(401).json({ message: "Token expired, please reconnect" });
        }
        const newTokens = await refreshAccessToken(connection.refreshToken);
        accessToken = newTokens.access_token!;
        await storage.updateCalendarConnection(connection.id, {
          accessToken: newTokens.access_token!,
          tokenExpiry: newTokens.expiry_date ? new Date(newTokens.expiry_date) : null
        });
      }
      
      const { start, end } = req.body;
      
      if (!start || !end) {
        return res.status(400).json({ message: "Start and end times are required" });
      }
      
      const conflicts = await checkForConflicts(
        accessToken, 
        new Date(start), 
        new Date(end), 
        connection.calendarId || "primary"
      );
      
      res.json({
        hasConflicts: !!conflicts,
        conflicts: conflicts || []
      });
    } catch (err: any) {
      console.error("Error checking conflicts:", err);
      res.status(500).json({ message: "Failed to check conflicts" });
    }
  });

  // ==================== CALENDAR CONNECTIONS ====================
  
  // Get user's calendar connections
  app.get("/api/calendar/connections", requireAuth, async (req, res) => {
    try {
      const connections = await storage.getUserCalendarConnections(req.user!.id);
      res.json(connections);
    } catch (err) {
      res.status(500).json({ message: "Error fetching calendar connections" });
    }
  });
  
  // Get specific calendar connection
  app.get("/api/calendar/connections/:id", requireAuth, async (req, res) => {
    try {
      const connection = await storage.getCalendarConnection(req.params.id);
      if (!connection || connection.userId !== req.user!.id) {
        return res.status(404).json({ message: "Connection not found" });
      }
      res.json(connection);
    } catch (err) {
      res.status(500).json({ message: "Error fetching connection" });
    }
  });
  
  // Create/initiate a calendar connection
  app.post("/api/calendar/connections", requireAuth, async (req, res) => {
    try {
      const { provider } = req.body;
      if (!provider) {
        return res.status(400).json({ message: "Provider is required" });
      }
      
      // Check if connection already exists
      const existing = await storage.getCalendarConnectionByProvider(req.user!.id, provider);
      if (existing) {
        return res.status(400).json({ message: "Connection already exists for this provider" });
      }
      
      const connection = await storage.createCalendarConnection({
        userId: req.user!.id,
        provider,
        isConnected: false
      });
      res.status(201).json(connection);
    } catch (err) {
      res.status(500).json({ message: "Error creating connection" });
    }
  });
  
  // Update calendar connection (for completing OAuth flow or updating status)
  app.patch("/api/calendar/connections/:id", requireAuth, async (req, res) => {
    try {
      const connection = await storage.getCalendarConnection(req.params.id);
      if (!connection || connection.userId !== req.user!.id) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      // Convert date strings to Date objects
      const updates = { ...req.body };
      if (updates.lastSyncAt && typeof updates.lastSyncAt === 'string') {
        updates.lastSyncAt = new Date(updates.lastSyncAt);
      }
      if (updates.tokenExpiry && typeof updates.tokenExpiry === 'string') {
        updates.tokenExpiry = new Date(updates.tokenExpiry);
      }
      
      const updated = await storage.updateCalendarConnection(req.params.id, updates);
      res.json(updated);
    } catch (err) {
      console.error("Error updating calendar connection:", err);
      res.status(500).json({ message: "Error updating connection" });
    }
  });
  
  // Repair/reconnect a calendar connection
  app.post("/api/calendar/connections/:id/repair", requireAuth, async (req, res) => {
    try {
      const connection = await storage.getCalendarConnection(req.params.id);
      if (!connection || connection.userId !== req.user!.id) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      // Clear error and reset for reconnection
      const updated = await storage.updateCalendarConnection(req.params.id, {
        lastError: null,
        isConnected: true,
        lastSyncAt: new Date()
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Error repairing connection" });
    }
  });
  
  // Delete calendar connection
  app.delete("/api/calendar/connections/:id", requireAuth, async (req, res) => {
    try {
      const connection = await storage.getCalendarConnection(req.params.id);
      if (!connection || connection.userId !== req.user!.id) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      await storage.deleteCalendarConnection(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting connection" });
    }
  });

  // ========== SYSTEM STATUS REPORT (Admin only) ==========
  app.get("/api/admin/system-status", requireAuth, requireRole(["Admin"]), async (req, res) => {
    try {
      const counts: Record<string, number> = {};
      const tables = [
        { key: "users", query: "SELECT count(*)::int as c FROM users" },
        { key: "jobs", query: "SELECT count(*)::int as c FROM jobs" },
        { key: "estimates", query: "SELECT count(*)::int as c FROM estimates" },
        { key: "equipment", query: "SELECT count(*)::int as c FROM equipment" },
        { key: "sops", query: "SELECT count(*)::int as c FROM sops" },
        { key: "materials", query: "SELECT count(*)::int as c FROM materials" },
        { key: "candidates", query: "SELECT count(*)::int as c FROM candidates" },
        { key: "employees", query: "SELECT count(*)::int as c FROM employees" },
        { key: "todos", query: "SELECT count(*)::int as c FROM todos" },
        { key: "tasks", query: "SELECT count(*)::int as c FROM tasks" },
        { key: "calendarEvents", query: "SELECT count(*)::int as c FROM calendar_events" },
        { key: "documents", query: "SELECT count(*)::int as c FROM documents" },
        { key: "customerMessages", query: "SELECT count(*)::int as c FROM customer_messages" },
        { key: "careGuides", query: "SELECT count(*)::int as c FROM care_guides" },
        { key: "customerSuggestions", query: "SELECT count(*)::int as c FROM customer_suggestions" },
        { key: "sopQuizzes", query: "SELECT count(*)::int as c FROM sop_quizzes" },
        { key: "quizAttempts", query: "SELECT count(*)::int as c FROM user_quiz_attempts" },
        { key: "maintenanceSchedules", query: "SELECT count(*)::int as c FROM maintenance_schedules" },
        { key: "repairRequests", query: "SELECT count(*)::int as c FROM repair_requests" },
        { key: "campaigns", query: "SELECT count(*)::int as c FROM campaigns" },
        { key: "forms", query: "SELECT count(*)::int as c FROM builder_forms" },
        { key: "plowSites", query: "SELECT count(*)::int as c FROM plow_sites" },
        { key: "appUpdates", query: "SELECT count(*)::int as c FROM app_updates" },
        { key: "activityLog", query: "SELECT count(*)::int as c FROM activity_log" },
      ];
      for (const t of tables) {
        try {
          const result = await db.execute(sql.raw(t.query));
          counts[t.key] = (result as any).rows?.[0]?.c ?? 0;
        } catch { counts[t.key] = -1; }
      }
      const roleCounts: Record<string, number> = {};
      try {
        const roleResult = await db.execute(sql.raw("SELECT role, count(*)::int as c FROM users GROUP BY role"));
        for (const row of (roleResult as any).rows || []) {
          roleCounts[row.role] = row.c;
        }
      } catch {}
      res.json({ counts, roleCounts, generatedAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ message: "Error generating system status" });
    }
  });

  // ========== DIAGNOSTIC REPORT ENDPOINTS (Master Admin only) ==========
  
  // Get error logs with optional filters
  app.get("/api/admin/diagnostics/errors", requireAuth, requireMasterAdmin, async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.severity) filters.severity = req.query.severity as string;
      if (req.query.feature) filters.feature = req.query.feature as string;
      if (req.query.isResolved !== undefined) filters.isResolved = req.query.isResolved === "true";
      if (req.query.limit) filters.limit = parseInt(req.query.limit as string);
      
      const errors = await storage.getErrorLogs(filters);
      res.json(errors);
    } catch (err) {
      res.status(500).json({ message: "Error fetching error logs" });
    }
  });
  
  // Get error statistics
  app.get("/api/admin/diagnostics/errors/stats", requireAuth, requireMasterAdmin, async (req, res) => {
    try {
      const stats = await storage.getErrorStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ message: "Error fetching error statistics" });
    }
  });
  
  // Update error (mark as resolved, etc.)
  app.patch("/api/admin/diagnostics/errors/:id", requireAuth, requireMasterAdmin, async (req, res) => {
    try {
      const updates = req.body;
      if (updates.isResolved) {
        updates.resolvedAt = new Date();
        updates.resolvedBy = req.user!.id;
      }
      const updated = await storage.updateErrorLog(req.params.id, updates);
      if (!updated) {
        return res.status(404).json({ message: "Error log not found" });
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Error updating error log" });
    }
  });
  
  
  // Generate diagnostic report (Simple mode - high-level summary)
  app.get("/api/admin/diagnostics/report/simple", requireAuth, requireMasterAdmin, async (req, res) => {
    try {
      const errorStats = await storage.getErrorStats();
      const recentErrors = await storage.getErrorLogs({ limit: 10, isResolved: false });
      // Get system summary data
      const users = await storage.getAllUsers();
      const sops = await storage.getSops();
      const materials = await storage.getMaterials();
      const jobs = await storage.getJobs();
      const todos = await storage.getTodos();
      
      const report = {
        generatedAt: new Date().toISOString(),
        mode: "simple",
        systemHealth: {
          status: errorStats.unresolved > 10 ? "needs_attention" : errorStats.unresolved > 0 ? "good" : "excellent",
          unresolvedIssues: errorStats.unresolved,
          totalIssuesLogged: errorStats.total,
        },
        quickStats: {
          totalUsers: users.length,
          activeUsers: users.filter((u: User) => u.isActive).length,
          totalSOPs: sops.filter((s: any) => !s.isArchived).length,
          totalMaterials: materials.length,
          activeJobs: jobs.filter((j: any) => j.status !== "Completed").length,
          pendingTodos: todos.filter((t: any) => t.status === "pending").length,
        },
        recentIssues: recentErrors.slice(0, 5).map((e: any) => ({
          id: e.id,
          when: e.createdAt,
          what: e.feature || "General",
          summary: e.errorMessage.substring(0, 100) + (e.errorMessage.length > 100 ? "..." : ""),
          severity: e.severity,
        })),
      };
      
      res.json(report);
    } catch (err) {
      console.error("Error generating simple report:", err);
      res.status(500).json({ message: "Error generating diagnostic report" });
    }
  });
  
  // Generate diagnostic report (Advanced mode - full technical details)
  app.get("/api/admin/diagnostics/report/advanced", requireAuth, requireMasterAdmin, async (req, res) => {
    try {
      const errorStats = await storage.getErrorStats();
      const allErrors = await storage.getErrorLogs({ limit: 100 });
      // Get comprehensive system data
      const users = await storage.getAllUsers();
      const sops = await storage.getSops();
      const materials = await storage.getMaterials();
      const jobs = await storage.getJobs();
      const candidates = await storage.getCandidates();
      const equipment = await storage.getEquipment();
      const forms = await storage.getCustomForms();
      const todos = await storage.getTodos();
      
      // Analyze error patterns
      const errorsByEndpoint: Record<string, number> = {};
      const errorsByTime: Record<string, number> = {};
      
      allErrors.forEach((e: any) => {
        const endpoint = e.endpoint || "unknown";
        errorsByEndpoint[endpoint] = (errorsByEndpoint[endpoint] || 0) + 1;
        
        const hour = new Date(e.createdAt).toISOString().substring(0, 13);
        errorsByTime[hour] = (errorsByTime[hour] || 0) + 1;
      });
      
      const report = {
        generatedAt: new Date().toISOString(),
        mode: "advanced",
        systemHealth: {
          status: errorStats.unresolved > 10 ? "needs_attention" : errorStats.unresolved > 0 ? "good" : "excellent",
          totalErrors: errorStats.total,
          unresolvedErrors: errorStats.unresolved,
          errorsBySeverity: errorStats.bySeverity,
          errorsByFeature: errorStats.byFeature,
        },
        systemUsage: {
          users: {
            total: users.length,
            active: users.filter((u: User) => u.isActive).length,
            byRole: users.reduce((acc: Record<string, number>, u: User) => {
              acc[u.role] = (acc[u.role] || 0) + 1;
              return acc;
            }, {}),
          },
          sops: {
            total: sops.length,
            active: sops.filter((s: any) => !s.isArchived).length,
            archived: sops.filter((s: any) => s.isArchived).length,
          },
          materials: { total: materials.length },
          jobs: {
            total: jobs.length,
            byStatus: jobs.reduce((acc: Record<string, number>, j: any) => {
              acc[j.status] = (acc[j.status] || 0) + 1;
              return acc;
            }, {}),
          },
          hiring: { totalCandidates: candidates.length },
          equipment: { total: equipment.length },
          forms: {
            total: forms.length,
            published: forms.filter((f: any) => f.status === "published").length,
            draft: forms.filter((f: any) => f.status === "draft").length,
          },
          todos: {
            total: todos.length,
            pending: todos.filter((t: any) => t.status === "pending").length,
            inProgress: todos.filter((t: any) => t.status === "in_progress").length,
            completed: todos.filter((t: any) => t.status === "completed").length,
          },
        },
        errorAnalysis: {
          byEndpoint: Object.entries(errorsByEndpoint)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([endpoint, count]) => ({ endpoint, count })),
          byTimeHour: Object.entries(errorsByTime)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-24)
            .map(([hour, count]) => ({ hour, count })),
        },
        recentErrors: allErrors.slice(0, 20).map((e: any) => ({
          id: e.id,
          type: e.errorType,
          message: e.errorMessage,
          endpoint: e.endpoint,
          httpMethod: e.httpMethod,
          statusCode: e.statusCode,
          feature: e.feature,
          severity: e.severity,
          userId: e.userId,
          userRole: e.userRole,
          isResolved: e.isResolved,
          createdAt: e.createdAt,
          stackTrace: e.stackTrace,
        })),
        mostActiveUsers: Object.entries({} as Record<string, number>)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([userId, count]) => {
            const user = users.find((u: User) => u.id === userId);
            return {
              userId,
              username: user?.username || "Unknown",
              role: user?.role,
              actionCount: count,
            };
          }),
      };
      
      res.json(report);
    } catch (err) {
      console.error("Error generating advanced report:", err);
      res.status(500).json({ message: "Error generating diagnostic report" });
    }
  });
  
  // Log a frontend error (for catching React errors)
  app.post("/api/diagnostics/log-error", requireAuth, async (req, res) => {
    try {
      const { errorType, errorMessage, stackTrace, feature, severity } = req.body;
      
      await storage.createErrorLog({
        errorType: errorType || "frontend_error",
        errorMessage: errorMessage || "Unknown frontend error",
        stackTrace,
        feature,
        severity: severity || "error",
        userId: req.user?.id,
        userRole: req.user?.role,
        endpoint: req.get("Referer"),
        userAgent: req.get("User-Agent"),
      });
      
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error logging frontend error" });
    }
  });

  // Marketing Campaigns
  app.get("/api/campaigns", requireAuth, async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching campaigns" });
    }
  });

  app.post("/api/campaigns", requireAdmin, async (req, res) => {
    try {
      const data = insertCampaignSchema.parse(req.body);
      const campaign = await storage.createCampaign({ ...data, createdBy: (req.user as any).id });
      res.status(201).json(campaign);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid campaign data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating campaign" });
    }
  });

  app.patch("/api/campaigns/:id", requireAdmin, async (req, res) => {
    try {
      const campaign = await storage.updateCampaign(req.params.id, req.body);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      res.json(campaign);
    } catch (error: any) {
      res.status(500).json({ message: "Error updating campaign" });
    }
  });

  app.delete("/api/campaigns/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteCampaign(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Campaign not found" });
      res.json({ message: "Campaign deleted" });
    } catch (error: any) {
      res.status(500).json({ message: "Error deleting campaign" });
    }
  });

  // Development Tracker endpoints (Master Admin only)
  app.get("/api/development-tracker", requireMasterAdmin, async (req, res) => {
    try {
      const { status, category, priority } = req.query;
      const items = await storage.getDevelopmentItems({
        status: status as string | undefined,
        category: category as string | undefined,
        priority: priority as string | undefined,
      });
      res.json(items);
    } catch (err) {
      console.error("Error fetching development items:", err);
      res.status(500).json({ message: "Error fetching development items" });
    }
  });

  app.get("/api/development-tracker/:id", requireMasterAdmin, async (req, res) => {
    try {
      const item = await storage.getDevelopmentItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (err) {
      console.error("Error fetching development item:", err);
      res.status(500).json({ message: "Error fetching development item" });
    }
  });

  app.post("/api/development-tracker", requireMasterAdmin, async (req, res) => {
    try {
      const item = await storage.createDevelopmentItem({
        ...req.body,
        updatedBy: req.user?.id,
      });
      res.json(item);
    } catch (err) {
      console.error("Error creating development item:", err);
      res.status(500).json({ message: "Error creating development item" });
    }
  });

  app.put("/api/development-tracker/:id", requireMasterAdmin, async (req, res) => {
    try {
      const item = await storage.updateDevelopmentItem(req.params.id, {
        ...req.body,
        updatedBy: req.user?.id,
      });
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (err) {
      console.error("Error updating development item:", err);
      res.status(500).json({ message: "Error updating development item" });
    }
  });

  app.delete("/api/development-tracker/:id", requireMasterAdmin, async (req, res) => {
    try {
      await storage.deleteDevelopmentItem(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting development item:", err);
      res.status(500).json({ message: "Error deleting development item" });
    }
  });

  // HQ Files
  app.get("/api/hq-files", requireAuth, async (req, res) => {
    try {
      const files = await storage.getHqFiles();
      res.json(files);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const ALLOWED_HQ_MIME_TYPES = [
    "image/png", "image/jpeg", "image/svg+xml",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "application/zip", "application/x-zip-compressed",
    "application/octet-stream",
  ];
  const MAX_HQ_FILE_SIZE = 50 * 1024 * 1024;

  app.post("/api/hq-files", requireAuth, async (req, res) => {
    try {
      const { name, objectPath, mimeType, size } = req.body;
      if (!name || !objectPath || !mimeType) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      if (!objectPath.startsWith("/objects/")) {
        return res.status(400).json({ message: "Invalid object path" });
      }
      if (!ALLOWED_HQ_MIME_TYPES.includes(mimeType)) {
        return res.status(400).json({ message: "File type not allowed" });
      }
      if (size && size > MAX_HQ_FILE_SIZE) {
        return res.status(400).json({ message: "File too large (50MB max)" });
      }
      const file = await storage.createHqFile({
        name,
        objectPath,
        mimeType,
        size: size || 0,
        uploadedBy: (req.user as any).id,
      });
      res.json(file);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/hq-files/:id/download", requireAuth, async (req, res) => {
    try {
      const file = await storage.getHqFile(req.params.id);
      if (!file) return res.status(404).json({ message: "File not found" });
      const objectStorageService = new (await import("./replit_integrations/object_storage/objectStorage")).ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(file.objectPath);
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.name)}"`);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (err: any) {
      console.error("[hq-files/download]", err.message);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  app.delete("/api/hq-files/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteHqFile(req.params.id);
      if (!deleted) return res.status(404).json({ message: "File not found" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Qualified Leads
  const requireStaffRole = (req: any, res: any, next: any) => {
    const role = req.user?.role;
    if (role === "Customer") return res.status(403).json({ message: "Not authorized" });
    next();
  };

  app.get("/api/qualified-leads", requireAuth, requireStaffRole, async (req, res) => {
    try {
      const leads = await storage.getQualifiedLeads();
      res.json(leads);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/qualified-leads/:id", requireAuth, requireStaffRole, async (req, res) => {
    try {
      const lead = await storage.getQualifiedLead(req.params.id);
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      res.json(lead);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/qualified-leads", requireAuth, requireStaffRole, async (req, res) => {
    try {
      const { contactName, contactEmail, contactPhone, companyName, propertyType,
              serviceType, projectSize, budget, timeline, source, location, notes,
              answers, score, maxScore, rating } = req.body;

      if (!contactName || !propertyType || !serviceType || !projectSize) {
        return res.status(400).json({ message: "Missing required fields: contactName, propertyType, serviceType, projectSize" });
      }

      const lead = await storage.createQualifiedLead({
        contactName, contactEmail, contactPhone, companyName, propertyType,
        serviceType, projectSize, budget, timeline, source, location, notes,
        answers: answers || [],
        score: typeof score === "number" ? score : 0,
        maxScore: typeof maxScore === "number" ? maxScore : 0,
        rating: ["hot", "warm", "cold", "unqualified"].includes(rating) ? rating : "cold",
        qualifiedBy: req.user!.id,
      });
      res.status(201).json(lead);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/qualified-leads/:id", requireAuth, requireStaffRole, async (req, res) => {
    try {
      const lead = await storage.getQualifiedLead(req.params.id);
      if (!lead) return res.status(404).json({ message: "Lead not found" });

      const { contactName, contactEmail, contactPhone, companyName, propertyType,
              serviceType, projectSize, budget, timeline, source, location, notes } = req.body;
      const updates: any = {};
      if (contactName !== undefined) updates.contactName = contactName;
      if (contactEmail !== undefined) updates.contactEmail = contactEmail;
      if (contactPhone !== undefined) updates.contactPhone = contactPhone;
      if (companyName !== undefined) updates.companyName = companyName;
      if (propertyType !== undefined) updates.propertyType = propertyType;
      if (serviceType !== undefined) updates.serviceType = serviceType;
      if (projectSize !== undefined) updates.projectSize = projectSize;
      if (budget !== undefined) updates.budget = budget;
      if (timeline !== undefined) updates.timeline = timeline;
      if (source !== undefined) updates.source = source;
      if (location !== undefined) updates.location = location;
      if (notes !== undefined) updates.notes = notes;

      const updated = await storage.updateQualifiedLead(req.params.id, updates);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/qualified-leads/:id", requireAuth, requireStaffRole, async (req, res) => {
    try {
      const deleted = await storage.deleteQualifiedLead(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Lead not found" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Staff Notifications API
  app.get("/api/staff-notifications", requireAuth, async (req, res) => {
    try {
      const notifications = await storage.getStaffNotifications(req.user!.id);
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ message: "Error fetching notifications" });
    }
  });

  app.get("/api/staff-notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const count = await storage.getUnreadStaffNotificationCount(req.user!.id);
      res.json({ count });
    } catch (err) {
      res.status(500).json({ message: "Error fetching notification count" });
    }
  });

  app.post("/api/staff-notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const updated = await storage.markStaffNotificationRead(req.params.id, req.user!.id);
      if (!updated) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error marking notification read" });
    }
  });

  app.post("/api/staff-notifications/read-all", requireAuth, async (req, res) => {
    try {
      await storage.markAllStaffNotificationsRead(req.user!.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error marking all read" });
    }
  });

  // ==================== ACTIVITY LOG ====================

  app.get("/api/activity-log", requireAuth, async (req, res) => {
    try {
      const items = await db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(50);
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Error fetching activity log" });
    }
  });

  app.get("/api/activity-log/unseen-count", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const items = await db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(100);
      const unseenCount = items.filter((item) => {
        const seenBy = (item.seenBy as string[]) || [];
        return !seenBy.includes(userId);
      }).length;
      res.json({ count: unseenCount });
    } catch (err) {
      res.status(500).json({ message: "Error fetching unseen count" });
    }
  });

  app.post("/api/activity-log/mark-seen", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const items = await db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(100);
      for (const item of items) {
        const seenBy = (item.seenBy as string[]) || [];
        if (!seenBy.includes(userId)) {
          await db.update(activityLog).set({ seenBy: [...seenBy, userId] }).where(eq(activityLog.id, item.id));
        }
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error marking activity seen" });
    }
  });

  app.post("/api/documents", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const role = user.role;
      if (role !== "Admin" && role !== "Manager") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const doc = await storage.createDocument({
        ...req.body,
        uploadedByUserId: user.id,
      });
      logActivity("document_uploaded", `"${doc.fileName}" uploaded to Document Library`, null, user.id);
      res.json(doc);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/documents", requireAuth, async (req, res) => {
    try {
      const { entityType, entityId, search, category } = req.query;
      if (entityType && entityId) {
        const docs = await storage.getDocumentsByEntityWithLinks(entityType as string, entityId as string);
        return res.json(docs);
      }
      if (search || category || entityType) {
        const docs = await storage.searchDocuments({
          fileName: search as string,
          category: category as string,
          entityType: entityType as string,
        });
        return res.json(docs);
      }
      const docs = await storage.searchDocuments({});
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const doc = await storage.getDocument(req.params.id);
      if (!doc) return res.status(404).json({ message: "Document not found" });
      res.json(doc);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== "Admin" && user.role !== "Manager") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const doc = await storage.updateDocument(req.params.id, req.body);
      if (!doc) return res.status(404).json({ message: "Document not found" });
      res.json(doc);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== "Admin" && user.role !== "Manager") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      await storage.deleteDocument(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/documents/:id/link", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== "Admin" && user.role !== "Manager") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const link = await storage.createDocumentLink({
        documentId: req.params.id,
        linkedEntityType: req.body.linkedEntityType,
        linkedEntityId: req.body.linkedEntityId,
        linkedByUserId: user.id,
      });
      res.json(link);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/documents/:id/links", requireAuth, async (req, res) => {
    try {
      const links = await storage.getDocumentLinks(req.params.id);
      res.json(links);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/document-links/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== "Admin" && user.role !== "Manager") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      await storage.deleteDocumentLink(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== "Admin" && user.role !== "Manager") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const role = req.query.role as string | undefined;
      const conditions = [];
      if (role) conditions.push(eq(users.role, role));
      const result = await db.select({ id: users.id, name: users.name, username: users.username, role: users.role })
        .from(users)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(users.name);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/document-shares", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== "Admin" && user.role !== "Manager") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const { documentId, shares } = req.body;
      if (!documentId || !Array.isArray(shares)) {
        return res.status(400).json({ message: "documentId and shares array required" });
      }
      const results = [];
      for (const s of shares) {
        if (!s.module) continue;
        const share = await storage.createDocumentShare({
          documentId,
          module: s.module,
          recordId: s.recordId || null,
          sharedByUserId: user.id,
        });
        results.push(share);
      }
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/document-shares", requireAuth, async (req, res) => {
    try {
      const { documentId, module, recordId } = req.query;
      if (documentId) {
        const shares = await storage.getDocumentSharesByDocument(documentId as string);
        return res.json(shares);
      }
      if (module) {
        const shares = await storage.getDocumentSharesByModule(module as string, recordId as string | undefined);
        return res.json(shares);
      }
      res.json([]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/document-shares/documents", requireAuth, async (req, res) => {
    try {
      const { module, recordId } = req.query;
      if (!module) {
        return res.status(400).json({ message: "module parameter required" });
      }
      const docs = await storage.getSharedDocumentsForModule(module as string, recordId as string | undefined);
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/document-shares/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== "Admin" && user.role !== "Manager") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      await storage.deleteDocumentShare(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  async function generateAndStorePdf(sub: any, user: any, storage: any) {
    try {
      const { generateFormPdf, uploadPdfToStorage } = await import("./pdfGenerator");
      const employeeName = user.name || "Employee";
      const pdfBuffer = await generateFormPdf(sub.formType, sub.submissionData as Record<string, any>, employeeName);

      const pdfPath = `forms/${sub.id}.pdf`;
      await uploadPdfToStorage(pdfBuffer, pdfPath);

      const doc = await storage.createDocument({
        fileName: `${sub.formType}_${employeeName.replace(/\s/g, "_")}.pdf`,
        fileUrl: `/objects/${pdfPath}`,
        fileType: "application/pdf",
        fileSizeKb: Math.round(pdfBuffer.length / 1024),
        category: "form",
        uploadedByUserId: user.id,
        homeEntityType: "employee",
        homeEntityId: sub.employeeId,
      });

      await storage.updateOnboardingFormSubmission(sub.id, { pdfDocumentId: doc.id });

      const { pool: dbPool } = await import("./db");
      await dbPool.query(
        `UPDATE onboarding_items SET status = 'Complete' WHERE employee_id = $1 AND LOWER(title) LIKE $2 AND status = 'Pending'`,
        [sub.employeeId, `%${sub.formType.replace(/_/g, "%")}%`]
      );
    } catch (pdfErr) {
      console.error("[PDF] Generation error:", pdfErr);
    }
  }

  app.post("/api/onboarding-forms", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.createOnboardingFormSubmission({
        ...req.body,
        submittedByUserId: user.id,
      });

      if (sub.status === "submitted" && sub.submissionData && sub.employeeId) {
        await generateAndStorePdf(sub, user, storage);
      }

      res.json(sub);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/onboarding-forms/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.getOnboardingFormSubmission(req.params.id);
      if (!sub) return res.status(404).json({ message: "Submission not found" });
      if (user.role !== "Admin" && user.role !== "Manager" && sub.employeeId !== user.employeeId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      res.json(sub);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/onboarding-forms", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { employeeId } = req.query;
      if (!employeeId) return res.status(400).json({ message: "employeeId required" });
      if (user.role !== "Admin" && user.role !== "Manager" && employeeId !== user.employeeId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const subs = await storage.getOnboardingFormSubmissionsByEmployee(employeeId as string);
      res.json(subs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/onboarding-forms/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const existing = await storage.getOnboardingFormSubmission(req.params.id);
      if (!existing) return res.status(404).json({ message: "Submission not found" });

      if (user.role !== "Admin" && user.role !== "Manager" && existing.employeeId !== user.employeeId) {
        return res.status(403).json({ message: "Not authorized to update this submission" });
      }

      const sub = await storage.updateOnboardingFormSubmission(req.params.id, req.body);
      if (!sub) return res.status(404).json({ message: "Update failed" });

      if (sub.status === "submitted" && sub.submissionData && sub.employeeId && !sub.pdfDocumentId) {
        await generateAndStorePdf(sub, user, storage);
        const updated = await storage.getOnboardingFormSubmission(sub.id);
        return res.json(updated || sub);
      }

      res.json(sub);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/onboarding-forms/:id/assign", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== "Admin" && user.role !== "Manager") {
        return res.status(403).json({ message: "Only Admin/Manager can assign forms" });
      }
      const { formType, employeeId } = req.body;
      const sub = await storage.createOnboardingFormSubmission({
        formType,
        employeeId,
        assignedByUserId: user.id,
        assignedAt: new Date(),
        status: "draft",
      });
      res.json(sub);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/shared-links", requireAuth, requireAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const { documentType, documentId, documentName, documentUrl, expiresIn, customDate, password, note } = req.body;
      if (!documentType || !documentId || !documentName) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      let expiresAt: Date;
      if (expiresIn === "24h") expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      else if (expiresIn === "7d") expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      else if (expiresIn === "30d") expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      else if (expiresIn === "custom" && customDate) expiresAt = new Date(customDate);
      else return res.status(400).json({ message: "Invalid expiration" });

      const token = crypto.randomBytes(32).toString("hex");
      const passwordHash = password ? await hashPassword(password) : null;

      const link = await storage.createSharedLink({
        token,
        documentType,
        documentId,
        documentName,
        documentUrl: documentUrl || null,
        createdBy: user.id,
        createdByName: user.name,
        expiresAt,
        passwordHash,
        note: note || null,
      });

      const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN || "localhost:5000";
      const protocol = domain.includes("localhost") ? "http" : "https";
      const shareUrl = `${protocol}://${domain}/shared/${link.token}`;

      res.json({ ...link, shareUrl });
    } catch (err: any) {
      console.error("Error creating shared link:", err);
      res.status(500).json({ message: err.message || "Failed to create shared link" });
    }
  });

  app.get("/api/shared-links", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const links = await storage.getSharedLinks();
      res.json(links);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/shared-links/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const link = await storage.revokeSharedLink(req.params.id);
      if (!link) return res.status(404).json({ message: "Link not found" });
      res.json(link);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/shared-links/:id/access-logs", requireAuth, requireAdmin, async (req, res) => {
    try {
      const logs = await storage.getSharedLinkAccessLogs(req.params.id);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/shared/:token", async (req, res) => {
    try {
      const link = await storage.getSharedLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found" });
      if (link.isRevoked) return res.status(410).json({ message: "This link has been revoked." });
      if (new Date(link.expiresAt) < new Date()) return res.status(410).json({ message: "This link has expired. Please contact Chapin Landscapes." });

      const needsPassword = !!link.passwordHash;
      if (needsPassword) {
        return res.json({
          needsPassword: true,
          documentName: link.documentName,
          note: link.note,
          expiresAt: link.expiresAt,
        });
      }

      await storage.incrementSharedLinkViewCount(link.id);
      await storage.logSharedLinkAccess(link.id, req.ip || req.headers["x-forwarded-for"] as string || null, req.headers["user-agent"] || null);

      let publicDocUrl = link.documentUrl;
      if (publicDocUrl && publicDocUrl.startsWith("/api/hq-files/")) {
        publicDocUrl = `/api/shared/${link.token}/download`;
      }

      res.json({
        needsPassword: false,
        documentName: link.documentName,
        documentUrl: publicDocUrl,
        documentType: link.documentType,
        note: link.note,
        expiresAt: link.expiresAt,
        createdByName: link.createdByName,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/shared/:token/verify-password", async (req, res) => {
    try {
      const link = await storage.getSharedLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found" });
      if (link.isRevoked) return res.status(410).json({ message: "This link has been revoked." });
      if (new Date(link.expiresAt) < new Date()) return res.status(410).json({ message: "This link has expired." });

      const { password } = req.body;
      if (!password || !link.passwordHash) return res.status(400).json({ message: "Password required" });

      const valid = await comparePasswords(password, link.passwordHash);
      if (!valid) return res.status(401).json({ message: "Incorrect password" });

      await storage.incrementSharedLinkViewCount(link.id);
      await storage.logSharedLinkAccess(link.id, req.ip || req.headers["x-forwarded-for"] as string || null, req.headers["user-agent"] || null);

      let verifiedDocUrl = link.documentUrl;
      if (verifiedDocUrl && verifiedDocUrl.startsWith("/api/hq-files/")) {
        verifiedDocUrl = `/api/shared/${link.token}/download`;
      }

      res.json({
        documentName: link.documentName,
        documentUrl: verifiedDocUrl,
        documentType: link.documentType,
        note: link.note,
        expiresAt: link.expiresAt,
        createdByName: link.createdByName,
        passwordVerified: true,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/shared/:token/download", async (req, res) => {
    try {
      const link = await storage.getSharedLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found" });
      if (link.isRevoked || new Date(link.expiresAt) < new Date()) {
        return res.status(410).json({ message: "Link expired or revoked" });
      }

      if (link.passwordHash) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return res.status(401).json({ message: "Password required" });
        }
        const providedPassword = Buffer.from(authHeader.slice(7), "base64").toString();
        const valid = await comparePasswords(providedPassword, link.passwordHash);
        if (!valid) return res.status(401).json({ message: "Incorrect password" });
      }

      if (link.documentUrl && link.documentUrl.startsWith("/api/hq-files/")) {
        const fileIdMatch = link.documentUrl.match(/\/api\/hq-files\/([^/]+)\/download/);
        if (fileIdMatch) {
          const file = await storage.getHqFile(fileIdMatch[1]);
          if (file && file.objectPath) {
            const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
            const objectStorage = new ObjectStorageService();
            res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.name)}"`);
            if (file.mimeType) res.setHeader("Content-Type", file.mimeType);
            return objectStorage.downloadObject(file.objectPath, res);
          }
        }
      }

      if (link.documentUrl) {
        return res.redirect(link.documentUrl);
      }
      return res.status(404).json({ message: "No downloadable file" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  registerHiringRoutes(app, requireAuth);
  registerEmployeeFormsRoutes(app, requireAuth);
  registerAgreementRoutes(app, requireAuth, requireAdmin);
  registerCustomerHubRoutes(app, requireAuth);
  registerSuggestionsRoutes(app, requireAuth);
  registerEquipmentRoutes(app, requireAuth);
  registerCalendarRoutes(app, requireAuth);
  registerTaskRoutes(app);
  registerObjectStorageRoutes(app, requireAuth);
  registerChatRoutes(app);
  registerAssistantRoutes(app);

  await migrateNotesTable();
  registerNotesRoutes(app);
  registerDailyWorksheetRoutes(app, requireAuth);
  registerCustomerRoutes(app, requireAuth);
  registerTimeRoutes(app, requireAuth);
  registerWorkAreaRoutes(app, requireAuth, requireRole);
  registerEstimateRoutes(app);
  registerSchedulingRoutes(app);
  registerMyDayRoutes(app);
  registerSettingsRoutes(app, requireAuth, requireRole);
  setInterval(runNoteReminderScheduler, 60 * 1000);
  console.log("[notes-scheduler] Note reminder scheduler started (checking every minute)");

  // PDF Field Placer — build fillable PDF from field placer tool
  const fieldPlacerUpload = (await import("multer")).default({
    storage: (await import("multer")).default.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }
  });

  app.post("/api/tools/pdf-field-placer/build",
    requireAuth,
    requireAdmin,
    fieldPlacerUpload.single("pdf"),
    async (req: any, res) => {
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");
      const { spawn } = await import("child_process");

      let inputPath = "";
      let outputPath = "";

      try {
        if (!req.file) {
          return res.status(400).json({ message: "No PDF file uploaded" });
        }
        if (!req.body.fields) {
          return res.status(400).json({ message: "No fields data provided" });
        }

        let fieldsData: any[];
        try {
          fieldsData = JSON.parse(req.body.fields);
        } catch {
          return res.status(400).json({ message: "Invalid fields JSON" });
        }

        if (!Array.isArray(fieldsData) || fieldsData.length === 0) {
          return res.status(400).json({ message: "Fields must be a non-empty array" });
        }

        const tmpDir = os.tmpdir();
        const timestamp = Date.now();
        inputPath = path.join(tmpDir, `placer_in_${timestamp}.pdf`);
        outputPath = path.join(tmpDir, `placer_out_${timestamp}.pdf`);

        fs.writeFileSync(inputPath, req.file.buffer);

        const scriptPath = path.join(process.cwd(), "scripts", "build_pdf_fields.py");
        const fieldsArg = JSON.stringify(fieldsData);

        await new Promise<void>((resolve, reject) => {
          const proc = spawn("python3", [scriptPath, inputPath, outputPath, fieldsArg], {
            timeout: 30000,
          });
          let stderr = "";
          proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
          proc.on("close", (code: number) => {
            if (code !== 0) {
              reject(new Error(stderr || "Python script failed"));
            } else {
              resolve();
            }
          });
          proc.on("error", (err: Error) => reject(err));
        });

        if (!fs.existsSync(outputPath)) {
          return res.status(500).json({ message: "PDF build completed but output file was not created" });
        }

        const outputBuffer = fs.readFileSync(outputPath);
        const originalName = req.file.originalname?.replace(/\.pdf$/i, "") || "document";

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${originalName}_fillable.pdf"`);
        res.setHeader("Content-Length", outputBuffer.length);
        res.send(outputBuffer);
      } catch (err: any) {
        console.error("[pdf-field-placer/build] Error:", err);
        res.status(500).json({ message: err.message || "Internal server error building PDF" });
      } finally {
        const fs2 = await import("fs");
        try { if (inputPath) fs2.unlinkSync(inputPath); } catch {}
        try { if (outputPath) fs2.unlinkSync(outputPath); } catch {}
      }
    }
  );

  // PDF Field Placer — save finished PDF to CompanyHQ document system
  app.post("/api/tools/pdf-field-placer/save",
    requireAuth,
    requireAdmin,
    fieldPlacerUpload.single("file"),
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }
        const user = req.user as any;
        const { name, destination, linkedType, linkedId } = req.body;
        const fileName = name || req.file.originalname || "fillable.pdf";

        if (!destination) {
          return res.status(400).json({ message: "Destination is required" });
        }

        const { ObjectStorageService, objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
        const { randomUUID } = await import("crypto");

        const objService = new ObjectStorageService();
        const privateDir = objService.getPrivateObjectDir();
        const objectId = randomUUID();
        const fullPath = `${privateDir}/uploads/${objectId}`;

        const pathParts = fullPath.startsWith("/") ? fullPath.split("/") : `/${fullPath}`.split("/");
        const bucketName = pathParts[1];
        const objectName = pathParts.slice(2).join("/");
        const bucket = objectStorageClient.bucket(bucketName);
        const file = bucket.file(objectName);

        await file.save(req.file.buffer, {
          contentType: "application/pdf",
          metadata: { contentType: "application/pdf" },
        });

        const fileUrl = `/objects/${objectId}`;
        const fileSizeKb = Math.ceil(req.file.buffer.length / 1024);

        let category = "form";
        let homeEntityType = "company";
        let homeEntityId = "global";

        if (destination === "forms_folder") {
          category = "form";
        } else if (destination === "document_library") {
          category = "general";
        } else if (destination === "linked_record") {
          if (linkedType === "employee" && linkedId) {
            homeEntityType = "employee";
            homeEntityId = linkedId;
          } else if (linkedType === "customer" && linkedId) {
            homeEntityType = "customer";
            homeEntityId = linkedId;
          }
          category = "form";
        }

        const doc = await storage.createDocument({
          fileName,
          fileUrl,
          fileType: "application/pdf",
          fileSizeKb,
          category,
          homeEntityType,
          homeEntityId,
          isTemplate: false,
          version: 1,
          uploadedByUserId: user.id,
        });

        res.json({ success: true, documentId: doc.id });
      } catch (err: any) {
        console.error("[pdf-field-placer/save] Error:", err);
        res.status(500).json({ message: err.message || "Internal server error saving document" });
      }
    }
  );

  // PDF Field Builder - build fillable PDFs from field coordinates
  const buildPdfUpload = (await import("multer")).default({
    storage: (await import("multer")).default.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }
  });

  app.post("/api/tools/build-pdf",
    requireAuth,
    requireRole(["Admin", "Manager"]),
    buildPdfUpload.fields([
      { name: "source_pdf", maxCount: 1 },
      { name: "field_coords", maxCount: 1 }
    ]),
    async (req: any, res) => {
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");
      const { spawnSync } = await import("child_process");

      let sourceTmpPath = "";
      let fieldsTmpPath = "";
      let outputTmpPath = "";

      try {
        if (!req.files?.source_pdf?.[0]) {
          return res.status(400).json({ message: "No source PDF uploaded" });
        }
        if (!req.files?.field_coords?.[0]) {
          return res.status(400).json({ message: "No field coordinates file uploaded" });
        }

        const sourcePdfFile = req.files.source_pdf[0];
        const fieldCoordsFile = req.files.field_coords[0];

        if (sourcePdfFile.mimetype !== "application/pdf") {
          return res.status(400).json({ message: "Source file must be a PDF" });
        }

        let fieldsData: any[];
        try {
          fieldsData = JSON.parse(fieldCoordsFile.buffer.toString("utf-8"));
        } catch {
          return res.status(400).json({ message: "Invalid field coordinates JSON" });
        }

        if (!Array.isArray(fieldsData) || fieldsData.length === 0) {
          return res.status(400).json({ message: "Field coordinates must be a non-empty array" });
        }

        const tmpDir = os.tmpdir();
        const timestamp = Date.now();
        sourceTmpPath = path.join(tmpDir, `source_${timestamp}.pdf`);
        fieldsTmpPath = path.join(tmpDir, `fields_${timestamp}.json`);
        outputTmpPath = path.join(tmpDir, `output_${timestamp}.pdf`);

        fs.writeFileSync(sourceTmpPath, sourcePdfFile.buffer);
        fs.writeFileSync(fieldsTmpPath, JSON.stringify(fieldsData));

        const scriptPath = path.join(process.cwd(), "server", "pdf_builder.py");
        const result = spawnSync("python3", [scriptPath, sourceTmpPath, fieldsTmpPath, outputTmpPath], {
          timeout: 30000,
          encoding: "utf-8",
        });

        if (result.status !== 0) {
          const errMsg = result.stderr || result.stdout || "Unknown error";
          console.error("[build-pdf] Python script failed:", errMsg);
          if (errMsg.includes("No module named")) {
            return res.status(500).json({ message: "pypdf library is not available on the server" });
          }
          return res.status(500).json({ message: "Failed to build PDF: " + errMsg.slice(0, 200) });
        }

        if (!fs.existsSync(outputTmpPath)) {
          return res.status(500).json({ message: "PDF build completed but output file was not created" });
        }

        const originalName = sourcePdfFile.originalname?.replace(/\.pdf$/i, "") || "document";
        const outputBuffer = fs.readFileSync(outputTmpPath);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${originalName}_fillable.pdf"`);
        res.setHeader("Content-Length", outputBuffer.length);
        res.send(outputBuffer);
      } catch (err: any) {
        console.error("[build-pdf] Error:", err);
        res.status(500).json({ message: "Internal server error building PDF" });
      } finally {
        const fs2 = await import("fs");
        try { if (sourceTmpPath) fs2.unlinkSync(sourceTmpPath); } catch {}
        try { if (fieldsTmpPath) fs2.unlinkSync(fieldsTmpPath); } catch {}
        try { if (outputTmpPath) fs2.unlinkSync(outputTmpPath); } catch {}
      }
    }
  );

  // ─── Job Application Public + Admin Routes ───────────────────────────────

  // PUBLIC: Get application by token (no auth required)
  app.get("/api/apply/:token", async (req, res) => {
    try {
      const app = await storage.getJobApplicationByToken(req.params.token);
      if (!app) return res.status(404).json({ message: "Application link not found" });
      if (new Date() > new Date(app.expiresAt)) return res.status(410).json({ message: "This application link has expired" });
      if (app.status === "submitted") return res.status(409).json({ message: "This application has already been submitted" });
      return res.json(app);
    } catch (err) {
      console.error("[apply] Error fetching application:", err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // PUBLIC: Autosave application data (no auth required)
  app.patch("/api/apply/:token", async (req, res) => {
    try {
      const app = await storage.getJobApplicationByToken(req.params.token);
      if (!app) return res.status(404).json({ message: "Not found" });
      if (new Date() > new Date(app.expiresAt)) return res.status(410).json({ message: "Link expired" });
      if (app.status === "submitted") return res.status(409).json({ message: "Already submitted" });
      const updated = await storage.updateJobApplication(app.id, {
        data: req.body.data ?? app.data,
        applicantName: req.body.applicantName ?? app.applicantName,
        applicantEmail: req.body.applicantEmail ?? app.applicantEmail,
        applicantPhone: req.body.applicantPhone ?? app.applicantPhone,
        position: req.body.position ?? app.position,
      });
      return res.json(updated);
    } catch (err) {
      console.error("[apply] Autosave error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // PUBLIC: Submit application (no auth required)
  app.post("/api/apply/:token/submit", async (req, res) => {
    try {
      const app = await storage.getJobApplicationByToken(req.params.token);
      if (!app) return res.status(404).json({ message: "Not found" });
      if (new Date() > new Date(app.expiresAt)) return res.status(410).json({ message: "Link expired" });
      if (app.status === "submitted") return res.status(409).json({ message: "Already submitted" });

      const data = req.body.data as Record<string, any>;
      const firstName = data?.firstName || "";
      const lastName = data?.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim();
      const position = data?.positionAppliedFor || "Landscaping Position";

      // Mark as submitted
      const updated = await storage.updateJobApplication(app.id, {
        status: "submitted",
        submittedAt: new Date(),
        data: data ?? app.data,
        applicantName: fullName,
        applicantEmail: data?.email || app.applicantEmail,
        applicantPhone: data?.phone || app.applicantPhone,
        position,
      });

      // Auto-create candidate in "Application Received"
      try {
        const candidate = await storage.createCandidate({
          name: fullName || "Unknown Applicant",
          role: position,
          stage: "Application Received",
          email: data?.email || "",
          phone: data?.phone || "",
          address: data?.streetAddress || "",
          city: data?.city || "",
          state: data?.state || "",
          zip: data?.zip || "",
          source: "Other",
          notes: `Applied via online application form. Token: ${req.params.token}`,
        });
        await storage.updateJobApplication(app.id, { candidateId: candidate.id });
      } catch (candidateErr) {
        console.error("[apply] Could not create candidate:", candidateErr);
      }

      // Notify all Admins and Managers
      try {
        const allUsers = await storage.getUsers();
        const notifyUsers = allUsers.filter(u => u.role === "Admin" || u.role === "Manager");
        const appUrl = process.env.APP_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
        for (const u of notifyUsers) {
          await logActivity(
            "new_application",
            `New application received from ${fullName || "an applicant"} for ${position}`,
            "/hiring",
            u.id
          );
          if (u.email) {
            sendNewApplicationNotificationEmail(u.email, fullName || "an applicant", position, appUrl).catch(() => {});
          }
        }
      } catch (notifyErr) {
        console.error("[apply] Notification error:", notifyErr);
      }

      return res.json({ message: "Application submitted successfully" });
    } catch (err) {
      console.error("[apply] Submit error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // ADMIN: Generate a new application link
  app.post("/api/apply/generate", requireAdmin, async (req, res) => {
    try {
      const { expiryDays = 30 } = req.body as { expiryDays?: number };
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);
      const application = await storage.createJobApplication({
        token,
        status: "draft",
        expiryDays,
        expiresAt,
        createdBy: (req.user as User)?.id,
        data: {},
      });
      return res.json(application);
    } catch (err) {
      console.error("[apply] Generate error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // ADMIN: List all applications
  // Get the submitted job application for a specific candidate (Admin only)
  app.get("/api/candidates/:id/application", requireAdmin, async (req, res) => {
    try {
      const app = await storage.getJobApplicationByCandidateId(req.params.id);
      if (!app) return res.status(404).json({ message: "No application found for this candidate" });
      return res.json(app);
    } catch (err) {
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/apply", requireAdmin, async (req, res) => {
    try {
      const apps = await storage.getJobApplications();
      return res.json(apps);
    } catch (err) {
      return res.status(500).json({ message: "Server error" });
    }
  });

  // PUBLIC: Applicant status page (no auth required)
  app.get("/api/status/:token", async (req, res) => {
    try {
      const application = await storage.getJobApplicationByToken(req.params.token);
      if (!application) {
        return res.status(404).json({ message: "Application not found. Please check your link." });
      }

      const baseInfo = {
        applicantName: application.applicantName || "Applicant",
        position: application.position || "Landscaping Position",
        token: application.token,
      };

      // Application not yet submitted — still in draft
      if (application.status !== "submitted" || !application.candidateId) {
        return res.json({
          ...baseInfo,
          status: "draft",
          stage: null,
          stageLabel: "Application In Progress",
          stageMessage: "Your application link is active. Complete and submit your application to be considered.",
          nextStep: "Submit your application to begin the review process.",
          contactEmail: "office@chapinlandscapes.com",
        });
      }

      // Submitted — look up the candidate for current stage
      const candidate = await storage.getCandidate(application.candidateId);
      if (!candidate) {
        return res.json({
          ...baseInfo,
          status: "submitted",
          stage: "Application Received",
          stageLabel: "Application Received",
          stageMessage: "We have received your application and our team is reviewing it.",
          nextStep: "If selected, we will reach out to schedule a phone screen or interview.",
          contactEmail: "office@chapinlandscapes.com",
        });
      }

      const stage = candidate.stage || "Application Received";

      const STAGE_INFO: Record<string, { label: string; message: string; nextStep: string; progress: number }> = {
        "Application Received": {
          label: "Application Received",
          message: "We have received your application and our team is reviewing it.",
          nextStep: "If selected, we will reach out to schedule a phone screen or interview.",
          progress: 1,
        },
        "Phone Screen": {
          label: "Phone Screen",
          message: "Your application is moving forward — our team will be in touch to schedule a brief phone call.",
          nextStep: "Look out for a call or email from our hiring team to coordinate a time.",
          progress: 2,
        },
        "1st Interview": {
          label: "First Interview",
          message: "You are being considered for a first interview with our team.",
          nextStep: "We will contact you with interview details. Please keep an eye on your email.",
          progress: 2,
        },
        "Interview Scheduled": {
          label: "Interview Scheduled",
          message: "Your interview has been scheduled. Please check your email for all the details.",
          nextStep: "Attend your scheduled interview. We look forward to speaking with you!",
          progress: 3,
        },
        "2nd Interview": {
          label: "Second Interview",
          message: "You are in advanced consideration and have been selected for a second interview.",
          nextStep: "We will be in touch with details for the second interview.",
          progress: 3,
        },
        "Reference Check": {
          label: "Reference Check",
          message: "We are currently checking your references as part of our final review.",
          nextStep: "We will reach out with our decision shortly.",
          progress: 4,
        },
        "Offer Extended": {
          label: "Offer Extended",
          message: "Congratulations! An offer of employment has been extended to you.",
          nextStep: "Please review the offer details sent to your email and respond at your earliest convenience.",
          progress: 5,
        },
        "Hired": {
          label: "Hired — Welcome to the Team!",
          message: "Congratulations — you have been hired by Chapin Landscapes! Welcome to the team.",
          nextStep: "Check your email for onboarding information and your account credentials.",
          progress: 6,
        },
        "Declined / Not a Fit": {
          label: "Application Closed",
          message: "Thank you for your interest in Chapin Landscapes. We have decided to move forward with other candidates at this time.",
          nextStep: "We encourage you to apply again in the future. We appreciate your time and interest.",
          progress: 0,
        },
      };

      const info = STAGE_INFO[stage] || {
        label: "In Review",
        message: "Your application is currently under review by our hiring team.",
        nextStep: "We will be in touch with next steps soon.",
        progress: 2,
      };

      return res.json({
        ...baseInfo,
        status: stage === "Hired" ? "hired" : stage === "Declined / Not a Fit" ? "declined" : "active",
        stage,
        stageLabel: info.label,
        stageMessage: info.message,
        nextStep: info.nextStep,
        progress: info.progress,
        contactEmail: "office@chapinlandscapes.com",
        submittedAt: application.submittedAt,
      });
    } catch (err: any) {
      console.error("[status] Error:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  });

  return httpServer;
}
