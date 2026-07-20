# i18n Coverage Report
_Generated: 2026-07-20 00:44:57_

## Overall Summary

| Metric | Value |
|---|---|
| TSX files scanned | 274 |
| Files with `useTranslation` | 58 / 274 (21%) |
| Files with NO translation | 216 |
| Detected t() calls (translated) | 1652 |
| Detected hardcoded lines (untranslated) | 4038 |
| Approx string-level coverage | **29%** |
| en.json flat keys | 2295 |
| es.json keys with value | 2295 |
| en keys missing/blank in es | 0 |
| t("key") in code missing from en.json | 12 |

## Directory Breakdown (worst first)

| Directory | Translated | Total Files | ░░░░░░░░░░░░░░░░░░░░ Coverage | Hardcoded Lines |
|---|---|---|---|---|
| `components/ui` | 0 | 57 | ░░░░░░░░░░░░░░░░░░░░ 0% | 315 |
| `tools/property-report-card` | 0 | 14 | ░░░░░░░░░░░░░░░░░░░░ 0% | 55 |
| `pages/catalog` | 0 | 3 | ░░░░░░░░░░░░░░░░░░░░ 0% | 53 |
| `components/forms` | 0 | 14 | ░░░░░░░░░░░░░░░░░░░░ 0% | 49 |
| `components/admin` | 0 | 2 | ░░░░░░░░░░░░░░░░░░░░ 0% | 41 |
| `pages/maintenance-routes` | 0 | 1 | ░░░░░░░░░░░░░░░░░░░░ 0% | 32 |
| `pages/Route` | 0 | 1 | ░░░░░░░░░░░░░░░░░░░░ 0% | 22 |
| `components/calculator` | 0 | 1 | ░░░░░░░░░░░░░░░░░░░░ 0% | 4 |
| `components/csv-import` | 0 | 1 | ░░░░░░░░░░░░░░░░░░░░ 0% | 2 |
| `(root)` | 0 | 2 | ░░░░░░░░░░░░░░░░░░░░ 0% | 1 |
| `hooks` | 0 | 3 | ░░░░░░░░░░░░░░░░░░░░ 0% | 1 |
| `lib` | 0 | 1 | ░░░░░░░░░░░░░░░░░░░░ 0% | 0 |
| `pages/admin` | 2 | 29 | █░░░░░░░░░░░░░░░░░░░ 7% | 434 |
| `components` | 3 | 43 | █░░░░░░░░░░░░░░░░░░░ 7% | 537 |
| `pages/jobs` | 3 | 13 | █████░░░░░░░░░░░░░░░ 23% | 215 |
| `pages` | 34 | 71 | ██████████░░░░░░░░░░ 48% | 2033 |
| `components/layout` | 1 | 2 | ██████████░░░░░░░░░░ 50% | 91 |
| `components/dashboard` | 1 | 2 | ██████████░░░░░░░░░░ 50% | 40 |
| `pages/my-day` | 1 | 1 | ████████████████████ 100% | 43 |
| `pages/customers` | 3 | 3 | ████████████████████ 100% | 41 |
| `pages/estimates` | 4 | 4 | ████████████████████ 100% | 18 |
| `pages/invoices` | 3 | 3 | ████████████████████ 100% | 8 |
| `pages/scheduling` | 1 | 1 | ████████████████████ 100% | 2 |
| `pages/time` | 1 | 1 | ████████████████████ 100% | 1 |
| `pages/my-hours` | 1 | 1 | ████████████████████ 100% | 0 |

## Top 20 Most Untranslated Files (by hardcoded line count)

| File | Hardcoded Lines | Has t()? |
|---|---|---|
| `client/src/pages/AdminPanel.tsx` | 199 | ✓ |
| `client/src/pages/Forms.tsx` | 182 | ✓ |
| `client/src/components/SOPBuilder.tsx` | 135 | ✗ |
| `client/src/pages/Hiring.tsx` | 120 | ✓ |
| `client/src/pages/SOPs.tsx` | 98 | ✓ |
| `client/src/pages/WorkOrders.tsx` | 98 | ✗ |
| `client/src/pages/Settings.tsx` | 70 | ✓ |
| `client/src/pages/PlowSiteMapper.tsx` | 69 | ✓ |
| `client/src/pages/ProcessAuditor.tsx` | 65 | ✗ |
| `client/src/pages/Employees.tsx` | 58 | ✓ |
| `client/src/components/layout/AppShell.tsx` | 57 | ✓ |
| `client/src/pages/Consultations.tsx` | 56 | ✗ |
| `client/src/pages/Calculator.tsx` | 53 | ✓ |
| `client/src/pages/PublicApplicationForm.tsx` | 50 | ✗ |
| `client/src/pages/Education.tsx` | 49 | ✓ |
| `client/src/pages/EquipmentTracker.tsx` | 49 | ✓ |
| `client/src/components/SOPPipeline.tsx` | 48 | ✗ |
| `client/src/pages/IntegrationWizard.tsx` | 48 | ✓ |
| `client/src/pages/CustomerBlasts.tsx` | 47 | ✗ |
| `client/src/pages/admin/WorksheetReview.tsx` | 45 | ✗ |

## en.json Keys Missing in es.json

✅ None — Spanish file is structurally complete.

## t("key") in Code With No Matching en.json Entry (12)

- `common.passwordsDontMatch`
- `dashboard.widgets.messages.unreadCount`
- `dashboard.widgets.tasks.totalTasksCount`
- `dashboard.widgets.tasks.overdueCount`
- `dashboard.widgets.tasks.activeCount`
- `dashboard.widgets.tasks.inProgressCount`
- `dashboard.widgets.tasks.dueTodayCount`
- `dashboard.widgets.pipeline.jobsCount`
- `dashboard.widgets.estimates.estimatesCount`
- `dashboard.widgets.notes.notesCount`
- `dashboard.widgets.notes.pinnedCount`
- `dashboard.widgets.notes.reminderCount`

---
_Methodology: "hardcoded lines" = lines in .tsx files matching high-confidence_
_JSX-text / user-facing-attribute patterns, minus lines already using t(), CSS_
_classes, comments, imports, and other non-user-facing patterns._
_"File coverage" = share of .tsx files that import useTranslation from react-i18next._