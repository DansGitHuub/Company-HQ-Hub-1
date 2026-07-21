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
  "createPlantCard",
  "createSop",
];

const STATUS_REQUIRING_CONFIRMATION = ["completed", "cancelled"];

export function shouldRequireConfirmation(toolName: string, toolArgs: any): boolean {
  if (TOOLS_REQUIRING_CONFIRMATION.includes(toolName)) return true;
  if (toolName === "updateTaskStatus") return true;
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
      description: "Get jobs/pipeline records. Use when the user asks about jobs, projects, estimates, sold jobs, or scheduled work. For questions about overdue jobs specifically, always set overdueOnly: true instead of trying to filter by stage.",
      parameters: {
        type: "object",
        properties: {
          stage: { type: "string", description: "Filter by sales-pipeline stage: Lead, Estimate, Sold, In Progress, Complete, Invoiced, Cancelled. Note: this is a legacy pipeline field and is often stale for jobs already in execution — do NOT use this to determine if a job is overdue." },
          scheduledToday: { type: "boolean", description: "If true, only return jobs scheduled for today." },
          category: { type: "string", description: "Filter by category: Install, Maintenance, Project, Service" },
          overdueOnly: { type: "boolean", description: "If true, only return jobs that are overdue: scheduled_date is in the past and the job's operational status is scheduled, in_progress, sold, or active. This is the correct and only way to answer 'how many overdue jobs' questions — it matches the count shown on the admin Daily Pulse widget." },
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
  {
    type: "function",
    function: {
      name: "searchPlantCards",
      description: "Search the plant card library by plant name. Use when the user asks about a specific plant, wants to look up care info, or asks if a plant card exists. Searches both common name and botanical name.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Plant name to search for (common name or botanical name)" },
          plantType: { type: "string", description: "Optional filter by plant type: Tree, Shrub, Perennial, Annual, Groundcover, Vine, Grass, Other" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createPlantCard",
      description: "Create a new plant card in the plant library using AI to fill in all the horticultural details. Use when the user asks to add a new plant, create a plant card, or add a plant to the library. Admin only. Always confirm before creating.",
      parameters: {
        type: "object",
        properties: {
          commonName: { type: "string", description: "The common name of the plant (e.g. 'Red Maple')" },
          botanicalName: { type: "string", description: "The botanical/scientific name (e.g. 'Acer rubrum')" },
          plantType: { type: "string", description: "Plant type: Tree, Shrub, Perennial, Annual, Groundcover, Vine, Grass, Other" },
        },
        required: ["commonName"],
      },
    },
  },

  // ── A. INVOICES ─────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getInvoices",
      description: "List or search invoices. Use when the user asks about invoices, outstanding balances, unpaid bills, past-due amounts, or specific customer invoices. Admin/Manager only.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by invoice status: draft, sent, paid, overdue, void" },
          customerName: { type: "string", description: "Filter by customer name (partial match)" },
          overdueOnly: { type: "boolean", description: "If true, only return past-due invoices with a balance remaining" },
          limit: { type: "integer", description: "Max number of results to return (default 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getInvoiceAgingSummary",
      description: "Get accounts receivable aging summary — outstanding balances bucketed by days past due (current, 1-30, 31-60, 61-90, 90+). Use when asked about 'aging', 'AR summary', 'overdue amounts', 'who owes money', or total outstanding receivables. Admin/Manager only.",
      parameters: { type: "object", properties: {} },
    },
  },

  // ── B. FINANCIAL REPORTS ────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getRevenueReport",
      description: "Get monthly revenue summary for the past 12 months — gross billed, collected, and outstanding by month, plus year-to-date totals. Use for 'revenue', 'sales totals', 'how much have we billed', 'monthly income', 'YTD revenue' questions. Admin/Manager only.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "getJobCostSummary",
      description: "Get job costing data — hours worked, crew size, and invoiced amounts per job. Use for 'job profitability', 'cost per job', 'how many hours on job X', 'job costing' questions. Admin/Manager only.",
      parameters: {
        type: "object",
        properties: {
          jobName: { type: "string", description: "Optional filter by job title or client name (partial match)" },
          limitDays: { type: "integer", description: "Lookback window in days (default 90)" },
        },
      },
    },
  },

  // ── C. PEOPLE / TIME ────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "getEmployeeHours",
      description: "Get hours worked by employee. Admin/Manager see all employees; Crew sees only their own hours. Use for 'how many hours has X worked', 'hours this week', 'time summary by employee', 'billable vs shop hours'. Supports date range filtering.",
      parameters: {
        type: "object",
        properties: {
          employeeName: { type: "string", description: "Optional: filter by employee name (partial match). Leave blank for all employees." },
          dateFrom: { type: "string", description: "Start date YYYY-MM-DD (default: start of current week)" },
          dateTo: { type: "string", description: "End date YYYY-MM-DD (default: today)" },
          groupByJob: { type: "boolean", description: "If true, also break down each employee's hours by job" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getOvertimeReport",
      description: "Show employees who worked more than 40 hours in a week. Use for 'overtime', 'who is over 40 hours', 'overtime risk', 'overworked employees'. Reviews the last 4 weeks by default. Admin/Manager only.",
      parameters: {
        type: "object",
        properties: {
          weeksBack: { type: "integer", description: "How many weeks back to check (default 4)" },
        },
      },
    },
  },

  // ── D. HIRING ────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "searchCandidates",
      description: "Search the hiring pipeline for candidates/applicants. Use when asked about applicants, candidates, who applied for a job, interview pipeline, or hiring status of a specific person. Admin/Manager only.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search by candidate name or applied position (partial match)" },
          stage: { type: "string", description: "Filter by pipeline stage, e.g. 'Application Received', 'Phone Screen', 'Interview Scheduled', 'Offer Extended', 'Hired', 'Rejected'" },
          recentOnly: { type: "boolean", description: "If true, only return candidates from the last 30 days" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getHiringPipelineSummary",
      description: "Get a high-level hiring pipeline overview — total applicants, breakdown by stage, by position, and most recent applications. Admin/Manager only.",
      parameters: { type: "object", properties: {} },
    },
  },

  // ── E. KNOWLEDGE BASE ────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "searchKnowledgeBase",
      description: "Search full content of SOPs, care guides, and customer resources for relevant information. Searches document body text, not just titles. Use when asked 'do we have a procedure for X', 'how do we handle Y', 'is there a guide for Z', or any knowledge/policy/process lookup. All internal roles can search SOPs and resources; Admin/Manager also search uploaded documents.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The topic, keyword, or question to search for" },
          scope: { type: "string", description: "Optional: 'sops', 'resources', or 'all' (default 'all')" },
        },
        required: ["query"],
      },
    },
  },

  // ── F. SOP BUILDER ────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "createSop",
      description: "Save a completed SOP to the SOP library. ONLY call this AFTER you have guided the user through the full SOP content step by step and they have confirmed the final result. Admin/Manager only. Always confirm before saving.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "SOP title — clear, action-oriented (e.g. 'How to Install a Block Retaining Wall')" },
          category: { type: "string", description: "Category, e.g. 'Installation', 'Maintenance', 'Safety', 'Equipment', 'Customer Service', 'Operations', 'HR'" },
          superCategory: { type: "string", description: "Optional top-level grouping, e.g. 'Field Operations', 'Administrative', 'Safety'" },
          content: { type: "string", description: "Full SOP content in markdown. Must include: an Overview paragraph, numbered Steps, and any Safety Notes or Materials/Tools needed." },
        },
        required: ["title", "category", "content"],
      },
    },
  },
];

const MODULE_ROUTES: Record<string, string> = {
  dashboard: "/",
  sops: "/sops",
  inventory: "/catalog",
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
  "plant library": "/plant-cards",
  "plant-library": "/plant-cards",
  "plant cards": "/plant-cards",
  "plant-cards": "/plant-cards",
  plants: "/plant-cards",
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
    "searchPlantCards",
    // New read-only tools available to all internal roles (scoped internally per role)
    "searchKnowledgeBase", "getEmployeeHours",
  ];
  if (readOnlyTools.includes(toolName)) return { allowed: true };

  if (role === "Customer") return { allowed: false, reason: "This action is not available for customer accounts." };

  // Financial, HR, and hiring tools — Admin/Manager only
  const adminManagerOnly = [
    "getInvoices", "getInvoiceAgingSummary",
    "getRevenueReport", "getJobCostSummary",
    "getOvertimeReport",
    "searchCandidates", "getHiringPipelineSummary",
    "createSop",
  ];
  if (adminManagerOnly.includes(toolName)) {
    if (!["Admin", "Master Admin", "Manager"].includes(role)) {
      return { allowed: false, reason: "This information is only available to Admin and Manager roles." };
    }
    return { allowed: true };
  }

  if (toolName === "createPlantCard") {
    if (!["Admin", "Master Admin"].includes(role)) return { allowed: false, reason: "Only admins can create plant cards." };
    return { allowed: true };
  }

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

export async function executeTool(toolName: string, toolArgs: any, user: any): Promise<{ result: any; navigationTarget?: string; error?: string; isDenied?: boolean }> {
  const permCheck = checkPermission(user, toolName);
  if (!permCheck.allowed) {
    return { result: null, error: permCheck.reason || "Permission denied.", isDenied: true };
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
        if (user.role === "Customer") return { result: null, error: "Global search is not available for customer accounts.", isDenied: true };
        const query = `%${toolArgs.query}%`;
        const results: any = {};
        const isGlobalAdmin = ["Admin", "Manager", "Master Admin"].includes(user.role);

        // Non-admin roles: scope tasks to own records only
        const taskQuery = isGlobalAdmin
          ? pool.query(`SELECT id, task_id, title, status, priority FROM tasks WHERE title ILIKE $1 OR description ILIKE $1 LIMIT 5`, [query])
          : pool.query(`SELECT id, task_id, title, status, priority FROM tasks WHERE (title ILIKE $1 OR description ILIKE $1) AND (assigned_to_user_id = $2 OR created_by_user_id = $2) LIMIT 5`, [query, user.id]);

        // Non-admin roles: return only name + role, never username or email
        const userSelectCols = isGlobalAdmin ? "id, name, username, role" : "id, name, role";
        const userQuery = pool.query(`SELECT ${userSelectCols} FROM users WHERE (name ILIKE $1 OR username ILIKE $1 OR role ILIKE $1) AND role != 'Customer' AND (is_active IS NULL OR is_active = true) LIMIT 5`, [query]);

        const [tasks, equip, users, sops] = await Promise.all([
          taskQuery,
          pool.query(`SELECT id, name, asset_id, make, model, status FROM equipment WHERE name ILIKE $1 OR make ILIKE $1 OR model ILIKE $1 OR asset_id ILIKE $1 LIMIT 5`, [query]),
          userQuery,
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
        if (user.role === "Customer") return { result: null, error: "Equipment search is not available for customer accounts.", isDenied: true };
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
        const isTaskAdmin = ["Admin", "Manager", "Master Admin"].includes(user.role);
        let sql = `SELECT t.id, t.task_id, t.title, t.status, t.priority, t.due_date,
                    creator.name as created_by_name, assignee.name as assigned_to_name
                    FROM tasks t
                    LEFT JOIN users creator ON t.created_by_user_id = creator.id
                    LEFT JOIN users assignee ON t.assigned_to_user_id = assignee.id
                    WHERE 1=1`;
        const params: any[] = [];
        let paramIdx = 1;

        if (!isTaskAdmin) {
          sql += ` AND (t.assigned_to_user_id = $${paramIdx} OR t.created_by_user_id = $${paramIdx})`;
          params.push(user.id);
          paramIdx++;
        }
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
        if (user.role === "Customer") return { result: null, error: "Employee search is not available for customer accounts.", isDenied: true };
        const isEmpAdmin = ["Admin", "Manager", "Master Admin"].includes(user.role);
        // Non-admin roles: return only name + role; never expose email or username
        const empSelectCols = isEmpAdmin ? "id, name, username, role, email" : "id, name, role";
        const query = `%${toolArgs.query}%`;
        const res = await pool.query(
          `SELECT ${empSelectCols} FROM users WHERE (name ILIKE $1 OR username ILIKE $1 OR role ILIKE $1) AND role != 'Customer' AND (is_active IS NULL OR is_active = true) LIMIT 10`,
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
        if (user.role === "Customer") return { result: null, error: "Calendar access is not available for customer accounts.", isDenied: true };
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
        if (user.role === "Customer") return { result: null, error: "Job information is not available for customer accounts.", isDenied: true };
        const isJobAdmin = ["Admin", "Manager", "Master Admin"].includes(user.role);
        // Non-admin roles: strip contract value and internal notes — these are admin-only in the UI
        const jobSelectCols = isJobAdmin
          ? "id, client, type, category, stage, status, value, scheduled_date, completion_date, notes, zone"
          : "id, client, type, category, stage, status, scheduled_date, zone";
        let jobSql = `SELECT ${jobSelectCols} FROM jobs WHERE 1=1`;
        const jobParams: any[] = [];
        let jobIdx = 1;

        if (!isJobAdmin) {
          jobSql += ` AND crew_lead_id = $${jobIdx++}`;
          jobParams.push(user.id);
        }
        if (toolArgs.stage) { jobSql += ` AND stage = $${jobIdx++}`; jobParams.push(toolArgs.stage); }
        if (toolArgs.category) { jobSql += ` AND category ILIKE $${jobIdx++}`; jobParams.push(toolArgs.category); }
        if (toolArgs.scheduledToday) { jobSql += ` AND scheduled_date::date = CURRENT_DATE`; }
        if (toolArgs.overdueOnly) {
          // Mirrors the "Overdue Jobs" definition used by the admin Daily Pulse widget
          // (server/adminDashboardRoutes.ts) and Overdue.tsx/ManagerDashboard.tsx: uses the
          // operational "status" column (not the legacy sales-pipeline "stage" column), which
          // is often stale/unmaintained once a job moves into execution.
          jobSql += ` AND scheduled_date IS NOT NULL AND DATE(scheduled_date) < CURRENT_DATE AND status IN ('scheduled', 'in_progress', 'sold', 'active')`;
        }

        jobSql += ` ORDER BY scheduled_date ASC NULLS LAST, created_at DESC LIMIT 20`;
        const jobRes = await pool.query(jobSql, jobParams);
        return { result: { jobs: jobRes.rows, count: jobRes.rows.length } };
      }

      case "getDailyBriefing": {
        if (user.role === "Customer") return { result: null, error: "Daily briefing is not available for customer accounts.", isDenied: true };
        const userId = user.id;
        const isBriefingAdmin = ["Admin", "Manager", "Master Admin"].includes(user.role);

        // Non-admin roles: scope equipment maintenance alerts to assets assigned to that user only
        const equipSql = isBriefingAdmin
          ? `SELECT e.name, e.asset_id, ms.name as schedule_name FROM maintenance_schedules ms JOIN equipment e ON ms.equipment_id = e.id WHERE ms.is_active = true AND ms.next_due_date <= NOW() LIMIT 10`
          : `SELECT e.name, e.asset_id, ms.name as schedule_name FROM maintenance_schedules ms JOIN equipment e ON ms.equipment_id = e.id WHERE ms.is_active = true AND ms.next_due_date <= NOW() AND e.assigned_to_user_id = $1 LIMIT 10`;
        const equipParams = isBriefingAdmin ? [] : [userId];

        const [overdue, dueToday, p1Equip, unack] = await Promise.all([
          pool.query(
            `SELECT t.task_id, t.title, t.priority, t.due_date FROM tasks t WHERE (t.assigned_to_user_id = $1 OR t.created_by_user_id = $1) AND t.status NOT IN ('completed','confirmed','cancelled') AND t.due_date < NOW() ORDER BY t.due_date LIMIT 10`,
            [userId]
          ),
          pool.query(
            `SELECT t.task_id, t.title, t.priority FROM tasks t WHERE (t.assigned_to_user_id = $1 OR t.created_by_user_id = $1) AND t.status NOT IN ('completed','confirmed','cancelled') AND t.due_date::date = CURRENT_DATE LIMIT 10`,
            [userId]
          ),
          pool.query(equipSql, equipParams),
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
        if (!canAssign.allowed) return { result: null, error: canAssign.reason || "You cannot assign tasks to this user.", isDenied: true };

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
        const isStatusAdmin = ["Admin", "Manager", "Master Admin"].includes(user.role);
        if (!isStatusAdmin) {
          const isOwner = task.assigned_to_user_id === user.id || task.created_by_user_id === user.id;
          if (!isOwner) return { result: null, error: "You can only update tasks that are assigned to you or that you created." };
        }
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

      case "searchPlantCards": {
        let sql = `SELECT id, common_name, botanical_name, plant_type, deciduous_evergreen,
                    mature_size, hardiness_zone, light_requirement, water_needs,
                    growth_rate, flowering, deer_resistant, published
                   FROM plant_cards WHERE (common_name ILIKE $1 OR botanical_name ILIKE $1)`;
        const params: any[] = [`%${toolArgs.query}%`];
        if (toolArgs.plantType) {
          sql += ` AND plant_type = $2`;
          params.push(toolArgs.plantType);
        }
        sql += ` ORDER BY common_name ASC LIMIT 10`;
        const res = await pool.query(sql, params);
        if (res.rows.length === 0) {
          return { result: { cards: [], count: 0, message: `No plant cards found matching "${toolArgs.query}". You can create one using the createPlantCard tool.` } };
        }
        return { result: { cards: res.rows, count: res.rows.length } };
      }

      case "createPlantCard": {
        // Use AI to generate all the horticultural data
        const aiClient = new OpenAI({
          apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        });
        const hint = [toolArgs.commonName, toolArgs.botanicalName, toolArgs.plantType].filter(Boolean).join(" / ");
        const completion = await aiClient.chat.completions.create({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You are a professional horticulturist. Return ONLY valid JSON. Be concise and accurate for northeastern USA (zones 5-7)." },
            { role: "user", content: `Generate a complete plant info card for: ${hint}\n\nReturn this exact JSON (fill every field; null for truly unknown):\n{\n  "commonName": "",\n  "botanicalName": "",\n  "plantType": "Tree|Shrub|Perennial|Annual|Groundcover|Vine|Grass|Other",\n  "deciduousEvergreen": "Deciduous|Evergreen|Semi-Evergreen",\n  "matureSize": "e.g. 20-30 ft tall x 15-20 ft wide",\n  "growthRate": "Slow|Moderate|Fast",\n  "hardinessZone": "e.g. 4-8",\n  "lightRequirement": "Full Sun|Part Sun|Part Shade|Full Shade|Adaptable",\n  "soilMoisture": "e.g. Well-drained, tolerates clay",\n  "waterNeeds": "Low|Moderate|High",\n  "deerResistant": true,\n  "flowering": true,\n  "flowerSeason": "e.g. May-June",\n  "flowerColor": "e.g. White",\n  "pruningTime": "e.g. Late winter before new growth",\n  "knownPestsIssues": "e.g. Aphids, fireblight",\n  "specialNotes": "2-3 sentences about landscape use",\n  "maintenanceNotes": "2-3 practical maintenance tips for a landscape crew"\n}` },
          ],
        });
        const data = JSON.parse(completion.choices[0].message.content || "{}");

        const insertRes = await pool.query(
          `INSERT INTO plant_cards (
            common_name, botanical_name, plant_type, deciduous_evergreen,
            mature_size, growth_rate, hardiness_zone, light_requirement, soil_moisture,
            water_needs, deer_resistant, flowering, flower_season, flower_color,
            pruning_time, known_pests_issues, special_notes, maintenance_notes,
            photos, published, created_by
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
          RETURNING id, common_name, botanical_name, plant_type`,
          [
            data.commonName || toolArgs.commonName,
            data.botanicalName || toolArgs.botanicalName || null,
            data.plantType || toolArgs.plantType || null,
            data.deciduousEvergreen || null,
            data.matureSize || null,
            data.growthRate || null,
            data.hardinessZone || null,
            data.lightRequirement || null,
            data.soilMoisture || null,
            data.waterNeeds || null,
            data.deerResistant ?? false,
            data.flowering ?? false,
            data.flowerSeason || null,
            data.flowerColor || null,
            data.pruningTime || null,
            data.knownPestsIssues || null,
            data.specialNotes || null,
            data.maintenanceNotes || null,
            JSON.stringify([]),
            true,
            user.username || user.name || "admin",
          ]
        );

        const card = insertRes.rows[0];
        return {
          result: {
            success: true,
            cardId: card.id,
            commonName: card.common_name,
            botanicalName: card.botanical_name,
            plantType: card.plant_type,
            message: `Plant card for "${card.common_name}" has been created and published. You can add photos by going to the Plant Library and opening the card.`,
          },
          navigationTarget: "/plant-cards",
        };
      }

      // ── A. INVOICES ──────────────────────────────────────────────────────────
      case "getInvoices": {
        let sql = `SELECT i.id, i.invoice_number,
          COALESCE(NULLIF(c.company_name, ''), c.first_name || ' ' || COALESCE(c.last_name, ''), 'Unknown') AS customer_name,
          ROUND(COALESCE(i.total, 0)::numeric, 2) AS total,
          ROUND(COALESCE(i.balance_due, 0)::numeric, 2) AS balance_due,
          ROUND(COALESCE(i.amount_paid, 0)::numeric, 2) AS amount_paid,
          i.status, i.due_date, i.issued_date
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.status != 'void'`;
        const invParams: any[] = [];
        let invIdx = 1;
        if (toolArgs.status) { sql += ` AND i.status = $${invIdx++}`; invParams.push(toolArgs.status); }
        if (toolArgs.customerName) {
          sql += ` AND (c.company_name ILIKE $${invIdx} OR (c.first_name || ' ' || COALESCE(c.last_name,'')) ILIKE $${invIdx})`;
          invParams.push(`%${toolArgs.customerName}%`); invIdx++;
        }
        if (toolArgs.overdueOnly) {
          sql += ` AND i.due_date < CURRENT_DATE AND i.balance_due > 0`;
        }
        sql += ` ORDER BY i.due_date ASC NULLS LAST LIMIT $${invIdx}`;
        invParams.push(Math.min(toolArgs.limit || 20, 50));
        const invRes = await pool.query(sql, invParams);
        const totalOut = invRes.rows.reduce((s: number, r: any) => s + parseFloat(r.balance_due || 0), 0);
        return { result: { invoices: invRes.rows, count: invRes.rows.length, total_outstanding: Math.round(totalOut * 100) / 100 } };
      }

      case "getInvoiceAgingSummary": {
        const agRes = await pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE balance_due > 0 AND (due_date IS NULL OR due_date >= CURRENT_DATE))::int AS current_count,
            ROUND(COALESCE(SUM(balance_due) FILTER (WHERE balance_due > 0 AND (due_date IS NULL OR due_date >= CURRENT_DATE)), 0)::numeric, 2) AS current_amount,
            COUNT(*) FILTER (WHERE balance_due > 0 AND due_date < CURRENT_DATE AND due_date >= CURRENT_DATE - INTERVAL '30 days')::int AS days_1_30_count,
            ROUND(COALESCE(SUM(balance_due) FILTER (WHERE balance_due > 0 AND due_date < CURRENT_DATE AND due_date >= CURRENT_DATE - INTERVAL '30 days'), 0)::numeric, 2) AS days_1_30_amount,
            COUNT(*) FILTER (WHERE balance_due > 0 AND due_date < CURRENT_DATE - INTERVAL '30 days' AND due_date >= CURRENT_DATE - INTERVAL '60 days')::int AS days_31_60_count,
            ROUND(COALESCE(SUM(balance_due) FILTER (WHERE balance_due > 0 AND due_date < CURRENT_DATE - INTERVAL '30 days' AND due_date >= CURRENT_DATE - INTERVAL '60 days'), 0)::numeric, 2) AS days_31_60_amount,
            COUNT(*) FILTER (WHERE balance_due > 0 AND due_date < CURRENT_DATE - INTERVAL '60 days' AND due_date >= CURRENT_DATE - INTERVAL '90 days')::int AS days_61_90_count,
            ROUND(COALESCE(SUM(balance_due) FILTER (WHERE balance_due > 0 AND due_date < CURRENT_DATE - INTERVAL '60 days' AND due_date >= CURRENT_DATE - INTERVAL '90 days'), 0)::numeric, 2) AS days_61_90_amount,
            COUNT(*) FILTER (WHERE balance_due > 0 AND due_date < CURRENT_DATE - INTERVAL '90 days')::int AS days_90_plus_count,
            ROUND(COALESCE(SUM(balance_due) FILTER (WHERE balance_due > 0 AND due_date < CURRENT_DATE - INTERVAL '90 days'), 0)::numeric, 2) AS days_90_plus_amount
          FROM invoices
          WHERE status NOT IN ('void', 'draft', 'paid')
        `);
        const ag = agRes.rows[0];
        const totalOutstanding = [ag.current_amount, ag.days_1_30_amount, ag.days_31_60_amount, ag.days_61_90_amount, ag.days_90_plus_amount]
          .reduce((s, v) => s + parseFloat(v || 0), 0);
        return {
          result: {
            aging: {
              current: { label: "Current (not yet due)", count: ag.current_count, amount: parseFloat(ag.current_amount) },
              days_1_30: { label: "1-30 days past due", count: ag.days_1_30_count, amount: parseFloat(ag.days_1_30_amount) },
              days_31_60: { label: "31-60 days past due", count: ag.days_31_60_count, amount: parseFloat(ag.days_31_60_amount) },
              days_61_90: { label: "61-90 days past due", count: ag.days_61_90_count, amount: parseFloat(ag.days_61_90_amount) },
              days_90_plus: { label: "90+ days past due", count: ag.days_90_plus_count, amount: parseFloat(ag.days_90_plus_amount) },
            },
            total_outstanding: Math.round(totalOutstanding * 100) / 100,
            as_of: new Date().toISOString().split("T")[0],
          }
        };
      }

      // ── B. FINANCIAL REPORTS ─────────────────────────────────────────────────
      case "getRevenueReport": {
        const [monthly, ytd] = await Promise.all([
          pool.query(`
            SELECT
              TO_CHAR(DATE_TRUNC('month', issued_date), 'Mon YYYY') AS month,
              DATE_TRUNC('month', issued_date)::date AS month_start,
              COUNT(*)::int AS invoice_count,
              ROUND(COALESCE(SUM(total), 0)::numeric, 2) AS gross_revenue,
              ROUND(COALESCE(SUM(amount_paid), 0)::numeric, 2) AS collected,
              ROUND(COALESCE(SUM(balance_due), 0)::numeric, 2) AS outstanding
            FROM invoices
            WHERE status NOT IN ('void', 'draft')
              AND issued_date >= NOW() - INTERVAL '12 months'
              AND issued_date IS NOT NULL
            GROUP BY DATE_TRUNC('month', issued_date)
            ORDER BY month_start DESC
          `),
          pool.query(`
            SELECT
              ROUND(COALESCE(SUM(total), 0)::numeric, 2) AS ytd_gross,
              ROUND(COALESCE(SUM(amount_paid), 0)::numeric, 2) AS ytd_collected,
              ROUND(COALESCE(SUM(balance_due), 0)::numeric, 2) AS ytd_outstanding,
              COUNT(*)::int AS ytd_invoice_count
            FROM invoices
            WHERE status NOT IN ('void', 'draft')
              AND issued_date >= DATE_TRUNC('year', NOW())
          `),
        ]);
        return { result: { monthly: monthly.rows, ytd: ytd.rows[0], generated_at: new Date().toISOString().split("T")[0] } };
      }

      case "getJobCostSummary": {
        const lookbackDays = Math.min(toolArgs.limitDays || 90, 365);
        const jcParams: any[] = [lookbackDays];
        let jcWhere = "";
        if (toolArgs.jobName) {
          jcWhere = ` AND (j.title ILIKE $2 OR j.client ILIKE $2)`;
          jcParams.push(`%${toolArgs.jobName}%`);
        }
        const jcRes = await pool.query(`
          SELECT j.id, COALESCE(NULLIF(j.title,''), j.client, 'Untitled') AS job_name, j.client, j.type, j.status,
            ROUND(COALESCE(j.value, 0)::numeric, 2) AS estimated_value,
            ROUND(COALESCE(SUM(te.duration_minutes) FILTER (WHERE te.clock_out IS NOT NULL), 0) / 60.0, 1) AS hours_worked,
            COUNT(DISTINCT te.user_id) FILTER (WHERE te.clock_out IS NOT NULL) AS crew_count,
            COUNT(DISTINCT i.id)::int AS invoice_count,
            ROUND(COALESCE(SUM(DISTINCT i.total), 0)::numeric, 2) AS invoiced_total
          FROM jobs j
          LEFT JOIN time_entries te ON te.job_id = j.id
          LEFT JOIN invoices i ON i.job_id = j.id AND i.status NOT IN ('void', 'draft')
          WHERE j.status != 'cancelled'
            AND j.created_at >= NOW() - ($1::int * INTERVAL '1 day')
            ${jcWhere}
          GROUP BY j.id, j.title, j.client, j.type, j.status, j.value
          ORDER BY j.created_at DESC
          LIMIT 20
        `, jcParams);
        return { result: { jobs: jcRes.rows, count: jcRes.rows.length, lookback_days: lookbackDays } };
      }

      // ── C. PEOPLE / TIME ─────────────────────────────────────────────────────
      case "getEmployeeHours": {
        const isHoursAdmin = ["Admin", "Manager", "Master Admin"].includes(user.role);
        const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        const dateFrom = toolArgs.dateFrom || weekStart.toISOString().split("T")[0];
        const dateTo = toolArgs.dateTo || new Date().toISOString().split("T")[0];
        const ehParams: any[] = [dateFrom, dateTo];
        let ehWhere = "";
        if (!isHoursAdmin) {
          ehWhere = ` AND te.user_id = $3`;
          ehParams.push(user.id);
        } else if (toolArgs.employeeName) {
          ehWhere = ` AND u.name ILIKE $3`;
          ehParams.push(`%${toolArgs.employeeName}%`);
        }
        const ehRes = await pool.query(`
          SELECT u.name AS employee_name,
            COUNT(DISTINCT te.clock_in::date)::int AS days_worked,
            ROUND(COALESCE(SUM(te.duration_minutes), 0) / 60.0, 1) AS total_hours,
            ROUND(COALESCE(SUM(te.duration_minutes) FILTER (WHERE te.entry_type = 'billable'), 0) / 60.0, 1) AS billable_hours,
            ROUND(COALESCE(SUM(te.duration_minutes) FILTER (WHERE te.entry_type = 'shop_time'), 0) / 60.0, 1) AS shop_hours,
            ROUND(COALESCE(SUM(te.duration_minutes) FILTER (WHERE te.entry_type = 'drive_time'), 0) / 60.0, 1) AS drive_hours
          FROM time_entries te
          LEFT JOIN users u ON u.id = te.user_id
          WHERE te.clock_out IS NOT NULL
            AND te.duration_minutes > 0
            AND te.clock_in::date >= $1
            AND te.clock_in::date <= $2
            ${ehWhere}
          GROUP BY u.id, u.name
          ORDER BY total_hours DESC
          LIMIT 25
        `, ehParams);
        const result: any = { period: { from: dateFrom, to: dateTo }, employees: ehRes.rows, count: ehRes.rows.length };
        if (toolArgs.groupByJob && isHoursAdmin) {
          const gjParams: any[] = [dateFrom, dateTo];
          let gjWhere = "";
          if (toolArgs.employeeName) { gjWhere = ` AND u.name ILIKE $3`; gjParams.push(`%${toolArgs.employeeName}%`); }
          const gjRes = await pool.query(`
            SELECT u.name AS employee_name,
              COALESCE(NULLIF(j.title,''), j.client, 'No Job / Shop') AS job_name,
              ROUND(COALESCE(SUM(te.duration_minutes), 0) / 60.0, 1) AS hours
            FROM time_entries te
            LEFT JOIN users u ON u.id = te.user_id
            LEFT JOIN jobs j ON j.id = te.job_id
            WHERE te.clock_out IS NOT NULL AND te.duration_minutes > 0
              AND te.clock_in::date >= $1 AND te.clock_in::date <= $2
              ${gjWhere}
            GROUP BY u.id, u.name, j.id, j.title, j.client
            ORDER BY u.name, hours DESC
            LIMIT 100
          `, gjParams);
          result.by_job = gjRes.rows;
        }
        return { result };
      }

      case "getOvertimeReport": {
        const weeksBack = Math.min(toolArgs.weeksBack || 4, 12);
        const otRes = await pool.query(`
          SELECT u.name AS employee_name,
            DATE_TRUNC('week', te.clock_in)::date AS week_start,
            (DATE_TRUNC('week', te.clock_in) + INTERVAL '6 days')::date AS week_end,
            ROUND(SUM(te.duration_minutes) / 60.0, 1) AS total_hours,
            GREATEST(ROUND(SUM(te.duration_minutes) / 60.0 - 40, 1), 0) AS overtime_hours
          FROM time_entries te
          LEFT JOIN users u ON u.id = te.user_id
          WHERE te.clock_out IS NOT NULL
            AND te.duration_minutes > 0
            AND te.clock_in >= NOW() - ($1::int * INTERVAL '1 week')
          GROUP BY u.id, u.name, DATE_TRUNC('week', te.clock_in)
          HAVING SUM(te.duration_minutes) / 60.0 > 40
          ORDER BY week_start DESC, total_hours DESC
        `, [weeksBack]);
        const totalOT = otRes.rows.reduce((s: number, r: any) => s + parseFloat(r.overtime_hours || 0), 0);
        return {
          result: {
            overtime_entries: otRes.rows,
            count: otRes.rows.length,
            total_overtime_hours: Math.round(totalOT * 10) / 10,
            weeks_reviewed: weeksBack,
            message: otRes.rows.length === 0 ? `No employees exceeded 40 hours/week in the last ${weeksBack} week(s).` : undefined,
          }
        };
      }

      // ── D. HIRING ─────────────────────────────────────────────────────────────
      case "searchCandidates": {
        let candSql = `SELECT id, name, role, stage, applied_date, rating, source, email FROM candidates WHERE 1=1`;
        const candParams: any[] = [];
        let candIdx = 1;
        if (toolArgs.query) {
          candSql += ` AND (name ILIKE $${candIdx} OR role ILIKE $${candIdx})`;
          candParams.push(`%${toolArgs.query}%`); candIdx++;
        }
        if (toolArgs.stage) {
          candSql += ` AND stage ILIKE $${candIdx++}`;
          candParams.push(`%${toolArgs.stage}%`);
        }
        if (toolArgs.recentOnly) {
          candSql += ` AND applied_date >= NOW() - INTERVAL '30 days'`;
        }
        candSql += ` ORDER BY applied_date DESC NULLS LAST LIMIT 20`;
        const candRes = await pool.query(candSql, candParams);
        return { result: { candidates: candRes.rows, count: candRes.rows.length } };
      }

      case "getHiringPipelineSummary": {
        const [stages, recent, positions, totals] = await Promise.all([
          pool.query(`SELECT stage, COUNT(*)::int AS count FROM candidates GROUP BY stage ORDER BY count DESC`),
          pool.query(`SELECT id, name, role, stage, applied_date, rating, source FROM candidates ORDER BY applied_date DESC NULLS LAST LIMIT 6`),
          pool.query(`SELECT COALESCE(NULLIF(role,''), 'Unknown') AS position, COUNT(*)::int AS count FROM candidates GROUP BY role ORDER BY count DESC LIMIT 8`),
          pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE stage = 'Hired')::int AS hired, COUNT(*) FILTER (WHERE applied_date >= NOW() - INTERVAL '30 days')::int AS last_30_days FROM candidates`),
        ]);
        return {
          result: {
            total_candidates: totals.rows[0]?.total || 0,
            total_hired: totals.rows[0]?.hired || 0,
            applied_last_30_days: totals.rows[0]?.last_30_days || 0,
            by_stage: stages.rows,
            by_position: positions.rows,
            recent_applicants: recent.rows,
          }
        };
      }

      // ── E. KNOWLEDGE BASE ─────────────────────────────────────────────────────
      case "searchKnowledgeBase": {
        const isKbAdmin = ["Admin", "Manager", "Master Admin"].includes(user.role);
        const kbQuery = `%${toolArgs.query}%`;
        const scope = toolArgs.scope || "all";
        const kbResults: any = { query: toolArgs.query };
        const searches: Promise<void>[] = [];

        if (scope === "all" || scope === "sops") {
          const sopSql = isKbAdmin
            ? `SELECT id, title, category, super_category, LEFT(content, 500) AS content_preview FROM sops WHERE title ILIKE $1 OR category ILIKE $1 OR content ILIKE $1 ORDER BY title LIMIT 5`
            : `SELECT id, title, category, super_category, LEFT(content, 500) AS content_preview FROM sops WHERE title ILIKE $1 OR category ILIKE $1 ORDER BY title LIMIT 5`;
          searches.push(pool.query(sopSql, [kbQuery]).then(r => { kbResults.sops = r.rows; }));
        }

        if (scope === "all" || scope === "resources") {
          searches.push(
            pool.query(
              `SELECT id, title, description, category, type, season,
                LEFT(COALESCE(content, description, ''), 500) AS content_preview
               FROM customer_resources
               WHERE is_published = true
                 AND (title ILIKE $1 OR description ILIKE $1 OR content ILIKE $1)
               ORDER BY title LIMIT 5`,
              [kbQuery]
            ).then(r => { kbResults.resources = r.rows; })
          );
        }

        if (isKbAdmin && (scope === "all" || scope === "documents")) {
          searches.push(
            pool.query(
              `SELECT id, file_name AS title, category, home_entity_type, created_at
               FROM documents WHERE file_name ILIKE $1 OR category ILIKE $1
               ORDER BY created_at DESC LIMIT 5`,
              [kbQuery]
            ).then(r => { kbResults.documents = r.rows; })
          );
        }

        await Promise.all(searches);

        const total = (kbResults.sops?.length || 0) + (kbResults.resources?.length || 0) + (kbResults.documents?.length || 0);
        kbResults.total_results = total;
        if (total === 0) kbResults.message = `No matches found for "${toolArgs.query}". Try a broader keyword or phrase.`;
        return { result: kbResults };
      }

      // ── F. SOP BUILDER ────────────────────────────────────────────────────────
      case "createSop": {
        const catRow = await pool.query(
          `SELECT id FROM sop_categories WHERE name ILIKE $1 LIMIT 1`,
          [`%${toolArgs.category}%`]
        );
        const categoryId = catRow.rows[0]?.id || null;
        const sopInsert = await pool.query(
          `INSERT INTO sops (title, category, category_id, super_category, content, last_updated)
           VALUES ($1, $2, $3, $4, $5, NOW())
           RETURNING id, title, category`,
          [toolArgs.title, toolArgs.category, categoryId, toolArgs.superCategory || null, toolArgs.content]
        );
        const saved = sopInsert.rows[0];
        return {
          result: {
            success: true,
            sopId: saved.id,
            title: saved.title,
            category: saved.category,
            message: `SOP "${saved.title}" has been saved to the ${saved.category} category. You can view and edit it in the SOP Library.`,
          },
          navigationTarget: "/sops",
        };
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
