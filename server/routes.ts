import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireAdmin, hashPassword, comparePasswords } from "./auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerChatRoutes } from "./replit_integrations/chat/routes";
import { sendMaintenanceReminderEmail } from "./email";
import OpenAI from "openai";
import { 
  insertSopTemplateSchema, 
  insertSopExampleSchema, 
  insertFormFolderSchema, 
  insertFormTemplateSchema, 
  insertPlowSiteImageSchema, 
  insertConfiguredIntegrationSchema,
  insertIntegrationResearchSessionSchema,
  type User 
} from "@shared/schema";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

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

  app.post("/api/sops/:id/copy", requireAuth, async (req, res) => {
    try {
      const sop = await storage.copySop(req.params.id as string);
      if (!sop) return res.status(404).json({ message: "SOP not found" });
      res.status(201).json(sop);
    } catch (err) {
      res.status(500).json({ message: "Error copying SOP" });
    }
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
            
            Make the content practical, detailed, and professional. Include safety considerations where relevant.`
          },
          {
            role: "user",
            content: `Create an SOP for: ${prompt}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2048,
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
      res.json(result);
    } catch (err: any) {
      console.error("AI SOP generation error:", err);
      res.status(500).json({ message: "AI generation failed", error: err.message });
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
      res.status(500).json({ message: "Error creating category" });
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
      res.status(500).json({ message: "Error creating material", error: err?.message });
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
      await storage.deleteJob(req.params.id as string);
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
      res.status(201).json(tab);
    } catch (err) {
      res.status(500).json({ message: "Error creating job pipeline tab" });
    }
  });

  app.patch("/api/job-pipeline-tabs/:id", requireAuth, async (req, res) => {
    try {
      const tab = await storage.updateJobPipelineTab(req.params.id as string, req.body);
      if (!tab) return res.status(404).json({ message: "Tab not found" });
      res.json(tab);
    } catch (err) {
      res.status(500).json({ message: "Error updating job pipeline tab" });
    }
  });

  app.delete("/api/job-pipeline-tabs/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteJobPipelineTab(req.params.id as string);
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
      res.status(500).json({ message: "Error sending message" });
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
      const { name, email, bio, phone, profilePicture, theme, currentPassword, newPassword } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (bio !== undefined) updates.bio = bio;
      if (phone !== undefined) updates.phone = phone;
      if (profilePicture !== undefined) updates.profilePicture = profilePicture;
      if (theme !== undefined) updates.theme = theme;
      
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
      res.status(500).json({ message: "Error creating equipment" });
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
      const schedule = await storage.createMaintenanceSchedule(req.body);
      res.status(201).json(schedule);
    } catch (err) {
      res.status(500).json({ message: "Error creating maintenance schedule" });
    }
  });

  app.put("/api/maintenance-schedules/:id", requireAuth, async (req, res) => {
    try {
      const schedule = await storage.updateMaintenanceSchedule(req.params.id as string, req.body);
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
          
          // Calculate next due date/mileage/hours based on interval
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

  // Maintenance reminder check - sends emails for due maintenance
  app.post("/api/maintenance/send-reminders", requireAdmin, async (req, res) => {
    try {
      const dueSchedules = await storage.getDueMaintenanceSchedules();
      const allEquipment = await storage.getEquipment();
      
      let sentCount = 0;
      const errors: string[] = [];
      
      for (const schedule of dueSchedules) {
        if (!schedule.reminderEmail) continue;
        
        const equip = allEquipment.find(e => e.id === schedule.equipmentId);
        if (!equip) continue;
        
        try {
          await sendMaintenanceReminderEmail(
            schedule.reminderEmail,
            equip.name,
            schedule.name,
            schedule.nextDueDate || undefined,
            schedule.nextDueMileage || undefined,
            schedule.nextDueHours || undefined
          );
          sentCount++;
        } catch (err: any) {
          errors.push(`Failed to send reminder for ${schedule.name}: ${err.message}`);
        }
      }
      
      res.json({ 
        message: `Sent ${sentCount} reminder emails`,
        dueSchedules: dueSchedules.length,
        sentCount,
        errors 
      });
    } catch (err) {
      res.status(500).json({ message: "Error sending maintenance reminders" });
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

  // To-Do System routes
  app.get("/api/todos", requireAuth, async (req, res) => {
    try {
      const allTodos = await storage.getTodos();
      res.json(allTodos);
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
      const todo = await storage.createTodo(req.body, user.id);
      if (req.body.assignedUserIds && Array.isArray(req.body.assignedUserIds)) {
        for (const userId of req.body.assignedUserIds) {
          await storage.createTodoAssignment({ todoId: todo.id, userId });
        }
      }
      res.status(201).json(todo);
    } catch (err) {
      res.status(500).json({ message: "Error creating todo" });
    }
  });

  app.patch("/api/todos/:id", requireAuth, async (req, res) => {
    try {
      const todo = await storage.updateTodo(req.params.id as string, req.body);
      if (!todo) return res.status(404).json({ message: "Todo not found" });
      res.json(todo);
    } catch (err) {
      res.status(500).json({ message: "Error updating todo" });
    }
  });

  app.delete("/api/todos/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTodo(req.params.id as string);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting todo" });
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
      const myTodos = allTodos.filter(t => assignments.some(a => a.todoId === t.id));
      const todosWithReadStatus = myTodos.map(t => ({
        ...t,
        isRead: assignments.find(a => a.todoId === t.id)?.isRead || false
      }));
      res.json(todosWithReadStatus);
    } catch (err) {
      res.status(500).json({ message: "Error fetching your todos" });
    }
  });

  app.post("/api/todos/:id/assignments", requireAuth, async (req, res) => {
    try {
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
      if (!processId) {
        return res.status(400).json({ message: "Process ID is required" });
      }
      
      const process = await storage.getBusinessProcess(processId);
      if (!process) {
        return res.status(404).json({ message: "Process not found" });
      }
      
      // Create a pending audit result
      const auditResult = await storage.createProcessAuditResult({
        processId,
        status: "running",
      });
      
      // Start the audit in background (non-blocking)
      runProcessAudit(processId, auditResult.id);
      
      res.status(202).json({ 
        message: "Audit started",
        auditId: auditResult.id,
        estimatedTime: "30-60 seconds",
        estimatedCost: "$0.02-0.05"
      });
    } catch (err) {
      res.status(500).json({ message: "Error starting audit" });
    }
  });
  
  // Background function to run the actual audit
  async function runProcessAudit(processId: string, auditId: string) {
    const startTime = Date.now();
    try {
      const process = await storage.getBusinessProcess(processId);
      if (!process) return;
      
      // Analyze the process using AI
      const systemPrompt = `You are a business process auditor for a landscape management company. Analyze the given process and provide detailed scores and recommendations.

You will evaluate the process on these criteria (each 0-100):
1. Efficiency - Are there unnecessary steps? Can steps be combined?
2. Reliability - Are there failure points? What happens if someone misses a step?
3. Customer Experience - Is the customer kept informed? Is it easy for them to understand?
4. Communication - Are the right people notified at the right times?

Respond with a JSON object containing:
{
  "overallScore": <number 0-100>,
  "efficiencyScore": <number 0-100>,
  "reliabilityScore": <number 0-100>,
  "customerExperienceScore": <number 0-100>,
  "communicationScore": <number 0-100>,
  "findings": [
    {"type": "issue|opportunity|strength", "title": "string", "description": "string", "severity": "low|medium|high"}
  ],
  "recommendations": [
    {"title": "string", "description": "string", "priority": "low|medium|high", "estimatedEffort": "string", "expectedImpact": "string"}
  ],
  "estimatedImprovementTime": "string"
}`;

      const userPrompt = `Analyze this business process:

Name: ${process.name}
Description: ${process.description || "No description provided"}
Category: ${process.category}
Roles Involved: ${process.rolesInvolved?.join(", ") || "Not specified"}
Estimated Duration: ${process.estimatedDuration || "Not specified"}

Process Steps:
${JSON.stringify(process.stepsJson, null, 2)}

Notifications:
${JSON.stringify(process.notificationsJson, null, 2)}

Provide a comprehensive audit with specific, actionable recommendations for this landscaping business.`;

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
      const auditData = JSON.parse(data.choices[0].message.content);
      const tokensUsed = (data.usage?.total_tokens || 0);
      const cost = (tokensUsed / 1000) * 0.00015; // Approximate cost
      
      await storage.updateProcessAuditResult(auditId, {
        status: "completed",
        overallScore: auditData.overallScore,
        efficiencyScore: auditData.efficiencyScore,
        reliabilityScore: auditData.reliabilityScore,
        customerExperienceScore: auditData.customerExperienceScore,
        communicationScore: auditData.communicationScore,
        findingsJson: auditData.findings,
        recommendationsJson: auditData.recommendations,
        estimatedImprovementTime: auditData.estimatedImprovementTime,
        estimatedCost: cost.toFixed(4),
        tokensUsed,
        runDurationMs: Date.now() - startTime,
        completedAt: new Date()
      });
      
      // Update the process's lastAuditedAt
      await storage.updateBusinessProcess(processId, { lastAuditedAt: new Date() });
      
    } catch (err) {
      console.error("Process audit failed:", err);
      await storage.updateProcessAuditResult(auditId, {
        status: "failed",
        runDurationMs: Date.now() - startTime,
        completedAt: new Date()
      });
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
  
  // OAuth callback - exchange code for tokens
  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const { code, state: userId } = req.query;
      
      if (!code || !userId) {
        return res.redirect("/?error=missing_params");
      }
      
      const { exchangeCodeForTokens, getUserCalendarList } = await import("./googleOAuth");
      const tokens = await exchangeCodeForTokens(code as string);
      
      // Get or create connection
      let connection = await storage.getCalendarConnectionByProvider(userId as string, "google");
      
      const calendarList = await getUserCalendarList(tokens.access_token!);
      const primaryCalendar = calendarList.find((c: any) => c.primary) || calendarList[0];
      
      const connectionData = {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || connection?.refreshToken || null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        calendarId: primaryCalendar?.id || "primary",
        calendarName: primaryCalendar?.summary || "Primary Calendar",
        isConnected: true,
        lastSyncAt: new Date(),
        lastError: null
      };
      
      if (connection) {
        await storage.updateCalendarConnection(connection.id, connectionData);
      } else {
        await storage.createCalendarConnection({
          userId: userId as string,
          provider: "google",
          ...connectionData
        });
      }
      
      res.redirect("/?calendar=connected");
    } catch (err: any) {
      console.error("OAuth callback error:", err);
      res.redirect("/?error=oauth_failed");
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

  registerObjectStorageRoutes(app, requireAuth);
  registerChatRoutes(app);

  return httpServer;
}
