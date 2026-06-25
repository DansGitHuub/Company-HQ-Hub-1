import type { Express, Request, Response, NextFunction } from "express";
import OpenAI from "openai";
import { requireAdmin } from "./auth";

type AuthRequest = Request & { user?: any };
import { pool } from "./db";
import { allToolDefinitions, executeTool, shouldRequireConfirmation, getToolNames } from "./assistantTools";
import { speechToText, textToSpeech } from "./replit_integrations/audio/client";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

import crypto from "crypto";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_LENGTH = 50;
const MAX_SESSION_ID_LENGTH = 128;
const CONFIRMATION_TTL_MS = 5 * 60 * 1000;
const INTERNAL_ROLES = ["Admin", "Master Admin", "Manager", "Crew Lead", "Crew", "New Hire", "HR", "Sales", "Customer"];

interface PendingConfirmation {
  userId: string;
  toolName: string;
  toolArgs: any;
  createdAt: number;
}
const pendingConfirmations = new Map<string, PendingConfirmation>();

function cleanupExpiredConfirmations() {
  const now = Date.now();
  for (const [token, entry] of pendingConfirmations.entries()) {
    if (now - entry.createdAt > CONFIRMATION_TTL_MS) {
      pendingConfirmations.delete(token);
    }
  }
}

function createConfirmationToken(userId: string, toolName: string, toolArgs: any): string {
  cleanupExpiredConfirmations();
  const token = crypto.randomBytes(32).toString("hex");
  pendingConfirmations.set(token, { userId, toolName, toolArgs, createdAt: Date.now() });
  return token;
}

function consumeConfirmationToken(token: string, userId: string): PendingConfirmation | null {
  cleanupExpiredConfirmations();
  const entry = pendingConfirmations.get(token);
  if (!entry) return null;
  if (entry.userId !== userId) return null;
  pendingConfirmations.delete(token);
  return entry;
}

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

const requireInternalRole = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as any;
  if (!user || !INTERNAL_ROLES.includes(user.role)) {
    return res.status(403).json({ message: "Assistant is not available for your role" });
  }
  next();
};


async function getAppContext(userId: string, userRole: string) {
  const context = { overdueTasks: 0, p1Alerts: 0, unacknowledgedTasks: 0, unreadMessages: 0 };

  try {
    const overdueResult = await pool.query(
      `SELECT COUNT(*) as count FROM tasks WHERE (assigned_to = $1 OR created_by = $1) AND status NOT IN ('completed', 'confirmed', 'cancelled') AND due_date < NOW()`,
      [userId]
    );
    context.overdueTasks = parseInt(overdueResult.rows[0]?.count || "0");
  } catch (err) {
    console.error("[assistant] Failed to query overdue tasks:", err);
  }

  if (["Admin", "Master Admin", "Manager"].includes(userRole)) {
    try {
      const p1Result = await pool.query(
        `SELECT COUNT(*) as count FROM maintenance_schedules ms JOIN equipment e ON ms.equipment_id = e.id WHERE ms.priority = 'p1_critical' AND ms.status = 'due'`
      );
      context.p1Alerts = parseInt(p1Result.rows[0]?.count || "0");
    } catch (err) {
      console.error("[assistant] Failed to query P1 alerts:", err);
    }
  }

  try {
    const unackResult = await pool.query(
      `SELECT COUNT(*) as count FROM tasks WHERE assigned_to = $1 AND status = 'assigned'`,
      [userId]
    );
    context.unacknowledgedTasks = parseInt(unackResult.rows[0]?.count || "0");
  } catch (err) {
    console.error("[assistant] Failed to query unacknowledged tasks:", err);
  }

  return context;
}

async function getAgentContext(userRole: string) {
  try {
    const res = await pool.query(
      `SELECT system_prompt_addition, enabled_tools FROM assistant_agents WHERE is_enabled = true AND (allowed_roles @> $1::jsonb OR allowed_roles = '[]'::jsonb)`,
      [JSON.stringify([userRole])]
    );
    const additions: string[] = [];
    const allowedTools: string[] = [];
    for (const row of res.rows) {
      if (row.system_prompt_addition) additions.push(row.system_prompt_addition);
      if (row.enabled_tools && Array.isArray(row.enabled_tools)) {
        for (const t of row.enabled_tools) {
          if (!allowedTools.includes(t)) allowedTools.push(t);
        }
      }
    }
    return { promptAdditions: additions.join("\n\n"), allowedTools };
  } catch {
    return { promptAdditions: "", allowedTools: [] };
  }
}

const CUSTOMER_TOOLS = ["navigateTo", "searchGlobal", "submitRepairRequest"];

function buildSystemPrompt(user: any, appContext: any, currentModule: string, agentAddition?: string) {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  const layer1 = `You are the CompanyHQ AI Assistant for a landscape business management platform.
Current user: ${user.name || user.username} (Role: ${user.role})
User ID: ${user.id}
Current time: ${now}
Current module: ${currentModule || "unknown"}`;

  let layer2: string;

  if (user.role === "Customer") {
    layer2 = `Behavioral Rules:
- You are speaking with a CUSTOMER of the landscape company. Be warm, helpful, and professional.
- Help them with: their service requests, job status, property care questions, scheduling, documents, and account information.
- You can help with general landscaping advice, plant care tips, seasonal maintenance guidance, and property improvement ideas.
- NEVER share internal company information such as: employee details, internal SOPs, financial data, hiring info, equipment details, other customer data, or internal operations.
- If asked about internal operations, politely explain you can only help with their account and services.
- Keep responses short and friendly — 2-3 sentences when possible.
- Remember the full conversation context.
- You can navigate the user to pages in their portal.
- Use a warm, professional tone appropriate for a valued customer.`;
  } else {
    const roleCapabilities: Record<string, string> = {
      "Admin": `You are speaking with an ADMIN. They have full access to everything. They CAN:
- Send messages to any employee (use sendInternalMessage — always confirm first)
- Create and assign tasks to anyone in the company
- View calendar events, jobs, tasks, equipment, employees, SOPs, and messages
- Update task statuses
- Log equipment service, update hours, submit repair requests
- Get daily briefings and summaries
- Navigate to any module
Sensitive data rules: Do NOT reveal another employee's pay rate, hourly wage, corrective action details, or personal contact info — direct them to the Employees module for sensitive HR data.`,

      "Master Admin": `You are speaking with a MASTER ADMIN. Same full access as Admin — they can do everything including send messages, assign any tasks, and view all data.
Sensitive data rules: Do NOT reveal another employee's pay rate, hourly wage, corrective action details, or personal contact info.`,

      "Manager": `You are speaking with a MANAGER. They CAN:
- Send messages to any employee
- Create and assign tasks to Crew Lead, Crew, New Hire, HR, and Sales roles
- View tasks, equipment, SOPs, calendar, jobs, and employee info
- Update task statuses for tasks in their scope
- Log equipment service, update equipment hours, submit repair requests
Sensitive data rules: Do NOT reveal another employee's pay rate, corrective actions, or personal contact info.`,

      "HR": `You are speaking with an HR team member. They CAN:
- Send messages to anyone in the company
- Create tasks for themselves and other HR/Sales team members
- View employees, SOPs, calendar, messages, and their own tasks
- Update their own task statuses
- Navigate to any module
They CANNOT assign tasks to Crew or equipment-related actions.`,

      "Sales": `You are speaking with a SALES team member. They CAN:
- Send messages to anyone in the company
- Create tasks for themselves and other Sales/HR team members
- View jobs, calendar, messages, SOPs, and their own tasks
- Update their own task statuses
They CANNOT assign tasks to Crew or perform equipment actions.`,

      "Crew Lead": `You are speaking with a CREW LEAD. They CAN:
- Send messages to managers and admins
- Create and assign tasks to Crew members and New Hires
- View their assigned tasks, equipment, and SOPs
- Update task statuses
- Log equipment service, update hours, submit repair requests
They CANNOT view other employees' sensitive HR data.`,

      "Crew": `You are speaking with a CREW member. They CAN:
- Send messages to managers and admins
- View and update their own assigned tasks
- View SOPs and equipment relevant to their work
- Submit repair requests
- View their own calendar
They CANNOT assign tasks to others or access sensitive HR data.`,

      "New Hire": `You are speaking with a NEW HIRE. They CAN:
- Send messages to managers and admins
- View and update their own assigned tasks
- View SOPs
They have limited access — guide them to their portal for most actions.`,
    };

    const roleGuide = roleCapabilities[user.role] || `You are speaking with an internal employee (Role: ${user.role}). Help them with tasks appropriate to their role.`;

    layer2 = `${roleGuide}

General Rules:
- Always confirm before creating or modifying any data — the system will prompt the user to confirm
- Never make up records or data — always use search tools to find real data first
- Keep responses short and direct — 2-3 sentences when possible
- Remember the full conversation context
- If asked to send a message, draft it based on what the user describes, then confirm before sending
- Use searchEmployees to find a user ID before assigning tasks or sending messages by name
- For daily briefings, use getDailyBriefing; for calendar questions use getCalendarEvents; for jobs use getJobs
- Use a professional but friendly tone`;
  }

  const contextParts: string[] = [];
  if (appContext.overdueTasks > 0) contextParts.push(`${appContext.overdueTasks} overdue task(s)`);
  if (appContext.p1Alerts > 0) contextParts.push(`${appContext.p1Alerts} P1 critical equipment alert(s)`);
  if (appContext.unacknowledgedTasks > 0) contextParts.push(`${appContext.unacknowledgedTasks} unacknowledged task(s)`);

  const layer3 = contextParts.length > 0
    ? `Current app state for this user: ${contextParts.join(", ")}.`
    : `Current app state: No urgent items detected.`;

  let prompt = `${layer1}\n\n${layer2}\n\n${layer3}`;
  if (agentAddition) prompt += `\n\nAdditional instructions:\n${agentAddition}`;
  return prompt;
}

async function logConversation(
  userId: string, sessionId: string, role: string, content: string,
  toolCalled?: string, toolArgs?: any, toolResult?: any, tokensUsed?: number
) {
  try {
    await pool.query(
      `INSERT INTO assistant_conversations (user_id, session_id, role, content, tool_called, tool_args, tool_result, tokens_used) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, sessionId, role, content, toolCalled || null, toolArgs ? JSON.stringify(toolArgs) : null, toolResult ? JSON.stringify(toolResult) : null, tokensUsed || null]
    );
  } catch (err) {
    console.error("[assistant] Failed to log conversation:", err);
  }
}

export function registerAssistantRoutes(app: Express) {
  app.post("/api/assistant/chat", requireAuth, requireInternalRole, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const { message, conversationHistory, currentModule, sessionId, confirmationGranted, confirmationToken } = req.body;

      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ error: "Message is required" });
      }
      if (message.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` });
      }

      const sid = typeof sessionId === "string" ? sessionId.slice(0, MAX_SESSION_ID_LENGTH) : "default";

      if (confirmationGranted === true && confirmationToken) {
        const pending = consumeConfirmationToken(confirmationToken, user.id);
        if (!pending) {
          return res.json({ response: "That confirmation has expired or is invalid. Please try the action again.", type: "error" });
        }
        const toolName = pending.toolName;
        const toolArgs = pending.toolArgs;

        await logConversation(user.id, sid, "user", `[Confirmed] ${toolName}`);

        const execResult = await executeTool(toolName, toolArgs, user);

        if (execResult.isDenied) {
          await logConversation(user.id, sid, "denied", `[Confirmed action] ${toolName}`, toolName, toolArgs,
            { denied: true, reason: execResult.error || "Access restricted.", user_role: user.role, user_name: user.name });
        }

        if (execResult.error) {
          await logConversation(user.id, sid, "assistant", `Error: ${execResult.error}`, toolName, toolArgs, { error: execResult.error });
          return res.json({
            response: execResult.error,
            type: "error",
            toolCalled: toolName,
          });
        }

        const summaryMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: "Summarize the result of this action in 1-2 short sentences for the user. Be specific about what was created/updated." },
          { role: "user", content: `Tool "${toolName}" was executed with these results: ${JSON.stringify(execResult.result)}` },
        ];

        const summaryCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: summaryMessages,
          max_tokens: 200,
        });

        const summaryText = summaryCompletion.choices[0]?.message?.content || "Action completed successfully.";
        await logConversation(user.id, sid, "assistant", summaryText, toolName, toolArgs, execResult.result, summaryCompletion.usage?.total_tokens);

        return res.json({
          response: summaryText,
          type: "action_result",
          toolCalled: toolName,
          toolResult: execResult.result,
          navigationTarget: execResult.navigationTarget,
        });
      }

      if (confirmationGranted === false) {
        await logConversation(user.id, sid, "user", "[Cancelled]");
        await logConversation(user.id, sid, "assistant", "No problem, I've cancelled that action.");
        return res.json({ response: "No problem, I've cancelled that action.", type: "text" });
      }

      const appContext = await getAppContext(user.id, user.role);
      const agentContext = await getAgentContext(user.role);
      const systemPrompt = buildSystemPrompt(user, appContext, currentModule || "", agentContext.promptAdditions);

      await logConversation(user.id, sid, "user", message);

      const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
      ];

      if (conversationHistory && Array.isArray(conversationHistory)) {
        const trimmedHistory = conversationHistory.slice(-MAX_HISTORY_LENGTH);
        for (const msg of trimmedHistory) {
          if ((msg.role === "user" || msg.role === "assistant") && typeof msg.content === "string") {
            chatMessages.push({ role: msg.role, content: msg.content.slice(0, MAX_MESSAGE_LENGTH) });
          }
        }
      }

      chatMessages.push({ role: "user", content: message });

      let tools = allToolDefinitions;
      if (user.role === "Customer") {
        tools = allToolDefinitions.filter(t => CUSTOMER_TOOLS.includes((t as any).function.name));
      } else if (agentContext.allowedTools.length > 0) {
        tools = allToolDefinitions.filter(t => agentContext.allowedTools.includes((t as any).function.name));
        if (tools.length === 0) tools = allToolDefinitions;
      }

      const chatOptions: any = {
        model: "gpt-4o",
        messages: chatMessages,
        max_tokens: 1000,
      };
      if (tools.length > 0) {
        chatOptions.tools = tools;
        chatOptions.tool_choice = "auto";
      }

      const completion = await openai.chat.completions.create(chatOptions);

      const choice = completion.choices[0];
      const tokensUsed = completion.usage?.total_tokens;

      if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
        const toolCall = choice.message.tool_calls[0];
        const toolName = (toolCall as any).function.name;
        let toolArgs: any;
        try {
          toolArgs = JSON.parse((toolCall as any).function.arguments);
        } catch {
          console.error("[assistant] Failed to parse tool arguments:", (toolCall as any).function.arguments);
          return res.json({ response: "I tried to perform an action but encountered an issue. Could you rephrase your request?", type: "text" });
        }

        if (shouldRequireConfirmation(toolName, toolArgs)) {
          const previewMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            ...chatMessages,
            choice.message as any,
            { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ status: "awaiting_confirmation", message: "Please describe what you are about to do in 1-2 sentences so the user can confirm." }) },
          ];

          const previewCompletion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: previewMessages,
            max_tokens: 300,
          });

          const previewText = previewCompletion.choices[0]?.message?.content || `I'd like to execute ${toolName}. Please confirm.`;
          const totalTokens = (tokensUsed || 0) + (previewCompletion.usage?.total_tokens || 0);

          await logConversation(user.id, sid, "assistant", `[Confirmation Required] ${previewText}`, toolName, toolArgs, null, totalTokens);

          const cToken = createConfirmationToken(user.id, toolName, toolArgs);

          return res.json({
            response: previewText,
            type: "confirmation_required",
            toolCalled: toolName,
            confirmationToken: cToken,
          });
        }

        const execResult = await executeTool(toolName, toolArgs, user);

        if (execResult.isDenied) {
          await logConversation(user.id, sid, "denied", message, toolName, toolArgs,
            { denied: true, reason: execResult.error || "Access restricted.", user_role: user.role, user_name: user.name });
        }

        if (execResult.error) {
          const followUpMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            ...chatMessages,
            choice.message as any,
            { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ error: execResult.error }) },
          ];

          const followUp = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: followUpMessages,
            max_tokens: 300,
          });

          const errorResponse = followUp.choices[0]?.message?.content || execResult.error;
          await logConversation(user.id, sid, "assistant", errorResponse, toolName, toolArgs, { error: execResult.error }, (tokensUsed || 0) + (followUp.usage?.total_tokens || 0));

          return res.json({
            response: errorResponse,
            type: "error",
            toolCalled: toolName,
          });
        }

        const followUpMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          ...chatMessages,
          choice.message as any,
          { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(execResult.result) },
        ];

        const followUp = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: followUpMessages,
          max_tokens: 500,
        });

        const finalResponse = followUp.choices[0]?.message?.content || "Done.";
        const totalTokens = (tokensUsed || 0) + (followUp.usage?.total_tokens || 0);

        await logConversation(user.id, sid, "assistant", finalResponse, toolName, toolArgs, execResult.result, totalTokens);

        return res.json({
          response: finalResponse,
          toolCalled: toolName,
          toolResult: execResult.result,
          navigationTarget: execResult.navigationTarget,
          type: "tool_result",
        });
      }

      const responseText = choice.message?.content || "I'm not sure how to respond to that.";
      await logConversation(user.id, sid, "assistant", responseText, undefined, undefined, undefined, tokensUsed);

      return res.json({ response: responseText, type: "text" });
    } catch (err: any) {
      console.error("[assistant] Chat error:", err);
      return res.status(500).json({ error: "Failed to get AI response" });
    }
  });

  app.get("/api/assistant/suggestions", requireAuth, requireInternalRole, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;

      if (user.role === "Customer") {
        const hour = new Date().getHours();
        const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
        return res.json({ suggestions: [
          `${greeting} — how can I help with your property?`,
          "What seasonal care does my lawn need right now?",
          "I'd like to request a service",
        ] });
      }

      const context = await getAppContext(user.id, user.role);
      const suggestions: string[] = [];

      if (context.overdueTasks > 0) {
        suggestions.push(`You have ${context.overdueTasks} overdue task${context.overdueTasks > 1 ? "s" : ""} — show me`);
      }
      if (context.p1Alerts > 0) {
        suggestions.push(`${context.p1Alerts} P1 critical equipment alert${context.p1Alerts > 1 ? "s" : ""} — summarize`);
      }
      if (context.unacknowledgedTasks > 0) {
        suggestions.push(`${context.unacknowledgedTasks} unacknowledged task${context.unacknowledgedTasks > 1 ? "s" : ""} — what needs attention?`);
      }

      if (suggestions.length === 0) {
        const hour = new Date().getHours();
        const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
        suggestions.push(`${greeting} — what needs attention today?`);
      }

      return res.json({ suggestions: suggestions.slice(0, 3) });
    } catch (err) {
      console.error("[assistant] Suggestions error:", err);
      return res.json({ suggestions: [] });
    }
  });

  app.post("/api/assistant/voice-log", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const { transcript } = req.body;
      if (!transcript || typeof transcript !== "string") {
        return res.status(400).json({ error: "transcript is required" });
      }
      await pool.query(
        `INSERT INTO voice_transcripts (id, external_id, transcript_text, source, recorded_at, recorded_by_email, transcript_format, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'assistant_voice_input', NOW(), $3, 'plain', NOW())`,
        [crypto.randomUUID(), transcript.trim(), user.email || user.username || null]
      );
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("[assistant] Voice log error:", err);
      return res.status(500).json({ error: "Failed to log voice transcript" });
    }
  });

  app.post("/api/assistant/transcribe", requireAuth, requireInternalRole, async (req: Request, res: Response) => {
    try {
      const { audio, format = "webm" } = req.body;
      if (!audio || typeof audio !== "string") {
        return res.status(400).json({ error: "Base64 audio data is required" });
      }
      const audioBuffer = Buffer.from(audio, "base64");
      if (audioBuffer.length > 25 * 1024 * 1024) {
        return res.status(400).json({ error: "Audio file too large (max 25MB)" });
      }
      const transcript = await speechToText(audioBuffer, format as "wav" | "mp3" | "webm");
      return res.json({ transcript });
    } catch (err: any) {
      console.error("[assistant] Transcription error:", err);
      return res.status(500).json({ error: "Failed to transcribe audio" });
    }
  });

  app.get("/api/assistant/history", requireAuth, requireInternalRole, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const sessionId = req.query.sessionId as string;
      if (!sessionId) return res.json({ messages: [] });

      const result = await pool.query(
        `SELECT role, content, tool_called, tool_result, created_at FROM assistant_conversations
         WHERE user_id = $1 AND session_id = $2 ORDER BY created_at ASC`,
        [user.id, sessionId]
      );

      return res.json({
        messages: result.rows.map((r: any) => ({
          role: r.role,
          content: r.content,
          toolCalled: r.tool_called,
          toolResult: r.tool_result ? JSON.parse(JSON.stringify(r.tool_result)) : undefined,
        })),
      });
    } catch (err) {
      console.error("[assistant] History error:", err);
      return res.json({ messages: [] });
    }
  });

  // ── Agent Manager CRUD ──
  app.get("/api/assistant/agents", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(`SELECT * FROM assistant_agents ORDER BY agent_name`);
      return res.json(result.rows);
    } catch (err) {
      console.error("[assistant] Agents fetch error:", err);
      return res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  app.post("/api/assistant/agents", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const { agentName, agentKey, systemPromptAddition, enabledTools, isEnabled, allowedRoles } = req.body;

      if (!agentName || !agentKey) return res.status(400).json({ error: "Agent name and key are required" });

      const result = await pool.query(
        `INSERT INTO assistant_agents (agent_name, agent_key, system_prompt_addition, enabled_tools, is_enabled, allowed_roles, created_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
        [agentName, agentKey, systemPromptAddition || null, JSON.stringify(enabledTools || []), isEnabled !== false, JSON.stringify(allowedRoles || []), user.id]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      if (err.code === "23505") return res.status(409).json({ error: "An agent with this key already exists" });
      console.error("[assistant] Agent create error:", err);
      return res.status(500).json({ error: "Failed to create agent" });
    }
  });

  app.patch("/api/assistant/agents/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { agentName, systemPromptAddition, enabledTools, isEnabled, allowedRoles } = req.body;

      const result = await pool.query(
        `UPDATE assistant_agents SET agent_name = COALESCE($1, agent_name), system_prompt_addition = $2, enabled_tools = $3, is_enabled = $4, allowed_roles = $5, updated_at = NOW() WHERE id = $6 RETURNING *`,
        [agentName, systemPromptAddition || null, JSON.stringify(enabledTools || []), isEnabled !== false, JSON.stringify(allowedRoles || []), id]
      );

      if (result.rows.length === 0) return res.status(404).json({ error: "Agent not found" });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error("[assistant] Agent update error:", err);
      return res.status(500).json({ error: "Failed to update agent" });
    }
  });

  app.delete("/api/assistant/agents/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await pool.query(`DELETE FROM assistant_agents WHERE id = $1 RETURNING id`, [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: "Agent not found" });
      return res.status(204).send();
    } catch (err) {
      console.error("[assistant] Agent delete error:", err);
      return res.status(500).json({ error: "Failed to delete agent" });
    }
  });

  app.get("/api/assistant/tools", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    return res.json(getToolNames());
  });

  // ── Conversation Log Viewer ──
  app.get("/api/assistant/logs", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, startDate, endDate, toolCalled, page = "1" } = req.query;
      const limit = 50;
      const offset = (parseInt(page as string) - 1) * limit;

      let sql = `SELECT ac.*, u.name as user_name, u.username FROM assistant_conversations ac LEFT JOIN users u ON ac.user_id = u.id WHERE 1=1`;
      const params: any[] = [];
      let paramIdx = 1;

      if (userId) { sql += ` AND ac.user_id = $${paramIdx++}`; params.push(userId); }
      if (startDate) { sql += ` AND ac.created_at >= $${paramIdx++}`; params.push(new Date(startDate as string)); }
      if (endDate) { sql += ` AND ac.created_at <= $${paramIdx++}`; params.push(new Date(endDate as string)); }
      if (toolCalled) { sql += ` AND ac.tool_called = $${paramIdx++}`; params.push(toolCalled); }

      sql += ` ORDER BY ac.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
      params.push(limit, offset);

      const result = await pool.query(sql, params);
      return res.json({ logs: result.rows, page: parseInt(page as string), limit });
    } catch (err) {
      console.error("[assistant] Logs fetch error:", err);
      return res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  app.get("/api/assistant/logs/sessions", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, startDate, endDate, toolCalled } = req.query;

      let sql = `SELECT ac.session_id, MIN(ac.created_at) as started_at, MAX(ac.created_at) as last_activity, COUNT(*) as message_count, u.name as user_name, u.username,
        (SELECT STRING_AGG(DISTINCT ac2.tool_called, ', ') FROM assistant_conversations ac2 WHERE ac2.session_id = ac.session_id AND ac2.tool_called IS NOT NULL) as tools_used
        FROM assistant_conversations ac LEFT JOIN users u ON ac.user_id = u.id WHERE 1=1`;
      const params: any[] = [];
      let paramIdx = 1;

      if (userId) { sql += ` AND ac.user_id = $${paramIdx++}`; params.push(userId); }
      if (startDate) { sql += ` AND ac.created_at >= $${paramIdx++}`; params.push(new Date(startDate as string)); }
      if (endDate) { sql += ` AND ac.created_at <= $${paramIdx++}`; params.push(new Date(endDate as string)); }
      if (toolCalled) { sql += ` AND ac.session_id IN (SELECT session_id FROM assistant_conversations WHERE tool_called = $${paramIdx++})`; params.push(toolCalled); }

      sql += ` GROUP BY ac.session_id, u.name, u.username ORDER BY last_activity DESC LIMIT 50`;

      const result = await pool.query(sql, params);
      return res.json(result.rows);
    } catch (err) {
      console.error("[assistant] Sessions fetch error:", err);
      return res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.get("/api/assistant/logs/session/:sessionId", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const result = await pool.query(
        `SELECT ac.*, u.name as user_name FROM assistant_conversations ac LEFT JOIN users u ON ac.user_id = u.id WHERE ac.session_id = $1 ORDER BY ac.created_at ASC`,
        [sessionId]
      );
      return res.json(result.rows);
    } catch (err) {
      console.error("[assistant] Session detail error:", err);
      return res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  // ── Denied-request log ─────────────────────────────────────────────────────
  app.get("/api/assistant/logs/denied", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, startDate, endDate } = req.query;
      let sql = `SELECT ac.id, ac.user_id, ac.session_id, ac.content, ac.tool_called, ac.tool_args, ac.tool_result, ac.created_at,
                        u.name as user_name, u.username, u.role as user_role
                 FROM assistant_conversations ac
                 LEFT JOIN users u ON ac.user_id = u.id
                 WHERE ac.role = 'denied'`;
      const params: any[] = [];
      let paramIdx = 1;
      if (userId) { sql += ` AND ac.user_id = $${paramIdx++}`; params.push(userId); }
      if (startDate) { sql += ` AND ac.created_at >= $${paramIdx++}`; params.push(new Date(startDate as string)); }
      if (endDate) { sql += ` AND ac.created_at <= $${paramIdx++}`; params.push(new Date(endDate as string)); }
      sql += ` ORDER BY ac.created_at DESC LIMIT 200`;
      const result = await pool.query(sql, params);
      return res.json(result.rows);
    } catch (err) {
      console.error("[assistant] Denied logs fetch error:", err);
      return res.status(500).json({ error: "Failed to fetch denied request logs" });
    }
  });

  app.get("/api/assistant/logs/usage", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const [today, week, month, tools, denied30] = await Promise.all([
        pool.query(`SELECT COUNT(*) as count, SUM(tokens_used) as tokens FROM assistant_conversations WHERE created_at >= CURRENT_DATE`),
        pool.query(`SELECT COUNT(*) as count, SUM(tokens_used) as tokens FROM assistant_conversations WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'`),
        pool.query(`SELECT COUNT(*) as count, SUM(tokens_used) as tokens FROM assistant_conversations WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'`),
        pool.query(`SELECT tool_called, COUNT(*) as count FROM assistant_conversations WHERE tool_called IS NOT NULL GROUP BY tool_called ORDER BY count DESC LIMIT 10`),
        pool.query(`SELECT COUNT(*) as count FROM assistant_conversations WHERE role = 'denied' AND created_at >= CURRENT_DATE - INTERVAL '30 days'`),
      ]);

      const GPT4O_COST_PER_TOKEN = 0.000005;

      return res.json({
        today: { messages: parseInt(today.rows[0]?.count || "0"), tokens: parseInt(today.rows[0]?.tokens || "0") },
        week: { messages: parseInt(week.rows[0]?.count || "0"), tokens: parseInt(week.rows[0]?.tokens || "0") },
        month: { messages: parseInt(month.rows[0]?.count || "0"), tokens: parseInt(month.rows[0]?.tokens || "0") },
        topTools: tools.rows,
        deniedRequests30d: parseInt(denied30.rows[0]?.count || "0"),
        estimatedCost: {
          today: ((parseInt(today.rows[0]?.tokens || "0")) * GPT4O_COST_PER_TOKEN).toFixed(4),
          week: ((parseInt(week.rows[0]?.tokens || "0")) * GPT4O_COST_PER_TOKEN).toFixed(4),
          month: ((parseInt(month.rows[0]?.tokens || "0")) * GPT4O_COST_PER_TOKEN).toFixed(4),
        },
      });
    } catch (err) {
      console.error("[assistant] Usage stats error:", err);
      return res.status(500).json({ error: "Failed to fetch usage stats" });
    }
  });

  // ── Text-to-Speech ──
  app.post("/api/ai/speak", requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { text, voice: overrideVoice } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }

      const truncatedText = text.length > 500 ? text.slice(0, 500) + "..." : text;

      let voiceToUse = overrideVoice || "alloy";
      if (!overrideVoice) {
        const userResult = await pool.query(
          `SELECT voice_selection FROM users WHERE id = $1`,
          [userId]
        );
        if (userResult.rows[0]?.voice_selection) {
          voiceToUse = userResult.rows[0].voice_selection;
        }
      }

      const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
      if (!validVoices.includes(voiceToUse)) voiceToUse = "alloy";

      const buffer = await textToSpeech(
        truncatedText,
        voiceToUse as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
        "wav"
      );

      res.set({
        "Content-Type": "audio/wav",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-cache",
      });
      res.send(buffer);
    } catch (err) {
      console.error("[ai/speak] TTS error:", err);
      res.status(500).json({ error: "Failed to generate speech" });
    }
  });

  // ── Voice Settings ──
  app.get("/api/users/voice-settings", requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const result = await pool.query(
        `SELECT voice_enabled, voice_auto_speak, voice_selection FROM users WHERE id = $1`,
        [userId]
      );

      if (!result.rows[0]) return res.status(404).json({ error: "User not found" });

      res.json({
        voiceEnabled: result.rows[0].voice_enabled ?? false,
        voiceAutoSpeak: result.rows[0].voice_auto_speak ?? false,
        voiceSelection: result.rows[0].voice_selection ?? "alloy",
      });
    } catch (err) {
      console.error("[voice] Settings fetch error:", err);
      res.status(500).json({ error: "Failed to fetch voice settings" });
    }
  });

  app.patch("/api/users/voice-settings", requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { voiceEnabled, voiceAutoSpeak, voiceSelection } = req.body;
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (voiceEnabled !== undefined) {
        updates.push(`voice_enabled = $${idx++}`);
        values.push(!!voiceEnabled);
      }
      if (voiceAutoSpeak !== undefined) {
        updates.push(`voice_auto_speak = $${idx++}`);
        values.push(!!voiceAutoSpeak);
      }
      if (voiceSelection !== undefined) {
        const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
        if (validVoices.includes(voiceSelection)) {
          updates.push(`voice_selection = $${idx++}`);
          values.push(voiceSelection);
        }
      }

      if (updates.length === 0) return res.status(400).json({ error: "No valid fields to update" });

      values.push(userId);
      await pool.query(
        `UPDATE users SET ${updates.join(", ")} WHERE id = $${idx}`,
        values
      );

      res.json({ message: "Voice settings updated" });
    } catch (err) {
      console.error("[voice] Settings update error:", err);
      res.status(500).json({ error: "Failed to update voice settings" });
    }
  });

  // ── Seed default agent ──
  (async () => {
    try {
      const existing = await pool.query(`SELECT id FROM assistant_agents WHERE agent_key = 'main'`);
      if (existing.rows.length === 0) {
        await pool.query(
          `INSERT INTO assistant_agents (agent_name, agent_key, system_prompt_addition, enabled_tools, is_enabled, allowed_roles, updated_at)
           VALUES ('Main Assistant', 'main', NULL, '[]', true, '[]', NOW())`
        );
        console.log("[assistant] Seeded default Main Assistant agent");
      }
    } catch (err) {
      console.error("[assistant] Failed to seed default agent:", err);
    }
  })();
}
