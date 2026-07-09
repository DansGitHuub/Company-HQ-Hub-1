---
name: Reusing the schedule-interview endpoint outside the drag-to-column flow
description: How to safely call POST /api/candidates/:id/schedule-interview from a second entry point (e.g. an edit tab) without duplicating side effects or clobbering pipeline stage
---

The Kanban drag-to-"Interview Scheduled" flow and any other UI entry point (e.g. an Interview edit tab) can both call the same `POST /api/candidates/:id/schedule-interview` endpoint to get identical real-world side effects (Zoom meeting, Google Calendar event, candidate email/SMS, HR staff_notifications).

**Why:** Duplicating the scheduling logic in a second code path is how "same logic" requests silently drift out of sync over time. But the endpoint unconditionally set `stage: "Interview Scheduled"`, which is correct for the drag flow (that's literally the column being dropped into) but wrong for an edit tab used on a candidate already further along (e.g. "1st Interview") — it would revert their stage.

**How to apply:**
- The endpoint accepts an optional `preserveStage: boolean` (default false) — pass `true` from any non-drag caller so the stage field is left untouched.
- The endpoint's `type` field only special-cases the literal string `"zoom"` for Zoom meeting creation; anything else just skips Zoom and treats `location` as informational. Any UI reusing this endpoint should restrict its Type dropdown to the same two values the endpoint understands (`zoom` / `in-person`) rather than offering extra options like `phone`/`video` that silently fall through to generic handling.
- To avoid re-firing candidate-facing notifications on every minor edit (e.g. just editing notes), only call the scheduling endpoint when the date/time actually changed from the saved value; otherwise do a plain metadata PATCH with no side effects.
