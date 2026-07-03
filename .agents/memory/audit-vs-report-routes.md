---
name: server/auditRoutes.ts vs server/reportRoutes.ts naming trap
description: Two similarly-named files can both implement "job costing"/"profitability" endpoints — only one is wired to the frontend. Always grep the frontend for the actual fetch URL before trusting a route file that "looks like" the one a bug report describes.
---

In this codebase, `server/reportRoutes.ts` contained a `/api/reports/job-costing` endpoint with a hardcoded 60% cost-ratio mock — but it was dead code with zero frontend callers. The actual "Job Profitability" tab in `client/src/pages/Reports.tsx` calls `/api/reports/job-profitability`, which lives in the differently-named `server/auditRoutes.ts`.

**Why:** A bug report describing symptoms ("Job Profitability tab uses a hardcoded 60% cost assumption") can point you to plausible-looking but unused code if you search by feature name/route-path pattern alone. The naming similarity between `reportRoutes.ts` and `auditRoutes.ts` (both plausible homes for a "reports" feature) made it easy to fix the wrong file.

**How to apply:** Before editing any backend endpoint to fix a reported frontend bug, grep the frontend component for its actual `fetch`/`useQuery` URL and confirm which server file registers that exact path. Don't assume the file name matches the feature name.
