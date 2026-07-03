---
name: Schema safety rule
description: How to safely add tables/columns to this project without breaking Drizzle migrations.
---

## Rule

NEVER run `drizzle-kit push` or `drizzle-kit generate` on this project for new table additions.

**Why:** drizzle-kit push detects tables it doesn't know about and prompts dangerous rename/drop operations. It has caused data loss risks on this project before.

**How to apply:**
1. Add new columns to existing tables via raw SQL: `ALTER TABLE x ADD COLUMN IF NOT EXISTS ...`
2. Add new table definitions to `shared/schema.ts` as type-only registrations (Drizzle will recognize them as already existing)
3. The server runs inline SQL migration scripts at startup (in server/index.ts or referenced migration files) — new tables should be created there with `CREATE TABLE IF NOT EXISTS`
4. For new tables: write raw SQL CREATE TABLE, run it, then add the pgTable definition to schema.ts

## Fixing a mistyped column (e.g. uuid that should be integer)

Postgres has no automatic assignment cast from `uuid` to `integer` — a plain `ALTER TABLE t ALTER COLUMN c TYPE integer` on a uuid column fails with "cannot be cast automatically" **regardless of the row data**, even if every value is already NULL. This is a type-system limitation, not a data-content problem.

**Why:** This caused a production publish failure that looked like a data problem ("existing rows can't cast") but was reproducible even against an all-NULL column — the missing `USING` clause was the actual cause, not real invalid data.

**How to apply:** Always give an explicit `USING` expression, e.g. `... TYPE integer USING NULL` (safe when old values are known-garbage and discardable) to bypass the missing-cast restriction. Never use `DROP COLUMN` if the user has a standing no-DROP-COLUMN rule — `USING NULL` avoids dropping anything while still discarding unusable values. Add any new FK as a separate guarded `ADD CONSTRAINT` step. Do not run this directly against production (`executeSql` prod is read-only) or via a custom prod-targeting script — only edit the project's own idempotent raw-SQL migration file so it runs the same way in every environment via the app's normal startup/deploy path. Before assuming "real invalid data" is the cause of a cast failure, query production directly (read-only) to check whether the column actually still has non-null offending values, or whether the missing-USING-clause explanation fits better.
