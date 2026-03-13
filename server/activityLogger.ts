import { db } from "./db";
import { activityLog } from "@shared/schema";

export async function logActivity(
  eventType: string,
  description: string,
  link?: string | null,
  userId?: string | null
) {
  try {
    await db.insert(activityLog).values({
      userId: userId || null,
      eventType,
      description,
      link: link || null,
    });
  } catch (err) {
    console.error("[activityLogger] Failed to log activity:", err);
  }
}
