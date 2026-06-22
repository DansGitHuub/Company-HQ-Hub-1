import { storage } from "./storage";
import { pool } from "./db";

// ── One-time migration: add overdue_notified_at so we notify exactly once ──
async function migrateTaskSchedulerColumns() {
  try {
    await pool.query(`
      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS overdue_notified_at TIMESTAMP WITH TIME ZONE
    `);
  } catch (err) {
    console.error("[TaskScheduler] Migration error:", err);
  }
}

// ── Helper: insert a staff_notifications row ────────────────────────────────
async function sendInAppNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  link: string,
  metadata: Record<string, unknown> = {}
) {
  await pool.query(
    `INSERT INTO staff_notifications (id, user_id, type, title, message, link, metadata)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
    [userId, type, title, message, link, JSON.stringify(metadata)]
  );
}

// ── 1. Task reminder notifications ─────────────────────────────────────────
async function checkReminderTasks() {
  try {
    const result = await pool.query(`
      SELECT id, task_id, title, assigned_to_user_id, due_date
      FROM tasks
      WHERE reminder_date IS NOT NULL
        AND reminder_date <= NOW()
        AND reminder_sent = false
        AND status NOT IN ('complete', 'cancelled')
    `);

    for (const task of result.rows) {
      // Mark reminder sent first to prevent double-fire on error
      await pool.query(
        `UPDATE tasks SET reminder_sent = true, updated_at = NOW() WHERE id = $1`,
        [task.id]
      );

      if (!task.assigned_to_user_id) continue;

      const user = await storage.getUser(task.assigned_to_user_id);
      if (!user) continue;

      const dueLabel = task.due_date
        ? ` — due ${new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        : "";

      await sendInAppNotification(
        task.assigned_to_user_id,
        "task_reminder",
        `Reminder: ${task.title}`,
        `You have a task reminder${dueLabel}.`,
        "/tasks",
        { taskId: task.id, taskRef: task.task_id }
      );

      console.log(`[TaskScheduler] Reminder notification sent for task "${task.title}" → ${user.name}`);
    }
  } catch (err) {
    console.error("[TaskScheduler] Reminder check error:", err);
  }
}

// ── 2. Overdue task notifications (once per task via overdue_notified_at) ──
async function checkOverdueTasks() {
  try {
    const result = await pool.query(`
      SELECT id, task_id, title, assigned_to_user_id, due_date
      FROM tasks
      WHERE due_date < NOW()
        AND status NOT IN ('complete', 'cancelled')
        AND assigned_to_user_id IS NOT NULL
        AND overdue_notified_at IS NULL
    `);

    for (const task of result.rows) {
      // Mark notified immediately to prevent re-fire
      await pool.query(
        `UPDATE tasks SET overdue_notified_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [task.id]
      );

      const user = await storage.getUser(task.assigned_to_user_id);
      if (!user) continue;

      const dueLabel = new Date(task.due_date).toLocaleDateString("en-US", {
        month: "short", day: "numeric",
      });

      await sendInAppNotification(
        task.assigned_to_user_id,
        "task_overdue",
        `Overdue: ${task.title}`,
        `This task was due on ${dueLabel} and is still open.`,
        "/tasks",
        { taskId: task.id, taskRef: task.task_id }
      );

      console.log(`[TaskScheduler] Overdue notification sent for task "${task.title}" → ${user.name}`);
    }

    if (result.rows.length > 0) {
      console.log(`[TaskScheduler] Sent overdue notifications for ${result.rows.length} task(s)`);
    }
  } catch (err) {
    console.error("[TaskScheduler] Overdue check error:", err);
  }
}

// ── 3. Recurring task generation ────────────────────────────────────────────
async function generateRecurringTasks() {
  try {
    const result = await pool.query(`
      SELECT * FROM tasks
      WHERE is_recurring = true
        AND status IN ('complete')
        AND recurring_config IS NOT NULL
    `);

    for (const task of result.rows) {
      const config = typeof task.recurring_config === "string"
        ? JSON.parse(task.recurring_config)
        : task.recurring_config;
      if (!config || !config.frequency) continue;

      const existing = await pool.query(
        `SELECT id FROM tasks WHERE parent_task_id = $1 AND status NOT IN ('complete', 'cancelled') LIMIT 1`,
        [task.id]
      );

      if (existing.rows.length > 0) continue;

      const nextDate = calculateNextDate(config, task.completed_at || task.updated_at);
      if (!nextDate) continue;

      const advanceDays = config.advance_days || 0;
      const generateDate = new Date(nextDate);
      generateDate.setDate(generateDate.getDate() - advanceDays);

      if (generateDate <= new Date()) {
        await storage.createTask({
          title: task.title,
          description: task.description,
          type: task.type,
          priority: task.priority,
          createdByUserId: task.created_by_user_id,
          assignedToUserId: task.assigned_to_user_id,
          dueDate: nextDate,
          category: task.category,
          estimatedMinutes: task.estimated_minutes,
          location: task.location,
          isRecurring: true,
          recurringConfig: task.recurring_config,
          parentTaskId: task.id,
        });
        console.log(`[TaskScheduler] Generated recurring instance for task ${task.task_id}`);
      }
    }
  } catch (err) {
    console.error("[TaskScheduler] Recurring generation error:", err);
  }
}

function calculateNextDate(config: any, lastCompleted: string | Date): Date | null {
  const base = new Date(lastCompleted);
  const next = new Date(base);

  switch (config.frequency) {
    case "daily":
      next.setDate(next.getDate() + (config.interval_days || 1));
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      if (config.days_of_week && config.days_of_week.length > 0) {
        while (!config.days_of_week.includes(next.getDay())) {
          next.setDate(next.getDate() + 1);
        }
      }
      break;
    case "biweekly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      if (config.day_of_month) next.setDate(config.day_of_month);
      break;
    case "custom":
      if (config.interval_days) next.setDate(next.getDate() + config.interval_days);
      else return null;
      break;
    default:
      return null;
  }

  return next;
}

// ── Interval handles ────────────────────────────────────────────────────────
let reminderInterval: ReturnType<typeof setInterval> | null = null;
let overdueInterval: ReturnType<typeof setInterval> | null = null;
let recurringInterval: ReturnType<typeof setInterval> | null = null;

export async function startTaskScheduler() {
  console.log("[TaskScheduler] Starting task scheduler...");

  await migrateTaskSchedulerColumns();

  reminderInterval    = setInterval(checkReminderTasks,      60 * 60 * 1000);
  overdueInterval     = setInterval(checkOverdueTasks,       60 * 60 * 1000);
  recurringInterval   = setInterval(generateRecurringTasks,  60 * 60 * 1000);

  // Initial run after 10 s to let the server finish booting
  setTimeout(() => {
    checkReminderTasks();
    checkOverdueTasks();
    generateRecurringTasks();
  }, 10_000);
}

export function stopTaskScheduler() {
  if (reminderInterval)     clearInterval(reminderInterval);
  if (overdueInterval)      clearInterval(overdueInterval);
  if (recurringInterval)    clearInterval(recurringInterval);
}
