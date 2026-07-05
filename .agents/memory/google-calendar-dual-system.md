---
name: Google Calendar dual-system trap
description: Why a shared OAuth callback lives inside a seemingly-orphaned per-user Google Calendar code block, and how to tell the two systems apart
---

This project has two independent Google Calendar integrations that look like duplicates but share critical infrastructure:

1. **Main Calendar system** (`server/calendarRoutes.ts`, consumed by `client/src/pages/Calendar.tsx`): `/api/auth/google/calendar` (init), `/api/calendar/google/status`, `/disconnect`, `/sync`, `/events`. Stores tokens on `users.googleAccessToken/googleRefreshToken/googleCalendarId/googleTokenExpiry`.
2. **Per-user duplicate system** (`server/routes.ts`, under a `GOOGLE CALENDAR INTEGRATION (PER-USER)` comment block): `/api/google-calendar/status`, `/api/auth/google/connect`, `/api/google-calendar/disconnect`, `/events` (GET+POST), `/check-conflicts`. Stores tokens in a separate `calendar_connections` table.

**The trap:** `GET /auth/google/callback` (no `/api` prefix) is physically located inside the "per-user" block in `routes.ts`, but it is actually the **shared, production OAuth callback for both systems** — it matches `GOOGLE_REDIRECT_URI` and both systems' auth-URL generators (`getAuthUrl()`) point to it. It writes to BOTH the `users` token columns (read by Main Calendar) AND `calendar_connections` (read by the per-user system). `calendarRoutes.ts` has its own `/api/auth/google/callback` (WITH `/api` prefix) as a dev-only fallback, explicitly commented as such.

**Why:** Naming and file placement suggested `/auth/google/callback` belonged to the per-user duplicate system since it lived in that comment block. Deleting it (e.g. during a "remove orphaned duplicate calendar code" cleanup) would have broken Main Calendar's real Google OAuth flow in production.

**How to apply:** When cleaning up either Google Calendar route set in this project, verify each route's actual callers via grep (not by which comment section or file it appears in) before deleting. Keep `/auth/google/callback` (no prefix) and `GET /api/google-calendar/events` (still used by the dashboard `CalendarWidget` in `client/src/components/dashboard/widgets.tsx`) — both look like per-user-only code but are load-bearing for other parts of the app.
