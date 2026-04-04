import { getTokens, runFullSync } from "./quickbooksSync";

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function startQuickBooksScheduler(): void {
  setInterval(async () => {
    try {
      const tok = await getTokens();
      if (!tok) return; // Not connected — skip silently
      console.log("[QB-Scheduler] Starting scheduled sync…");
      const results = await runFullSync();
      const total = Object.values(results).reduce((sum, r) => sum + (r as any).synced, 0);
      console.log(`[QB-Scheduler] Sync complete — ${total} records synced`);
    } catch (err: any) {
      console.error("[QB-Scheduler] Sync error:", err.message);
    }
  }, INTERVAL_MS);

  console.log("[QB-Scheduler] QuickBooks auto-sync scheduled (every 15 minutes)");
}
