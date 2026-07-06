---
name: Testing auth and sequence quirks
description: How to get a working login for e2e tests, and a recurring sequence-desync bug pattern to watch for
---

## NEVER touch a real named user's account for testing — including "Matt H"
Do not log into, reset the password of, or otherwise modify any existing real/named user account for e2e testing purposes, on this project, permanently, regardless of role (Admin, Manager, etc). This includes accounts that look like generic seed/test data — "Matt H" is a real named employee account, not a disposable one, and was mistakenly treated as such in the past (a password reset was performed on it to log in during a UI test). Real password hashes are one-way (scrypt) and cannot be restored once overwritten.

**Why:** Resetting a real user's password locks them out with no way to recover their original credential, and logging in as them is an unauthorized access event even when done for "read-only" verification purposes.

**How to apply:** For any e2e test requiring login, always create a brand-new disposable account yourself first (see below), use it for the test, and delete it immediately afterward. Never reuse or repurpose an existing named account, even temporarily and even if you intend to reset it back.

## Creating a disposable test account for e2e testing on this project
`server/seed.ts`'s `seedUsers()` runs on every server startup and auto-deletes any user whose username starts with a test-ish prefix (`e2e`, `testadmin`, `tester`, etc.) OR whose email contains `@test.com` / `@example.com` — this auto-cleanup can fire *before* a test runs (since `runTest()` appears to restart/reload the app first), causing a confusing "Invalid username or password" failure that looks like a hashing bug but isn't.

**Why:** The cleanup logic is startup-triggered, not test-triggered, so a freshly-inserted disposable user can vanish between creation and login if it matches the banned prefixes/domains.

**How to apply:** Insert a new user row directly via SQL with a clearly-disposable but non-banned username/email (avoid `@test.com`/`@example.com` and prefixes `e2e`/`testadmin`/`tester`), hash its password with the same scrypt scheme as `server/auth.ts` (`scrypt(password, salt, 64)` -> `hex(hash).salt`), use it for the test, then explicitly `DELETE FROM users WHERE ...` it yourself when done — don't rely on the startup cleanup to remove it.

## Sequence desync causing duplicate-key errors on inserts
Symptom: inserting a new row (e.g. a new estimate) fails with a unique constraint violation on a human-readable number column (e.g. `estimate_number`), even though it "should" be the next number. Root cause: the underlying Postgres sequence (e.g. `sales_estimate_seq`) has `is_called = false`, so `nextval()` returns the *current* `last_value` again instead of advancing past it — producing a value that already exists in the table.

**Why:** Sequences created/altered via `setval(seq, n)` without the `is_called` argument default to `is_called = false`. This can happen from manual data seeding/migration scripts that set the counter but never actually call `nextval()`.

**How to apply:** If you hit an unexpected duplicate-key error on an auto-numbered column during testing/dev (unrelated to your actual feature change), check `SELECT last_value, is_called FROM <seq_name>` and fix with `SELECT setval('<seq_name>', <last_value>, true)`. This is a data-only fix, safe to apply even when the surrounding feature work is unrelated.
