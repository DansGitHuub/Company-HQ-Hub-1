---
name: WO→job auto-complete pattern
description: How work order task completion rolls up to job status, and how the revert guard works
---

## Rule
When ALL tasks on a work order complete (pct=100): auto-set the linked job's status to `completed` only if it is currently `in_progress`. Stamp `wo_auto_completed_at=NOW()` on the job row at the same time.

When a task is un-checked (pct<100) and the WO previously had `closeout_ready_at` set: revert the job to `in_progress` BUT ONLY if `wo_auto_completed_at IS NOT NULL`. Jobs that a human manually marked complete (wo_auto_completed_at IS NULL) are never touched by the revert.

## Column
`jobs.wo_auto_completed_at TIMESTAMPTZ` — added as a fire-and-forget `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` at the top of `registerWorkOrderRoutes()` in `server/workOrderRoutes.ts`. No schema.ts entry needed (raw SQL pattern).

**Why:** The NULL vs non-NULL distinction on `wo_auto_completed_at` is the only safe way to distinguish "WO auto-completed this job" from "admin manually completed this job" without adding a separate state machine or audit table.

**How to apply:** Any future code that marks a job `completed` via admin action should leave `wo_auto_completed_at` as NULL (or clear it). The WO task-complete handler at `/api/work-orders/:id/areas/:areaId/tasks/:taskId/complete` is the only writer of that column.
