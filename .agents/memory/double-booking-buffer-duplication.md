---
name: Double-booking buffer logic is duplicated across 4 route files
description: The 480-minute default-duration conflict-check constant exists in 4 separate files; only one is wired to the admin-configurable business_rules setting.
---

The crew/equipment scheduling conflict check (`rangesOverlap`-style function that treats a missing end time as `start + 480` minutes) is intentionally duplicated, not shared, across: `server/schedulingRoutes.ts`, `server/dailyPlanRoutes.ts`, `server/jobEquipmentRoutes.ts`, and `server/adminDashboardRoutes.ts`.

Only `server/schedulingRoutes.ts` (`POST /api/scheduling/check-crew-overlap`, the dispatch-calendar double-booking warning) has been wired to read its buffer from the `business_rules` table (key `double_booking_buffer_minutes`). The other three still use the hard-coded `480` literal.

**Why:** a task explicitly scoped "wire the double-booking buffer to the new setting" to only the named double-booking warning feature, and explicitly forbade touching other modules — so the other 3 duplicates were left untouched on purpose, not missed.

**How to apply:** if a future task asks to make double-booking/overlap buffers consistent everywhere, or complains that daily-plan/equipment/admin-dashboard conflict checks don't respect the admin setting, this is expected — wire each one the same way (read `business_rules.double_booking_buffer_minutes`, fallback 480) rather than assuming a shared helper already covers them.
