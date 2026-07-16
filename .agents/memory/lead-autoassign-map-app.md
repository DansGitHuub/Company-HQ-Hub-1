---
name: Lead auto-assign and map app preference
description: Architecture decisions for S10-5 (lead auto-assign), S10-6 (follow-up enforcement), and B.3-8 (preferred map app).
---

## Lead auto-assign helpers

`getAutoAssignee()` and `getAutoFollowUpDate()` are **exported** from `server/consultationRoutes.ts` and imported into `server/publicInquiryRoutes.ts`. Both functions read from `app_settings` table (keys: `lead_assign_mode`, `lead_default_assignee`, `lead_assign_last_idx`) and `business_rules` (key: `lead_followup_days`).

**Why exported vs. shared file:** Only two callers exist; a shared helper file would add indirection with no benefit. If a third caller appears, consider extracting to `server/leadHelpers.ts`.

**How to apply:** Any new consultation creation path (e.g., a future booking page) must call both helpers and include the results in the INSERT or a follow-up UPDATE.

## app_settings lead keys

Seeded in `migrateConsultations()` via `ON CONFLICT (key) DO NOTHING`:
- `lead_assign_mode`: "none" | "specific" | "round_robin"
- `lead_default_assignee`: employee ID string (empty = none)
- `lead_assign_last_idx`: round-robin position counter

Admin can configure via `GET/PUT /api/settings/lead-assignment`. UI panel on `/consultations` page (⚙ Lead Settings button, Admin-only).

## preferred_map_app column

Added to `users` table via raw SQL in `consultationRoutes.ts` migration block (not a new migration file). Drizzle schema.ts also updated with `preferredMapApp` field. PATCH /api/profile accepts `preferred_map_app` and sets `updates.preferredMapApp`.

## Map URL helpers

Centralized in `client/src/lib/mapUrl.ts`:
- `buildMapUrl(address, app)` — search/pin link
- `buildNavUrl(address, app)` — turn-by-turn navigation link
- Supports: `"google"` (default), `"apple"`, `"waze"`

**Usage pattern:** Import `buildMapUrl`/`buildNavUrl` statically. Pass `user?.preferredMapApp` from the nearest `useAuth()` call. Do NOT use dynamic `import()` inside JSX href attributes.

Places wired: JobPipeline.tsx (`getGoogleMapsLink`), Route/index.tsx (`mapsHref` inside `StopView`), WorkOrders.tsx (customer/site card).

## Customer job notifications (S9-7/S9-8)

`sendCustomerJobNotification(jobId, status)` in `server/jobRoutes.ts` fires on `in_progress` and `completed` status changes. Looks up the job's customer email → finds portal user by email + role='Customer' → inserts into `customer_notifications`. Notification types seeded: `job_started_customer` (sort 185), `job_completed_customer` (sort 195) in notificationCenterRoutes.ts.

**Why:** Existing `sendJobStatusEmail` handles email; this adds the in-app portal bell notification.
