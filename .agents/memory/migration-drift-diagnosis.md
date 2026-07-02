---
name: Migration drift diagnosis
description: Why the same DROP INDEX / ALTER COLUMN "id" SET DEFAULT gen_random_uuid() / CREATE INDEX diff kept regenerating on every publish, and what the actual scope was.
---

## The pattern
Publish repeatedly proposed the same ~25-line diff: drop `idx_activity_log_created_at`,
`ALTER COLUMN "id" DROP DEFAULT` / re-add on ~10 tables, recreate the index.
A prior migration file (`migrations/0002_schema_drift_fix.sql`) had already tried to fix
this once and it kept coming back.

## Root cause (confirmed via direct read-only pg_catalog queries on both dev and prod)
This is **not** a systemic issue with the `varchar(36).default(sql\`gen_random_uuid()\`)`
pattern used on 60+ tables in this schema — a spot check of `users`, `jobs`, `customers`,
`estimates`, `tasks`, `equipment`, `candidates` showed byte-identical `default_expr`
between dev and prod (`gen_random_uuid()`, no cast) for all of them.

The drift is isolated to exactly the 10 tables named in `0002_schema_drift_fix.sql`
(gps_pings, invoice_line_items, invoices, job_assignments, job_work_areas, payments,
process_audit_schedules, terms_and_conditions, time_entries, work_area_types) plus the
`idx_activity_log_created_at` index:

- **id column default**: prod stores the raw form `gen_random_uuid()`; dev stores
  `(gen_random_uuid())::text`. Functionally identical, but a different catalog
  representation — consistent with prod's column having been created via a raw-SQL
  `ADD COLUMN ... DEFAULT gen_random_uuid()` statement while dev's default was applied
  later via a separate `ALTER COLUMN ... SET DEFAULT` statement (the form `drizzle-kit
  push` emits), which Postgres stores with an explicit `::text` cast.
- **Index ordering**: dev's live index is `(created_at DESC)`; prod's is `(created_at)`
  ascending. schema.ts declares the index with no `.desc()` at all — so dev's live DB
  has actually drifted away from schema.ts itself, independent of prod. Since Replit's
  publish flow diffs the *live dev DB* against the *live prod DB* (not schema.ts vs
  prod), this stray DESC on dev is what keeps re-triggering the drop/recreate on every
  publish.

**Why re-fixing failed before**: `0002_schema_drift_fix.sql` only contains
`ALTER COLUMN "id" DROP DEFAULT` statements with no matching re-add, and the repo's
`migrations/` directory is not wired into the build or deploy pipeline (`npm run build`
does not call `drizzle-kit migrate`/`push`) — so that file was never actually applied to
either database. It's a stale generated artifact, not a real fix.

**How to apply**: the real fix has two independent parts and must not be done via
`drizzle-kit push`/`generate` (see schema-safety.md): (1) reconcile dev's live index
back to ascending to match schema.ts's declared intent, and (2) decide/normalize the id
column default representation so dev and prod store the same catalog form — via raw SQL
per the schema-safety rule, then let Publish's own diff settle once both sides agree.
