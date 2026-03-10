import { storage } from "./storage";
import { sendMaintenanceReminderEmail } from "./email";
import { log } from "./index";
import { recalculateAllPriorities } from "./priorityEngine";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour
const OVERDUE_ESCALATION_SUBJECT_PREFIX = "OVERDUE: ";

interface ReminderResult {
  scheduleName: string;
  equipmentName: string;
  email: string;
  success: boolean;
  error?: string;
  isOverdue: boolean;
  reminderNumber: number;
}

async function checkAndSendReminders(): Promise<ReminderResult[]> {
  const results: ReminderResult[] = [];

  try {
    const allSchedules = await storage.getMaintenanceSchedules();
    const allEquipment = await storage.getEquipment();
    const now = new Date();

    const activeSchedules = allSchedules.filter(
      (s) => s.isActive && s.reminderEnabled && s.reminderEmail
    );

    for (const schedule of activeSchedules) {
      const equip = allEquipment.find((e) => e.id === schedule.equipmentId);
      if (!equip) continue;

      const recurringDays = schedule.recurringReminderDays || 3;
      let isEligible = false;
      let isOverdue = false;

      if (schedule.nextDueDate) {
        const nextDue = new Date(schedule.nextDueDate);
        const reminderDays = schedule.reminderDays || 7;
        const reminderStartDate = new Date(nextDue);
        reminderStartDate.setDate(reminderStartDate.getDate() - reminderDays);
        isEligible = now >= reminderStartDate;
        isOverdue = now > nextDue;
      } else if (schedule.nextDueMileage && equip.mileage) {
        isEligible = equip.mileage >= schedule.nextDueMileage;
        isOverdue = isEligible;
      } else if (schedule.nextDueHours && equip.hours) {
        isEligible = equip.hours >= schedule.nextDueHours;
        isOverdue = isEligible;
      }

      if (!isEligible) continue;

      const shouldSend = shouldSendReminder(
        schedule.lastReminderSent,
        schedule.reminderCount || 0,
        isOverdue,
        recurringDays,
        now
      );

      if (!shouldSend) continue;

      const newCount = (schedule.reminderCount || 0) + 1;

      try {
        await sendMaintenanceReminderEmail(
          schedule.reminderEmail!,
          equip.name,
          isOverdue
            ? `${OVERDUE_ESCALATION_SUBJECT_PREFIX}${schedule.name}`
            : schedule.name,
          schedule.nextDueDate || undefined,
          schedule.nextDueMileage || undefined,
          schedule.nextDueHours || undefined
        );

        await storage.updateMaintenanceSchedule(schedule.id, {
          lastReminderSent: now,
          reminderCount: newCount,
        });

        results.push({
          scheduleName: schedule.name,
          equipmentName: equip.name,
          email: schedule.reminderEmail!,
          success: true,
          isOverdue,
          reminderNumber: newCount,
        });

        log(
          `Maintenance reminder #${newCount} sent for "${schedule.name}" (${equip.name}) to ${schedule.reminderEmail}${isOverdue ? " [OVERDUE]" : ""}`,
          "scheduler"
        );
      } catch (err: any) {
        results.push({
          scheduleName: schedule.name,
          equipmentName: equip.name,
          email: schedule.reminderEmail!,
          success: false,
          error: err.message,
          isOverdue,
          reminderNumber: newCount,
        });

        log(
          `Failed to send maintenance reminder for "${schedule.name}": ${err.message}`,
          "scheduler"
        );
      }
    }
  } catch (err: any) {
    log(`Maintenance scheduler error: ${err.message}`, "scheduler");
  }

  return results;
}

function shouldSendReminder(
  lastSent: Date | null,
  currentCount: number,
  isOverdue: boolean,
  recurringDays: number,
  now: Date
): boolean {
  if (currentCount === 0) return true;

  if (!lastSent) return true;

  const lastSentDate = new Date(lastSent);
  const daysSinceLastSent = Math.floor(
    (now.getTime() - lastSentDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (isOverdue) {
    return daysSinceLastSent >= recurringDays;
  }

  return daysSinceLastSent >= recurringDays;
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startMaintenanceScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  log("Maintenance reminder scheduler started (checking every hour)", "scheduler");

  setTimeout(async () => {
    try {
      await recalculateAllPriorities();
      log("Priority recalculation complete", "scheduler");
    } catch (err: any) {
      log(`Priority recalculation error: ${err.message}`, "scheduler");
    }
    checkAndSendReminders().then((results) => {
      if (results.length > 0) {
        log(
          `Initial check: sent ${results.filter((r) => r.success).length} reminders, ${results.filter((r) => !r.success).length} failures`,
          "scheduler"
        );
      }
    });
  }, 10000);

  schedulerInterval = setInterval(async () => {
    try {
      await recalculateAllPriorities();
    } catch (err: any) {
      log(`Priority recalculation error: ${err.message}`, "scheduler");
    }
    checkAndSendReminders().then((results) => {
      if (results.length > 0) {
        log(
          `Scheduled check: sent ${results.filter((r) => r.success).length} reminders, ${results.filter((r) => !r.success).length} failures`,
          "scheduler"
        );
      }
    });
  }, CHECK_INTERVAL_MS);
}

export function stopMaintenanceScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    log("Maintenance reminder scheduler stopped", "scheduler");
  }
}

export { checkAndSendReminders };
