import OpenAI from "openai";
import { pool } from "./db";

const TOOLS_REQUIRING_CONFIRMATION = [
  "createTask",
  "sendInternalMessage",
  "createEquipment",
  "logEquipmentService",
  "updateEquipmentHours",
  "submitRepairRequest",
  "createNote",
];

const STATUS_REQUIRING_CONFIRMATION = ["completed", "cancelled"];

export function shouldRequireConfirmation(toolName: string, toolArgs: any): boolean {
  if (TOOLS_REQUIRING_CONFIRMATION.includes(toolName)) return true;
  if (toolName === "updateTaskStatus" && STATUS_REQUIRING_CONFIRMATION.includes(toolArgs?.status)) return true;
  return false;
}

export const allToolDefinitions: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "navigateTo",
      description: "Navigate the user to a different module or page in the app.",
      parameters: {
        type: "object",
        properties: {
          module: { type: "string", description: "Module name: dashboard, sops, inventory, hiring, marketing, jobs, equipment, tasks, calendar, customers, messages, forms, branding, search, profile, settings, help, lead-qualifier, plow-mapper, employees" },
          subpage: { type: "string", description: "Optional subpage or tab within the module" },
        },
        required: ["module"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "openRecord",
      description: "Navigate to a specific record's detail page (equipment asset, task, employee, or job).",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["equipment", "task", "employee", "job"], description: "The type of record to open" },
          id: { type: "string", description: "The ID of the record" },
        },
        required: ["type", "id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchGlobal",
      description: "Full text search across tasks, equipment, employees, SOPs, and messages. Returns top 5 results from each category.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query text" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchEquipment",
      description: "Search equipment/fleet assets with optional filters. Returns matching equipment records with their current priority status.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status: Active, Inactive, In Service" },
          category: { type: "string", description: "Filter by category" },
          assignedTo: { type: "string", description: "Filter by assigned user name" },
          maintenanceDue: { type: "boolean", description: "If true, only return equipment with overdue or due-soon maintenance" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchTasks",
      description: "Search tasks with optional filters. Returns matching task records.",
      parameters: {
        type: "object",
        properties: {
          assignedTo: { type: "string", description: "Filter by assigned user name or ID" },
          priority: { type: "string", description: "Filter by priority: p1_urgent, p2_high, p3_normal, p4_low" },
          status: { type: "string", description: "Filter by status: assigned, acknowledged, in_progress, on_hold, completed, confirmed, cancelled, overdue" },
          dueToday: { type: "boolean", description: "If true, only return tasks due today" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchEmployees",
      description: "Search employees by name, role, or department.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query for employee name, role, or department" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchSOPs",
      description: "Full text search across the SOP (Standard Operating Procedures) library.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query for SOP title or content" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sendInternalMessage",
      description: "Compose and send an internal message to an employee. Use when the user asks to send, write, or draft a message to someone. Always confirm before sending.",
      parameters: {
        type: "object",
        properties: {
          recipientName: { type: "string", description: "The name of the person to send the message to (will be looked up)" },
          recipientId: { type: "string", description: "The user ID of the recipient if already known" },
          subject: { type: "string", description: "Subject line of the message" },
          message: { type: "string", description: "The full message body" },
        },
        required: ["subject", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getMessages",
      description: "Get the current user's messages/inbox. Use when the user asks about their messages, inbox, or new notifications.",
      parameters: {
        type: "object",
        properties: {
          unreadOnly: { type: "boolean", description: "If true, only return unread/unanswered messages" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getCalendarEvents",
      description: "Get calendar events for the user. Use when the user asks about their schedule, calendar, appointments, or what is happening today or on a specific date.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "ISO date string (YYYY-MM-DD) to filter events for a specific day. Defaults to today if not provided." },
          upcoming: { type: "boolean", description: "If true, return upcoming events from today forward (next 7 days)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getJobs",
      description: "Get jobs/pipeline records. Use when the user asks about jobs, projects, estimates, sold jobs, or scheduled work.",
      parameters: {
        type: "object",
        properties: {
          stage: { type: "string", description: "Filter by stage: Lead, Estimate, Sold, In Progress, Complete, Invoiced, Cancelled" },
          scheduledToday: { type: "boolean", description: "If true, only return jobs scheduled for today." },
          category: { type: "string", description: "Filter by category: Install, Maintenance, Project, Service" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getDailyBriefing",
      description: "Get a structured daily briefing summary with overdue tasks, urgent equipment alerts, unread messages, and tasks due today. Use when the user asks 'what do I need to know today?' or 'give me a summary'.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "createTask",
      description: "Create a new task and assign it to a user. ALWAYS confirm with the user before creating.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title (max 120 chars)" },
          assignedToUserId: { type: "string", description: "The user ID to assign the task to" },
          assignedToName: { type: "string", description: "The name of the user being assigned (for display)" },
          priority: { type: "string", enum: ["p1_urgent", "p2_high", "p3_normal", "p4_low"], description: "Task priority" },
          dueDate: { type: "string", description: "Due date in YYYY-MM-DD format" },
          description: { type: "string", description: "Task description" },
        },
        required: ["title", "assignedToUserId", "priority"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateTaskStatus",
      description: "Update the status of an existing task. Confirm with user before marking as completed or cancelled.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "The task ID (e.g. the UUID)" },
          status: { type: "string", description: "New status: acknowledged, in_progress, on_hold, completed, confirmed, cancelled" },
          note: { type: "string", description: "Optional note about the status change" },
        },
        required: ["taskId", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createEquipment",
      description: "Create a new equipment/fleet asset. ALWAYS confirm with the user before creating.",
      parameters: {
        type: "object",
        properties: {
          assetName: { type: "string", description: "Name of the equipment" },
          category: { type: "string", description: "Equipment category" },
          type: { type: "string", description: "Equipment type: Vehicle, Mower, Trailer, Handheld, Attachment, Other" },
          make: { type: "string", description: "Manufacturer/make" },
          model: { type: "string", description: "Model name" },
          year: { type: "integer", description: "Year of manufacture" },
          serialNumber: { type: "string", description: "Serial number" },
          assignedTo: { type: "string", description: "User ID to assign to" },
          currentHours: { type: "integer", description: "Current operating hours" },
        },
        required: ["assetName", "type", "make", "model"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "logEquipmentService",
      description: "Log a completed maintenance/service task for an equipment asset. Confirm before executing.",
      parameters: {
        type: "object",
        properties: {
          assetId: { type: "string", description: "Equipment asset UUID" },
          taskName: { type: "string", description: "Name of the service performed" },
          serviceDate: { type: "string", description: "Date of service in YYYY-MM-DD format" },
          hoursAtService: { type: "integer", description: "Hours reading at time of service" },
          performedBy: { type: "string", description: "User ID who performed the service" },
          notes: { type: "string", description: "Service notes" },
          cost: { type: "number", description: "Cost of service" },
        },
        required: ["assetId", "taskName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateEquipmentHours",
      description: "Update the current operating hours on an equipment asset. Confirm before executing.",
      parameters: {
        type: "object",
        properties: {
          assetId: { type: "string", description: "Equipment asset UUID" },
          currentHours: { type: "integer", description: "New current hours reading" },
        },
        required: ["assetId", "currentHours"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookupVIN",
      description: "Look up vehicle information using a VIN (Vehicle Identification Number) via the NHTSA API.",
      parameters: {
        type: "object",
        properties: {
          vin: { type: "string", description: "The 17-character VIN to decode" },
        },
        required: ["vin"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submitRepairRequest",
      description: "Submit a repair/issue request for an equipment asset. Confirm before executing.",
      parameters: {
        type: "object",
        properties: {
          assetId: { type: "string", description: "Equipment asset UUID" },
          description: { type: "string", description: "Description of the problem" },
          severity: { type: "string", enum: ["minor", "moderate", "major"], description: "Severity level" },
          isUsable: { type: "string", enum: ["yes", "no", "partial"], description: "Whether the equipment is still usable" },
        },
        required: ["assetId", "description", "severity", "isUsable"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createNote",
      description: "Create a quick note in the user's personal notepad on the dashboard. Can include a reminder time. Use when the user asks you to 'take a note', 'remind me', 'write this down', 'save this', or similar. Always confirm before saving.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short title or subject for the note" },
          body: { type: "string", description: "The full note content" },
          reminderAt: { type: "string", description: "Optional ISO 8601 datetime string if the user wants a reminder (e.g. '2025-06-15T09:00:00')" },
          color: { type: "string", enum: ["default", "yellow", "green", "blue", "purple", "red", "orange", "teal"], description: "Optional note color" },
          tags: { type: "array", items: { type: "string" }, description: "Optional tags or categories" },
          isPinned: { type: "boolean", description: "Whether to pin the note to the top" },
        },
        required: ["body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getNotes",
      description: "Search or list the user's personal notes. Use when the user asks 'what notes do I have', 'find my note about X', 'show my reminders', etc.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Optional search term to filter notes by title, body, or tag" },
          pinned: { type: "boolean", description: "If true, only return pinned notes" },
        },
        required: [],
      },
    },
  },
];

const MODULE_ROUTES: Record<string, string> = {
  dashboard: "/",
  sops: "/sops",
  inventory: "/inventory",
  hiring: "/hiring",
  marketing: "/marketing",
  jobs: "/jobs",
  equipment: "/equipment",
  fleet: "/equipment",
  tasks: "/todo",
  "to-do": "/todo",
  todo: "/todo",
  calendar: "/calendar",
  customers: "/customer-hub",
  "customer hub": "/customer-hub",
  messages: "/messages",
  communications: "/messages",
  forms: "/form-builder",
  branding: "/branding",
  search: "/search",
  profile: "/profile",
  settings: "/settings",
  help: "/help",
  "lead qualifier": "/lead-qualifier",
  "lead-qualifier": "/lead-qualifier",
  leads: "/lead-qualifier",
  "plow mapper": "/plow-mapper",
  "plow-mapper": "/plow-mapper",
  employees: "/employees",
  admin: "/admin",
};

const RECORD_ROUTES: Record<string, (id: string) => string> = {
  equipment: (id) => `/equipment?asset=${id}`,
  task: (id) => `/todo?task=${id}`,
  employee: (id) => `/employees?id=${id}`,
  job: (id) => `/jobs?id=${id}`,
};

function checkPermission(user: any, toolName: string): { allowed: boolean; reason?: string } {
  const role = user.role;
  const readOnlyTools = [
    "searchGlobal", "searchEquipment", "searchTasks", "searchEmployees", "searchSOPs",
    "getDailyBriefing", "navigateTo", "openRecord", "lookupVIN",
    "getMessages", "getCalendarEvents", "getJobs", "getNotes",
  ];
  if (readOnlyTools.includes(toolName)) return { allowed: true };

  if (role === "Customer") return { allowed: false, reason: "This action is not available for customer accounts." };

  if (["createTask"].includes(toolName)) {
    if (role === "Customer") return { allowed: false, reason: "Customers cannot create tasks." };
    return { allowed: true };
  }

  if (["updateTaskStatus"].includes(toolName)) {
    return { allowed: true };
  }

  if (["createEquipment"].includes(toolName)) {
    if (!["Admin", "Master Admin", "Manager"].includes(role)) return { allowed: false, reason: "Only managers and admins can add equipment." };
    return { allowed: true };
  }

  if (["logEquipmentService", "updateEquipmentHours", "submitRepairRequest"].includes(toolName)) {
    if (!["Admin", "Master Admin", "Manager", "Crew Lead", "Crew"].includes(role)) return { allowed: false, reason: "You don't have permission to perform this equipment action." };
    return { allowed: true };
  }

  return { allowed: true };
}

export async function executeTool(toolName: string, toolArgs: any, user: any): Promise<{ result: any; navigationTarget?: string; error?: string }> {
  const permCheck = checkPermission(user, toolName);
  if (!permCheck.allowed) {
    return { result: null, error: permCheck.reason || "Permission denied." };
  }

  try {
    switch (toolName) {
      case "navigateTo": {
        const moduleName = toolArgs.module?.toLowerCase();
        const route = MODULE_ROUTES[moduleName];
        if (route) {
          const target = toolArgs.subpage ? `${route}/${toolArgs.subpage}` : route;
          return { result: { success: true, navigatedTo: moduleName }, navigationTarget: target };
        }
        return { result: { success: false, error: `Unknown module: ${toolArgs.module}` } };
      }

      case "openRecord": {
        const routeFn = RECORD_ROUTES[toolArgs.type];
        if (routeFn) {
          return { result: { success: true, type: toolArgs.type, id: toolArgs.id }, navigationTarget: routeFn(toolArgs.id) };
        }
        return { result: { success: false, error: `Unknown record type: ${toolArgs.type}` } };
      }

      case "searchGlobal": {
        const query = `%${toolArgs.query}%`;
        const results: any = {};

        const [tasks, equip, users, sops] = await Promise.all([
          pool.query(`SELECT id, task_id, title, status, priority FROM tasks WHERE title ILIKE $1 OR description ILIKE $1 LIMIT 5`, [query]),
          pool.query(`SELECT id, name, asset_id, make, model, status FROM equipment WHERE name ILIKE $1 OR make ILIKE $1 OR model ILIKE $1 OR asset_id ILIKE $1 LIMIT 5`, [query]),
          pool.query(`SELECT id, name, username, role FROM users WHERE (name ILIKE $1 OR username ILIKE $1 OR role ILIKE $1) AND role != 'Customer' AND (is_active IS NULL OR is_active = true) LIMIT 5`, [query]),
          pool.query(`SELECT id, title, category FROM sops WHERE title ILIKE $1 OR category ILIKE $1 LIMIT 5`, [query]),
        ]);

        results.tasks = tasks.rows;
        results.equipment = equip.rows;
        results.employees = users.rows;
        results.sops = sops.rows;
        results.totalResults = tasks.rows.length + equip.rows.length + users.rows.length + sops.rows.length;
        return { result: results };
      }

      case "searchEquipment": {
        let sql = `SELECT e.id, e.name, e.asset_id, e.make, e.model, e.year, e.status, e.category, e.current_hours,
                    u.name as assigned_to_name
                    FROM equipment e LEFT JOIN users u ON e.assigned_to_user_id = u.id WHERE 1=1`;
        const params: any[] = [];
        let paramIdx = 1;

        if (toolArgs.status) { sql += ` AND e.status = $${paramIdx++}`; params.push(toolArgs.status); }
        if (toolArgs.category) { sql += ` AND e.category ILIKE $${paramIdx++}`; params.push(`%${toolArgs.category}%`); }
        if (toolArgs.assignedTo) {
          sql += ` AND u.name ILIKE $${paramIdx++}`;
          params.push(`%${toolArgs.assignedTo}%`);
        }
        if (toolArgs.maintenanceDue) {
          sql += ` AND EXISTS (SELECT 1 FROM maintenance_schedules ms WHERE ms.equipment_id = e.id AND ms.priority IN ('p1_critical', 'p2_due_soon'))`;
        }
        sql += ` ORDER BY e.name LIMIT 10`;

        const res = await pool.query(sql, params);
        return { result: { equipment: res.rows, count: res.rows.length } };
      }

      case "searchTasks": {
        let sql = `SELECT t.id, t.task_id, t.title, t.status, t.priority, t.due_date,
                    creator.name as created_by_name, assignee.name as assigned_to_name
                    FROM tasks t
                    LEFT JOIN users creator ON t.created_by_user_id = creator.id
                    LEFT JOIN users assignee ON t.assigned_to_user_id = assignee.id
                    WHERE 1=1`;
        const params: any[] = [];
        let paramIdx = 1;

        if (toolArgs.assignedTo) {
          sql += ` AND (assignee.name ILIKE $${paramIdx} OR t.assigned_to_user_id = $${paramIdx})`;
          params.push(`%${toolArgs.assignedTo}%`);
          paramIdx++;
        }
        if (toolArgs.priority) { sql += ` AND t.priority = $${paramIdx++}`; params.push(toolArgs.priority); }
        if (toolArgs.status) { sql += ` AND t.status = $${paramIdx++}`; params.push(toolArgs.status); }
        if (toolArgs.dueToday) {
          sql += ` AND t.due_date::date = CURRENT_DATE`;
        }
        sql += ` ORDER BY t.due_date ASC NULLS LAST LIMIT 10`;

        const res = await pool.query(sql, params);
        return { result: { tasks: res.rows, count: res.rows.length } };
      }

      case "searchEmployees": {
        const query = `%${toolArgs.query}%`;
        const res = await pool.query(
          `SELECT id, name, username, role, email FROM users WHERE (name ILIKE $1 OR username ILIKE $1 OR role ILIKE $1) AND role != 'Customer' AND (is_active IS NULL OR is_active = true) LIMIT 10`,
          [query]
        );
        return { result: { employees: res.rows, count: res.rows.length } };
      }

      case "searchSOPs": {
        const query = `%${toolArgs.query}%`;
        const res = await pool.query(
          `SELECT id, title, category, super_category FROM sops WHERE title ILIKE $1 OR category ILIKE $1 LIMIT 10`,
          [query]
        );
        return { result: { sops: res.rows, count: res.rows.length } };
      }

      case "sendInternalMessage": {
        // Resolve recipient
        let recipientId = toolArgs.recipientId || null;
        let recipientName = toolArgs.recipientName || null;

        if (!recipientId && recipientName) {
          const recipientRes = await pool.query(
            `SELECT id, name, role FROM users WHERE name ILIKE $1 AND role != 'Customer' LIMIT 1`,
            [`%${recipientName}%`]
          );
          if (recipientRes.rows.length === 0) {
            return { result: null, error: `Could not find an employee named "${recipientName}". Use searchEmployees to find the correct name.` };
          }
          recipientId = recipientRes.rows[0].id;
          recipientName = recipientRes.rows[0].name;
        } else if (recipientId) {
          const recipientRes = await pool.query(`SELECT id, name, role FROM users WHERE id = $1`, [recipientId]);
          if (recipientRes.rows.length === 0) return { result: null, error: "Recipient not found." };
          recipientName = recipientRes.rows[0].name;
        }

        if (!recipientId) return { result: null, error: "A recipient is required to send a message. Please specify who to send it to." };

        const msgId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO customer_messages (id, customer_id, target_employee_id, subject, message, status, created_at)
           VALUES ($1, $2, $3, $4, $5, 'unread', NOW())`,
          [msgId, user.id, recipientId, toolArgs.subject, toolArgs.message]
        );

        return { result: { success: true, sentTo: recipientName, subject: toolArgs.subject, messagePreview: toolArgs.message.slice(0, 100) } };
      }

      case "getMessages": {
        let msgSql = `SELECT cm.id, cm.subject, cm.message, cm.status, cm.created_at, cm.admin_reply, cm.replied_at,
                      sender.name as sender_name, target.name as target_name
                      FROM customer_messages cm
                      LEFT JOIN users sender ON cm.customer_id = sender.id
                      LEFT JOIN users target ON cm.target_employee_id = target.id
                      WHERE (cm.customer_id = $1 OR cm.target_employee_id = $1)`;
        if (toolArgs.unreadOnly) {
          msgSql += ` AND cm.status = 'unread'`;
        }
        msgSql += ` ORDER BY cm.created_at DESC LIMIT 15`;

        const msgRes = await pool.query(msgSql, [user.id]);
        return { result: { messages: msgRes.rows, count: msgRes.rows.length } };
      }

      case "getCalendarEvents": {
        let evtSql = `SELECT ce.id, ce.title, ce.description, ce.event_type, ce.start_datetime, ce.end_datetime, ce.all_day, ce.location,
                      u.name as created_by_name
                      FROM calendar_events ce
                      LEFT JOIN users u ON ce.created_by = u.id
                      WHERE (ce.created_by = $1 OR ce.assigned_to = $1 OR ce.is_company_event = true)`;
        const evtParams: any[] = [user.id];

        if (toolArgs.scheduledToday || (!toolArgs.date && !toolArgs.upcoming)) {
          evtSql += ` AND ce.start_datetime::date = CURRENT_DATE`;
        } else if (toolArgs.date) {
          evtSql += ` AND ce.start_datetime::date = $2`;
          evtParams.push(toolArgs.date);
        } else if (toolArgs.upcoming) {
          evtSql += ` AND ce.start_datetime >= NOW() AND ce.start_datetime <= NOW() + INTERVAL '7 days'`;
        }

        evtSql += ` ORDER BY ce.start_datetime ASC LIMIT 20`;
        const evtRes = await pool.query(evtSql, evtParams);
        return { result: { events: evtRes.rows, count: evtRes.rows.length, date: toolArgs.date || new Date().toISOString().split("T")[0] } };
      }

      case "getJobs": {
        let jobSql = `SELECT id, client, type, category, stage, value, scheduled_date, completion_date, notes, zone FROM jobs WHERE 1=1`;
        const jobParams: any[] = [];
        let jobIdx = 1;

        if (toolArgs.stage) { jobSql += ` AND stage = $${jobIdx++}`; jobParams.push(toolArgs.stage); }
        if (toolArgs.category) { jobSql += ` AND category ILIKE $${jobIdx++}`; jobParams.push(toolArgs.category); }
        if (toolArgs.scheduledToday) { jobSql += ` AND scheduled_date::date = CURRENT_DATE`; }

        jobSql += ` ORDER BY scheduled_date ASC NULLS LAST, created_at DESC LIMIT 20`;
        const jobRes = await pool.query(jobSql, jobParams);
        return { result: { jobs: jobRes.rows, count: jobRes.rows.length } };
      }

      case "getDailyBriefing": {
        const userId = user.id;
        const [overdue, dueToday, p1Equip, unack] = await Promise.all([
          pool.query(
            `SELECT t.task_id, t.title, t.priority, t.due_date FROM tasks t WHERE (t.assigned_to_user_id = $1 OR t.created_by_user_id = $1) AND t.status NOT IN ('completed','confirmed','cancelled') AND t.due_date < NOW() ORDER BY t.due_date LIMIT 10`,
            [userId]
          ),
          pool.query(
            `SELECT t.task_id, t.title, t.priority FROM tasks t WHERE (t.assigned_to_user_id = $1 OR t.created_by_user_id = $1) AND t.status NOT IN ('completed','confirmed','cancelled') AND t.due_date::date = CURRENT_DATE LIMIT 10`,
            [userId]
          ),
          pool.query(
            `SELECT e.name, e.asset_id, ms.name as schedule_name FROM maintenance_schedules ms JOIN equipment e ON ms.equipment_id = e.id WHERE ms.is_active = true AND ms.next_due_date <= NOW() LIMIT 10`
          ),
          pool.query(`SELECT COUNT(*) as count FROM tasks WHERE assigned_to_user_id = $1 AND status = 'assigned'`, [userId]),
        ]);

        return {
          result: {
            overdueTasks: { count: overdue.rows.length, items: overdue.rows },
            tasksDueToday: { count: dueToday.rows.length, items: dueToday.rows },
            urgentEquipment: { count: p1Equip.rows.length, items: p1Equip.rows },
            unacknowledgedTasks: parseInt(unack.rows[0]?.count || "0"),
          },
        };
      }

      case "createTask": {
        const assigneeCheck = await pool.query(`SELECT id, name, role FROM users WHERE id = $1`, [toolArgs.assignedToUserId]);
        if (assigneeCheck.rows.length === 0) return { result: null, error: "Could not find the specified user to assign to." };

        const assignee = assigneeCheck.rows[0];
        const canAssign = checkTaskAssignment(user.role, assignee.role);
        if (!canAssign.allowed) return { result: null, error: canAssign.reason || "You cannot assign tasks to this user." };

        const taskIdRes = await pool.query(`SELECT task_id FROM tasks ORDER BY created_at DESC LIMIT 1`);
        const lastId = taskIdRes.rows[0]?.task_id || "TK-0000";
        const nextNum = parseInt(lastId.replace("TK-", "")) + 1;
        const taskId = `TK-${String(nextNum).padStart(4, "0")}`;

        const newTaskId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO tasks (id, task_id, title, description, priority, status, created_by_user_id, assigned_to_user_id, due_date, type, requires_confirmation, created_at)
           VALUES ($1, $2, $3, $4, $5, 'assigned', $6, $7, $8, 'standard', false, NOW())`,
          [newTaskId, taskId, toolArgs.title, toolArgs.description || null, toolArgs.priority, user.id, toolArgs.assignedToUserId, toolArgs.dueDate ? new Date(toolArgs.dueDate) : null]
        );

        await pool.query(
          `INSERT INTO task_history (id, task_id, changed_by, field_changed, old_value, new_value, created_at) VALUES ($1, $2, $3, 'status', NULL, 'assigned', NOW())`,
          [crypto.randomUUID(), newTaskId, user.id]
        );

        return { result: { success: true, taskId, title: toolArgs.title, assignedTo: assignee.name, priority: toolArgs.priority } };
      }

      case "updateTaskStatus": {
        const taskRes = await pool.query(`SELECT id, task_id, title, status, assigned_to_user_id, created_by_user_id FROM tasks WHERE id = $1 OR task_id = $1`, [toolArgs.taskId]);
        if (taskRes.rows.length === 0) return { result: null, error: "Task not found." };

        const task = taskRes.rows[0];
        const oldStatus = task.status;

        await pool.query(`UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2`, [toolArgs.status, task.id]);

        if (toolArgs.note) {
          await pool.query(
            `INSERT INTO task_history (id, task_id, changed_by, field_changed, old_value, new_value, note, created_at) VALUES ($1, $2, $3, 'status', $4, $5, $6, NOW())`,
            [crypto.randomUUID(), task.id, user.id, oldStatus, toolArgs.status, toolArgs.note]
          );
        }

        return { result: { success: true, taskId: task.task_id, title: task.title, oldStatus, newStatus: toolArgs.status } };
      }

      case "createEquipment": {
        const assetIdRes = await pool.query(`SELECT asset_id FROM equipment ORDER BY created_at DESC LIMIT 1`);
        const lastAssetId = assetIdRes.rows[0]?.asset_id || "EQ-0000";
        const nextAssetNum = parseInt(lastAssetId.replace("EQ-", "")) + 1;
        const assetId = `EQ-${String(nextAssetNum).padStart(4, "0")}`;

        const newId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO equipment (id, asset_id, type, name, category, make, model, year, serial_number, assigned_to_user_id, current_hours, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Active', NOW(), NOW())`,
          [newId, assetId, toolArgs.type || "Other", toolArgs.assetName, toolArgs.category || null, toolArgs.make, toolArgs.model, toolArgs.year || null, toolArgs.serialNumber || null, toolArgs.assignedTo || null, toolArgs.currentHours || 0]
        );

        return { result: { success: true, assetId, name: toolArgs.assetName, make: toolArgs.make, model: toolArgs.model, id: newId } };
      }

      case "logEquipmentService": {
        const equipRes = await pool.query(`SELECT id, name, asset_id FROM equipment WHERE id = $1 OR asset_id = $1`, [toolArgs.assetId]);
        if (equipRes.rows.length === 0) return { result: null, error: "Equipment asset not found." };

        const equip = equipRes.rows[0];
        const logId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO maintenance_logs (id, equipment_id, name, description, hours_at_service, completed_date, performed_by, total_cost, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [logId, equip.id, toolArgs.taskName, toolArgs.notes || null, toolArgs.hoursAtService || null, toolArgs.serviceDate ? new Date(toolArgs.serviceDate) : new Date(), toolArgs.performedBy || user.id, toolArgs.cost ? Math.round(toolArgs.cost * 100) : null]
        );

        return { result: { success: true, assetName: equip.name, assetId: equip.asset_id, serviceName: toolArgs.taskName } };
      }

      case "updateEquipmentHours": {
        const equipRes = await pool.query(`SELECT id, name, asset_id, current_hours FROM equipment WHERE id = $1 OR asset_id = $1`, [toolArgs.assetId]);
        if (equipRes.rows.length === 0) return { result: null, error: "Equipment asset not found." };

        const equip = equipRes.rows[0];
        await pool.query(
          `UPDATE equipment SET current_hours = $1, last_hours_update = NOW(), updated_at = NOW() WHERE id = $2`,
          [toolArgs.currentHours, equip.id]
        );

        return { result: { success: true, assetName: equip.name, assetId: equip.asset_id, oldHours: equip.current_hours, newHours: toolArgs.currentHours } };
      }

      case "lookupVIN": {
        const vinResponse = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${toolArgs.vin}?format=json`);
        const vinData = await vinResponse.json();

        const varMap: Record<number, string> = { 26: "make", 28: "model", 29: "year", 5: "bodyClass", 13: "engineCylinders", 24: "fuelType", 37: "transmissionType" };
        const decoded: Record<string, string> = {};
        for (const item of vinData.Results || []) {
          const key = varMap[item.VariableId];
          if (key && item.Value) decoded[key] = item.Value;
        }

        return { result: { vin: toolArgs.vin, decoded, raw: false } };
      }

      case "submitRepairRequest": {
        const equipRes = await pool.query(`SELECT id, name, asset_id FROM equipment WHERE id = $1 OR asset_id = $1`, [toolArgs.assetId]);
        if (equipRes.rows.length === 0) return { result: null, error: "Equipment asset not found." };

        const equip = equipRes.rows[0];
        const reqId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO repair_requests (id, asset_id, reported_by_user_id, problem_description, severity, is_usable, status, report_date)
           VALUES ($1, $2, $3, $4, $5, $6, 'open', NOW())`,
          [reqId, equip.id, user.id, toolArgs.description, toolArgs.severity, toolArgs.isUsable]
        );

        return { result: { success: true, assetName: equip.name, assetId: equip.asset_id, severity: toolArgs.severity, requestId: reqId } };
      }

      case "createNote": {
        const noteId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO notes (id, user_id, title, body, color, is_pinned, tags, reminder_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [noteId, user.id, toolArgs.title || null, toolArgs.body, toolArgs.color || "default",
           toolArgs.isPinned || false, toolArgs.tags || [], toolArgs.reminderAt || null]
        );
        return {
          result: {
            success: true,
            message: `Note saved${toolArgs.title ? ` — "${toolArgs.title}"` : ""}${toolArgs.reminderAt ? ` with reminder set for ${new Date(toolArgs.reminderAt).toLocaleString()}` : ""}. You can find it on your dashboard notepad.`,
            noteId,
          },
        };
      }

      case "getNotes": {
        let query = `SELECT * FROM notes WHERE user_id = $1 AND is_archived = FALSE ORDER BY is_pinned DESC, updated_at DESC LIMIT 15`;
        const params: any[] = [user.id];

        if (toolArgs.pinned) {
          query = `SELECT * FROM notes WHERE user_id = $1 AND is_pinned = TRUE AND is_archived = FALSE ORDER BY updated_at DESC LIMIT 10`;
        } else if (toolArgs.query) {
          query = `SELECT * FROM notes WHERE user_id = $1 AND is_archived = FALSE AND (title ILIKE $2 OR body ILIKE $2) ORDER BY is_pinned DESC, updated_at DESC LIMIT 10`;
          params.push(`%${toolArgs.query}%`);
        }

        const { rows } = await pool.query(query, params);
        if (rows.length === 0) return { result: { notes: [], message: "No notes found." } };

        const noteList = rows.map((n: any) => ({
          id: n.id,
          title: n.title || "(no title)",
          body: n.body ? n.body.slice(0, 150) + (n.body.length > 150 ? "…" : "") : "",
          color: n.color,
          isPinned: n.is_pinned,
          tags: n.tags,
          reminderAt: n.reminder_at,
          updatedAt: n.updated_at,
        }));

        return { result: { notes: noteList, count: rows.length } };
      }

      default:
        return { result: null, error: `Unknown tool: ${toolName}` };
    }
  } catch (err: any) {
    console.error(`[assistant] Tool execution error (${toolName}):`, err);
    return { result: null, error: "An internal error occurred while performing this action." };
  }
}

function checkTaskAssignment(creatorRole: string, assigneeRole: string): { allowed: boolean; reason?: string } {
  if (["Admin", "Master Admin"].includes(creatorRole)) return { allowed: true };
  if (creatorRole === "Manager") {
    if (["Crew Lead", "Crew", "New Hire", "HR", "Sales"].includes(assigneeRole)) return { allowed: true };
    return { allowed: false, reason: `As a Manager, you can assign tasks to Crew Lead, Crew, New Hire, HR, or Sales roles.` };
  }
  if (["HR", "Sales"].includes(creatorRole)) {
    // HR and Sales can assign tasks to themselves or other HR/Sales; not to crew
    if (["HR", "Sales"].includes(assigneeRole) || assigneeRole === creatorRole) return { allowed: true };
    return { allowed: false, reason: `As ${creatorRole}, you can create tasks for yourself or other HR/Sales team members.` };
  }
  if (creatorRole === "Crew Lead") {
    if (["Crew", "New Hire"].includes(assigneeRole)) return { allowed: true };
    return { allowed: false, reason: `As a Crew Lead, you can only assign tasks to Crew members or New Hires.` };
  }
  return { allowed: false, reason: `Your role (${creatorRole}) does not have permission to assign tasks to others.` };
}

export function getToolNames(): string[] {
  return allToolDefinitions.map(t => (t as any).function.name);
}
