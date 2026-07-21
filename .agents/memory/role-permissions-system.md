---
name: Role permissions system
description: Configurable RBAC via role_permissions table + in-memory cache — pattern, lock rules, and approved default loosenings.
---

## The system

`role_permissions` table: `(role TEXT, permission TEXT, granted BOOLEAN, updated_at, updated_by)` with `PRIMARY KEY (role, permission)`.  
Migration: `server/migrations/rolePermissions.ts`, runs on startup via `server/index.ts` before route registration.  
Cache: `server/permissionCache.ts` — `loadPermissionCache()` fills an in-memory `Map<string, Set<string>>` at boot; `reloadPermissionCache()` called after every PATCH; `hasPermission(user, perm)` is the single sync gate (Master Admin always passes).

## Permission keys (12)
`see_finance`, `see_people_hr`, `see_hiring`, `see_customers`, `see_jobs_work`, `see_time_reports`, `manage_content`, `manage_equipment`, `approve_work`, `manage_marketing`, `manage_settings`, `manage_spanish_content`

## Where each permission is enforced
- `see_finance` — `requirePermission("see_finance")` middleware in `invoiceRoutes.ts` (12 routes) and `reportRoutes.ts`
- `see_hiring` — `requireHRAccess` / `requireManagerAccess` local middleware in `hiringRoutes.ts`; hire-to-employee action stays Admin-only (hard-coded)
- `see_time_reports` — inline `hasPermission` check in `timeRoutes.ts` → `/api/admin/time-reports`
- `manage_content`, `manage_equipment`, `see_finance`, `see_hiring` — `checkPermission()` in `assistantTools.ts`
- Matrix admin UI — `requireAdmin` (not `manage_settings`-gated per spec)

## Lock rules (enforced server-side in rolePermissionsRoutes.ts)
- Customer row: all OFF, unmodifiable
- Admin + manage_settings: locked ON, unmodifiable
- Master Admin: bypasses hasPermission entirely, not shown in matrix UI

## Approved intentional loosenings vs old hard-coded gates
- HR role: now gets `see_hiring` + `see_people_hr` (was locked out)
- Sales role: now gets `see_customers` + `manage_marketing` + `see_jobs_work`
- Manager role: now gets `see_time_reports` (normalizes with existing report API gate)

## API routes
`GET /api/role-permissions` — full matrix as `Record<role, Record<perm, bool>>` (Admin only)  
`PATCH /api/role-permissions` — `{ role, permission, granted }` (Admin only, enforces locks, reloads cache)  
`GET /api/my-permissions` — `Record<perm, bool>` for current user (all roles)

## Adding a new permission in the future
1. Add seed row in `server/migrations/rolePermissions.ts`
2. Add key to `ALL_PERMS` array in `rolePermissionsRoutes.ts` and `PermissionsMatrixPage.tsx`
3. Add `requirePermission("new_perm")` to the routes it should gate
4. Add EN + ES i18n keys for `permissions.*` and `permissionDesc.*`

**Why:** Hard-coded role arrays (`["Admin","Manager"]`) scattered across route files make access changes require code deploys. Cache approach keeps all gates consistent with one DB source of truth.
