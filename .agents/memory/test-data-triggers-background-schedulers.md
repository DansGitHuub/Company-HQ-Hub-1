---
name: Test data can trigger unrelated background schedulers
description: Creating disposable test rows that match a real business condition (e.g. status='overdue') can cause pre-existing cron/schedulers to independently fire external side effects during your test window.
---

Several background schedulers in this app scan tables on a timer/cron (e.g. invoice overdue notifier, stale-lead alerts, worksheet reminders) independent of whatever feature you're testing. If your disposable ZZZ test row happens to match the scanned condition (e.g. `invoices.status = 'overdue'` with a real-looking customer email/phone), the scheduler can fire mid-test and send a real outbound email/SMS via Resend/Twilio to your test contact info, even though it has nothing to do with the feature under test.

**Why:** Schedulers query broadly (e.g. "all invoices where status=overdue and notification not yet sent") — they have no concept of "this is disposable test data," so any row satisfying the condition is fair game the moment the scheduler's interval ticks, which can overlap with a manual test session.

**How to apply:** When seeding test data that mirrors a real trigger condition (overdue invoices, stale leads, missing-worksheet jobs, etc.), either (a) use a clearly fake but harmless contact address/domain so any accidental send is inert, (b) do the test quickly and clean up immediately so the row's window of exposure is short, or (c) check for known scheduler intervals (grep `server/*Scheduler.ts`) before leaving matching rows in the DB for an extended time. Always verify post-test whether a scheduler log line (e.g. "Invoice overdue notifications: sent N") appeared during your window — if so, confirm the affected row was your disposable data (harmless) and not a real record.
