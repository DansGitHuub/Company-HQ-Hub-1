---
name: Dashboard widget permission gating
description: How Stage 6 wires the live permission matrix into the dashboard widget system (render guard, picker, defaults).
---

## Rule
Widget access is a 4-layer defense: permission-filtered defaults → permission-filtered picker → client render guard → API 403 backstop. Always keep all 4 layers consistent.

## Implementation

**`widgetRegistry.ts`**
- `WidgetDefinition.requiredPermission?: string` — maps to a key from `/api/my-permissions`
- Sensitive widget → permission mapping:
  - `estimates` → `see_finance`
  - `employees` → `see_people_hr`
  - `suggestions` → `see_people_hr`
  - `marketing` → `manage_marketing`
  - `hiring` → `see_hiring`
- `getDefaultWidgets(role, grantedPermissions?)` — filters the default list by permission before seeding
- `getAvailableWidgets(role, isMasterAdmin, grantedPermissions?)` — filters picker by permission

**`Home.tsx`**
- Fetches `/api/my-permissions` (staleTime 60s)
- Derives `grantedPerms: string[]` from the result
- `canSeeWidget(type)` — the client render guard; checks `masterAdminOnly` AND `requiredPermission` against live data; returns false → widget renders null (no component mount, no API fetch)
- Initialization: if saved layout exists, use it immediately (no permission wait); if empty, wait for permissions then call `getDefaultWidgets(role, grantedPerms)`
- `resetToDefaults` and `getAvailableWidgets` both pass `grantedPerms`

## Role defaults (Stage 6)
- Admin: myday, messages, pipeline, estimates, employees, hiring, todos, marketing, notes, soppipeline
- Master Admin: + devtracker
- Manager: myday, messages, pipeline, estimates, employees, hiring, todos, calendar, notes
- Crew Lead: myday, messages, pipeline, todos, calendar, equipment, sops, quizzes
- Crew: myday, todos, messages, calendar, sops, quizzes, equipment, notes
- HR: myday, employees, hiring, messages, todos, suggestions, notes, dailyagenda
- Sales: myday, pipeline, messages, calendar, marketing, todos, notes
- New Hire: myday, todos, sops, quizzes, notes, dailyagenda

## Why
Crew and New Hire must never see finance/HR data. The `roles` array in each WidgetDefinition is a coarse gate; `requiredPermission` is the fine-grained live gate that respects admin-configurable permission overrides.

## How to apply
When adding a new sensitive widget: (1) add `requiredPermission` to its WidgetDefinition, (2) add it to ROLE_DEFAULTS only for roles that should see it by default, (3) ensure the backend API it calls is also gated with `requirePermission()`.
