---
name: Resolving "managers" for staff notifications
description: There is no employee->manager FK in this schema; how the codebase already defines "managers" for alerting purposes
---

`employees.supervisor` is free text, not a foreign key. There is no
`manager_id` / `division_id` relationship anywhere in `shared/schema.ts` that
reliably maps a crew member to their manager.

**Why:** `server/notificationScheduler.ts` already had to solve this exact
problem for a different alert and settled on: "managers" = all `users` rows
where `role IN ('Admin', 'Manager')` OR `isMasterAdmin = true`. This treats
management as company-wide rather than per-crew, which matches how the rest
of the admin/manager tooling in this app works (e.g. Daily Pulse dashboard is
also company-wide, not per-crew-scoped).

**How to apply:** Any new feature that needs to "notify the manager(s)" of an
employee should reuse this same role-filter convention rather than inventing
a new relational field or guessing at a schema change. Keeps behavior
consistent across features and avoids an unnecessary migration.
