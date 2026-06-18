---
name: Job Detail Tabs
description: All tabs in the job detail page (show.tsx), their visibility rules, and component wiring pattern.
---

# Job Detail Page Tabs (client/src/pages/jobs/show.tsx)

## Tab Order (as of Phase 3 completion)
1. overview — all roles
2. work-order — all roles
3. time — all roles
4. notes — all roles
5. invoices — all roles
6. messages — all roles
7. activity — all roles
8. daily-logs (Journal) — all roles
9. change-orders — isAdminOrManager only
10. checkpoints — all roles
11. closeout — isAdminOrManager only
12. warranty — isAdminOrManager only
13. packet-gate (Job Gate) — isAdminOrManager only

## Pattern for Adding a New Tab
1. Import component at top of show.tsx
2. Add `<TabsTrigger value="..." data-testid="tab-...">` inside `<TabsList>`, wrapped in `{isAdminOrManager && (...)}` if restricted
3. Add `<TabsContent value="...">` in the body, before the closing `</Tabs>`
4. Both trigger and content must use the same `value` string

## isAdminOrManager Definition
```ts
const isAdminOrManager = user?.role === "Admin" || user?.role === "Manager" || user?.role === "Master Admin";
```

**Why:** Tabs that expose sensitive financial, quality, or gate data are restricted to Admin/Manager roles.
