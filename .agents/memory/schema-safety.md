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

## Fixing a mistyped column (e.g. uuid that should be integer) — do NOT alter the type in place

Postgres has no automatic assignment cast from `uuid` to `integer` — a plain `ALTER TABLE t ALTER COLUMN c TYPE integer` fails with "cannot be cast automatically" regardless of row data (even an all-NULL column). Adding an explicit `USING` clause (e.g. `TYPE integer USING NULL`) fixes this *for a manual one-off run*, but is NOT safe to rely on for a column that must survive a Replit Publish.

**Why:** Replit's Publish/Provision step independently introspects the *entire* live database structure (dev vs prod) and generates its own raw diff DDL — completely separate from Drizzle/schema.ts and from any app-level migration script, and it runs *before* the app or its migration script boots in the new deployment. If it finds a same-named column whose type differs between dev and prod, it emits a plain `ALTER COLUMN ... SET DATA TYPE` with no `USING` clause, which fails identically on every publish attempt for a uuid→integer change. This applies even to tables/columns Drizzle has never heard of (verified by grepping `shared/schema.ts` and the Drizzle `migrations/` folder — the affected table wasn't tracked there at all, yet the platform still diffed it). Once dev and prod diverge on a column's type this way, the app's own idempotent migration script never gets a chance to reconcile things, because the deploy fails at Provision every single time — a loop that can't self-heal.

**How to apply:** Never change an existing shipped column's type as the fix. Instead: (1) leave the mistyped column in place untouched forever (deprecated/dead), (2) add a **brand-new** column with the correct type via plain `ADD COLUMN IF NOT EXISTS` (a pure additive op, always safe — there's nothing to cast, so the Provision-diff can never generate a failing statement for it), (3) point the app's read/write code at the new column, aliasing it back to the old field name in SELECTs (`new_col AS old_name`) if the API/frontend contract must stay unchanged. If dev's copy of the column was already manually converted in-place (e.g. from an earlier attempted fix), revert it back to match production's real current type first — the Provision-diff compares live dev vs live prod structure, so dev must match prod on the old column for the trigger to disappear. Never run any of this DDL directly against production; only add it to the project's own idempotent migration file. This supersedes the earlier "just add a USING clause" advice below, which is correct Postgres syntax but insufficient to survive Replit's Publish flow.
