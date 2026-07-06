---
name: Test account cleanup - audit_log columns
description: How to find and delete disposable test-account rows in audit_log, which has no user_id column.
---

`audit_log` does not have a `user_id` column. It uses `actor_user_id` and `target_user_id` instead.

**Why:** Following the standing rule to delete disposable test accounts (and their dependent rows) after e2e testing, a naive `DELETE ... WHERE user_id IN (...)` against `audit_log` fails with `column "user_id" does not exist`. `activity_log`, by contrast, does use `user_id`.

**How to apply:** Before cleaning up a disposable test account, check both `activity_log` (column `user_id`) and `audit_log` (columns `actor_user_id`, `target_user_id`) for rows referencing the test account's id, and delete from both before deleting the `users` row. Also check any other feature-specific tables the test session may have touched (e.g. tables with `created_by`/`performed_by`) if the test flow created data beyond login/navigation.
