---
name: tsc --noEmit OOM on this project
description: Plain `npx tsc --noEmit` crashes on this codebase; how to run a full type-check successfully
---

Running `npx tsc --noEmit` directly on this project OOMs/crashes before finishing (large codebase, many files). It does not reliably report errors or absence of errors.

**Why:** The default Node heap size is too small for a full-project type-check here.

**How to apply:** Always prefix with a larger heap: `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit`. This exits with code 2 due to ~260+ pre-existing unrelated errors elsewhere in the repo (not a clean baseline) — when verifying your own change, grep the output for your specific edited file paths rather than expecting exit code 0.
