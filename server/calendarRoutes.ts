import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { calendarEvents, users } from "@shared/schema";
import { eq, and, or, gte, lte, sql, desc } from "drizzle-orm";
import { getAuthUrl, exchangeCodeForTokens, refreshAccessToken, isTokenExpired } from "./googleOAuth";
import * as googleOAuth from "./googleOAuth";

type AuthRequest = Request & { user?: any };

export function registerCalendarRoutes(app: Express, requireAuth: any) {
  const requireRole = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthRequest).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };

  async function getValidAccessToken(user: any): Promise<string | null> {
    if (!user.googleRefreshToken) return null;

    if (user.googleAccessToken && user.googleTokenExpiry && !isTokenExpired(user.googleTokenExpiry)) {
      return user.googleAccessToken;
    }

    try {
      const credentials = await refreshAccessToken(user.googleRefreshToken);
      await db.update(users).set({
        googleAccessToken: credentials.access_token || undefined,
        googleTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
      }).where(eq(users.id, user.id));
      return credentials.access_token || null;
    } catch (err) {
      console.error("[calendar] Token refresh failed for user", user.id, err);
      return null;
    }
  }

  async function pushToGoogle(user: any, event: any, action: "create" | "update" | "delete") {
    const token = await getValidAccessToken(user);
    if (!token) return null;

    const calendarId = user.googleCalendarId || "primary";

    try {
      if (action === "create") {
        const googleEvent = await googleOAuth.createCalendarEvent(token, {
          summary: event.title,
          description: event.description || undefined,
          location: event.location || undefined,
          start: event.allDay
            ? { date: event.startDatetime.toISOString().split("T")[0] }
            : { dateTime: event.startDatetime.toISOString() },
          end: event.allDay
            ? { date: event.endDatetime.toISOString().split("T")[0] }
            : { dateTime: event.endDatetime.toISOString() },
        }, calendarId);
        return googleEvent.id || null;
      }

      if (action === "update" && event.googleEventId) {
        const calendar = googleOAuth.getCalendarClient(token);
        await calendar.events.update({
          calendarId,
          eventId: event.googleEventId,
          requestBody: {
            summary: event.title,
            description: event.description || undefined,
            location: event.location || undefined,
            start: event.allDay
              ? { date: event.startDatetime.toISOString().split("T")[0] }
              : { dateTime: event.startDatetime.toISOString() },
            end: event.allDay
              ? { date: event.endDatetime.toISOString().split("T")[0] }
              : { dateTime: event.endDatetime.toISOString() },
          },
        });
      }

      if (action === "delete" && event.googleEventId) {
        const calendar = googleOAuth.getCalendarClient(token);
        await calendar.events.delete({ calendarId, eventId: event.googleEventId });
      }
    } catch (err) {
      console.error(`[calendar] Google sync ${action} failed:`, err);
    }
    return null;
  }

  // GET /api/calendar/events
  app.get("/api/calendar/events", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const start = req.query.start ? new Date(req.query.start as string) : new Date();
      const end = req.query.end ? new Date(req.query.end as string) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      let events;
      if (user.role === "Admin" || user.isMasterAdmin) {
        events = await db.select().from(calendarEvents)
          .where(and(
            gte(calendarEvents.startDatetime, start),
            lte(calendarEvents.endDatetime, end)
          ));
      } else if (user.role === "Manager") {
        events = await db.select().from(calendarEvents)
          .where(and(
            gte(calendarEvents.startDatetime, start),
            lte(calendarEvents.endDatetime, end),
            or(
              eq(calendarEvents.isCompanyEvent, true),
              eq(calendarEvents.createdBy, user.id),
              eq(calendarEvents.assignedTo, user.id)
            )
          ));
      } else if (user.role === "Customer") {
        events = await db.select().from(calendarEvents)
          .where(and(
            gte(calendarEvents.startDatetime, start),
            lte(calendarEvents.endDatetime, end),
            or(
              eq(calendarEvents.createdBy, user.id),
              eq(calendarEvents.assignedTo, user.id),
              and(eq(calendarEvents.linkedRecordType, "customer"), eq(calendarEvents.isCompanyEvent, true))
            )
          ));
      } else {
        events = await db.select().from(calendarEvents)
          .where(and(
            gte(calendarEvents.startDatetime, start),
            lte(calendarEvents.endDatetime, end),
            or(
              eq(calendarEvents.isCompanyEvent, true),
              eq(calendarEvents.createdBy, user.id),
              eq(calendarEvents.assignedTo, user.id)
            )
          ));
      }

      res.json(events);
    } catch (err) {
      console.error("[calendar] Error fetching events:", err);
      res.status(500).json({ message: "Error fetching calendar events" });
    }
  });

  // GET /api/calendar/events/upcoming
  app.get("/api/calendar/events/upcoming", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const now = new Date();
      const limit = parseInt(req.query.limit as string) || 5;
      const daysAhead = parseInt(req.query.days as string) || 7;
      const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

      const events = await db.select().from(calendarEvents)
        .where(and(
          gte(calendarEvents.startDatetime, now),
          lte(calendarEvents.startDatetime, end),
          or(
            eq(calendarEvents.isCompanyEvent, true),
            eq(calendarEvents.createdBy, user.id),
            eq(calendarEvents.assignedTo, user.id)
          )
        ))
        .orderBy(calendarEvents.startDatetime)
        .limit(limit);

      res.json(events);
    } catch (err) {
      res.status(500).json({ message: "Error fetching upcoming events" });
    }
  });

  // POST /api/calendar/events
  app.post("/api/calendar/events", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { title, description, eventType, startDatetime, endDatetime, allDay,
        location, assignedTo, linkedRecordType, linkedRecordId,
        isCompanyEvent, isPrivate, recurrenceRule } = req.body;

      if (!title || !startDatetime || !endDatetime) {
        return res.status(400).json({ message: "Title, start and end datetime are required" });
      }

      if (isCompanyEvent && user.role !== "Admin" && user.role !== "Manager" && !user.isMasterAdmin) {
        return res.status(403).json({ message: "Only Admin and Manager can create company events" });
      }

      const [event] = await db.insert(calendarEvents).values({
        title,
        description: description || null,
        eventType: eventType || "personal",
        startDatetime: new Date(startDatetime),
        endDatetime: new Date(endDatetime),
        allDay: allDay || false,
        location: location || null,
        createdBy: user.id,
        assignedTo: assignedTo || null,
        linkedRecordType: linkedRecordType || null,
        linkedRecordId: linkedRecordId || null,
        isCompanyEvent: isCompanyEvent || false,
        isPrivate: isPrivate || false,
        recurrenceRule: recurrenceRule || null,
      }).returning();

      // Push to Google Calendar
      const targetUser = assignedTo
        ? (await db.select().from(users).where(eq(users.id, assignedTo)))[0]
        : user;

      if (targetUser) {
        const googleEventId = await pushToGoogle(targetUser, event, "create");
        if (googleEventId) {
          await db.update(calendarEvents).set({ googleEventId }).where(eq(calendarEvents.id, event.id));
          event.googleEventId = googleEventId;
        }
      }

      // For company events, push to all connected users
      if (isCompanyEvent) {
        const connectedUsers = await db.select().from(users)
          .where(sql`google_refresh_token IS NOT NULL AND id != ${user.id}`);
        for (const u of connectedUsers) {
          await pushToGoogle(u, event, "create").catch(() => {});
        }
      }

      res.status(201).json(event);
    } catch (err) {
      console.error("[calendar] Error creating event:", err);
      res.status(500).json({ message: "Error creating calendar event" });
    }
  });

  // PATCH /api/calendar/events/:id
  app.patch("/api/calendar/events/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const eventId = req.params.id;

      const existing = await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId));
      if (!existing.length) return res.status(404).json({ message: "Event not found" });

      const event = existing[0];
      if (user.role !== "Admin" && !user.isMasterAdmin && user.role !== "Manager" && event.createdBy !== user.id) {
        return res.status(403).json({ message: "Cannot edit this event" });
      }

      const updates: any = {};
      const allowedFields = ["title", "description", "eventType", "startDatetime", "endDatetime",
        "allDay", "location", "assignedTo", "linkedRecordType", "linkedRecordId",
        "isCompanyEvent", "isPrivate", "recurrenceRule"];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          if (field === "startDatetime" || field === "endDatetime") {
            updates[field] = new Date(req.body[field]);
          } else {
            updates[field] = req.body[field];
          }
        }
      }

      updates.updatedAt = new Date();

      const [updated] = await db.update(calendarEvents).set(updates).where(eq(calendarEvents.id, eventId)).returning();

      const targetUser = updated.assignedTo
        ? (await db.select().from(users).where(eq(users.id, updated.assignedTo)))[0]
        : (await db.select().from(users).where(eq(users.id, updated.createdBy)))[0];

      if (targetUser) {
        await pushToGoogle(targetUser, updated, "update");
      }

      res.json(updated);
    } catch (err) {
      console.error("[calendar] Error updating event:", err);
      res.status(500).json({ message: "Error updating calendar event" });
    }
  });

  // DELETE /api/calendar/events/:id
  app.delete("/api/calendar/events/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const eventId = req.params.id;

      const existing = await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId));
      if (!existing.length) return res.status(404).json({ message: "Event not found" });

      const event = existing[0];
      if (user.role !== "Admin" && !user.isMasterAdmin && user.role !== "Manager" && event.createdBy !== user.id) {
        return res.status(403).json({ message: "Cannot delete this event" });
      }

      const targetUser = event.assignedTo
        ? (await db.select().from(users).where(eq(users.id, event.assignedTo)))[0]
        : (await db.select().from(users).where(eq(users.id, event.createdBy)))[0];

      if (targetUser) {
        await pushToGoogle(targetUser, event, "delete");
      }

      await db.delete(calendarEvents).where(eq(calendarEvents.id, eventId));
      res.json({ message: "Event deleted" });
    } catch (err) {
      console.error("[calendar] Error deleting event:", err);
      res.status(500).json({ message: "Error deleting calendar event" });
    }
  });

  // Google Calendar OAuth routes
  app.get("/api/auth/google/calendar", requireAuth, (req: AuthRequest, res) => {
    try {
      const url = getAuthUrl(req.user!.id);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to generate auth URL" });
    }
  });

  // Note: The primary OAuth callback is registered at /auth/google/callback (no /api prefix)
  // in routes.ts to match the GOOGLE_REDIRECT_URI. This /api/ prefixed version is kept
  // as a fallback for dev environments where GOOGLE_REDIRECT_URI may not be set.
  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      const userId = req.query.state as string;

      if (!code || !userId) {
        return res.redirect("/calendar?google_error=missing_params");
      }

      const tokens = await exchangeCodeForTokens(code);

      let calendarId = "primary";
      try {
        if (tokens.access_token) {
          const calendarList = await googleOAuth.getUserCalendarList(tokens.access_token);
          const primaryCalendar = calendarList.find((c: any) => c.primary) || calendarList[0];
          if (primaryCalendar?.id) calendarId = primaryCalendar.id;
        }
      } catch (calErr) {
        console.error("[calendar] Failed to fetch calendar list:", calErr);
      }

      await db.update(users).set({
        googleAccessToken: tokens.access_token || undefined,
        googleRefreshToken: tokens.refresh_token || undefined,
        googleCalendarId: calendarId,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      }).where(eq(users.id, userId));

      res.redirect("/calendar?google_connected=true");
    } catch (err) {
      console.error("[calendar] Google OAuth callback error:", err);
      res.redirect("/calendar?google_error=auth_failed");
    }
  });

  // GET /api/calendar/google/status
  app.get("/api/calendar/google/status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const [dbUser] = await db.select({
        googleRefreshToken: users.googleRefreshToken,
        googleCalendarId: users.googleCalendarId,
      }).from(users).where(eq(users.id, user.id));

      res.json({
        connected: !!dbUser?.googleRefreshToken,
        calendarId: dbUser?.googleCalendarId || "primary",
      });
    } catch (err) {
      res.status(500).json({ message: "Error checking Google Calendar status" });
    }
  });

  // POST /api/calendar/google/disconnect
  app.post("/api/calendar/google/disconnect", requireAuth, async (req: AuthRequest, res) => {
    try {
      await db.update(users).set({
        googleAccessToken: null,
        googleRefreshToken: null,
        googleCalendarId: "primary",
        googleTokenExpiry: null,
      }).where(eq(users.id, req.user!.id));

      res.json({ message: "Disconnected from Google Calendar" });
    } catch (err) {
      res.status(500).json({ message: "Error disconnecting" });
    }
  });

  // GET /api/calendar/users — for the assign-to dropdown
  app.get("/api/calendar/users", requireAuth, async (req: AuthRequest, res) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        name: users.name,
        role: users.role,
      }).from(users).where(eq(users.isActive, true));
      res.json(allUsers);
    } catch (err) {
      res.status(500).json({ message: "Error fetching users" });
    }
  });
}
