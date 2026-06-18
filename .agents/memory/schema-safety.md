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
