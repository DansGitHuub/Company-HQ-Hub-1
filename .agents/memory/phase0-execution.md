---
name: Phase 0 execution findings
description: Critical DB discoveries made during Phase 0 cleanup — what tables exist, what was completed, what is pending.
---

## Critical DB discoveries (June 2026)

The live database had many tables that were NOT registered in shared/schema.ts. These were created via raw SQL migrations and were invisible to Drizzle ORM.

### Tables found in live DB that were missing from schema.ts (now registered):
- `consultations` — separate from estimates, has pipeline_stage, customer_id, full lead fields
- `customers` — a separate CRM entity table distinct from the `users` auth table (registered as `customersEntity` in schema to avoid name collision)
- `customer_contacts` — multiple contacts per customer, already built
- `properties` — existed, missing access_notes/gate_code/has_pets (added via raw SQL)
- `work_orders` + 7 child tables — real, full backend in server/workOrderRoutes.ts
- `sales_estimates` — this is System B (authoritative) estimate system
- `direct_messages`, `dm_conversations`, `dm_messages`, `dm_reads` — two DM systems exist
- `message_folders`, `message_folder_items`, `message_notifications`, `message_attachments`
- `route_days`

### Jobs table — already had customer_id and property_id columns (nullable, no FK enforcement)
Only 3 test jobs had no customer_id — no real backfill needed.
Added via raw SQL: `source_estimate_id varchar(36)`, `crew_lead_id varchar(36)`

### Two estimate systems:
- System A (LEGACY): `estimates` + `estimate_items` — marked with LEGACY comment in schema.ts
- System B (AUTHORITATIVE): `sales_estimates` + `estimate_line_items` + `estimate_work_area_groups` + `calculator_runs` + `catalog_items`

### Two worksheet systems:
- Old: `daily_worksheets` — 1 record, 0 in last 30 days — effectively unused
- New: `worksheetSessions` / `worksheets` / child tables — DailyWorksheet.tsx ALREADY uses new system

### Two DM systems:
- Old: `direct_messages` (Gmail-style, single messages)
- New: `dm_conversations` + `dm_messages` + `dm_reads`
The `/messages` page uses the newer system.

## Completed Phase 0 changes

1. **storedPassword removed completely** — DB column dropped, schema.ts updated, routes.ts cleaned (user create, update, profile get/patch, crew portal invite), auth.ts cleaned, AdminPanel.tsx view password dialog + mutation + state + dropdown item all removed
2. **properties table enhanced** — added access_notes, gate_code, has_pets columns via raw SQL
3. **jobs table enhanced** — added source_estimate_id, crew_lead_id columns via raw SQL
4. **All missing tables registered in schema.ts** — properties, customersEntity, customerContacts, consultations, salesEstimates, workOrders + 7 child tables, directMessages, dmConversations, dmMessages, dmReads, messageFolders, messageFolderItems, messageNotifications, messageAttachments, routeDays
5. **LEGACY labels added** — estimates and estimateItems tables in schema.ts marked with LEGACY comment
6. **Materials migrated** — 12 records from old `materials` table migrated to `catalog_items` (catalog_items now has 20 records)
7. **/materials route** — now redirects to /catalog in App.tsx
8. **my-day route fixed** — was wrongly redirecting to /daily-worksheet; now correctly shows MyDayPage (crew clock-in/out view)
9. **Duplicate /customers key** fixed in App.tsx
10. **AdminPanel sidebar customizer** — "Materials" entry updated to "Materials Catalog" pointing to catalog

## Pending Phase 0 / Phase 1 items

- materials nav item defined in AppShell (line 372) but NOT in any sidebar section — can be cleaned up
- my_day nav item defined in AppShell (line 380) but NOT in any sidebar section currently
- Old `daily_worksheets` table has 1 record — safe to archive/ignore (UI already uses new system)
- Messaging consolidation (old customerMessages vs messagingThreads) — Phase 1
- Work orders: job_id is text not UUID FK; missing customer_id/property_id proper columns — Phase 2
- consultations table: assigned_to FK was fixed to employees(id) per migration log
