---
name: Verify against git log after compression
description: How to avoid re-doing or "re-discovering" work that was already committed earlier in the same session, before a context compression event
---

## The problem
A post-compression progress summary is a lossy digest of the prior conversation. It can omit that a piece of work (e.g. removing a component, deleting a widget) was already implemented and committed earlier in the same session, even though the summary describes the task as still "in investigation." Blindly trusting the summary leads to wasted grep/search cycles hunting for code that no longer exists, or worse, attempting to redo work that's already done.

**Why:** This happened when a task's stated goal ("remove the Low Stock dashboard widget") had already been fully implemented and merged (two commits, same session id) before compression, but the carried-over summary said the widget "was not yet located." Repeated greps for the described field names (`stockQuantity`, `reorderPoint`) correctly found nothing — because the removal already happened, not because the search was wrong.

**How to apply:** When a described feature/bug/file can't be found via grep/search even though the task summary implies it should still exist, check `git log --oneline --all --grep="<keyword>"` (and `git show <commit>` on any hits) before concluding the summary or your search terms are wrong. If a matching commit exists with the same session id, treat that part of the task as already done and move on to verifying/extending it rather than re-implementing it.
