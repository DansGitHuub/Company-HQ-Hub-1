---
name: Soft-delete conventions for jobs/invoices/customers
description: What DELETE endpoints actually do in this app, and why customer cleanup can silently fail — relevant whenever seeding/cleaning up test data
---

`DELETE /api/jobs/:id` does not remove the row — it sets `status='cancelled'`.
`DELETE /api/invoices/:id` does not remove the row — it sets `status='void'`.
There is no `DELETE /api/customers/:id` route at all; customers can only be
archived (`PATCH /api/customers/:id/archive`, sets `is_active=false`), and
archiving is itself blocked (409) if the customer still has any job whose
stage isn't excluded (a cancelled job still counts) or any invoice with a
nonzero balance (a voided invoice still counts as "unpaid" for this check).

**Why:** The app intentionally preserves job/invoice/customer history for
audit and reporting rather than hard-deleting; the archive-eligibility check
guards against orphaning financial/job history behind an archived customer.

**How to apply:** When seeding and then cleaning up throwaway test data
(customers/jobs/invoices/estimates) for a test, expect "delete" calls to only
soft-cancel/void the row, not remove it — that's normal, not a bug. Don't
expect to be able to fully archive a test customer immediately after
cancelling its jobs/voiding its invoices; leaving cancelled/void test records
in place (clearly named, e.g. "ZZZ Safe to Delete") is an accepted end state.
