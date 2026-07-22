---
name: Personal area sheet pattern
description: Key discoveries from building the Stage 5 "My Account" personal area sheet behind the sidebar avatar.
---

## Rule
When extending `/api/employees/me` or adding self-service pay endpoints, check what fields it actually returns — the endpoint omits pay fields by default and pay-history is manager-gated.

## Details

**`/api/employees/me` pay fields (hiringRoutes.ts ~line 535)**
- Originally omitted: `pay_rate`, `pay_type`, `pay_period`, `payment_method`
- These exist in the `employees` table but were not mapped in the response
- Fix: add `payRate: emp.pay_rate, payType: emp.pay_type, payPeriod: emp.pay_period, paymentMethod: emp.payment_method` to the res.json() call

**`/api/employees/:id/pay-history` is `requireManagerAccess`**
- Employees cannot call this on themselves
- Solution: add a new `GET /api/employees/me/pay-history` route (requireAuth only) BEFORE the `:id` route to avoid URL matching conflict
- It looks up employee by user_id, then returns their own pay history

**Embedding full page components in Sheet tabs works cleanly**
- `Profile.tsx` renders `<div className="max-w-2xl mx-auto space-y-6">` — no min-h-screen, no position:fixed → embeds fine in scrollable sheet tab
- `EmployeePortal.tsx` renders `<div className="space-y-4 max-w-5xl mx-auto">` with 4-col grid (1 nav + 3 content) → also embeds fine
- Both components manage their own React Query data fetching and share the cache with the full pages, so opening the sheet is instant when cache is warm

**Why admin users see "No pay info" in MY PAY tab**
- Admins (e.g. Chapin123/Daniel) typically have no `employees` row linked to their `users` row
- `GET /api/employees/me` returns 404 for admin-only accounts; the panel correctly shows the informational message
- Crew members with employee records see the full estimated pay + rate history view
