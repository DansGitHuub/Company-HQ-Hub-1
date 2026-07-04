---
name: users table has no first_name/last_name
description: The users table schema only has a single `name` column, not first_name/last_name — a recurring source of silently-swallowed SQL errors in routes that join users.
---

The `users` table has columns `id, username, password, email, name, role, ...` — there is no `first_name` or `last_name` column. Any query joining `users` and referencing `first_name`/`last_name` will throw at the DB layer.

**Why:** Several older route files were apparently written against an assumed `first_name`/`last_name` schema. When the query throws inside a `try/catch` that falls back to `res.json([])` (or similar empty-result fallback) on error, the endpoint returns HTTP 200 with an empty/null result instead of an error — making the bug invisible from the frontend and from casual API smoke-testing (curl returns 200, looks "fine"). Found this pattern in `server/worksheetPhotoRoutes.ts`'s `GET /api/jobs/:jobId/worksheet-photos` (fixed to use `COALESCE(u.name, 'Unknown')`); `server/closeoutRoutes.ts` has a code comment noting the same bug was already fixed there previously.

**How to apply:** When a route joins `users` for a display name and returns suspiciously empty/null results, grep for `first_name`/`last_name` against that route file before assuming the bug is elsewhere (e.g. in test data setup or a different table). Also be wary generally of `catch` blocks that swallow DB errors into an empty-array success response — always check server logs (`console.error` in the catch) when an endpoint returns empty during e2e testing, not just the test's own DOM report.
