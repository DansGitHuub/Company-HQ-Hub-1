import type { Express } from "express";
import { storage } from "./storage";

export function registerTaskRoutes(app: Express) {
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    next();
  };

  const isManagerOrAdmin = (user: any) => ["Admin", "Manager", "Master Admin"].includes(user.role);

  app.get("/api/tasks/assignable-users", requireAuth, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      const assignable = users
        .filter(u => u.isActive && u.role !== "Customer")
        .map(u => ({ id: u.id, name: u.name, role: u.role, username: u.username, profilePictureUrl: u.profilePicture }));
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

  app.get("/api/tasks", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      let allTasks;

      if (isManagerOrAdmin(user)) {
        allTasks = await storage.getAllTasks();
      } else {
        const myTasks = await storage.getTasksByAssignee(user.id);
        const myCreated = await storage.getTasksByCreator(user.id);
        const openPool = await storage.getOpenPoolTasks();
        const taskMap = new Map();
        [...myTasks, ...myCreated, ...openPool].forEach(t => taskMap.set(t.id, t));
        allTasks = Array.from(taskMap.values());
      }

      res.json(allTasks);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tasks/open-pool", requireAuth, async (req: any, res) => {
    try {
      const openTasks = await storage.getOpenPoolTasks();
      res.json(openTasks);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tasks/linked/:recordType/:recordId", requireAuth, async (req: any, res) => {
    try {
      const linkedTasks = await storage.getTasksByLinkedRecord(req.params.recordType, req.params.recordId);
      res.json(linkedTasks);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tasks/my", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const [myTasks, myCreated, openPool] = await Promise.all([
        storage.getTasksByAssignee(userId),
        storage.getTasksByCreator(userId),
        storage.getOpenPoolTasks(),
      ]);
      const taskMap = new Map();
      [...myTasks, ...myCreated, ...openPool].forEach(t => taskMap.set(t.id, t));
      res.json(Array.from(taskMap.values()));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tasks/assigned", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const myTasks = await storage.getTasksByAssignee(userId);
      res.json(myTasks);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tasks/my-upcoming", requireAuth, async (req: any, res) => {
    try {
      const myTasks = await storage.getTasksByAssignee(req.user.id);
      const now = new Date();
      const active = myTasks
        .filter(t => !["complete", "cancelled"].includes(t.status))
        .sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        })
        .slice(0, 5);

      const overdueCount = myTasks.filter(t =>
        t.dueDate && new Date(t.dueDate) < now && !["complete", "cancelled"].includes(t.status)
      ).length;

      res.json({ tasks: active, overdueCount });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tasks/calendar-events", requireAuth, async (req: any, res) => {
    try {
      const allTasks = await storage.getTasksByAssignee(req.user.id);
      const tasksWithDates = allTasks
        .filter(t => t.dueDate && !["complete", "cancelled"].includes(t.status))
        .map(t => ({
          id: `task-${t.id}`,
          title: `Task: ${t.title}`,
          start: t.dueDate,
          end: t.dueDate,
          type: "task",
          priority: t.priority,
          linkedRecordType: "task",
          linkedRecordId: t.id,
        }));
      res.json(tasksWithDates);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ message: "Task not found" });

      const [comments, customFields, attachments, checklist, history] = await Promise.all([
        storage.getTaskComments(task.id),
        storage.getTaskCustomFields(task.id),
        storage.getTaskAttachments(task.id),
        storage.getTaskChecklistItems(task.id),
        storage.getTaskHistory(task.id),
      ]);

      const commentUsers = await Promise.all(
        comments.map(async c => {
          const user = await storage.getUser(c.userId);
          return { ...c, userName: user?.name || "Unknown", userProfilePicture: user?.profilePicture };
        })
      );

      res.json({ ...task, comments: commentUsers, customFields, attachments, checklist, history });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tasks", requireAuth, async (req: any, res) => {
    try {
      const { title, description, status, priority, assignedToUserId, dueDate, startDate,
        estimatedMinutes, linkedRecordType, linkedRecordId, reminderDate,
        customFields, category, location } = req.body;

      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      if (assignedToUserId && assignedToUserId !== req.user.id && !isManagerOrAdmin(req.user)) {
        return res.status(403).json({ message: "Only managers and admins can assign tasks to others" });
      }

      const taskData: any = {
        title,
        description: description || null,
        status: status || "todo",
        priority: priority || "medium",
        createdByUserId: req.user.id,
        assignedToUserId: assignedToUserId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        startDate: startDate ? new Date(startDate) : null,
        estimatedMinutes: estimatedMinutes || null,
        linkedRecordType: linkedRecordType || null,
        linkedRecordId: linkedRecordId || null,
        reminderDate: reminderDate ? new Date(reminderDate) : null,
        category: category || null,
        location: location || null,
      };

      const task = await storage.createTask(taskData);

      if (customFields && Array.isArray(customFields)) {
        for (const cf of customFields) {
          if (cf.fieldName) {
            await storage.createTaskCustomField({ taskId: task.id, fieldName: cf.fieldName, fieldValue: cf.fieldValue || null });
          }
        }
      }

      await storage.createTaskHistory({
        taskId: task.id,
        eventType: "created",
        changedByUserId: req.user.id,
        newValue: title,
      });

      res.status(201).json(task);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ message: "Task not found" });

      const user = req.user;
      const canEdit = isManagerOrAdmin(user) || task.createdByUserId === user.id || task.assignedToUserId === user.id;
      if (!canEdit) return res.status(403).json({ message: "Not authorized to edit this task" });

      if (req.body.assignedToUserId !== undefined && req.body.assignedToUserId !== user.id && !isManagerOrAdmin(user)) {
        return res.status(403).json({ message: "Only managers and admins can reassign tasks" });
      }

      const updates: any = {};
      const allowedFields = ['title', 'description', 'status', 'priority', 'assignedToUserId',
        'dueDate', 'startDate', 'estimatedMinutes', 'linkedRecordType', 'linkedRecordId',
        'reminderDate', 'category', 'location', 'completionNotes'];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          if (['dueDate', 'startDate', 'reminderDate'].includes(field)) {
            updates[field] = req.body[field] ? new Date(req.body[field]) : null;
          } else {
            updates[field] = req.body[field];
          }
        }
      }

      if (req.body.status === "complete" && task.status !== "complete") {
        updates.completedAt = new Date();
      }
      if (req.body.status === "cancelled" && task.status !== "cancelled") {
        updates.cancelledAt = new Date();
      }
      if (req.body.status === "in_progress" && task.status !== "in_progress") {
        updates.startedAt = new Date();
      }

      if (req.body.status && req.body.status !== task.status) {
        await storage.createTaskHistory({
          taskId: task.id,
          eventType: "status_change",
          changedByUserId: user.id,
          oldValue: task.status,
          newValue: req.body.status,
        });
      }

      if (req.body.assignedToUserId !== undefined && req.body.assignedToUserId !== task.assignedToUserId) {
        await storage.createTaskHistory({
          taskId: task.id,
          eventType: "assignment_change",
          changedByUserId: user.id,
          oldValue: task.assignedToUserId || "unassigned",
          newValue: req.body.assignedToUserId || "unassigned",
        });
      }

      const updated = await storage.updateTask(req.params.id, updates);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ message: "Task not found" });

      if (!isManagerOrAdmin(req.user) && task.createdByUserId !== req.user.id) {
        return res.status(403).json({ message: "Only managers, admins, or task creator can delete tasks" });
      }

      await storage.deleteTask(req.params.id);
      res.json({ message: "Task deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tasks/:id/comments", requireAuth, async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ message: "Task not found" });

      const { body } = req.body;
      if (!body || !body.trim()) return res.status(400).json({ message: "Comment body is required" });

      const comment = await storage.createTaskComment({
        taskId: task.id,
        userId: req.user.id,
        body: body.trim(),
      });

      const user = await storage.getUser(req.user.id);
      res.status(201).json({ ...comment, userName: user?.name || "Unknown", userProfilePicture: user?.profilePicture });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/tasks/:taskId/comments/:commentId", requireAuth, async (req: any, res) => {
    try {
      const comments = await storage.getTaskComments(req.params.taskId);
      const comment = comments.find(c => c.id === req.params.commentId);
      if (!comment) return res.status(404).json({ message: "Comment not found" });

      if (comment.userId !== req.user.id && !isManagerOrAdmin(req.user)) {
        return res.status(403).json({ message: "Not authorized to delete this comment" });
      }

      await storage.deleteTaskComment(req.params.commentId);
      res.json({ message: "Comment deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tasks/:id/custom-fields", requireAuth, async (req: any, res) => {
    try {
      const { fieldName, fieldValue } = req.body;
      if (!fieldName) return res.status(400).json({ message: "Field name is required" });

      const field = await storage.createTaskCustomField({
        taskId: req.params.id,
        fieldName,
        fieldValue: fieldValue || null,
      });
      res.status(201).json(field);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/tasks/:taskId/custom-fields/:fieldId", requireAuth, async (req: any, res) => {
    try {
      const updated = await storage.updateTaskCustomField(req.params.fieldId, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/tasks/:taskId/custom-fields/:fieldId", requireAuth, async (req: any, res) => {
    try {
      await storage.deleteTaskCustomField(req.params.fieldId);
      res.json({ message: "Custom field deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tasks/:id/attachments", requireAuth, async (req: any, res) => {
    try {
      const { fileUrl, fileName, fileType, fileSize } = req.body;
      if (!fileUrl) return res.status(400).json({ message: "File URL is required" });

      const attachment = await storage.createTaskAttachment({
        taskId: req.params.id,
        fileUrl,
        fileName: fileName || "file",
        fileType: fileType || null,
        fileSize: fileSize || null,
        uploadedBy: req.user.id,
      });
      res.status(201).json(attachment);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/tasks/:taskId/attachments/:attachmentId", requireAuth, async (req: any, res) => {
    try {
      await storage.deleteTaskAttachment(req.params.attachmentId);
      res.json({ message: "Attachment deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tasks/:id/assign-to-me", requireAuth, async (req: any, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ message: "Task not found" });

      if (task.assignedToUserId && !isManagerOrAdmin(req.user)) {
        return res.status(403).json({ message: "Task is already assigned" });
      }

      const updated = await storage.updateTask(req.params.id, { assignedToUserId: req.user.id });

      await storage.createTaskHistory({
        taskId: task.id,
        eventType: "assignment_change",
        changedByUserId: req.user.id,
        oldValue: task.assignedToUserId || "unassigned",
        newValue: req.user.id,
        note: "Self-assigned from open pool",
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tasks/:id/checklist", requireAuth, async (req: any, res) => {
    try {
      const items = await storage.getTaskChecklistItems(req.params.id);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tasks/:id/checklist", requireAuth, async (req: any, res) => {
    try {
      const { itemText } = req.body;
      if (!itemText) return res.status(400).json({ message: "Item text is required" });
      const item = await storage.createTaskChecklistItem({ taskId: req.params.id, itemText });
      res.status(201).json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/tasks/:taskId/checklist/:itemId", requireAuth, async (req: any, res) => {
    try {
      const updated = await storage.updateTaskChecklistItem(req.params.itemId, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/tasks/:taskId/checklist/:itemId", requireAuth, async (req: any, res) => {
    try {
      await storage.deleteTaskChecklistItem(req.params.itemId);
      res.json({ message: "Checklist item deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
