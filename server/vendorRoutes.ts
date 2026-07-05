import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { requireRole } from "./auth";
import multer from "multer";
import { parse } from "csv-parse/sync";

type AuthMiddleware = (req: Request, res: Response, next: () => void) => void;

const upload = multer({ storage: multer.memoryStorage() });

export function registerVendorRoutes(app: Express, requireAuth: AuthMiddleware) {
  const requireVendorAccess = [requireAuth, requireRole("Admin", "Manager")];

  app.get("/api/vendors", ...requireVendorAccess, async (req: any, res) => {
    try {
      const list = await storage.getVendors();
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/vendors/:id", ...requireVendorAccess, async (req: any, res) => {
    try {
      const vendor = await storage.getVendor(req.params.id);
      if (!vendor) return res.status(404).json({ message: "Vendor not found" });
      res.json(vendor);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/vendors", ...requireVendorAccess, async (req: any, res) => {
    try {
      const name = (req.body.name || "").trim();
      if (!name) return res.status(400).json({ message: "Name is required" });
      const vendor = await storage.createVendor({ ...req.body, name });
      res.status(201).json(vendor);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/vendors/:id", ...requireVendorAccess, async (req: any, res) => {
    try {
      const updated = await storage.updateVendor(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Vendor not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/vendors/:id", ...requireVendorAccess, async (req: any, res) => {
    try {
      await storage.deleteVendor(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/vendors/import", ...requireVendorAccess, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const text = req.file.buffer.toString("utf-8");
      const records: Record<string, string>[] = parse(text, { columns: true, skip_empty_lines: true, trim: true });

      const results = { imported: 0, updated: 0, skipped: 0, errors: [] as string[] };
      const existing = await storage.getVendors();

      for (const row of records) {
        try {
          const name = row["Name"] || row["name"];
          if (!name) { results.skipped++; continue; }
          const contactName = row["ContactName"] || row["Contact Name"] || row["contactName"] || row["contact_name"] || null;
          const email = row["Email"] || row["email"] || null;
          const phone = row["Phone"] || row["phone"] || null;
          const address = row["Address"] || row["address"] || null;
          const category = row["Category"] || row["category"] || null;
          const notes = row["Notes"] || row["notes"] || null;

          const match = existing.find(v => v.name.trim().toLowerCase() === name.trim().toLowerCase());

          if (match) {
            await storage.updateVendor(match.id, { name, contactName, email, phone, address, category, notes });
            results.updated++;
            continue;
          }

          const created = await storage.createVendor({ name, contactName, email, phone, address, category, notes } as any);
          existing.push(created);
          results.imported++;
        } catch (rowErr: any) {
          results.errors.push(`Row "${row["Name"] || row["name"] || "?"}": ${rowErr.message}`);
          results.skipped++;
        }
      }
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
