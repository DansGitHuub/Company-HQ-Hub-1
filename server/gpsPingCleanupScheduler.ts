import { pool } from "./db";
import { log } from "./index";

const RETENTION_DAYS = 90;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day

async function deleteOldGpsPings(): Promise<void> {
  try {
    const result = await pool.query(
      `DELETE FROM gps_pings WHERE recorded_at < NOW() - INTERVAL '${RETENTION_DAYS} days'`
    );
    const deleted = result.rowCount ?? 0;
    if (deleted > 0) {
      log(`GPS ping cleanup: deleted ${deleted} rows older than ${RETENTION_DAYS} days`, "scheduler");
    }
  } catch (err: any) {
    log(`GPS ping cleanup error: ${err.message}`, "scheduler");
  }
}

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startGpsPingCleanupScheduler() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  log("GPS ping cleanup scheduler started (running daily, retaining 90 days)", "scheduler");

  setTimeout(deleteOldGpsPings, 60 * 1000);

  cleanupInterval = setInterval(deleteOldGpsPings, CHECK_INTERVAL_MS);
}

export function stopGpsPingCleanupScheduler() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    log("GPS ping cleanup scheduler stopped", "scheduler");
  }
}
