import type { Express, RequestHandler } from "express";
import { db } from "./db";
import { customerSuggestions, users } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { sendSuggestionConfirmationEmail, sendSuggestionStatusUpdateEmail } from "./email";
import { requireAdmin } from "./auth";

export function registerSuggestionsRoutes(app: Express, requireAuth: RequestHandler) {
  const requireCustomer: RequestHandler = (req: any, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    if (req.user.role !== "Customer") return res.status(403).json({ message: "Customer access only" });
    next();
  };


  app.post("/api/suggestions", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const { title, description } = req.body;
      if (!title || typeof title !== "string" || title.trim().length === 0) {
        return res.status(400).json({ message: "Title is required" });
      }
      if (title.length > 200) {
        return res.status(400).json({ message: "Title must be 200 characters or less" });
      }
      if (description && description.length > 1000) {
        return res.status(400).json({ message: "Description must be 1000 characters or less" });
      }

      const [suggestion] = await db.insert(customerSuggestions).values({
        customerId: req.user.id,
        title: title.trim(),
        description: description?.trim() || null,
      }).returning();

      sendSuggestionConfirmationEmail(
        req.user.email,
        req.user.name,
        title.trim(),
        req.user.language || "en"
      ).catch(err => console.error("[suggestions] Failed to send confirmation email:", err));

      const adminUsers = await db.select().from(users).where(eq(users.role, "Admin"));
      for (const admin of adminUsers) {
        console.log(`[suggestions] New suggestion from ${req.user.name}: "${title.trim()}" — notifying admin ${admin.name}`);
      }

      res.json(suggestion);
    } catch (err) {
      console.error("[suggestions] Error creating suggestion:", err);
      res.status(500).json({ message: "Failed to submit suggestion" });
    }
  });

  app.get("/api/suggestions/mine", requireAuth, requireCustomer, async (req: any, res) => {
    try {
      const suggestions = await db.select()
        .from(customerSuggestions)
        .where(eq(customerSuggestions.customerId, req.user.id))
        .orderBy(desc(customerSuggestions.createdAt));
      res.json(suggestions);
    } catch (err) {
      console.error("[suggestions] Error fetching suggestions:", err);
      res.status(500).json({ message: "Failed to fetch suggestions" });
    }
  });

  app.get("/api/suggestions", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const suggestions = await db.select({
        id: customerSuggestions.id,
        title: customerSuggestions.title,
        description: customerSuggestions.description,
        status: customerSuggestions.status,
        adminNote: customerSuggestions.adminNote,
        createdAt: customerSuggestions.createdAt,
        updatedAt: customerSuggestions.updatedAt,
        customerId: customerSuggestions.customerId,
        customerName: users.name,
        customerEmail: users.email,
      })
        .from(customerSuggestions)
        .innerJoin(users, eq(customerSuggestions.customerId, users.id))
        .orderBy(desc(customerSuggestions.createdAt));
      res.json(suggestions);
    } catch (err) {
      console.error("[suggestions] Error fetching all suggestions:", err);
      res.status(500).json({ message: "Failed to fetch suggestions" });
    }
  });

  app.patch("/api/suggestions/:id", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { status, adminNote } = req.body;
      const validStatuses = ["received", "reviewing", "planned", "completed", "not_planned"];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const [existing] = await db.select()
        .from(customerSuggestions)
        .where(eq(customerSuggestions.id, req.params.id));

      if (!existing) {
        return res.status(404).json({ message: "Suggestion not found" });
      }

      const updateData: any = { updatedAt: new Date() };
      if (status) updateData.status = status;
      if (adminNote !== undefined) updateData.adminNote = adminNote;

      const [updated] = await db.update(customerSuggestions)
        .set(updateData)
        .where(eq(customerSuggestions.id, req.params.id))
        .returning();

      if (status && status !== existing.status) {
        const [customer] = await db.select().from(users).where(eq(users.id, existing.customerId));
        if (customer) {
          sendSuggestionStatusUpdateEmail(
            customer.email,
            customer.name,
            existing.title,
            status,
            adminNote || updateData.adminNote,
            customer.language || "en"
          ).catch(err => console.error("[suggestions] Failed to send status update email:", err));
        }
      }

      res.json(updated);
    } catch (err) {
      console.error("[suggestions] Error updating suggestion:", err);
      res.status(500).json({ message: "Failed to update suggestion" });
    }
  });
}
