# Employee Data Set Audit

> **Audit scope:** Read-only inspection of the employee data model, connections, permissions, history tracking, and risks.
> **Date:** June 13, 2026
> **No code, schema, UI, permission, or workflow changes were made.**

---

## 1. How Does the Data Get There?

### Source 1 — Hiring Pipeline (Applicant → Employee Conversion)

| Attribute | Detail |
|---|---|
| **Source name** | Hiring Module — "Hired" stage trigger |
| **Responsible role/system** | Admin or Manager; backend function `executeHireFlow` |
| **Form / Page / Route** | `POST /api/candidates/:id/stage` (stage body = `"hired"`) in `server/hiringRoutes.ts` |
| **How data arrives** | Automatically copied from the `candidates` record: name, email, phone, offered pay rate/type |
| **Also creates** | A linked `users` account (role: `"Crew"`, temporary password), a 16-item onboarding checklist, welcome email/SMS |
| **Validation** | Checks for duplicate employee linked to the same candidate; role defaults to Crew; `firstName`/`lastName` copied from `candidates.name` |

### Source 2 — Manual Employee Creation

| Attribute | Detail |
|---|---|
| **Source name** | Employees Page — "Add Employee" dialog |
| **Responsible role** | Admin or Manager |
| **Form / Page / Route** | `POST /api/employees` in `server/hiringRoutes.ts`; `AddEmployeeForm` component in `client/src/pages/Employees.tsx` |
| **How data arrives** | Manually entered by HR staff |
| **Validation** | Client-side: `firstName` and `lastName` required before save button enables. Server-side: `firstName` and `lastName` are the only `notNull` DB-enforced fields |

### Source 3 — Admin Profile Editing

| Attribute | Detail |
|---|---|
| **Source name** | Employee Profile tabs (Personal, Employment, Pay Rate) |
| **Responsible role** | Admin or Manager (Pay Rate tab: Admin only in the UI) |
| **Form / Page / Route** | `PATCH /api/employees/:id` in `server/hiringRoutes.ts` |
| **How data arrives** | Manually updated by HR; covers all fields including pay rate changes |
| **Validation** | Role check via `requireHRAccess` middleware (Admin + Manager + Master Admin allowed). No server-side field-level validation beyond basic schema types |

### Source 4 — Employee Self-Service (Portal)

| Attribute | Detail |
|---|---|
| **Source name** | Employee Portal |
| **Responsible role** | Crew (the employee themselves) |
| **Form / Page / Route** | Various portal endpoints; `client/src/pages/EmployeePortal.tsx` |
| **How data arrives** | Employee updates limited personal fields (contact info, emergency contacts) |
| **Validation** | Route-level check: user can only modify their own record |

### Source 5 — User Account Management (Admin Panel)

| Attribute | Detail |
|---|---|
| **Source name** | Admin Panel — User Management |
| **Responsible role** | Admin, Master Admin |
| **Form / Page / Route** | `POST /api/admin/users`, `PATCH /api/admin/users/:id` in `server/routes.ts` |
| **How data arrives** | Manages the linked `users` table record (username, email, role, active status). Changes here affect the employee's login and permissions |
| **Validation** | `requireAdmin` middleware; unique constraint on `users.email` and `users.username` |

### Source 6 — Portal Invite

| Attribute | Detail |
|---|---|
| **Source name** | Employee → Portal Invite button |
| **Responsible role** | Admin only (`requireAdmin` — Managers excluded) |
| **Form / Page / Route** | `POST /api/admin/employees/:id/portal-invite` in `server/routes.ts` |
| **How data arrives** | Creates a `users` account and links it to the `employees` record if one doesn't already exist |
| **Validation** | `requireAdmin` only |

### Source 7 — HR Forms (Time Off, Resignation, Corrective Actions)

| Attribute | Detail |
|---|---|
| **Source name** | Employee File Forms |
| **Responsible role** | Crew (submits); Admin/Manager (issues corrective actions) |
| **Form / Page / Route** | `POST /api/time-off-requests`, `POST /api/resignation-letters`, `POST /api/corrective-actions` in `server/employeeFormsRoutes.ts` |
| **How data arrives** | Digital form submission with optional signature fields |
| **Validation** | `requireAuth`; ownership check on the record; Managers may only issue corrective actions to users with the `Crew` role |

### Source 8 — No Bulk Import

There is currently **no CSV or bulk import pathway for employees**. Unlike the Materials Catalog which has a dedicated `/catalog/import` route and UI, employees must be created one at a time either through the hiring pipeline or the Add Employee form.

---

## 2. What Other Modules Does the Employee Data Set Touch?

### Scheduling / Dispatch

| Attribute | Detail |
|---|---|
| **Type of connection** | Read (to populate crew dropdowns), Write (creates `job_assignments`) |
| **Employee fields used** | `users.id`, `users.name`, `users.role`; `employees.id` |
| **Files / Tables / Routes** | `server/schedulingRoutes.ts`, `job_assignments` table, `client/src/pages/scheduling/index.tsx` |
| **Risk if data missing** | Assignments cannot be made; crews cannot be dispatched to jobs |

### Time Tracking

| Attribute | Detail |
|---|---|
| **Type of connection** | Read/Write |
| **Employee fields used** | `users.id` (primary key used in `time_entries`), `users.name` |
| **Files / Tables / Routes** | `server/timeRoutes.ts`, `time_entries` table (references `users.id`, NOT `employees.id`), `time_cards` table |
| **Risk if data missing** | ⚠️ **Split identity risk.** `time_entries` is linked to `users.id`, while `job_assignments` is linked to `employees.id`. If an employee record exists without a linked `users` account (`userId` is nullable), their time entries and job assignments cannot be joined without extra logic |

### Jobs & Work Orders

| Attribute | Detail |
|---|---|
| **Type of connection** | Read (owner/assignee display) |
| **Employee fields used** | `users.id`, `users.name` |
| **Files / Tables / Routes** | `server/jobRoutes.ts`, `jobs.ownerId` → `users.id` |
| **Risk if data missing** | Job ownership is anonymous; no crew attribution on job records |

### Estimates

| Attribute | Detail |
|---|---|
| **Type of connection** | Read (salesperson/owner) |
| **Employee fields used** | `users.id`, `users.name` |
| **Files / Tables / Routes** | `server/estimateRoutes.ts`, `estimates.ownerId` → `users.id` |
| **Risk if data missing** | Estimates have no owner; commission or accountability tracking impossible |

### SOPs & Training Quizzes

| Attribute | Detail |
|---|---|
| **Type of connection** | Read/Write |
| **Employee fields used** | `users.id`, `users.username`, `users.role` |
| **Files / Tables / Routes** | `server/sopQuizGenerator.ts`, `user_quiz_attempts` table, `client/src/pages/TestingKnowledge.tsx` |
| **Risk if data missing** | Quiz history orphaned; compliance tracking breaks |

### Reports / Dashboards

| Attribute | Detail |
|---|---|
| **Type of connection** | Read (aggregate) |
| **Employee fields used** | `users.id`, `users.name`, `time_entries.durationMinutes` |
| **Files / Tables / Routes** | `server/reportRoutes.ts`, `client/src/pages/admin/TimeReports.tsx`, `client/src/pages/Reports.tsx` |
| **Risk if data missing** | Labor hours cannot be attributed; crew performance reports are empty or misleading |

### QuickBooks Time Export

| Attribute | Detail |
|---|---|
| **Type of connection** | Read (pay rate, time entries); Write (stores QB mapping ID back on `users`) |
| **Employee fields used** | `employees.payRate`, `users.qbo_employee_id`, `time_entries.*` |
| **Files / Tables / Routes** | `server/quickbooksRoutes.ts`, `server/quickbooksSync.ts` |
| **Risk if data missing** | Payroll export fails or maps to wrong QB employee; time activities cannot be sent |

### MORS Budget Module

| Attribute | Detail |
|---|---|
| **Type of connection** | Parallel / Independent — does NOT read from `employees` table |
| **Employee fields used** | Has its own `mors_employees` table with a separate `pay_rate` field (line 2879 of `shared/schema.ts`) |
| **Files / Tables / Routes** | `server/morsRoutes.ts`, `mors_employees` table |
| **Risk if data missing** | ⚠️ **Disconnection risk.** Budget labor rates in MORS are entered manually and have no link to the live `employees.payRate`. A raise given in HR has zero effect on MORS budget calculations unless someone manually updates both |

### Hiring Pipeline

| Attribute | Detail |
|---|---|
| **Type of connection** | Write (creates employees); Read (displays status) |
| **Employee fields used** | `candidates.name → employees.firstName/lastName`, `candidates.email`, `candidates.offerPay → employees.payRate` |
| **Files / Tables / Routes** | `server/hiringRoutes.ts`, `candidates` table, `employees` table |
| **Risk if data missing** | Hire flow cannot complete; no employee record or user account created |

### Notifications

| Attribute | Detail |
|---|---|
| **Type of connection** | Read |
| **Employee fields used** | `users.email`, `users.phone`, `users.emailNotifications`, `users.smsNotifications` |
| **Files / Tables / Routes** | `server/notificationService.ts`, `staff_notifications` table |
| **Risk if data missing** | Notifications not delivered; employees miss important alerts |

### Google Calendar Sync

| Attribute | Detail |
|---|---|
| **Type of connection** | Read/Write |
| **Employee fields used** | `users.googleCalendarId`, `users.googleAccessToken`, `users.googleRefreshToken` |
| **Files / Tables / Routes** | `server/googleCalendar.ts`, `server/calendarRoutes.ts`, `calendar_connections` table |
| **Risk if data missing** | Calendar sync silently fails |

### Consultations / Sales Pipeline

| Attribute | Detail |
|---|---|
| **Type of connection** | Read (salesperson assignment) |
| **Employee fields used** | `employees.id`, `users.id`, `users.name` |
| **Files / Tables / Routes** | `consultations.assigned_to` → `employees.id` |
| **Risk if data missing** | Consultations unassigned; lead alerts sent to nobody |

### Agreements / Digital Signing

| Attribute | Detail |
|---|---|
| **Type of connection** | Read/Write |
| **Employee fields used** | `employees.id`, `users.id`, `employees.jobTitle` |
| **Files / Tables / Routes** | `server/agreementRoutes.ts`, `employee_agreements` table |
| **Risk if data missing** | Agreements cannot be sent or signed |

### My Day (Crew Mobile View)

| Attribute | Detail |
|---|---|
| **Type of connection** | Read |
| **Employee fields used** | `users.id`, `job_assignments.employeeId` |
| **Files / Tables / Routes** | `client/src/pages/MyDay.tsx`, `job_assignments` table |
| **Risk if data missing** | Crew member sees no jobs; cannot clock in; daily work is invisible |

---

## 3. Who Can See the Data?

### Master Admin

| Capability | Detail |
|---|---|
| **Can view** | Everything including sensitive fields. Uniquely can see plaintext passwords of staff accounts |
| **Can edit** | All employee fields, all users, all roles including Admin accounts |
| **Cannot access** | Nothing is blocked |
| **Enforcement** | `isMasterAdmin` boolean flag on `users` table; checked throughout `server/auth.ts` and route middleware |

### Admin

| Capability | Detail |
|---|---|
| **Can view** | Full employee directory; all profile tabs including Pay Rate, banking info (masked), documents, history, corrective actions |
| **Can edit** | All employee fields; can create, deactivate, or delete user accounts; can issue corrective actions to any role |
| **Cannot access** | Cannot view another Admin's plaintext password (only Master Admin can) |
| **Enforcement** | `requireAdmin` middleware on sensitive routes; `requireHRAccess` on HR routes |

### Manager

| Capability | Detail |
|---|---|
| **Can view** | Full employee list; all profile tabs except Pay Rate (tab hidden in UI) |
| **Can edit** | Personal and employment fields; can issue corrective actions to Crew role only; can move candidates through hiring stages |
| **Cannot access** | Pay Rate tab is hidden in the frontend. However, the API `PATCH /api/employees/:id` allows Manager access via `requireHRAccess` middleware — the payRate field is not server-side blocked from being written by a Manager if they call the API directly |
| **Enforcement** | `requireHRAccess` (Admin + Manager + Master Admin). Frontend tab hiding for Pay Rate. Backend corrective-action check: `if (targetUser.role !== "Crew") return 403` |
| **⚠️ Gap** | Pay Rate is returned in the full employee API response to Managers. The tab is hidden, but the data is technically accessible via the API. Also, Managers can write payRate via PATCH if they construct the request manually |

### Crew

| Capability | Detail |
|---|---|
| **Can view** | Own employee profile only (personal info, onboarding checklist, documents, time off, pay stubs if available) |
| **Can edit** | Own personal contact info and emergency contacts via the Employee Portal |
| **Cannot access** | Other employees' records, pay rates, HR notes, corrective actions of others |
| **Enforcement** | Route-level ownership checks: `req.user.id === targetRecord.userId`; the `/employees` list page is not accessible to Crew in the frontend routing |

### Customer

| Capability | Detail |
|---|---|
| **Can view** | No employee data directly. May see employee names on job records or assigned consultations if exposed in Customer Hub |
| **Can edit** | None |
| **Cannot access** | Full employee directory, pay data, HR records |
| **Enforcement** | Frontend routing redirects Customers to `/customer-hub`; global search API explicitly excludes employee data for Customers |

---

## 4. What Fields Should Be Mandatory?

### Required at Employee Creation

| Field | Why Required | What Breaks Without It | Currently Enforced? |
|---|---|---|---|
| `firstName` | Identity | Every display, report, notification breaks | ✅ Yes — `notNull` in DB + form validation |
| `lastName` | Identity | Same as above | ✅ Yes — `notNull` in DB + form validation |
| `personalEmail` | Communication, portal invite | Welcome emails fail; portal access impossible | ❌ No — optional text field |
| `jobTitle` | Scheduling, agreements, reports | Agreements use `jobTitle` as a variable; scheduling context is missing | ❌ No |
| `employmentType` | Payroll, reporting | Defaults to "Full-time" but should be a deliberate choice | ✅ Partial — defaults exist but not enforced at input |
| `startDate` | Seniority, compliance, onboarding scheduling | Tenure calculations impossible; legal documentation gaps | ❌ No |

### Required Before Scheduling

| Field | Why Required | What Breaks Without It | Currently Enforced? |
|---|---|---|---|
| `userId` (linked user account) | Scheduling uses `users.id` to identify crew | `job_assignments` can be created for `employees` without a `users` account, but clock-in and `time_entries` would be broken | ❌ No — `userId` is nullable |
| `status` | Should be "Active" to appear in dispatch | Terminated or On-Leave employees would still appear in crew pickers | ✅ Partial — defaults to "Active" but not filtered everywhere |
| `jobTitle` / `department` | Knowing role before assignment | Crew assigned to wrong division or type of work | ❌ No |

### Required Before Payroll / Wage Tracking

| Field | Why Required | What Breaks Without It | Currently Enforced? |
|---|---|---|---|
| `payRate` | Wage calculations, QuickBooks export, job costing | Time hours have no dollar value; QBO export fails | ❌ No — optional text field |
| `payType` | Hourly vs. salary distinction | Wrong calculation method applied | ❌ No |
| `payPeriod` | Pay cycle determines paycheck frequency | Payroll schedule unknown | ❌ No |

### Required Before Customer-Facing Assignment

| Field | Why Required | What Breaks Without It | Currently Enforced? |
|---|---|---|---|
| `profilePhoto` | Customer-facing credential / trust | Not required but expected for customer communication | ❌ No |
| `status` = "Active" | Should not send terminated employees to customer jobs | Customer relations and liability issue | ❌ No |

### Optional Fields

`preferredName`, `pronouns`, `dateOfBirth`, `address/city/state/zip`, `emergencyContact2*`, `supervisor`, `workLocation`, `bankNameLast4`, `accountLast4`, `routingLast4`, `accountType`, `paymentMethod`, `profilePhoto`, `employeeNumber`

### Sensitive Fields — Should Have Restricted Access

| Field | Sensitivity | Currently Restricted? |
|---|---|---|
| `payRate`, `payType`, `payPeriod` | Wage data | ⚠️ Partial — Pay Rate tab hidden from Managers in UI, but API returns full object |
| `bankNameLast4`, `accountLast4`, `routingLast4`, `accountType` | Banking (masked) | ⚠️ Partial — shown in Pay tab, accessible to Admins and technically to Managers via API |
| `dateOfBirth` | PII / legal | ❌ No restriction beyond general employee access |
| `personalEmail`, `personalPhone` | PII | ❌ No restriction beyond general employee access |
| `emergencyContact*` fields | PII — third party | ❌ No restriction |

---

## 5. Do We Need to Track a Change Log?

### Is There Currently a Change Log?

**Yes, partially.** Two dedicated tables exist:

- **`employee_pay_history`** — records `oldRate`, `newRate`, `reason`, `approvedBy`, `createdAt`
- **`employee_history`** — records `changeType`, `details`, `recordedBy`, `createdAt`

A "History" tab exists in the employee detail UI (`client/src/pages/Employees.tsx`) to display these records.

### What Fields Should Have Change History?

| Field | Has History Now? | Should Have History |
|---|---|---|
| `payRate` | ✅ `employee_pay_history` exists | ✅ Yes |
| `status` (Active/Terminated/On Leave) | ✅ Via `employee_history` (manual entry) | ✅ Yes |
| `jobTitle` | ❌ No | ✅ Yes — promotions / title changes |
| `role` (on `users` table) | ❌ No | ✅ Yes — role escalation is a security event |
| `supervisor` | ❌ No | ✅ Yes — management changes |
| `employmentType` | ❌ No | ✅ Yes — Full-time → Part-time changes affect benefits |
| `personalEmail` / `personalPhone` | ❌ No | ⚠️ Recommended for fraud detection |
| `paymentMethod` / banking fields | ❌ No | ✅ Yes — banking changes are a fraud risk |
| `startDate`, `endDate` | ❌ No | ✅ Yes — correcting these after the fact should be traceable |

### Is Wage History Properly Preserved for Past Payroll and Job Costing?

⚠️ **Partially — with a significant risk.**

The `employee_pay_history` table records that a change happened, but:

1. **`payRate` in the main `employees` table is a single text field.** When an employee gets a raise, the old value is overwritten. The history table captures the before/after, but only if the code that processes the PATCH explicitly writes to `employee_pay_history`. There is no database-level trigger that auto-populates it.

2. **`time_entries` does not store the employee's pay rate at the time of the entry.** If you query hours worked last month against today's pay rate, you get an inflated cost. There is no `effectivePayRate` snapshot on time entries.

3. **`employee_pay_history.oldRate` and `newRate` are stored as `text`, not `numeric`.** This means you cannot do math directly on the history table; you must parse and convert.

4. **MORS budget `mors_employees.payRate` is completely disconnected.** It has its own pay rate that is never updated by HR changes.

**Conclusion:** Wage history exists structurally but is not enforced by the database, not snapshotted in time entries, and not connected to the budget module. Past job costing reports can be silently inaccurate after a raise.

### Who Should View and Who Should Make Changes?

| Action | Recommended Role |
|---|---|
| View change history | Admin, Manager (read-only) |
| Write to `employee_history` | Auto-triggered by system on any employee PATCH; Admin can add manual notes |
| Write to `employee_pay_history` | Admin only |
| View pay change history | Admin only |
| Make changes to role or permissions | Admin, Master Admin only |

### Should Previous Values, New Values, Changed By, Changed Date, and Reason Be Tracked?

Yes. The tables already have the right columns (`oldRate`, `newRate`, `approvedBy`, `reason`, `changeType`, `details`, `recordedBy`, `createdAt`). The gap is **enforcement** — these history records currently depend on the application code explicitly calling the write; no automatic database trigger ensures they are always populated.

---

## 6. Missing Fields, Weak Connections, and Risks

### Missing Fields

| Missing Field | Impact |
|---|---|
| `workEmail` (separate from `personalEmail`) | Employees currently only have `personalEmail`; work communication vs. personal email are indistinguishable |
| `division` on `employees` | Scheduling and dispatch use divisions extensively; the employee record has no native division link |
| `terminationReason` | `endDate` and `status = "Terminated"` exist, but no `terminationReason` field |
| `effectivePayRateDate` | No way to know when the current `payRate` became effective without reading history |
| Numeric `dateOfBirth` type | Stored as `text`, not a proper date; age and eligibility calculations not reliable |
| `i9Status` / `w4Status` | I-9 and W-4 completion is tracked via the onboarding checklist, not as structured fields |
| `ssn` / EIN | Intentionally absent (good for security), but means no payroll system integration without QuickBooks mapping |

### Missing Relationships

| Missing Relationship | Risk |
|---|---|
| `supervisor` is free text, not FK to `employees.id` | Cannot build org charts, notify supervisors programmatically, or cascade access |
| `payRate` not snapshotted in `time_entries` | Historical job costing inaccurate after any wage change |
| `employees` and `mors_employees` have no FK connection | Budget module is permanently out of sync with live HR data |
| `time_entries.userId` vs `job_assignments.employeeId` | Two different keys used for the same person across modules; reporting requires a JOIN through `employees.userId` |
| `candidates.offerPay` does not auto-create `employee_pay_history` | The initial pay rate set during hiring is never recorded as the first entry in pay history; history starts blank |

### Permission Risks

| Risk | Severity |
|---|---|
| Managers can call `PATCH /api/employees/:id` and include `payRate` in the body — `requireHRAccess` does not block it | **High** |
| `employee_pay_history` write route (`POST /api/employees/:id/pay-history`) uses `requireHRAccess`, which includes Managers | **Medium** |
| Portal invite route (`POST /api/admin/employees/:id/portal-invite`) uses `requireAdmin`, so Managers cannot create portal accounts for their own crew without an Admin | **Low** (operational inconvenience, not a security risk) |
| `bankNameLast4`, `accountLast4`, `routingLast4` are returned in the full employee API response to anyone with `requireHRAccess` — including Managers | **Medium** |
| No rate limiting or brute-force protection on employee profile endpoints | **Low** |

### Data Quality Risks

| Risk | Severity |
|---|---|
| `payRate` stored as `text` — no type safety, cannot be summed without conversion | **High** |
| `startDate` stored as `text` — no date validation; "January 5th" is as valid as "2024-01-05" | **Medium** |
| `supervisor` is a free-text string with no referential integrity | **Medium** |
| `employeeNumber` has no uniqueness constraint — duplicates are possible | **Medium** |
| An `employees` record can exist with `userId = null` (no portal access, no clock-in capability) — the system does not warn when this happens | **Medium** |
| No guard against creating an `employees` record for a terminated candidate | **Low** |

### Reporting Risks

| Risk | Severity |
|---|---|
| Labor cost reports use today's `payRate` applied to past hours — not the pay rate at the time of those hours | **High** |
| `time_entries` references `users.id` but `job_assignments` references `employees.id` — joining both for a single employee requires going through `employees.userId` | **High** |
| Employees without a linked `users` account appear in `job_assignments` but have zero time entries — their hours are invisible in reports | **High** |
| MORS budget rates are never synchronized with live HR pay rates | **Medium** |

### Payroll / Wage History Risks

| Risk | Severity |
|---|---|
| No automatic DB trigger ensures a history row is written when `payRate` changes | **High** |
| The hire flow (`executeHireFlow`) does not write the initial offer pay to `employee_pay_history` — history starts empty | **High** |
| `employee_pay_history.oldRate` / `newRate` are `text`, not `numeric` — math requires parsing and can silently fail | **Medium** |
| `approvedBy` is a free-text string, not a FK — no guarantee it matches a real user | **Low** |

### Recommended Fixes for Later

1. Change `payRate`, `employee_pay_history.oldRate/newRate` from `text` to `numeric`
2. Add a `snapshottedPayRate` column to `time_entries` populated at clock-out
3. Add a DB trigger (or middleware hook) to auto-write to `employee_pay_history` on any PATCH that changes `payRate`
4. Write the initial `offerPay` to `employee_pay_history` at hire time in `executeHireFlow`
5. Change `supervisor` from a free-text field to a FK referencing `employees.id`
6. Add `uniqueness` constraint to `employeeNumber`
7. Change `startDate` / `endDate` / `dateOfBirth` to proper `date` type columns
8. Add a `division` foreign key to the `employees` table to align with scheduling
9. Enforce server-side that Managers cannot write `payRate` via the PATCH endpoint
10. Add a bulk employee import pathway (CSV) similar to the Materials Catalog importer

---

## 7. Final Summary

### What Is Working Well

- **Core structure is solid.** The `employees` table has the right shape for an HR system: personal info, employment info, pay info, emergency contacts, and a link to the `users` authentication table.
- **Hiring pipeline to employee conversion is well-built.** The `executeHireFlow` function handles the full lifecycle — creating the employee, the user account, the onboarding checklist, and sending the welcome message — in a single atomic-ish flow.
- **History tables exist.** Both `employee_pay_history` and `employee_history` tables are defined with the right columns. The UI "History" tab surfaces this to HR staff.
- **Role-based access is broadly correct.** The `requireAdmin` / `requireHRAccess` middleware pattern is consistently applied. Customers cannot see any employee data.
- **Sensitive banking fields are masked** (last 4 digits only). Full account or routing numbers are never stored.
- **Employee portal self-service exists.** Crew members can view and update their own limited records without exposing other employees' data.

---

### What Needs Attention Before Alpha Testing

1. **Split identity problem** — `time_entries` uses `users.id` and `job_assignments` uses `employees.id`. Any report that tries to show "hours worked by employee on a job" requires an extra JOIN through `employees.userId`. This should be documented at minimum so reports are written correctly.
2. **Managers can write payRate via the API** — the frontend hides the Pay Rate tab, but there is no server-side block on the `payRate` field in the PATCH endpoint for Managers. This is a real permissions gap.
3. **No initial pay history entry at hire time** — the first pay rate set during hiring is never recorded in `employee_pay_history`, so the history table will be blank for all new hires.
4. **Employees without linked user accounts** — `userId` is nullable. An employee can be scheduled via `job_assignments` but have no ability to clock in. No warning is shown to admins.

---

### What Should Be Fixed Before Beta Testing

1. **Snapshot pay rate in time entries** — add `snapshottedPayRate` to `time_entries`, set at clock-out. Without this, every job cost report will silently be wrong for any employee who has ever received a raise.
2. **Auto-write pay history** — enforce that `employee_pay_history` is written whenever `payRate` changes, ideally at the server/middleware level, not just when the UI calls it manually.
3. **Make payRate numeric** — the current `text` type for `payRate` is a latent data quality issue. Any math performed on it (job costing, QuickBooks export, MORS comparison) requires a string-to-number conversion that can silently fail.
4. **MORS disconnect** — the budget module has its own employee pay rates with no link to HR. A brief reconciliation or manual sync process should exist at minimum, with a warning that MORS rates must be updated manually when raises are given.
5. **Unique constraint on employeeNumber** — currently allows duplicates, which will create ambiguity in any payroll or compliance report.

---

### What Can Wait Until Later

- Changing `startDate`, `endDate`, `dateOfBirth` to proper `date` types (migration required; current data may have inconsistent formats)
- Adding `division` FK to `employees`
- Making `supervisor` a FK to `employees.id` (org chart and notification automation)
- Bulk CSV employee import
- Full audit of which `employee_history` write calls are actually happening throughout the app vs. which field changes have no history entry
- Adding `workEmail` as a separate field from `personalEmail`
- Adding `terminationReason` field
