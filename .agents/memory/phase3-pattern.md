---
name: Phase 3 DB Pattern
description: How Phase 3 feature tables (change orders, checkpoints, closeout, warranty) are structured and registered.
---

# Phase 3 Database Pattern

## Rule
All new tables in this project use raw SQL via `pool.query()` in migration files. Never use `drizzle-kit push`.

## Migration File Convention
- Location: `server/migrations/<featureName>.ts`
- Exports: `async function run<Feature>Migration()`
- Uses: `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` + `CREATE SEQUENCE IF NOT EXISTS`
- Registration: imported and called in `server/index.ts` before `registerPublicPages(app)` and `registerRoutes(...)`

## Phase 3 Tables Created
- `job_change_orders` + `job_change_order_items` + `co_number_seq` (sequence for CO-XXXXX numbers)
- `checkpoint_templates` (seeded with 7 defaults) + `job_checkpoints`
- `job_closeouts` (UNIQUE on job_id — one per job)
- `job_warranties` + `warranty_claims` + `claim_number_seq`

## Route File Convention
- Location: `server/<feature>Routes.ts`
- Exports: `registerXRoutes(app: Express, requireAuth: any)`
- Defines `requireRole()` locally (no shared util) for admin-only endpoints
- Registered in `server/routes.ts` alongside other route registrations

**Why:** drizzle-kit push has caused schema conflicts in this project. Raw SQL gives full control and idempotency via IF NOT EXISTS guards.
