import { storage } from "./storage";
import { pool } from "./db";

const ESCALATION_THRESHOLDS: Record<string, number> = {
  p1_urgent: 30,
  p2_high: 120,
  p3_normal: 1440,
  p4_low: 2880,
};

async function checkUnacknowledgedTasks() {
  try {
    const result = await pool.query(`
      SELECT id, task_id, title, priority, assigned_to_user_id, created_by_user_id, created_at 
      FROM tasks 
      WHERE status = 'assigned' AND acknowledged_at IS NULL
    `);

    const now = Date.now();
    for (const task of result.rows) {
      const elapsed = (now - new Date(task.created_at).getTime()) / 60000;
      const threshold = ESCALATION_THRESHOLDS[task.priority] || 1440;

      if (elapsed > threshold) {
        const existing = await pool.query(
          `SELECT id FROM task_history WHERE task_id = $1 AND event_type = 'escalated' AND created_at > NOW() - INTERVAL '1 hour' LIMIT 1`,
          [task.id]
        );
        if (existing.rows.length === 0) {
          await storage.createTaskHistory({
            taskId: task.id,
            eventType: "escalated",
            note: `Auto-escalated: unacknowledged for ${Math.round(elapsed)} minutes (threshold: ${threshold}min)`,
          });
        }
      }
    }
  } catch (err) {
    console.error("[TaskScheduler] Escalation check error:", err);
  }
}

async function checkOverdueTasks() {
  try {
    const result = await pool.query(`
      UPDATE tasks 
      SET status = 'overdue', updated_at = NOW() 
      WHERE due_date < NOW() 
        AND status NOT IN ('completed', 'confirmed', 'cancelled', 'overdue')
      RETURNING id, task_id, title
    `);

    for (const task of result.rows) {
      await storage.createTaskHistory({
        taskId: task.id,
        eventType: "status_changed",
        oldValue: "in_progress",
        newValue: "overdue",
        note: "Auto-marked overdue by system",
      });
    }

    if (result.rows.length > 0) {
      console.log(`[TaskScheduler] Marked ${result.rows.length} tasks as overdue`);
    }
  } catch (err) {
    console.error("[TaskScheduler] Overdue check error:", err);
  }
}

async function generateRecurringTasks() {
  try {
    const result = await pool.query(`
      SELECT * FROM tasks 
      WHERE is_recurring = true 
        AND status IN ('completed', 'confirmed')
        AND recurring_config IS NOT NULL
    `);

    for (const task of result.rows) {
      const config = typeof task.recurring_config === "string" ? JSON.parse(task.recurring_config) : task.recurring_config;
      if (!config || !config.frequency) continue;

      const existing = await pool.query(`
        SELECT id FROM tasks WHERE parent_task_id = $1 AND status NOT IN ('completed', 'confirmed', 'cancelled') LIMIT 1
      `, [task.id]);

      if (existing.rows.length > 0) continue;

      let nextDate = calculateNextDate(config, task.completed_at || task.updated_at);
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
          dueTime: config.time || task.due_time,
          category: task.category,
          estimatedMinutes: task.estimated_minutes,
          location: task.location,
          requiresConfirmation: task.requires_confirmation,
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

let escalationInterval: ReturnType<typeof setInterval> | null = null;
let overdueInterval: ReturnType<typeof setInterval> | null = null;
let recurringInterval: ReturnType<typeof setInterval> | null = null;

export function startTaskScheduler() {
  console.log("[TaskScheduler] Starting task scheduler...");

  escalationInterval = setInterval(checkUnacknowledgedTasks, 15 * 60 * 1000);

  overdueInterval = setInterval(checkOverdueTasks, 60 * 60 * 1000);

  recurringInterval = setInterval(generateRecurringTasks, 60 * 60 * 1000);

  setTimeout(() => {
    checkOverdueTasks();
    generateRecurringTasks();
  }, 10000);
}

export function stopTaskScheduler() {
  if (escalationInterval) clearInterval(escalationInterval);
  if (overdueInterval) clearInterval(overdueInterval);
  if (recurringInterval) clearInterval(recurringInterval);
}
