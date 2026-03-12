import { storage } from "./storage";
import { pool } from "./db";

async function checkReminderTasks() {
  try {
    const result = await pool.query(`
      SELECT id, title, assigned_to_user_id 
      FROM tasks 
      WHERE reminder_date IS NOT NULL 
        AND reminder_date <= NOW() 
        AND reminder_sent = false 
        AND status NOT IN ('complete', 'cancelled')
    `);

    for (const task of result.rows) {
      await pool.query(`UPDATE tasks SET reminder_sent = true, updated_at = NOW() WHERE id = $1`, [task.id]);
      if (task.assigned_to_user_id) {
        const user = await storage.getUser(task.assigned_to_user_id);
        if (user) {
          console.log(`[TaskScheduler] Reminder sent for task "${task.title}" to ${user.name}`);
        }
      }
    }
  } catch (err) {
    console.error("[TaskScheduler] Reminder check error:", err);
  }
}

async function checkOverdueTasks() {
  try {
    const result = await pool.query(`
      SELECT id, task_id, title, assigned_to_user_id
      FROM tasks 
      WHERE due_date < NOW() 
        AND status NOT IN ('complete', 'cancelled')
        AND assigned_to_user_id IS NOT NULL
    `);

    if (result.rows.length > 0) {
      console.log(`[TaskScheduler] ${result.rows.length} overdue task(s) detected`);
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
        AND status IN ('complete')
        AND recurring_config IS NOT NULL
    `);

    for (const task of result.rows) {
      const config = typeof task.recurring_config === "string" ? JSON.parse(task.recurring_config) : task.recurring_config;
      if (!config || !config.frequency) continue;

      const existing = await pool.query(`
        SELECT id FROM tasks WHERE parent_task_id = $1 AND status NOT IN ('complete', 'cancelled') LIMIT 1
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

async function checkTodoReminders() {
  try {
    const result = await pool.query(`
      SELECT t.id, t.title, t.reminder_date, ta.user_id
      FROM todos t
      LEFT JOIN todo_assignments ta ON ta.todo_id = t.id
      WHERE t.reminder_date IS NOT NULL 
        AND t.reminder_date <= NOW() 
        AND (t.reminder_sent = false OR t.reminder_sent IS NULL)
        AND t.status NOT IN ('completed', 'archived')
    `);

    const todoIds = new Set<string>();
    for (const row of result.rows) {
      if (!todoIds.has(row.id)) {
        todoIds.add(row.id);
        await pool.query(`UPDATE todos SET reminder_sent = true, updated_at = NOW() WHERE id = $1`, [row.id]);
      }
      if (row.user_id) {
        const user = await storage.getUser(row.user_id);
        if (user) {
          console.log(`[TaskScheduler] Todo reminder: "${row.title}" for ${user.name}`);
        }
      }
    }

    if (todoIds.size > 0) {
      console.log(`[TaskScheduler] Processed ${todoIds.size} todo reminder(s)`);
    }
  } catch (err) {
    console.error("[TaskScheduler] Todo reminder check error:", err);
  }
}

let reminderInterval: ReturnType<typeof setInterval> | null = null;
let overdueInterval: ReturnType<typeof setInterval> | null = null;
let recurringInterval: ReturnType<typeof setInterval> | null = null;
let todoReminderInterval: ReturnType<typeof setInterval> | null = null;

export function startTaskScheduler() {
  console.log("[TaskScheduler] Starting task scheduler...");

  reminderInterval = setInterval(checkReminderTasks, 60 * 60 * 1000);
  overdueInterval = setInterval(checkOverdueTasks, 60 * 60 * 1000);
  recurringInterval = setInterval(generateRecurringTasks, 60 * 60 * 1000);
  todoReminderInterval = setInterval(checkTodoReminders, 60 * 60 * 1000);

  setTimeout(() => {
    checkReminderTasks();
    checkOverdueTasks();
    generateRecurringTasks();
    checkTodoReminders();
  }, 10000);
}

export function stopTaskScheduler() {
  if (reminderInterval) clearInterval(reminderInterval);
  if (overdueInterval) clearInterval(overdueInterval);
  if (recurringInterval) clearInterval(recurringInterval);
  if (todoReminderInterval) clearInterval(todoReminderInterval);
}
