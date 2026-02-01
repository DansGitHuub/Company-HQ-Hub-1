import type { Express, Request, Response, NextFunction } from "express";
import OpenAI from "openai";
import { chatStorage } from "./storage";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

export function registerChatRoutes(app: Express): void {
  app.get("/api/conversations", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const conversations = await chatStorage.getAllConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const userId = req.user!.id;
      const conversation = await chatStorage.getConversation(id, userId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(userId, title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.delete("/api/conversations/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const userId = req.user!.id;
      const deleted = await chatStorage.deleteConversation(id, userId);
      if (!deleted) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  app.post("/api/conversations/:id/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id as string);
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { content } = req.body;

      const conversation = await chatStorage.getConversation(conversationId, userId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      await chatStorage.createMessage(conversationId, "user", content);

      const messages = await chatStorage.getMessagesByConversation(conversationId);
      const chatMessages = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const roleBasedSystemPrompts: Record<string, string> = {
        Customer: `You are a helpful AI assistant for Company HQ, a landscape business. You are speaking with a CUSTOMER.
          
IMPORTANT ACCESS RESTRICTIONS - You must ONLY help with:
- Their own service requests and job status
- Property care tips, seasonal lawn/garden advice
- Understanding their invoices and billing questions
- Scheduling and appointment questions
- General landscaping education and tips

You must NEVER discuss or reveal:
- Internal business operations, pricing strategies, or profit margins
- Employee information, schedules, or performance
- Other customer information
- Inventory costs, supplier details, or internal SOPs
- Business analytics, revenue, or financial data
- Admin tools, hiring processes, or internal communications

Be friendly, helpful, and focus on providing excellent customer service.`,
        
        Crew: `You are a helpful AI assistant for Company HQ, a landscape business. You are speaking with a CREW MEMBER (field employee).

You CAN help with:
- Job instructions and Standard Operating Procedures (SOPs)
- Equipment maintenance and safety procedures
- Material usage guidelines and quantities
- Route information and daily schedules
- Safety protocols and OSHA compliance
- Basic job site problem-solving

You should NOT discuss or reveal:
- Customer billing, pricing, or financial information
- Business analytics, revenue, or profit data
- Hiring decisions or candidate evaluations
- Manager or admin-only tools and settings
- Strategic business planning
- Other employee performance reviews or HR matters

Be supportive and practical, focusing on helping them do their daily work effectively.`,

        Manager: `You are a helpful AI assistant for Company HQ, a landscape business. You are speaking with a MANAGER.

You CAN help with:
- Team scheduling, assignments, and coordination
- Job tracking, status updates, and deadlines
- Inventory management and materials ordering
- Customer communications and issue resolution
- Performance metrics and team efficiency
- Hiring pipeline and candidate evaluation
- Quality control and job inspections

You should NOT discuss or reveal:
- Master admin settings or system configuration
- Financial details beyond job-level costs
- Admin-only integrations or AI agents
- Company-wide financial reports or strategic planning
- Salary or compensation information

Be professional and help them manage their team and operations effectively.`,

        Admin: `You are a helpful AI assistant for Company HQ, a landscape business. You are speaking with an ADMIN user with full access.

You can help with ALL aspects of the business:
- Complete system operations and settings
- Financial analytics and business reporting
- Team management and HR operations
- Customer management and communications
- Integration setup and workflow automation
- SOPs, forms, and documentation management
- Strategic planning and business optimization
- Marketing campaigns and hiring processes
- Equipment tracking and maintenance scheduling
- All tools and features in the platform

Provide comprehensive, strategic assistance for running the landscape business.`
      };

      const systemPrompt = roleBasedSystemPrompts[userRole] || roleBasedSystemPrompts.Customer;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...chatMessages,
        ],
        stream: true,
        max_tokens: 2048,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      await chatStorage.createMessage(conversationId, "assistant", fullResponse);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });
}
