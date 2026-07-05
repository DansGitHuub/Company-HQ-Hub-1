---
name: Testing auth and sequence quirks
description: How to get a working login for e2e tests, and a recurring sequence-desync bug pattern to watch for
---

## Resetting a test user's password for e2e testing
Passwords are scrypt-hashed (`server/auth.ts` hashPassword: `scrypt(password, salt, 64)` -> `hex(hash).salt`). There is no way to recover a plaintext password from the DB. To get a working login for `runTest()`, generate a hash with the same scheme via `node -e` (using Node's built-in `crypto`) and `UPDATE users SET password = '<hash>' WHERE username = '...'`.

**Why:** Existing seeded users' real passwords are unknown; this is the only way to authenticate as an existing named user without going through a password-reset UI flow.

**How to apply:** After testing, reset the account's password again to a new random value (don't leave a known test password on what may be a real-looking account) and mention this to the user in the final summary. Avoid the app's "locked" master-admin seed account for this (check `server/seed.ts` for a hardcoded username/password pair restored on every server startup via `comparePasswords` check) — any temp password set on it gets silently reverted on the next restart. Use a different Admin-role account instead.

## Sequence desync causing duplicate-key errors on inserts
Symptom: inserting a new row (e.g. a new estimate) fails with a unique constraint violation on a human-readable number column (e.g. `estimate_number`), even though it "should" be the next number. Root cause: the underlying Postgres sequence (e.g. `sales_estimate_seq`) has `is_called = false`, so `nextval()` returns the *current* `last_value` again instead of advancing past it — producing a value that already exists in the table.

**Why:** Sequences created/altered via `setval(seq, n)` without the `is_called` argument default to `is_called = false`. This can happen from manual data seeding/migration scripts that set the counter but never actually call `nextval()`.

**How to apply:** If you hit an unexpected duplicate-key error on an auto-numbered column during testing/dev (unrelated to your actual feature change), check `SELECT last_value, is_called FROM <seq_name>` and fix with `SELECT setval('<seq_name>', <last_value>, true)`. This is a data-only fix, safe to apply even when the surrounding feature work is unrelated.
