import type { Express } from "express";
import { storage } from "./storage";
import { canAssignTo, canCreateTasks, getAssignableRoles, canTransitionStatus, canUserTransition } from "./taskValidation";

export function registerTaskRoutes(app: Express) {
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    next();
  };

  const requireTaskCreator = (req: any, res: any, next: any) => {
    if (!canCreateTasks(req.user)) return res.status(403).json({ message: "Not authorized to create tasks" });
    next();
  };

  app.get("/api/tasks/assignable-users", requireAuth, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      const assignableRoles = getAssignableRoles(req.user);
      const assignable = users
        .filter(u => u.isActive && assignableRoles.includes(u.role))
        .map(u => ({ id: u.id, name: u.name, role: u.role, username: u.username }));
      res.json(assignable);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tasks/dashboard", requireAuth, async (req: any, res) => {
    try {
      const counts = await storage.getTaskDashboardCounts(req.user.id);
      res.json(counts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tasks", requireAuth, requireTaskCreator, async (req: any, res) => {
    try {
      const { title, description, type, priority, assignedToUserId, dueDate, dueTime,
        category, estimatedMinutes, location, requiresConfirmation,
        isRecurring, recurringConfig, checklistItems } = req.body;

      if (!title || !assignedToUserId) {
        return res.status(400).json({ message: "Title and assignee required" });
      }

      if (assignedToUserId !== req.user.id) {
        const assignee = await storage.getUser(assignedToUserId);
        if (!assignee || !canAssignTo(req.user, assignee)) {
          return res.status(403).json({ message: "Not authorized to assign to this user" });
        }
      }

      const task = await storage.createTask({
        title: title.substring(0, 120),
        description,
        type: type || "standard",
        priority: priority || "p3_normal",
        status: "assigned",
        createdByUserId: req.user.id,
        assignedToUserId,
        dueDate: dueDate ? new Date(dueDate) : null,
        dueTime: dueTime || null,
        category: category || null,
        estimatedMinutes: estimatedMinutes || null,
        location: location || null,
        requiresConfirmation: requiresConfirmation ?? false,
        isRecurring: isRecurring ?? false,
        recurringConfig: recurringConfig || null,
      });

      await storage.createTaskHistory({
        taskId: task.id,
        eventType: "created",
        changedByUserId: req.user.id,
        newValue: JSON.stringify({ title: task.title, priority: task.priority, assignee: assignedToUserId }),
      });

      if (checklistItems && Array.isArray(checklistItems)) {
        for (let i = 0; i < checklistItems.length; i++) {
          if (checklistItems[i]?.text || checklistItems[i]?.itemText) {
            await storage.createTaskChecklistItem({
              taskId: task.id,
              itemText: checklistItems[i].text || checklistItems[i].itemText,
              sortOrder: i,
            });
          }
        }
      }

      res.status(201).json(task);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tasks/my", requireAuth, async (req: any, res) => {
    try {
      const allTasks = await storage.getTasksByAssignee(req.user.id);
      const users = await storage.getAllUsers();
      const userMap = new Map(users.map(u => [u.id, u.name]));
      const now = new Date();

      const enriched = allTasks.map(t => ({
        ...t,
        assigneeName: userMap.get(t.assignedToUserId) || "Unknown",
        creatorName: userMap.get(t.createdByUserId) || "Unknown",
        isOverdue: t.dueDate && new Date(t.dueDate) < now && !["completed", "confirmed", "cancelled"].includes(t.status),
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tasks/assigned", requireAuth, async (req: any, res) => {
    try {
      const allTasks = await storage.getTasksByCreator(req.user.id);
      const users = await storage.getAllUsers();
      const userMap = new Map(users.map(u => [u.id, u.name]));

      const enriched = allTasks.map(t => ({
        ...t,
        assigneeName: userMap.get(t.assignedToUserId) || "Unknown",
        creatorName: userMap.get(t.createdByUserId) || "Unknown",
        isOverdue: t.dueDate && new Date(t.dueDate) < new Date() && !["completed", "confirmed", "cancelled"].includes(t.status),
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tasks/team", requireAuth, async (req: any, res) => {
    try {
      if (!["Admin", "Manager"].includes(req.user.role) && !req.user.isMasterAdmin) {
        return res.status(403).json({ message: "Manager access required" });
      }
      const allTasks = await storage.getAllTasks();
      const users = await storage.getAllUsers();
      const userMap = new Map(users.map(u => [u.id, u.name]));

      const enriched = allTasks.map(t => ({
        ...t,
        assigneeName: userMap.get(t.assignedToUserId) || "Unknown",
        creatorName: userMap.get(t.createdByUserId) || "Unknown",
        isOverdue: t.dueDate && new Date(t.dueDate) < new Date() && !["completed", "confirmed", "cancelled"].includes(t.status),
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tasks/calendar-events", requireAuth, async (req: any, res) => {
    try {
      const myTasks = await storage.getTasksByAssignee(req.user.id);
      const events = myTasks
        .filter(t => t.dueDate && !["completed", "confirmed", "cancelled"].includes(t.status))
        .map(t => ({
          id: t.id,
          title: t.title,
          date: t.dueDate,
          priority: t.priority,
          status: t.status,
          taskId: t.taskId,
        }));
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tasks/reports/individual", requireAuth, async (req: any, res) => {
    try {
      if (!["Admin", "Manager"].includes(req.user.role) && !req.user.isMasterAdmin) {
        return res.status(403).json({ message: "Manager access required" });
      }
      const { userId, start, end } = req.query;
      const allTasks = await storage.getAllTasks();
      const targetTasks = allTasks.filter(t => {
        if (userId && t.assignedToUserId !== userId) return false;
        if (start && t.createdAt && new Date(t.createdAt) < new Date(start as string)) return false;
        if (end && t.createdAt && new Date(t.createdAt) > new Date(end as string)) return false;
        return true;
      });

      const completed = targetTasks.filter(t => ["completed", "confirmed"].includes(t.status));
      const onTime = completed.filter(t => !t.dueDate || new Date(t.completedAt || t.updatedAt!) <= new Date(t.dueDate));
      const late = completed.filter(t => t.dueDate && new Date(t.completedAt || t.updatedAt!) > new Date(t.dueDate));
      const overdue = targetTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !["completed", "confirmed", "cancelled"].includes(t.status));

      const ackTimes = completed
        .filter(t => t.acknowledgedAt && t.createdAt)
        .map(t => (new Date(t.acknowledgedAt!).getTime() - new Date(t.createdAt!).getTime()) / 60000);
      const completionTimes = completed
        .filter(t => t.completedAt && t.createdAt)
        .map(t => (new Date(t.completedAt!).getTime() - new Date(t.createdAt!).getTime()) / 60000);

      res.json({
        totalAssigned: targetTasks.length,
        completedOnTime: onTime.length,
        completedOnTimePercent: targetTasks.length ? Math.round((onTime.length / targetTasks.length) * 100) : 0,
        completedLate: late.length,
        completedLatePercent: targetTasks.length ? Math.round((late.length / targetTasks.length) * 100) : 0,
        overdue: overdue.length,
        avgAckTimeMinutes: ackTimes.length ? Math.round(ackTimes.reduce((a, b) => a + b, 0) / ackTimes.length) : 0,
        avgCompletionTimeMinutes: completionTimes.length ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) : 0,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tasks/reports/team", requireAuth, async (req: any, res) => {
    try {
      if (!["Admin", "Manager"].includes(req.user.role) && !req.user.isMasterAdmin) {
        return res.status(403).json({ message: "Manager access required" });
      }
      const { start, end } = req.query;
      const allTasks = await storage.getAllTasks();
      const users = await storage.getAllUsers();
      const userMap = new Map(users.map(u => [u.id, u.name]));

      const filtered = allTasks.filter(t => {
        if (start && t.createdAt && new Date(t.createdAt) < new Date(start as string)) return false;
        if (end && t.createdAt && new Date(t.createdAt) > new Date(end as string)) return false;
        return true;
      });

      const byPerson = new Map<string, { total: number; completed: number; onTime: number; overdue: number; name: string }>();
      for (const t of filtered) {
        const key = t.assignedToUserId;
        if (!byPerson.has(key)) byPerson.set(key, { total: 0, completed: 0, onTime: 0, overdue: 0, name: userMap.get(key) || "Unknown" });
        const entry = byPerson.get(key)!;
        entry.total++;
        if (["completed", "confirmed"].includes(t.status)) {
          entry.completed++;
          if (!t.dueDate || new Date(t.completedAt || t.updatedAt!) <= new Date(t.dueDate)) entry.onTime++;
        }
        if (t.dueDate && new Date(t.dueDate) < new Date() && !["completed", "confirmed", "cancelled"].includes(t.status)) entry.overdue++;
      }

      const overdueTasks = filtered
        .filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !["completed", "confirmed", "cancelled"].includes(t.status))
        .map(t => ({
          ...t,
          assigneeName: userMap.get(t.assignedToUserId) || "Unknown",
          daysOverdue: Math.floor((Date.now() - new Date(t.dueDate!).getTime()) / (1000 * 60 * 60 * 24)),
        }));

      res.json({
        byPerson: Array.from(byPerson.values()).sort((a, b) => b.total - a.total),
        overdueTasks: overdueTasks.sort((a, b) => b.daysOverdue - a.daysOverdue),
        totalTasks: filtered.length,
        totalCompleted: filtered.filter(t => ["completed", "confirmed"].includes(t.status)).length,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ message: "Task not found" });

      const isAssignee = task.assignedToUserId === req.user.id;
      const isCreator = task.createdByUserId === req.user.id;
      const isAdmin = req.user.role === "Admin" || req.user.isMasterAdmin;
      const isManager = req.user.role === "Manager";
      if (!isAssignee && !isCreator && !isAdmin && !isManager) {
        return res.status(403).json({ message: "Not authorized to view this task" });
      }

      if (isAssignee && task.status === "assigned" && !task.acknowledgedAt) {
        await storage.updateTask(task.id, { acknowledgedAt: new Date(), status: "acknowledged" });
        await storage.createTaskHistory({
          taskId: task.id,
          eventType: "acknowledged",
          changedByUserId: req.user.id,
        });
      }

      const checklist = await storage.getTaskChecklistItems(task.id);
      const history = await storage.getTaskHistory(task.id);
      const attachments = await storage.getTaskAttachments(task.id);
      const delegationChain = await storage.getTaskDelegationChain(task.id);

      const users = await storage.getAllUsers();
      const userMap = new Map(users.map(u => [u.id, u.name]));

      res.json({
        ...task,
        assigneeName: userMap.get(task.assignedToUserId) || "Unknown",
        creatorName: userMap.get(task.createdByUserId) || "Unknown",
        checklist,
        history: history.map(h => ({ ...h, changedByName: userMap.get(h.changedByUserId || "") || "System" })),
        attachments,
        delegationChain: delegationChain.map(d => ({
          ...d,
          fromName: userMap.get(d.fromUserId) || "Unknown",
          toName: userMap.get(d.toUserId) || "Unknown",
        })),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/tasks/:id/status", requireAuth, async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ message: "Task not found" });

      const { status, note, completionNotes, completionPhotoUrl } = req.body;
      if (!status) return res.status(400).json({ message: "Status required" });

      if (!canTransitionStatus(task.status, status)) {
        return res.status(400).json({ message: `Cannot transition from ${task.status} to ${status}` });
      }

      if (!canUserTransition(req.user, task, status)) {
        return res.status(403).json({ message: "Not authorized for this transition" });
      }

      const updates: any = { status };
      if (status === "acknowledged") updates.acknowledgedAt = new Date();
      if (status === "in_progress") updates.startedAt = new Date();
      if (status === "completed") {
        updates.completedAt = new Date();
        if (completionNotes) updates.completionNotes = completionNotes;
        if (completionPhotoUrl) updates.completionPhotoUrl = completionPhotoUrl;
        if (!task.requiresConfirmation) updates.status = "confirmed";
      }
      if (status === "confirmed") updates.confirmedAt = new Date();
      if (status === "cancelled") updates.cancelledAt = new Date();
      if (status === "assigned") {
        updates.completedAt = null;
        updates.completionNotes = null;
      }

      const updated = await storage.updateTask(task.id, updates);

      await storage.createTaskHistory({
        taskId: task.id,
        eventType: "status_changed",
        changedByUserId: req.user.id,
        oldValue: task.status,
        newValue: updates.status || status,
        note: note || null,
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ message: "Task not found" });

      const isCreator = task.createdByUserId === req.user.id;
      const isAdmin = req.user.role === "Admin" || req.user.isMasterAdmin;
      if (!isCreator && !isAdmin) return res.status(403).json({ message: "Only creator or admin can edit" });

      const { title, description, priority, dueDate, dueTime, category, estimatedMinutes, location, requiresConfirmation } = req.body;
      const updates: any = {};
      if (title !== undefined) updates.title = title.substring(0, 120);
      if (description !== undefined) updates.description = description;
      if (priority !== undefined) updates.priority = priority;
      if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
      if (dueTime !== undefined) updates.dueTime = dueTime;
      if (category !== undefined) updates.category = category;
      if (estimatedMinutes !== undefined) updates.estimatedMinutes = estimatedMinutes;
      if (location !== undefined) updates.location = location;
      if (requiresConfirmation !== undefined) updates.requiresConfirmation = requiresConfirmation;

      const updated = await storage.updateTask(task.id, updates);

      for (const [key, val] of Object.entries(updates)) {
        if ((task as any)[key] !== val) {
          await storage.createTaskHistory({
            taskId: task.id,
            eventType: "edited",
            changedByUserId: req.user.id,
            oldValue: String((task as any)[key] ?? ""),
            newValue: String(val ?? ""),
            note: `Changed ${key}`,
          });
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tasks/:id/reassign", requireAuth, async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ message: "Task not found" });

      const isAssignee = task.assignedToUserId === req.user.id;
      const isCreator = task.createdByUserId === req.user.id;
      const isAdmin = req.user.role === "Admin" || req.user.isMasterAdmin;
      const isManager = req.user.role === "Manager";
      if (!isAssignee && !isCreator && !isAdmin && !isManager) {
        return res.status(403).json({ message: "Not authorized to reassign this task" });
      }

      const { toUserId, reason } = req.body;
      if (!toUserId) return res.status(400).json({ message: "New assignee required" });

      const newAssignee = await storage.getUser(toUserId);
      if (!newAssignee) return res.status(404).json({ message: "User not found" });

      if (!canAssignTo(req.user, newAssignee)) {
        return res.status(403).json({ message: "Not authorized to assign to this user" });
      }

      await storage.createTaskDelegation({
        taskId: task.id,
        fromUserId: task.assignedToUserId,
        toUserId,
        reason: reason || null,
      });

      const updated = await storage.updateTask(task.id, {
        assignedToUserId: toUserId,
        status: "assigned",
        acknowledgedAt: null,
        startedAt: null,
      });

      await storage.createTaskHistory({
        taskId: task.id,
        eventType: "reassigned",
        changedByUserId: req.user.id,
        oldValue: task.assignedToUserId,
        newValue: toUserId,
        note: reason || null,
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tasks/:id/confirm", requireAuth, async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (task.status !== "completed") return res.status(400).json({ message: "Task must be completed first" });

      const isCreator = task.createdByUserId === req.user.id;
      const isAdmin = req.user.role === "Admin" || req.user.isMasterAdmin || req.user.role === "Manager";
      if (!isCreator && !isAdmin) return res.status(403).json({ message: "Only assigner or admin can confirm" });

      const updated = await storage.updateTask(task.id, { status: "confirmed", confirmedAt: new Date() });
      await storage.createTaskHistory({
        taskId: task.id,
        eventType: "confirmed",
        changedByUserId: req.user.id,
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tasks/:id/send-back", requireAuth, async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (task.status !== "completed") return res.status(400).json({ message: "Task must be completed first" });

      const { reason } = req.body;
      if (!reason) return res.status(400).json({ message: "Reason required" });

      const isCreator = task.createdByUserId === req.user.id;
      const isAdmin = req.user.role === "Admin" || req.user.isMasterAdmin || req.user.role === "Manager";
      if (!isCreator && !isAdmin) return res.status(403).json({ message: "Only assigner or admin can send back" });

      const updated = await storage.updateTask(task.id, {
        status: "assigned",
        completedAt: null,
        completionNotes: null,
      });

      await storage.createTaskHistory({
        taskId: task.id,
        eventType: "status_changed",
        changedByUserId: req.user.id,
        oldValue: "completed",
        newValue: "assigned",
        note: reason,
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tasks/:id/checklist", requireAuth, async (req: any, res) => {
    try {
      const { itemText, sortOrder } = req.body;
      if (!itemText) return res.status(400).json({ message: "Item text required" });
      const item = await storage.createTaskChecklistItem({ taskId: req.params.id, itemText, sortOrder: sortOrder || 0 });
      res.status(201).json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/tasks/:id/checklist/:itemId", requireAuth, async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ message: "Task not found" });
      const isAssignee = task.assignedToUserId === req.user.id;
      const isAdmin = req.user.role === "Admin" || req.user.isMasterAdmin;
      if (!isAssignee && !isAdmin) return res.status(403).json({ message: "Not authorized" });

      const { isCompleted } = req.body;
      const updates: any = { isCompleted };
      if (isCompleted) {
        updates.completedBy = req.user.id;
        updates.completedAt = new Date();
      } else {
        updates.completedBy = null;
        updates.completedAt = null;
      }
      const item = await storage.updateTaskChecklistItem(req.params.itemId, updates);
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ message: "Task not found" });
      const isCreator = task.createdByUserId === req.user.id;
      const isAdmin = req.user.role === "Admin" || req.user.isMasterAdmin;
      if (!isCreator && !isAdmin) return res.status(403).json({ message: "Only creator or admin can delete" });
      await storage.deleteTask(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
