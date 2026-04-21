/**
 * Notification Preference Routes
 *
 * GET  /api/users/:id/notification-preferences
 * PUT  /api/users/:id/notification-preferences
 * POST /api/staff-notifications/read-all   (already exists, included for reference)
 * POST /api/staff-notifications/:id/read   (already exists, included for included for reference)
 * POST /api/sms/opt-out                    (handles STOP keyword opt-outs)
 */

import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { log } from "./index";

export function registerNotificationPreferenceRoutes(app: Express): void {

  app.get("/api/users/:id/notification-preferences", async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({ emailNotifications: user.emailNotifications ?? true, smsNotifications: (user as any).smsNotifications ?? true, phone: user.phone || null, email: user.email || null });
    } catch (err: any) {
      log(`GET notification-preferences error: ${err.message}`, "routes");
      res.status(500).json({ error: "Failed to fetch preferences" });
    }
  });

  app.put("/api/users/:id/notification-preferences", async (req: Request, res: Response) => {
    try {
      const { emailNotifications, smsNotifications, phone } = req.body as { emailNotifications?: boolean; smsNotifications?: boolean; phone?: string };
      const updates: Record<string, unknown> = {};
      if (typeof emailNotifications === "boolean") updates.emailNotifications = emailNotifications;
      if (typeof smsNotifications === "boolean") updates.smsNotifications = smsNotifications;
      if (typeof phone === "string") updates.phone = phone.trim() || null;
      await storage.updateUser(req.params.id, updates);
      res.json({ success: true, ...updates });
    } catch (err: any) {
      log(`PUT notification-preferences error: ${err.message}`, "routes");
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  app.post("/api/sms/opt-out", async (req: Request, res: Response) => {
    try {
      const { From, Body } = req.body as { From?: string; Body?: string };
      if (!From) return res.status(200).send("<Response></Response>");
      const normalized = From.replace(/\s+/g, "");
      const keyword = (Body || "").trim().toUpperCase();
      if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(keyword)) {
        const allUsers = await storage.getAllUsers();
        const matching = allUsers.filter((u: any) => {
          if (!u.phone) return false;
          const d = u.phone.replace(/\D/g, ""); const fd = normalized.replace(/\D/g, "");
          return d === fd || `1${d}` === fd || d === `1${fd}`;
        });
        for (const u of matching) { await storage.updateUser(u.id, { smsNotifications: false } as any); log(`[sms-optout] Disabled SMS for ${u.id}`, "sms"); }
      }
      res.set("Content-Type", "text/xml"); res.send("<Response></Response>");
    } catch (err: any) { log(`SMS opt-out error: ${err.message}`, "routes"); res.status(200).send("<Response></Response>"); }
  });

  app.post("/api/sms/opt-in", async (req: Request, res: Response) => {
    try {
      const { From, Body } = req.body as { From?: string; Body?: string };
      if (!From) return res.status(200).send("<Response></Response>");
      const normalized = From.replace(/\s+/g, "");
      const keyword = (Body || "").trim().toUpperCase();
      if (["START", "UNSTOP", "YES"].includes(keyword)) {
        const allUsers = await storage.getAllUsers();
        const matching = allUsers.filter((u: any) => {
          if (!u.phone) return false;
          const d = u.phone.replace(/\D/g, ""); const fd = normalized.replace(/\D/g, "");
          return d === fd || `1${d}` === fd || d === `1${fd}`;
        });
        for (const u of matching) { await storage.updateUser(u.id, { smsNotifications: true } as any); log(`[sms-optin] Re-enabled SMS for ${u.id}`, "sms"); }
      }
      res.set("Content-Type", "text/xml"); res.send("<Response></Response>");
    } catch (err: any) { log(`SMS opt-in error: ${err.message}`, "routes"); res.status(200).send("<Response></Response>"); }
  });
}
