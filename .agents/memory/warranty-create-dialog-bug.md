---
name: Warranty "Create Warranty" dialog does not open
description: Pre-existing bug found while testing warranty claim photos — clicking Create Warranty on the empty-state warranty panel does not open the dialog
---

On a job's Warranty tab, when no warranty exists yet, clicking the "+ Create Warranty" button (data-testid `button-create-warranty`) does not open the dialog. Reproduced twice via e2e browser testing with no console errors captured — the click registers but the Radix Dialog never mounts (`role=dialog` count stays 0).

Confirmed via `git diff` that the dialog and its trigger in `client/src/pages/jobs/JobWarranty.tsx` were untouched by the warranty-claim-photos feature work, so this is a pre-existing issue, not something introduced by that change.

**Why noted:** discovered incidentally; was out of scope for the task in progress (claim photo uploads), so it was left unfixed and worked around by seeding a warranty row directly via SQL for that test instead of going through the UI.

**How to apply:** if a future task touches warranty creation, or a user reports "Create Warranty button doesn't do anything," start here — check the `showCreate` state wiring and Dialog mount timing in `JobWarranty.tsx` rather than re-diagnosing from scratch.
