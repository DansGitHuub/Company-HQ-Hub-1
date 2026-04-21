/**
 * Notification Scheduler
 *
 * Sends:
 *  - 24h interview reminders to candidates (SMS + email)
 *  - 1h interview reminders to candidates (SMS)
 *  - Follow-up reminders for pending applications (in-app + email to admins)
 */

import { storage } from "./storage";
import { sendInterviewSms } from "./smsService";
import { sendEmail as _sendEmailRaw } from "./emailService";
import { log } from "./index";

const sendEmail = ({ to, subject, html }: { to: string; subject: string; html: string }) =>
  _sendEmailRaw(to, subject, html);

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

async function checkInterviewReminders(): Promise<void> {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in1h = new Date(now.getTime() + 60 * 60 * 1000);

    const applications = await (storage as any).getApplicationsWithUpcomingInterviews?.() || [];

    for (const app of applications) {
      if (!app.interviewDate) continue;
      const iDate = new Date(app.interviewDate);

      const hoursUntil = (iDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntil >= 23 && hoursUntil <= 25 && !app.reminder24hSent) {
        const dateStr = formatDate(iDate);
        const timeStr = formatTime(iDate);

        if (app.phone) {
          await sendInterviewSms(app.phone, app.applicantName, dateStr, timeStr, app.interviewType || "in-person", app.zoomUrl || undefined, app.interviewLocation || undefined);
          log(`[notif-scheduler] 24h SMS reminder sent to ${app.applicantName}`, "scheduler");
        }
        if (app.email) {
          await sendEmail(app.email, `Interview Reminder — Tomorrow at ${timeStr}`, `<p>Hi ${app.applicantName.split(" ")[0]},</p><p>Reminder: your interview with Chapin Landscapes is ${dateStr} at ${timeStr}.</p>`);
          log(`[notif-scheduler] 24h email reminder sent to ${app.applicantName}`, "scheduler");
        }
        await storage.updateJobApplication?.(app.id, { reminder24hSent: true });
      }

      if (hoursUntil >= 0.916 && hoursUntil <= 1.083 && !app.reminder1hSent) {
        const dateStr = formatDate(iDate);
        const timeStr = formatTime(iDate);
        if (app.phone) {
          await sendInterviewSms(app.phone, app.applicantName, dateStr, timeStr, app.interviewType || "in-person", app.zoomUrl || undefined, app.interviewLocation || undefined);
          log(`[notif-scheduler] 1h SMS reminder sent to ${app.applicantName}`, "scheduler");
        }
        await storage.updateJobApplication?.(app.id, { reminder1hSent: true });
      }
    }
  } catch (err: any) {
    log(`[notif-scheduler] Interview reminder check error: ${err.message}`, "scheduler");
  }
}

async function checkPendingApplicationFollowups(): Promise<void> {
  try {
    const allApps = await storage.getJobApplications?.() || [];
    const now = new Date();
    const staleThresholdMs = 3 * 24 * 60 * 60 * 1000;
    const stale = allApps.filter((app: any) => {
      if (!["Application Received", "Review & Rate"].includes(app.stage)) return false;
      const age = now.getTime() - new Date(app.createdAt || app.submittedAt).getTime();
      return age >= staleThresholdMs && !app.followupReminderSent;
    });
    if (stale.length === 0) return;
    const users = await storage.getAllUsers();
    const admins = users.filter((u: any) => ["admin", "super_admin"].includes(u.role));
    for (const app of stale) {
      for (const admin of admins) {
        try {
          await storage.createStaffNotification({ userId: admin.id, type: "application_followup", title: "Application Awaiting Review", message: `${app.applicantName}'s application for ${app.position} has been waiting ${Math.floor((now.getTime() - new Date(app.createdAt || app.submittedAt).getTime()) / (1000 * 60 * 60 * 24))} days without action.`, link: `/hiring/${app.id}`, metadata: { applicationId: app.id } });
        } catch {}
      }
      await storage.updateJobApplication?.(app.id, { followupReminderSent: true });
      log(`[notif-scheduler] Follow-up reminder sent for application ${app.id} (${app.applicantName})`, "scheduler");
    }
  } catch (err: any) {
    log(`[notif-scheduler] Pending application followup check error: ${err.message}`, "scheduler");
  }
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startNotificationScheduler(): void {
  if (schedulerInterval) clearInterval(schedulerInterval);
  log("Notification scheduler started (checking every 15 minutes)", "scheduler");
  setTimeout(async () => { await checkInterviewReminders(); await checkPendingApplicationFollowups(); }, 30_000);
  schedulerInterval = setInterval(async () => { await checkInterviewReminders(); await checkPendingApplicationFollowups(); }, CHECK_INTERVAL_MS);
}

export function stopNotificationScheduler(): void {
  if (schedulerInterval) { clearInterval(schedulerInterval); schedulerInterval = null; log("Notification scheduler stopped", "scheduler"); }
}
