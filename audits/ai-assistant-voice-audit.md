# AI Assistant & Voice System — Security & Capability Audit

**Date:** June 22, 2026  
**Scope:** `server/assistantRoutes.ts`, `server/assistantTools.ts`, `server/assistantMigration.ts`, `server/replit_integrations/chat/routes.ts`, `client/src/components/AIAssistantPanel.tsx`, `client/src/components/FloatingChatPopup.tsx`, `client/src/pages/Assistant.tsx`, `client/src/hooks/use-voice.tsx`, `client/src/components/ConversationLogViewer.tsx`  
**Inspector:** Agent (read-only, no code changed)

---

## Executive Summary

The platform contains **two entirely separate AI chat systems** running simultaneously. The primary system (the floating panel) is well-architected with RBAC, tool-calling, confirmation flows, and admin audit logs. The secondary system (the full-page `/assistant` route and `FloatingChatPopup`) is a legacy Replit integration with no tools, no audit log, and weaker guardrails. Several data-exposure gaps exist in the primary system's read tools that would allow Crew, HR, or Customer roles to query data they should not see. These must be fixed before alpha.

---

## 1. Capability Classification Legend

| Tag | Meaning |
|---|---|
| ✅ Working | Implemented and functional |
| ⚠️ Partially working | Implemented but has gaps |
| ❌ Not built | Capability does not exist |
| 🔴 Unsafe | Security or data-exposure risk |
| 🗑️ Should be removed | Legacy/duplicate, creates confusion |
| 🔒 Should require confirmation | Write action executes without user approval |
| 👑 Should be Admin-only | Accessible to wrong roles |
| 🧑‍💼 Should be Manager/Admin-only | Accessible to wrong roles |
| 👷 Safe for Crew | Low-risk, appropriate access |
| 👤 Safe for Customer | Customer-appropriate capability |

---

## 2. Duplicate AI Systems

There are **two independent AI chat systems** registered on the same Express app:

| | **System A — Main Assistant** | **System B — Legacy Chat** |
|---|---|---|
| Routes | `/api/assistant/*` | `/api/conversations/*` |
| Backend file | `server/assistantRoutes.ts` | `server/replit_integrations/chat/routes.ts` |
| Frontend | `AIAssistantPanel.tsx` (floating panel) | `Assistant.tsx` (page) + `FloatingChatPopup.tsx` |
| Model | GPT-4o, non-streaming | GPT-4o/GPT-3.5, streaming |
| Tool-calling | ✅ 19 tools with confirmation flow | ❌ No tools |
| RBAC | ✅ Role-based system prompts + tool filtering | ⚠️ Role-based system prompts only |
| Admin audit log | ✅ Full log in `assistant_conversations` | ❌ None — stored in `chat_messages` only |
| Voice | ✅ Full voice input/output | ❌ None |
| DB tables | `assistant_conversations`, `assistant_agents` | `chat_conversations`, `chat_messages` |

**Classification:** 🗑️ **System B should be removed.** It duplicates System A with weaker security, no audit trail, and no tool access. Users accessing `/assistant` get a different (inferior) experience than the floating panel. The `FloatingChatPopup` component appears to not be rendered anywhere in the main app shell, but it is importable and could be accidentally added.

---

## 3. Database Tables the AI Can Read Today

### System A (Main Assistant)

| Table | Tool(s) That Read It | Role Filter Applied? |
|---|---|---|
| `tasks` | `searchTasks`, `getDailyBriefing`, `getAppContext` | ⚠️ Daily briefing: user-scoped. `searchTasks`: **no ownership filter** |
| `equipment` | `searchEquipment`, `getDailyBriefing` | ⚠️ No filter — all assets visible to any internal role |
| `maintenance_schedules` | `searchEquipment`, `getDailyBriefing` | ⚠️ No filter — all maintenance records visible |
| `users` | `searchEmployees`, `sendInternalMessage` | ✅ Excludes `Customer` role, active only |
| `sops` | `searchSOPs`, `searchGlobal` | ⚠️ No filter — all SOPs visible to any internal role |
| `customer_messages` | `getMessages`, `sendInternalMessage` | ✅ User-scoped (sender or recipient) |
| `calendar_events` | `getCalendarEvents` | ✅ User-scoped (created_by, assigned_to, or company-wide) |
| `jobs` | `getJobs` | 🔴 **No filter — ALL jobs returned to any internal role** |
| `notes` | `getNotes`, `createNote` | ✅ User-scoped |
| `plant_cards` | `searchPlantCards` | ✅ No sensitive data |
| `assistant_agents` | `getAgentContext` (every request) | ✅ Role-filtered |
| `assistant_conversations` | `history` endpoint | ✅ User-scoped (admin sees all) |

### System B (Legacy Chat)

| Table | Read by |
|---|---|
| `chat_conversations` | All messages in a conversation — user-scoped by ownership check |
| `chat_messages` | All messages in a conversation the user owns |

---

## 4. App Modules the AI Can Query

| Module | System A Can Query | Notes |
|---|---|---|
| Jobs | ✅ `getJobs` | 🔴 No role/ownership filter |
| Tasks | ✅ `searchTasks` | 🔴 No ownership filter for non-admin |
| Employees | ✅ `searchEmployees` | ✅ Safe (no sensitive HR fields) |
| Equipment / Fleet | ✅ `searchEquipment` | ⚠️ All assets, all roles |
| SOPs | ✅ `searchSOPs` | ⚠️ All SOPs, all roles |
| Messages (DM) | ✅ `getMessages` | ✅ User-scoped |
| Calendar | ✅ `getCalendarEvents` | ✅ User-scoped |
| Notes | ✅ `getNotes` | ✅ User-scoped |
| Plant Library | ✅ `searchPlantCards` | ✅ Read-safe |
| Customers | ❌ Not queryable | No tool to look up customer records |
| Properties | ❌ Not queryable | — |
| Estimates | ❌ Not queryable | Not built |
| Time Entries | ❌ Not queryable | Not built |
| Worksheets | ❌ Not queryable | Not built |
| Materials / Catalog | ❌ Not queryable | Not built |
| Warranties | ❌ Not queryable | Not built |
| Reports | ❌ Not queryable | Not built |
| Hiring / HR | ❌ Not queryable | Not built |
| Invoices | ❌ Not queryable | Not built |

---

## 5. Does the AI Respect the Logged-In User's Role?

**Partially — with gaps.** ⚠️

**What is working:**
- `requireInternalRole` middleware blocks all `/api/assistant/*` endpoints if the user is not authenticated or their role is unrecognized.
- `buildSystemPrompt` injects role-specific behavioral rules (Admin, Manager, HR, Sales, Crew Lead, Crew, New Hire, Customer each get distinct instructions).
- Customers get only 3 tools: `navigateTo`, `searchGlobal`, `submitRepairRequest`.
- `checkPermission()` is called at the top of `executeTool()` for every tool before any DB operation. Write tools are blocked for Customers.
- Agent-level tool filtering: `assistant_agents` rows can restrict which tools are available for specific roles.

**What is NOT working (gaps):**

| Gap | Details |
|---|---|
| `getJobs` — no RBAC | Returns ALL jobs to any internal role. A Crew member can ask "show me all jobs" and get the entire pipeline including client names, values, and stages they are not assigned to. |
| `searchTasks` — no RBAC | Returns ALL tasks matching a filter. A Crew member can query `searchTasks` with no `assignedTo` filter and see every task in the system. |
| `getDailyBriefing` equipment section — no RBAC | The briefing returns all overdue maintenance alerts to every role, including HR and Sales. Only `getAppContext` (the system-prompt badge) correctly scopes P1 alerts to Admin/Manager. |
| `searchGlobal` accessible to Customers | `CUSTOMER_TOOLS` includes `searchGlobal`, which queries tasks (titles), equipment (names/make/model), employees (id/name/username/role), and SOP titles. A Customer asking "search for maintenance" would receive internal employee directory and task data, relying solely on the system prompt to suppress it before it reaches the user — not a hard data boundary. |
| `submitRepairRequest` in `CUSTOMER_TOOLS` but blocked by `checkPermission` | The tool appears available to Customers in their tool list; GPT-4o may attempt it, but `checkPermission` will deny it with an error. Confusing UX and wastes tokens. |

---

## 6. Are Permissions Checked BEFORE Data Is Sent to the AI?

**Partially.** ⚠️

- The **system prompt** is role-gated (layer 2 of `buildSystemPrompt`). Role capabilities and behavioral rules are injected before the first token is generated.
- The **app context** (overdue tasks, P1 alerts) is pre-filtered by role in `getAppContext` before it appears in the system prompt.
- **Tool data is NOT pre-filtered** — when a tool like `getJobs` or `searchTasks` executes, it returns raw DB results to OpenAI without checking whether the user's role is permitted to see that data. The system prompt instructs the AI not to reveal certain things, but the underlying data is in the model's context window.

**Risk:** Prompt injection or a sufficiently crafted message could trick the AI into revealing data it was instructed to hide, because the data has already been delivered to the model.

---

## 7. Are Permissions Checked AGAIN Before Any Action Is Executed?

**Yes — for all write actions.** ✅

`executeTool()` calls `checkPermission(user, toolName)` as its **first statement**, before any DB query. If denied, a `{result: null, error: reason}` is returned and nothing is written. This is the correct pattern.

**Gaps in write-action permission checks:**

| Issue | Details |
|---|---|
| `updateTaskStatus` — no ownership check | Any authenticated internal user can call `updateTaskStatus` with any task UUID and change its status (except completed/cancelled, which require confirmation). A Crew member could change the status of a task assigned to someone else. |
| Confirmation token stored in memory | `pendingConfirmations` is an in-process `Map`. A server restart clears all pending tokens. Not a security issue but a UX one — a restart mid-confirmation would silently fail. |
| Confirmation token bound to `user.id` | ✅ The token is user-bound. A different user's session cannot consume another user's token. |

---

## 8. What Actions Can the AI Perform?

### Read-only tools (no confirmation required)

| Tool | Description | Classification |
|---|---|---|
| `navigateTo` | Route browser to a module | ✅ Safe for Crew, 👤 Safe for Customer |
| `openRecord` | Deep-link to a specific record | ✅ Safe for Crew |
| `searchGlobal` | Full-text across tasks/equipment/employees/SOPs | 🔴 Unsafe for Customer (exposes internal data) |
| `searchEquipment` | Equipment list with maintenance status | 🧑‍💼 Should be Manager/Admin-only or scoped |
| `searchTasks` | Task list — all tasks, no ownership filter | 🔴 Unsafe (no ownership filter) |
| `searchEmployees` | Employee directory (name/role/email) | ⚠️ Partially working — Crew shouldn't get emails |
| `searchSOPs` | SOP title/category search | ✅ Safe for Crew |
| `getDailyBriefing` | Overdue tasks, due today, equipment alerts | ⚠️ Equipment section not role-filtered |
| `getMessages` | Inbox — user's own messages | ✅ Working, user-scoped |
| `getCalendarEvents` | Calendar — user's events | ✅ Working, user-scoped |
| `getJobs` | Jobs pipeline — ALL jobs | 🔴 Unsafe (no role/assignment filter) |
| `getNotes` | Personal notepad | ✅ Working, user-scoped |
| `searchPlantCards` | Plant library lookup | ✅ Working |
| `lookupVIN` | NHTSA VIN decode (external API) | ✅ Safe |

### Write tools (all require user confirmation)

| Tool | DB Write | Confirmation? | Classification |
|---|---|---|---|
| `createTask` | INSERT into `tasks` + `task_history` | ✅ Always confirmed | ✅ Working; role-assignment matrix enforced |
| `updateTaskStatus` | UPDATE `tasks` | ⚠️ Only for completed/cancelled | 🔒 in_progress/on_hold should also confirm; missing ownership check |
| `sendInternalMessage` | INSERT into `customer_messages` | ✅ Always confirmed | ✅ Working; Customer blocked by checkPermission |
| `createEquipment` | INSERT into `equipment` | ✅ Always confirmed | 🧑‍💼 Admin/Manager only ✅ |
| `logEquipmentService` | INSERT into `maintenance_logs` | ✅ Always confirmed | ✅ Admin/Manager/Crew Lead/Crew |
| `updateEquipmentHours` | UPDATE `equipment` | ✅ Always confirmed | ✅ Admin/Manager/Crew Lead/Crew |
| `submitRepairRequest` | INSERT into `repair_requests` | ✅ Always confirmed | ✅ Admin/Manager/Crew — Customers blocked |
| `createNote` | INSERT into `notes` | ✅ Always confirmed | ✅ User's own notes only |
| `createPlantCard` | INSERT into `plant_cards` via OpenAI JSON | ✅ Always confirmed | 👑 Admin-only ✅; but uses wrong model name (`gpt-5-mini` — does not exist, should be `gpt-4o-mini`) |

---

## 9. Voice System — Capability & Review

### Voice Input (Speech → Text)

Two separate mechanisms exist simultaneously:

| Mechanism | Where | How | Transcript stored? | User can review before sending? |
|---|---|---|---|---|
| Browser Web Speech API | `use-voice.tsx` `startListening()` | Calls `window.SpeechRecognition`, fires callback when speech ends | ❌ Never stored | ⚠️ Auto-submits in GlobalMicButton flow — no review |
| OpenAI Whisper | `AIAssistantPanel.tsx` mic button + `/api/assistant/transcribe` | Audio recorded as WebM blob, base64-encoded, sent to Whisper | ❌ Transcript not stored — only the final message in `assistant_conversations` | ✅ Transcript populates input field; user presses Enter to send |

**Classification:** ⚠️ Partially working.

- The Whisper path is well-designed (45-second hard cap, silence detection, audio size limit at 25 MB, user review before send).
- The Web Speech API path (used when `voice.settings.voiceEnabled = true`) auto-submits immediately without review. A misrecognition fires an action without the user seeing what was sent.
- Neither path stores the raw transcript separately. If an AI action is disputed, there is no way to replay exactly what was spoken vs. what was understood.

### Voice Output (Text → Speech)

| Route | Auth check | Role check | Notes |
|---|---|---|---|
| `POST /api/ai/speak` | ✅ `requireAuth` | ⚠️ No `requireInternalRole` | Any authenticated user (including Customer) can call TTS. Voice selection is validated against allowlist (`alloy/echo/fable/onyx/nova/shimmer`). Text truncated at 500 chars. |

**Classification:** ✅ Working, ⚠️ accessible to Customers (minor — TTS itself is not harmful).

---

## 10. AI Action & Denial Logging — Can an Admin Review AI Usage?

### System A (Main Assistant) — ✅ Full audit log

Every interaction is logged to `assistant_conversations`:

| Field | Content |
|---|---|
| `user_id` | Who sent the message |
| `session_id` | Groups messages into a session |
| `role` | `user` or `assistant` |
| `content` | Full message text |
| `tool_called` | Name of tool if AI called one |
| `tool_args` | Arguments passed to the tool (JSONB) |
| `tool_result` | Result returned by the tool (JSONB) |
| `tokens_used` | Token count per response |
| `created_at` | Timestamp |

Logged events include:
- Every user message
- Every assistant response
- Every tool call with args and result
- Confirmations (`[Confirmed] toolName`)
- Cancellations (`[Cancelled]`)
- Permission-denied errors (logged as error response in assistant turn)

**Admin UI:** `ConversationLogViewer.tsx` (accessible under AI & Tools admin section). Provides:
- Usage dashboard: messages and tokens today / 7 days / 30 days with estimated cost
- Session list: filterable by user, date range, tool called
- Full session thread drilldown
- All routes require `requireAdmin` middleware

**Classification:** ✅ Working.

### System B (Legacy Chat) — ❌ No admin audit

Legacy `chat_messages` are stored per user, but there is no admin viewer, no tool-call log, and no way to review what any user asked the legacy AI. An Admin has no visibility into System B usage.

**Classification:** 🔴 Unsafe (no oversight). Reinforces the need to remove System B.

---

## 11. Data Exposure Risks

### Risk 1 — `getJobs`: All jobs visible to all internal roles 🔴

```
getJobs → SELECT id, client, type, category, stage, value, scheduled_date, ... FROM jobs WHERE 1=1
```

No `WHERE` clause filters by user or role. A Crew member asking "show me jobs in the Sold stage" gets the full list including client names, job values, and pipeline stages. This is financial and operational data that Crew should not see.

**Required fix:** Filter by `assigned_crew` or role. At minimum, Crew/New Hire should only see jobs they are assigned to. HR/Sales should see estimates but not completed job values. Admin/Manager see all.

### Risk 2 — `searchTasks`: All tasks visible to all roles 🔴

```
searchTasks → SELECT ... FROM tasks WHERE 1=1 [optional filters]
```

No ownership filter when `assignedTo` is not provided. A Crew member can call `searchTasks` with `status: "in_progress"` and see every in-progress task across the entire company.

**Required fix:** For Crew/New Hire, add `AND (assigned_to_user_id = $user OR created_by_user_id = $user)`. Manager sees their department. Admin/Master Admin see all.

### Risk 3 — `searchGlobal` exposed to Customers 🔴

`CUSTOMER_TOOLS = ["navigateTo", "searchGlobal", "submitRepairRequest"]`

When a Customer uses `searchGlobal`, the query returns:
- `tasks`: task IDs, titles, status, priority (ALL internal tasks)
- `equipment`: asset IDs, make, model, status (entire fleet)
- `users`: employee IDs, **names, usernames, roles** (entire staff directory)
- `sops`: SOP titles and categories (entire procedure library)

The system prompt instructs the AI not to reveal this, but the data is already in GPT-4o's context. A prompt like "list everything you found in your search results" could expose it.

**Required fix:** Either remove `searchGlobal` from `CUSTOMER_TOOLS` entirely, or create a customer-safe variant that only searches customer-facing content (Resource Library, job status, etc.).

### Risk 4 — `updateTaskStatus`: No ownership check 🔴

Any authenticated internal user can call `updateTaskStatus` with any task UUID and change its status. A disgruntled Crew member could mark another crew member's tasks as cancelled.

**Required fix:** Before executing, verify `task.assigned_to_user_id = user.id OR task.created_by_user_id = user.id OR user.role IN ("Admin", "Master Admin", "Manager")`.

### Risk 5 — `getDailyBriefing` equipment alerts: No role filter ⚠️

The briefing returns all overdue maintenance alerts from `maintenance_schedules` to any role. HR staff asking "what needs attention today?" would receive equipment maintenance data they have no business context for.

**Required fix:** Wrap the equipment query in the same role check used in `getAppContext`: only include for Admin/Master Admin/Manager.

### Risk 6 — `submitRepairRequest` in `CUSTOMER_TOOLS` but blocked by `checkPermission` ⚠️

`CUSTOMER_TOOLS` includes `submitRepairRequest`, but `checkPermission` blocks it for Customer role (requires Crew, Crew Lead, Manager, Admin, or Master Admin). When a Customer asks to report a repair, GPT-4o will attempt `submitRepairRequest`, get an error, and have to re-answer awkwardly.

**Required fix:** Either remove `submitRepairRequest` from `CUSTOMER_TOOLS` and handle repair requests a different way for customers, or add a customer-specific path with separate confirmation.

### Risk 7 — `createPlantCard` uses non-existent model name ⚠️

```typescript
model: "gpt-5-mini"
```

This model name does not exist. The API call will fail at runtime when an Admin tries to create a plant card via the assistant. Should be `gpt-4o-mini`.

### Risk 8 — Voice auto-submit bypasses user review 🔒

When `voice.settings.voiceEnabled = true`, the `startListening` callback in `AIAssistantPanel.tsx` auto-submits the transcript without the user seeing or confirming what was transcribed. If the speech was misrecognized, a task could be created or a message sent without the user's knowledge (pending the confirmation dialog for confirmed actions).

**Required fix:** Always populate the input field and require the user to press Send, even in voice-enabled mode. Never auto-submit to the chat API from a voice callback.

---

## 12. What Must Be Fixed Before Alpha Testing

### Critical (data exposure / security)

| # | Issue | Files Affected |
|---|---|---|
| C1 | `getJobs` returns all jobs to all roles — add role/assignment filter | `server/assistantTools.ts` |
| C2 | `searchTasks` has no ownership filter — scope to user for Crew/New Hire | `server/assistantTools.ts` |
| C3 | `updateTaskStatus` has no ownership check — any user can update any task | `server/assistantTools.ts` |
| C4 | `searchGlobal` exposes employees/tasks/equipment/SOPs to Customers | `server/assistantTools.ts`, `server/assistantRoutes.ts` |

### High (RBAC/logic)

| # | Issue | Files Affected |
|---|---|---|
| H1 | `getDailyBriefing` equipment section not role-filtered | `server/assistantTools.ts` |
| H2 | `submitRepairRequest` in `CUSTOMER_TOOLS` but blocked by `checkPermission` — confusing UX | `server/assistantRoutes.ts` |
| H3 | Voice auto-submit bypasses user review for confirmed messages | `client/src/components/AIAssistantPanel.tsx` |
| H4 | `createPlantCard` uses `"gpt-5-mini"` — does not exist, will 500 at runtime | `server/assistantTools.ts` |

### Medium (audit/observability)

| # | Issue | Files Affected |
|---|---|---|
| M1 | System B (legacy chat at `/api/conversations`) has no admin audit log | `server/replit_integrations/chat/routes.ts` |
| M2 | Voice transcripts are not logged — no audit trail for voice interactions | `server/assistantRoutes.ts` |
| M3 | `pendingConfirmations` is in-memory — lost on server restart | `server/assistantRoutes.ts` |

### Low (cleanup)

| # | Issue | Files Affected |
|---|---|---|
| L1 | System B (`FloatingChatPopup.tsx`, `Assistant.tsx`, `/api/conversations/*`) is a duplicate — should be removed or clearly deprecated | Multiple |
| L2 | `updateTaskStatus` without confirmation for `in_progress`/`on_hold`/`acknowledged` states is inconsistent with the "always confirm write actions" rule | `server/assistantTools.ts` |
| L3 | `searchEmployees` returns employee email addresses — Crew should not receive colleague emails | `server/assistantTools.ts` |

---

## 13. Per-Capability Classification Summary

| Capability | Classification |
|---|---|
| **AI chat (floating panel, System A)** | ✅ Working |
| **AI chat (legacy page + popup, System B)** | 🗑️ Should be removed |
| **Role-based system prompt** | ✅ Working |
| **Customer tool restriction** | ⚠️ Partially working (searchGlobal still exposes internal data) |
| **`navigateTo` / `openRecord`** | ✅ Working, 👤 Safe for Customer |
| **`searchGlobal`** | 🔴 Unsafe for Customer |
| **`searchEquipment`** | ⚠️ Partially working — 🧑‍💼 Should be Manager/Admin-only or scoped |
| **`searchTasks`** | 🔴 Unsafe (no ownership filter) |
| **`searchEmployees`** | ⚠️ Partially working (exposes emails to all roles) |
| **`searchSOPs`** | ✅ Working, 👷 Safe for Crew |
| **`getDailyBriefing`** | ⚠️ Partially working (equipment section not role-filtered) |
| **`getMessages`** | ✅ Working, ✅ user-scoped |
| **`getCalendarEvents`** | ✅ Working, ✅ user-scoped |
| **`getJobs`** | 🔴 Unsafe (no role filter — all jobs visible to all) |
| **`getNotes`** | ✅ Working, ✅ user-scoped, 👷 Safe for Crew |
| **`searchPlantCards`** | ✅ Working, 👷 Safe for Crew, 👤 Safe for Customer |
| **`lookupVIN`** | ✅ Working, 👷 Safe for Crew |
| **`createTask`** | ✅ Working, 🔒 Should require confirmation ✅ (already does) |
| **`updateTaskStatus`** | 🔴 Unsafe (no ownership check); 🔒 partial confirmation (missing for non-terminal states) |
| **`sendInternalMessage`** | ✅ Working, 🔒 Should require confirmation ✅ (already does) |
| **`createEquipment`** | ✅ Working, 🧑‍💼 Manager/Admin-only ✅ |
| **`logEquipmentService`** | ✅ Working, 🔒 Should require confirmation ✅ (already does), 👷 Safe for Crew |
| **`updateEquipmentHours`** | ✅ Working, 🔒 Should require confirmation ✅ (already does) |
| **`submitRepairRequest`** | ⚠️ Partially working (Customer tool list mismatch), 👷 Safe for Crew |
| **`createNote`** | ✅ Working, 🔒 Should require confirmation ✅ (already does), 👷 Safe for Crew |
| **`createPlantCard`** | ❌ Not built (wrong model name, will fail), 👑 Should be Admin-only ✅ |
| **Voice input (Whisper path)** | ✅ Working, ⚠️ transcript not stored for audit |
| **Voice input (Web Speech path)** | ⚠️ Partially working — 🔒 auto-submits without user review |
| **Voice output (TTS)** | ✅ Working, accessible to all authenticated roles including Customers |
| **Admin audit log (System A)** | ✅ Working — full log with sessions, tool calls, usage stats |
| **Admin audit log (System B)** | ❌ Not built |
| **AI agent configuration** | ✅ Working, 👑 Admin-only ✅ |
| **Confirmation flow** | ✅ Working — user-bound tokens, 5-minute TTL |

---

## 14. What Should Require Confirmation vs. Be Blocked

### Must always confirm (before alpha add)
- `updateTaskStatus` to any status, not just terminal ones — a status change is a business record change

### Should be blocked entirely (for the listed roles)
- `getJobs` → Crew, New Hire (should only see their assigned jobs)
- `searchTasks` without ownership filter → Crew, New Hire
- `searchGlobal` → Customer (or replace with customer-safe variant)
- `submitRepairRequest` → Customer (remove from `CUSTOMER_TOOLS`)
- `updateTaskStatus` on tasks they didn't create or weren't assigned to → Crew, New Hire

### Should be Admin-only
- `createPlantCard` ✅ (already enforced, but model name must be fixed)
- Viewing other users' AI conversation logs ✅ (already enforced)

### Safe without confirmation (current behavior is fine)
- All search/read tools
- `navigateTo`, `openRecord`
- `lookupVIN`

---

*End of audit. No code was modified during this inspection.*
