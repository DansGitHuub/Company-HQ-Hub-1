---
name: Employee delete FK chain
description: Why deleting a row from employees can fail with a foreign key violation, and what to clean up first.
---

Deleting a row from `employees` can fail with:
`update or delete on table "employees" violates foreign key constraint "onboarding_items_employee_id_fkey"`

**Why:** New-hire creation (including via CSV import) auto-generates a full onboarding checklist — roughly 16 rows in `onboarding_items` keyed to the new employee's id. Those rows must be removed before the employee row can be deleted.

**How to apply:** Before deleting a test/throwaway employee record (e.g. after an import test), first `DELETE FROM onboarding_items WHERE employee_id = ...`, then delete the employee. Check for other employee-linked tables (time entries, corrective actions, etc.) if the delete still fails — the FK chain may not be limited to onboarding_items alone.
