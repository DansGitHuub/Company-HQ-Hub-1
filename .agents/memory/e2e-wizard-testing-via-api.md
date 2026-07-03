---
name: E2E testing of multi-step wizard forms
description: When a runTest browser-driven plan for a multi-step wizard (unknown dropdown labels, multi-page navigation) fails or reuses stale UI state, switch the "perform the action" step to a direct [API] call against the same endpoint, then verify via [DB] + a read-only [Browser] check.
---

A runTest plan that tried to drive a multi-step qualification wizard (Lead Qualifier) through the UI failed: the test agent ended up reporting on a pre-existing saved record instead of actually submitting a new one, because navigating unfamiliar step-by-step forms with dropdowns whose option labels weren't known in advance is unreliable for the testing subagent.

**Why:** The UI wizard and a direct API call both go through the exact same backend route/handler, so exercising the endpoint via `[API]` is just as valid a test of the fix as clicking through the wizard, and removes the unreliable multi-step-form-navigation variable entirely.

**How to apply:** For backend logic fixes (e.g., "does saving X also create/link Y"), prefer a test plan of the form: register/log in as throwaway user → `[API]` POST directly to the real endpoint with explicit JSON body → `[DB]` assert the expected rows/columns → `[Browser]` read-only check that the UI surfaces the result correctly. Reserve full UI wizard walkthroughs for tests that are specifically about the wizard's own step navigation/UX.
