import { getTokens, getValidToken, runFullSync } from "./quickbooksSync";

const SYNC_INTERVAL_MS         = 15 * 60 * 1000; // 15 minutes
const TOKEN_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function startQuickBooksScheduler(): void {
  setInterval(async () => {
    try {
      const tok = await getTokens();
      if (!tok) return; // Not connected — skip silently
      if (tok?.needs_reauth) { console.log('[QB-Scheduler] Skipping refresh — needs_reauth=true; user must reauthorize at /admin?tab=quickbooks'); return; }
      console.log("[QB-Scheduler] Starting scheduled sync…");
      const results = await runFullSync();
      const total = Object.values(results).reduce((sum, r) => sum + (r as any).synced, 0);
      console.log(`[QB-Scheduler] Sync complete — ${total} records synced`);
    } catch (err: any) {
      console.error("[QB-Scheduler] Sync error:", err.message);
    }
  }, SYNC_INTERVAL_MS);

  // Proactive token refresh — runs every 30 minutes regardless of whether a
  // sync is needed.  This guarantees the refresh_token rotates well within
  // Intuit's 100-day expiry so the connection never silently drops due to
  // an un-rotated token when sync traffic is low.
  setInterval(async () => {
    try {
      const tok = await getTokens();
      if (!tok) return; // Not connected — skip silently
      if (tok?.needs_reauth) { console.log('[QB-Scheduler] Skipping refresh — needs_reauth=true; user must reauthorize at /admin?tab=quickbooks'); return; }
      await getValidToken();
      console.log("[QB-Token] Refresh cycle complete");
    } catch (err: any) {
      console.error("[QB-Token] Proactive refresh error:", err.message);
    }
  }, TOKEN_REFRESH_INTERVAL_MS);

  console.log("[QB-Scheduler] QuickBooks auto-sync scheduled (every 15 minutes)");
  console.log("[QB-Scheduler] QuickBooks token refresh scheduled (every 30 minutes)");
}
