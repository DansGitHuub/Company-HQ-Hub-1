import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { recalculateAssetPriorities, calculateNextDue } from "./priorityEngine";

type AuthMiddleware = (req: Request, res: Response, next: () => void) => void;

function requireRole(...roles: string[]) {
  return (req: any, res: Response, next: () => void) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const userRole = req.user.role;
    const isMasterAdmin = req.user.isMasterAdmin;
    if (isMasterAdmin || roles.includes(userRole)) return next();
    return res.status(403).json({ message: "Insufficient permissions" });
  };
}

function canAccessEquipment(req: any): boolean {
  const role = req.user?.role;
  return ["Admin", "Manager", "Crew"].includes(role) || req.user?.isMasterAdmin;
}

function canManageEquipment(req: any): boolean {
  const role = req.user?.role;
  return ["Admin", "Manager"].includes(role) || req.user?.isMasterAdmin;
}

export function registerEquipmentRoutes(app: Express, requireAuth: AuthMiddleware) {
  const requireEquipAccess = [requireAuth, requireRole("Admin", "Manager", "Crew")];
  const requireManager = [requireAuth, requireRole("Admin", "Manager")];

  app.get("/api/fleet/dashboard", ...requireEquipAccess, async (req: any, res) => {
    try {
      const stats = await storage.getFleetDashboardStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/fleet/assets", ...requireEquipAccess, async (req: any, res) => {
    try {
      const assets = await storage.getEquipment();
      const schedules = await storage.getMaintenanceSchedules();
      const enriched = assets.map(a => {
        const assetSchedules = schedules.filter(s => s.equipmentId === a.id && s.isActive);
        const highestPriority = assetSchedules.reduce<string>((best, s) => {
          const order = { p1: 0, p2: 1, p3: 2, p4: 3 } as Record<string, number>;
          return (order[s.priority || "p4"] ?? 3) < (order[best] ?? 3) ? (s.priority || "p4") : best;
        }, "p4");
        const nextService = assetSchedules
          .filter(s => s.nextDueDate)
          .sort((a, b) => new Date(a.nextDueDate!).getTime() - new Date(b.nextDueDate!).getTime())[0];
        return {
          ...a,
          healthPriority: highestPriority,
          nextServiceTask: nextService?.name,
          nextServiceDate: nextService?.nextDueDate,
          scheduleCount: assetSchedules.length,
        };
      });
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/fleet/assets/:id", ...requireEquipAccess, async (req: any, res) => {
    try {
      const asset = await storage.getEquipmentById(req.params.id);
      if (!asset) return res.status(404).json({ message: "Asset not found" });
      res.json(asset);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/fleet/assets", ...requireManager, async (req: any, res) => {
    try {
      const assetId = await storage.getNextAssetId();
      const asset = await storage.createEquipment({ ...req.body, assetId });
      if (req.body.autoAssignTemplates && asset.make && asset.category) {
        await autoAssignTemplates(asset.id, asset.make, asset.category, asset.currentHours ?? 0);
      }
      res.status(201).json(asset);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/fleet/assets/:id", ...requireManager, async (req: any, res) => {
    try {
      const updated = await storage.updateEquipment(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Asset not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/fleet/assets/:id", ...requireManager, async (req: any, res) => {
    try {
      await storage.deleteEquipment(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/fleet/assets/:id/update-hours", ...requireEquipAccess, async (req: any, res) => {
    try {
      const { hours, mileage } = req.body;
      if (hours == null && mileage == null) return res.status(400).json({ message: "Hours or mileage required" });
      const updateData: any = { lastHoursUpdate: new Date() };
      if (mileage != null) {
        updateData.mileage = mileage;
      }
      if (hours != null) {
        updateData.currentHours = hours;
        updateData.hours = hours;
      }
      const updated = await storage.updateEquipment(req.params.id, updateData);
      if (!updated) return res.status(404).json({ message: "Asset not found" });
      await recalculateAssetPriorities(req.params.id);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/fleet/assets/:id/schedules", ...requireEquipAccess, async (req: any, res) => {
    try {
      const schedules = await storage.getMaintenanceSchedules(req.params.id);
      res.json(schedules);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/fleet/assets/:id/schedules", ...requireManager, async (req: any, res) => {
    try {
      const schedule = await storage.createMaintenanceSchedule({
        ...req.body,
        equipmentId: req.params.id,
      });
      res.status(201).json(schedule);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/fleet/schedules/:id", ...requireManager, async (req: any, res) => {
    try {
      const updated = await storage.updateMaintenanceSchedule(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/fleet/schedules/:id", ...requireManager, async (req: any, res) => {
    try {
      await storage.deleteMaintenanceSchedule(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/fleet/schedules/:id/complete", ...requireEquipAccess, async (req: any, res) => {
    try {
      const schedule = await storage.getMaintenanceSchedule(req.params.id);
      if (!schedule) return res.status(404).json({ message: "Schedule not found" });

      const asset = await storage.getEquipmentById(schedule.equipmentId);
      if (!asset) return res.status(404).json({ message: "Asset not found" });

      const currentHours = asset.currentHours ?? asset.hours ?? 0;
      const now = new Date();

      const log = await storage.createMaintenanceLog({
        equipmentId: schedule.equipmentId,
        scheduleId: schedule.id,
        logType: "scheduled",
        name: schedule.name,
        description: schedule.taskDescription || schedule.description,
        completedDate: now,
        hoursAtService: currentHours,
        mileageAtService: asset.mileage,
        performedBy: req.user.id,
        ...(req.body || {}),
      });

      const nextDue = calculateNextDue(
        { hoursInterval: schedule.hoursInterval, calendarIntervalDays: schedule.calendarIntervalDays },
        currentHours,
        now
      );

      await storage.updateMaintenanceSchedule(schedule.id, {
        lastServiceHours: currentHours,
        lastServiceDate: now,
        lastCompletedDate: now,
        lastCompletedHours: currentHours,
        nextDueHours: nextDue.nextDueHours,
        nextDueDate: nextDue.nextDueDate,
      });

      await recalculateAssetPriorities(schedule.equipmentId);

      res.json({ log, message: "Service logged and schedule updated" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/fleet/assets/:id/service-history", ...requireEquipAccess, async (req: any, res) => {
    try {
      const logs = await storage.getMaintenanceLogs(req.params.id);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/fleet/service-log", ...requireEquipAccess, async (req: any, res) => {
    try {
      const log = await storage.createMaintenanceLog({
        ...req.body,
        performedBy: req.body.performedBy || req.user.id,
      });

      if (req.body.scheduleId) {
        const schedule = await storage.getMaintenanceSchedule(req.body.scheduleId);
        if (schedule) {
          const asset = await storage.getEquipmentById(schedule.equipmentId);
          const currentHours = asset?.currentHours ?? asset?.hours ?? 0;
          const nextDue = calculateNextDue(
            { hoursInterval: schedule.hoursInterval, calendarIntervalDays: schedule.calendarIntervalDays },
            currentHours,
            new Date()
          );
          await storage.updateMaintenanceSchedule(schedule.id, {
            lastServiceHours: req.body.hoursAtService ?? currentHours,
            lastServiceDate: new Date(),
            lastCompletedDate: new Date(),
            nextDueHours: nextDue.nextDueHours,
            nextDueDate: nextDue.nextDueDate,
          });
          await recalculateAssetPriorities(schedule.equipmentId);
        }
      }

      res.status(201).json(log);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/fleet/repair-requests", ...requireEquipAccess, async (req: any, res) => {
    try {
      const assetId = req.query.assetId as string | undefined;
      const requests = await storage.getRepairRequests(assetId);
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/fleet/repair-requests/:id", ...requireEquipAccess, async (req: any, res) => {
    try {
      const request = await storage.getRepairRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Not found" });
      res.json(request);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/fleet/repair-requests", ...requireEquipAccess, async (req: any, res) => {
    try {
      const { assetId, problemDescription, severity, isUsable, updateAssetStatus } = req.body;
      if (!assetId || !problemDescription) return res.status(400).json({ message: "Asset ID and problem description required" });
      const request = await storage.createRepairRequest({
        assetId,
        problemDescription,
        severity: severity || "minor",
        isUsable: isUsable || "yes",
        reportedByUserId: req.user.id,
        status: "open",
      });
      if (updateAssetStatus) {
        await storage.updateEquipment(assetId, { status: "In Service" });
      }
      res.status(201).json(request);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/fleet/repair-requests/:id", ...requireManager, async (req: any, res) => {
    try {
      const updated = await storage.updateRepairRequest(req.params.id, req.body);
      if (req.body.status === "resolved" && updated) {
        const asset = await storage.getEquipmentById(updated.assetId);
        if (asset && asset.status === "In Service") {
          await storage.updateEquipment(updated.assetId, { status: "Active" });
        }
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/fleet/assets/:id/documents", ...requireEquipAccess, async (req: any, res) => {
    try {
      const docs = await storage.getEquipmentUploads(req.params.id);
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/fleet/assets/:id/documents", ...requireEquipAccess, async (req: any, res) => {
    try {
      const doc = await storage.createEquipmentUpload({
        ...req.body,
        equipmentId: req.params.id,
        uploadedBy: req.user.id,
      });
      res.status(201).json(doc);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/fleet/documents/:id", ...requireEquipAccess, async (req: any, res) => {
    try {
      await storage.deleteEquipmentUpload(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/fleet/oem-templates", ...requireEquipAccess, async (req: any, res) => {
    try {
      const brand = req.query.brand as string | undefined;
      const category = req.query.category as string | undefined;
      const templates = await storage.getOemTemplates(brand, category);
      res.json(templates);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/fleet/assets/:id/assign-templates", ...requireManager, async (req: any, res) => {
    try {
      const { templateIds } = req.body;
      const asset = await storage.getEquipmentById(req.params.id);
      if (!asset) return res.status(404).json({ message: "Asset not found" });

      const created = [];
      for (const templateId of templateIds) {
        const template = await storage.getOemTemplate(templateId);
        if (!template) continue;
        const currentHours = asset.currentHours ?? asset.hours ?? 0;
        const nextDue = calculateNextDue(
          { hoursInterval: template.hoursInterval, calendarIntervalDays: template.calendarIntervalDays },
          currentHours,
          new Date()
        );
        const schedule = await storage.createMaintenanceSchedule({
          equipmentId: asset.id,
          templateId: template.id,
          name: template.taskName,
          taskDescription: template.taskDescription,
          description: template.taskDescription,
          intervalType: template.hoursInterval ? "hours" : "days",
          intervalValue: template.hoursInterval || template.calendarIntervalDays || 365,
          hoursInterval: template.hoursInterval,
          calendarIntervalDays: template.calendarIntervalDays,
          nextDueHours: nextDue.nextDueHours,
          nextDueDate: nextDue.nextDueDate,
          isActive: true,
          reminderEnabled: true,
          reminderDays: 7,
        });
        created.push(schedule);
      }

      await recalculateAssetPriorities(req.params.id);
      res.json({ created: created.length, schedules: created });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/fleet/vin-decode/:vin", ...requireEquipAccess, async (req: any, res) => {
    try {
      const { vin } = req.params;
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`);
      const data = await response.json();
      const results = data.Results || [];
      const getValue = (varId: number) => results.find((r: any) => r.VariableId === varId)?.Value || "";
      res.json({
        make: getValue(26),
        model: getValue(28),
        year: getValue(29),
        bodyClass: getValue(5),
        engineCylinders: getValue(13),
        engineDisplacement: getValue(11),
        fuelType: getValue(24),
        transmissionType: getValue(37),
        raw: results.filter((r: any) => r.Value && r.Value.trim()),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/fleet/staff", ...requireEquipAccess, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      const staff = users
        .filter(u => ["Admin", "Manager", "Crew"].includes(u.role) && u.isActive)
        .map(u => ({ id: u.id, name: u.name, role: u.role }));
      res.json(staff);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/fleet/calendar-events", ...requireEquipAccess, async (req: any, res) => {
    try {
      const schedules = await storage.getMaintenanceSchedules();
      const allEquipment = await storage.getEquipment();
      const events = schedules
        .filter(s => s.isActive && s.nextDueDate)
        .map(s => {
          const asset = allEquipment.find(e => e.id === s.equipmentId);
          return {
            id: s.id,
            title: `${asset?.name || "Unknown"} - ${s.name}`,
            date: s.nextDueDate,
            priority: s.priority || "p4",
            assetId: s.equipmentId,
            assetName: asset?.name,
            category: asset?.category,
          };
        });
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}

async function autoAssignTemplates(assetId: string, make: string, category: string, currentHours: number) {
  const templates = await storage.getOemTemplates(make, category);
  if (templates.length === 0) {
    const genericTemplates = await storage.getOemTemplates("Generic", category);
    if (genericTemplates.length === 0) return;
    for (const t of genericTemplates) {
      await createScheduleFromTemplate(assetId, t, currentHours);
    }
    return;
  }
  for (const t of templates) {
    await createScheduleFromTemplate(assetId, t, currentHours);
  }
}

async function createScheduleFromTemplate(assetId: string, template: any, currentHours: number) {
  const nextDue = calculateNextDue(
    { hoursInterval: template.hoursInterval, calendarIntervalDays: template.calendarIntervalDays },
    currentHours,
    new Date()
  );
  await storage.createMaintenanceSchedule({
    equipmentId: assetId,
    templateId: template.id,
    name: template.taskName,
    taskDescription: template.taskDescription,
    description: template.taskDescription,
    intervalType: template.hoursInterval ? "hours" : "days",
    intervalValue: template.hoursInterval || template.calendarIntervalDays || 365,
    hoursInterval: template.hoursInterval,
    calendarIntervalDays: template.calendarIntervalDays,
    nextDueHours: nextDue.nextDueHours,
    nextDueDate: nextDue.nextDueDate,
    isActive: true,
    reminderEnabled: true,
    reminderDays: 7,
  });
}
