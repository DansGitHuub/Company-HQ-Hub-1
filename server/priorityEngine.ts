import { db } from "./db";
import { equipment, maintenanceSchedules } from "@shared/schema";
import { eq } from "drizzle-orm";

export type Priority = "p1" | "p2" | "p3" | "p4";

export function calculatePriority(
  schedule: {
    hoursInterval: number | null;
    calendarIntervalDays: number | null;
    lastServiceHours: number | null;
    lastServiceDate: Date | null;
    nextDueHours: number | null;
    nextDueDate: Date | null;
  },
  currentHours: number | null
): Priority {
  const now = new Date();
  let hoursPriority: Priority = "p4";
  let calendarPriority: Priority = "p4";

  if (schedule.hoursInterval && schedule.nextDueHours != null && currentHours != null) {
    const remaining = schedule.nextDueHours - currentHours;
    const threshold10 = schedule.hoursInterval * 0.1;
    if (remaining < 0) hoursPriority = "p1";
    else if (remaining === 0) hoursPriority = "p2";
    else if (remaining <= threshold10) hoursPriority = "p3";
  }

  if (schedule.nextDueDate) {
    const dueDate = new Date(schedule.nextDueDate);
    const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilDue < 0) calendarPriority = "p1";
    else if (daysUntilDue <= 7) calendarPriority = "p2";
    else if (daysUntilDue <= 14) calendarPriority = "p3";
  }

  const priorities: Priority[] = [hoursPriority, calendarPriority];
  if (priorities.includes("p1")) return "p1";
  if (priorities.includes("p2")) return "p2";
  if (priorities.includes("p3")) return "p3";
  return "p4";
}

export async function recalculateAssetPriorities(assetId: string) {
  const [asset] = await db.select().from(equipment).where(eq(equipment.id, assetId));
  if (!asset) return;

  const schedules = await db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.equipmentId, assetId));

  for (const sched of schedules) {
    if (!sched.isActive) continue;
    const priority = calculatePriority(sched, asset.currentHours ?? asset.hours ?? 0);
    if (priority !== sched.priority) {
      await db.update(maintenanceSchedules).set({ priority }).where(eq(maintenanceSchedules.id, sched.id));
    }
  }
}

export async function recalculateAllPriorities() {
  const allEquipment = await db.select().from(equipment);
  const allSchedules = await db.select().from(maintenanceSchedules);

  for (const sched of allSchedules) {
    if (!sched.isActive) continue;
    const asset = allEquipment.find(e => e.id === sched.equipmentId);
    if (!asset) continue;
    const priority = calculatePriority(sched, asset.currentHours ?? asset.hours ?? 0);
    if (priority !== sched.priority) {
      await db.update(maintenanceSchedules).set({ priority }).where(eq(maintenanceSchedules.id, sched.id));
    }
  }
}

export function calculateNextDue(
  interval: { hoursInterval: number | null; calendarIntervalDays: number | null },
  currentHours: number | null,
  serviceDate: Date
): { nextDueHours: number | null; nextDueDate: Date | null } {
  const nextDueHours = interval.hoursInterval && currentHours != null
    ? currentHours + interval.hoursInterval
    : null;
  const nextDueDate = interval.calendarIntervalDays
    ? new Date(serviceDate.getTime() + interval.calendarIntervalDays * 24 * 60 * 60 * 1000)
    : null;
  return { nextDueHours, nextDueDate };
}
