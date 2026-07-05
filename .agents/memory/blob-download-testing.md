---
name: Testing client-side Blob CSV/file downloads
description: How to verify content of a client-side Blob download (e.g. CSV export) in an e2e test when the test runner can't read downloaded files directly.
---

When a feature downloads a file entirely client-side (Blob + `URL.createObjectURL` + temporary `<a download>` + `.click()`, no server round-trip), Playwright's `download.text()`/`download.path()` may be unavailable in this environment's test runner.

**Workaround:** instruct the test to inject JS into the page before clicking the trigger button that monkey-patches `HTMLAnchorElement.prototype.click` to detect `blob:` hrefs, `fetch()` the blob URL (same-origin, works from page JS), and `console.log()` the text wrapped in unique start/end markers. The test can then read the captured browser console output to assert exact header/row content.

**Why:** confirmed working after `download.text()`/`download.path()` both failed with "not a function" / path errors in this sandboxed test runner.

**How to apply:** any time you add a client-side-generated file download (CSV export, generated report, etc.) and need e2e content verification, use this console-marker interception technique instead of relying on Playwright's native download APIs.
