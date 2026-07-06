---
name: Admin Panel nav has two parallel group configs that must be edited together
description: Where the Admin Panel's sidebar/group labels live and a gotcha about href vs tab items that causes false test failures
---

The Admin Panel's left-nav grouping (which section a page appears under) is defined in **two separate places** that must be kept in sync manually — there is no shared source of truth:
1. `client/src/pages/AdminPanel.tsx` — internal `groups` array (drives the in-page sidebar tabs) and a matching `groupLabelColor()` switch, plus a duplicate hardcoded list again in the "Admin Home" tile sections.
2. `client/src/components/layout/AdminLayout.tsx` — `ADMIN_GROUPS` array, which drives the top breadcrumb for every `/admin/*`, `/catalog`, `/plant-cards`, `/mors-budget` page.

**Why:** These two configs have drifted before (items present in one but missing from the other) with no compile-time or runtime check to catch it. Any regrouping/relabeling task must update all three renderings (sidebar groups, tile sections, breadcrumb `ADMIN_GROUPS`) or some pages will show a stale/missing group in the breadcrumb while still working correctly.

**How to apply:** When splitting/renaming a group, grep both files for the old label string before finishing, and check for any group-specific special-case logic (e.g. a `label === "OldGroupName"` check driving collapse/expand UI) that also needs renaming — it's easy to update the array but miss a hardcoded label comparison elsewhere in the same file.

**Gotcha:** Some nav items navigate via `href` (a real route, e.g. `/admin/customer-duplicates`) while others navigate via `tab` (`/admin?tab=<value>`). When testing breadcrumbs, using the wrong URL pattern for an `href`-based item (e.g. hitting `/admin?tab=customer-duplicates` instead of `/admin/customer-duplicates`) produces a breadcrumb showing only "Admin Panel" — this looks like a real bug but is just an incorrect test URL. Check the item definition's `href` vs `tab` field before writing a breadcrumb test.
