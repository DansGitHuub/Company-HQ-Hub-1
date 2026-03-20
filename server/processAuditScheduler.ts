import { storage } from "./storage";

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

async function runDueSchedules() {
  try {
    const schedules = await storage.getProcessAuditSchedules();
    const now = new Date();

    for (const schedule of schedules) {
      if (!schedule.isEnabled) continue;
      if (!schedule.nextRunAt || new Date(schedule.nextRunAt) > now) continue;

      console.log(`[AuditScheduler] Running scheduled audit for process: ${schedule.processId}`);

      try {
        const proc = await storage.getBusinessProcess(schedule.processId);
        if (!proc) continue;

        const auditResult = await storage.createProcessAuditResult({
          processId: schedule.processId,
          status: "running",
          auditPhase: "researching",
        });

        const runFn = (global as any).__runProcessAudit;
        if (typeof runFn === "function") {
          runFn(schedule.processId, auditResult.id);
        }

        const nextRunAt = computeNextRunAt(schedule.frequency, schedule.customIntervalDays || 7);
        await storage.updateProcessAuditSchedule(schedule.id, {
          lastRunAt: now,
          lastAuditId: auditResult.id,
          nextRunAt,
        });

        console.log(`[AuditScheduler] Triggered audit for "${proc.name}", next run: ${nextRunAt.toISOString()}`);
      } catch (err) {
        console.error(`[AuditScheduler] Failed to trigger audit for schedule ${schedule.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[AuditScheduler] Scheduler error:", err);
  }
}

function computeNextRunAt(frequency: string, customIntervalDays: number): Date {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  switch (frequency) {
    case "daily": return new Date(now + DAY);
    case "weekly": return new Date(now + 7 * DAY);
    case "monthly": return new Date(now + 30 * DAY);
    case "custom": return new Date(now + customIntervalDays * DAY);
    default: return new Date(now + 7 * DAY);
  }
}

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check every hour

export function startProcessAuditScheduler() {
  console.log("[AuditScheduler] Starting process audit scheduler (checking every hour)");
  setTimeout(() => {
    runDueSchedules().catch(err => console.error("[AuditScheduler] Initial run error:", err));
  }, 30000);
  schedulerInterval = setInterval(() => {
    runDueSchedules().catch(err => console.error("[AuditScheduler] Interval error:", err));
  }, CHECK_INTERVAL_MS);
}

export function stopProcessAuditScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[AuditScheduler] Stopped");
  }
}
