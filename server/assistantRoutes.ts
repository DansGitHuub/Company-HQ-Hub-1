import type { Express, Request, Response, NextFunction } from "express";
import OpenAI from "openai";
import { pool } from "./db";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_LENGTH = 50;
const MAX_SESSION_ID_LENGTH = 128;
const INTERNAL_ROLES = ["Admin", "Master Admin", "Manager", "Crew Lead", "Crew", "New Hire", "HR", "Sales"];

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
  leads: "/lead-qualifier",
  "plow mapper": "/plow-mapper",
  employees: "/employees",
};

const navigateToTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "navigateTo",
    description: "Navigate the user to a different module in the app. Use this when the user asks to go to, open, or see a specific section of the application.",
    parameters: {
      type: "object",
      properties: {
        module: {
          type: "string",
          description: `The module name to navigate to. Available modules: ${Object.keys(MODULE_ROUTES).join(", ")}`,
        },
      },
      required: ["module"],
    },
  },
};

async function getAppContext(userId: string, userRole: string) {
  const context: { overdueTasks: number; p1Alerts: number; unacknowledgedTasks: number; unreadMessages: number } = {
    overdueTasks: 0,
    p1Alerts: 0,
    unacknowledgedTasks: 0,
    unreadMessages: 0,
  };

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

function buildSystemPrompt(user: any, appContext: any, currentModule: string) {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  const layer1 = `You are the CompanyHQ AI Assistant for a landscape business management platform.
Current user: ${user.name || user.username} (Role: ${user.role})
User ID: ${user.id}
Current time: ${now}
Current module: ${currentModule || "unknown"}`;

  const layer2 = `Behavioral Rules:
- Always confirm before creating or modifying any data
- Never make up records or data that doesn't exist
- Keep responses short and direct — 2-3 sentences when possible
- Remember the full conversation context
- If the user asks for something outside their permissions, explain what they can't do
- You can navigate the user to any module by using the navigateTo tool
- Be proactive — if you notice something urgent in the context, mention it briefly
- Use a professional but friendly tone`;

  const contextParts: string[] = [];
  if (appContext.overdueTasks > 0) contextParts.push(`${appContext.overdueTasks} overdue task(s)`);
  if (appContext.p1Alerts > 0) contextParts.push(`${appContext.p1Alerts} P1 critical equipment alert(s)`);
  if (appContext.unacknowledgedTasks > 0) contextParts.push(`${appContext.unacknowledgedTasks} unacknowledged task(s)`);

  const layer3 = contextParts.length > 0
    ? `Current app state for this user: ${contextParts.join(", ")}.`
    : `Current app state: No urgent items detected.`;

  return `${layer1}\n\n${layer2}\n\n${layer3}`;
}

async function logConversation(
  userId: string,
  sessionId: string,
  role: string,
  content: string,
  toolCalled?: string,
  toolArgs?: any,
  toolResult?: any,
  tokensUsed?: number
) {
  try {
    await pool.query(
      `INSERT INTO assistant_conversations (user_id, session_id, role, content, tool_called, tool_args, tool_result, tokens_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
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
      const { message, conversationHistory, currentModule, sessionId } = req.body;

      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ error: "Message is required" });
      }
      if (message.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` });
      }

      const sid = typeof sessionId === "string" ? sessionId.slice(0, MAX_SESSION_ID_LENGTH) : "default";
      const appContext = await getAppContext(user.id, user.role);
      const systemPrompt = buildSystemPrompt(user, appContext, currentModule || "");

      await logConversation(user.id, sid, "user", message);

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
      ];

      if (conversationHistory && Array.isArray(conversationHistory)) {
        const trimmedHistory = conversationHistory.slice(-MAX_HISTORY_LENGTH);
        for (const msg of trimmedHistory) {
          if ((msg.role === "user" || msg.role === "assistant") && typeof msg.content === "string") {
            messages.push({ role: msg.role, content: msg.content.slice(0, MAX_MESSAGE_LENGTH) });
          }
        }
      }

      messages.push({ role: "user", content: message });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        tools: [navigateToTool],
        tool_choice: "auto",
        max_tokens: 1000,
      });

      const choice = completion.choices[0];
      const tokensUsed = completion.usage?.total_tokens;

      if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
        const toolCall = choice.message.tool_calls[0];
        const toolName = toolCall.function.name;
        let toolArgs: any;
        try {
          toolArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          console.error("[assistant] Failed to parse tool arguments:", toolCall.function.arguments);
          return res.json({ response: "I tried to perform an action but encountered an issue. Could you rephrase your request?" });
        }

        let toolResult: any = {};
        let navigationTarget: string | undefined;

        if (toolName === "navigateTo") {
          const moduleName = toolArgs.module?.toLowerCase();
          const route = MODULE_ROUTES[moduleName];
          if (route) {
            toolResult = { success: true, navigatedTo: moduleName, route };
            navigationTarget = route;
          } else {
            toolResult = { success: false, error: `Unknown module: ${toolArgs.module}` };
          }
        }

        const followUpMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          ...messages,
          choice.message as any,
          {
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          },
        ];

        const followUp = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: followUpMessages,
          max_tokens: 500,
        });

        const finalResponse = followUp.choices[0]?.message?.content || "Done.";
        const totalTokens = (tokensUsed || 0) + (followUp.usage?.total_tokens || 0);

        await logConversation(user.id, sid, "assistant", finalResponse, toolName, toolArgs, toolResult, totalTokens);

        return res.json({
          response: finalResponse,
          toolCalled: toolName,
          toolResult,
          navigationTarget,
        });
      }

      const responseText = choice.message?.content || "I'm not sure how to respond to that.";
      await logConversation(user.id, sid, "assistant", responseText, undefined, undefined, undefined, tokensUsed);

      return res.json({ response: responseText });
    } catch (err: any) {
      console.error("[assistant] Chat error:", err);
      return res.status(500).json({ error: "Failed to get AI response" });
    }
  });

  app.get("/api/assistant/suggestions", requireAuth, requireInternalRole, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
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
}
