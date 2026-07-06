---
name: Tool route/grid role gating
description: Single-source-of-truth pattern for gating both a card grid's visibility and the underlying page routes by role.
---

When a feature exposes both a discovery grid (cards linking to sub-pages) and the sub-pages themselves as real routes, filtering the grid alone is cosmetic — a user can still type the URL directly. Both layers must read from the same role map.

**Why:** The user explicitly required that Tools page card visibility and the actual `/forms`, `/tools/plow-mapper`, `/tools/calculator`, `/tools/lead-qualifier` routes be locked down consistently, not just hidden in the UI. Two separate hand-maintained role lists (one in the grid component, one in the router) would drift apart over time.

**How to apply:** Put the role list in one small shared module (e.g. `client/src/lib/toolAccess.ts` exporting a `TOOL_ROLES` map + a `canAccessTool(id, role, isMasterAdmin)` helper). The grid component imports it to filter/show cards; the router imports it to pass `allowedRoles` into the existing `ProtectedRoute` convention for each corresponding route. Any dashboard widgets/quick-links that shortcut to the same pages must also filter through the same helper, or they'll show dead links to roles that just got locked out.
