---
name: Audit log actor/target labeling
description: Security/audit-trail log entries must store the human display name (not just the raw input) on every event, including failure paths, or search/filter features silently miss rows.
---

When logging a security-audit event (login success/failure, permission change, settings change, etc.) that supports free-text search over actor/target/description fields, always resolve and store the best-known **display name** at write time — not just the raw user-supplied identifier (e.g. an attempted username).

**Why:** A login-failure handler had a `best-effort` user lookup to resolve `actorUserId`, but still wrote the raw attempted username string into `actorName`/omitted `targetLabel`. The audit UI displayed it fine (fallback rendering), but the search filter (`ILIKE` on `actor_name`/`target_label`/`description`) silently excluded that row whenever a user searched by the person's real name instead of their login string — caught only by an e2e test that searched by display name.

**How to apply:** Whenever a lookup (by username/email/id) succeeds anywhere in an audit-logging code path, prefer `resolvedUser?.name` over the raw input for every display-oriented field (`actorName`, `targetLabel`, and ideally embed it in `description` too), falling back to the raw input only when no user record exists. Test search/filter UI by the display name, not just the identifier used to trigger the event.
