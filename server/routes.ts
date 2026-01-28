import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireAdmin, hashPassword } from "./auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerChatRoutes } from "./replit_integrations/chat/routes";
import { sendMaintenanceReminderEmail } from "./email";
import OpenAI from "openai";
import { insertSopTemplateSchema, insertSopExampleSchema, insertFormFolderSchema, insertFormTemplateSchema } from "@shared/schema";

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
      const { password, recoveryToken, recoveryExpires, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      res.status(500).json({ message: "Error fetching profile" });
    }
  });

  app.patch("/api/profile", requireAuth, async (req, res) => {
    try {
      const { name, email, bio, phone, profilePicture, theme } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (bio !== undefined) updates.bio = bio;
      if (phone !== undefined) updates.phone = phone;
      if (profilePicture !== undefined) updates.profilePicture = profilePicture;
      if (theme !== undefined) updates.theme = theme;
      
      const user = await storage.updateUser(req.user!.id, updates);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, recoveryToken, recoveryExpires, ...safeUser } = user;
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

  app.patch("/api/company-settings", requireAdmin, async (req, res) => {
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
      const todo = await storage.getTodo(req.params.id);
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
      const todo = await storage.updateTodo(req.params.id, req.body);
      if (!todo) return res.status(404).json({ message: "Todo not found" });
      res.json(todo);
    } catch (err) {
      res.status(500).json({ message: "Error updating todo" });
    }
  });

  app.delete("/api/todos/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTodo(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting todo" });
    }
  });

  // To-Do Assignments
  app.get("/api/todos/:id/assignments", requireAuth, async (req, res) => {
    try {
      const assignments = await storage.getTodoAssignments(req.params.id);
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
        todoId: req.params.id,
        userId: req.body.userId
      });
      res.status(201).json(assignment);
    } catch (err) {
      res.status(500).json({ message: "Error creating assignment" });
    }
  });

  app.delete("/api/todo-assignments/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTodoAssignment(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting assignment" });
    }
  });

  app.post("/api/todos/:id/mark-read", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      await storage.markTodoAsRead(req.params.id, user.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error marking todo as read" });
    }
  });

  // Active To-Do Users
  app.get("/api/todo-active-users", requireAdmin, async (req, res) => {
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
      const activeUser = await storage.activateTodoUser(req.params.userId, admin.id);
      res.status(201).json(activeUser);
    } catch (err) {
      res.status(500).json({ message: "Error activating todo user" });
    }
  });

  app.delete("/api/todo-active-users/:userId", requireAdmin, async (req, res) => {
    try {
      await storage.deactivateTodoUser(req.params.userId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deactivating todo user" });
    }
  });

  registerObjectStorageRoutes(app, requireAuth);
  registerChatRoutes(app);

  return httpServer;
}
