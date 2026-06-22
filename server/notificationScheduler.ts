/**
 * Notification Scheduler
 *
 * Sends:
 *  - 24h interview reminders to candidates (SMS + email)
 *  - 1h interview reminders to candidates (SMS)
 *  - Follow-up reminders for pending applications (in-app + email to admins)
 */

import { storage } from "./storage";
import { pool } from "./db";
import { sendInterviewSms } from "./smsService";
import { sendEmail as _sendEmailRaw } from "./emailService";
import { notifyStaff } from "./notificationService";
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

const CLOCKOUT_REMINDER_THRESHOLD_MS  = 8  * 60 * 60 * 1000; // 8 hours → first reminder
const CLOCKOUT_REREMINDER_INTERVAL_MS = 2  * 60 * 60 * 1000; // every 2h thereafter
const CLOCKOUT_AUTO_TIMEOUT_MS        = 30 * 60 * 1000;       // 30 min unanswered → auto-clockout

async function checkAutoClockout(): Promise<void> {
  try {
    const now = new Date();

    // ── Step 1: Auto-clockout entries whose last reminder was >30 min ago ──────
    const overdueRes = await pool.query<{
      id: string; user_id: string; last_reminder_at: Date;
    }>(`
      SELECT id, user_id, last_reminder_at
      FROM time_entries
      WHERE clock_out IS NULL
        AND last_reminder_at IS NOT NULL
        AND last_reminder_at <= NOW() - INTERVAL '30 minutes'
    `);

    for (const entry of overdueRes.rows) {
      const autoClockOut = new Date(entry.last_reminder_at.getTime() + CLOCKOUT_AUTO_TIMEOUT_MS);
      const durationMins = Math.round(
        (autoClockOut.getTime() - 0) / 60000 // will be recalculated properly below
      );
      // Fetch clock_in to compute real duration
      const teRes = await pool.query<{ clock_in: Date }>(
        `SELECT clock_in FROM time_entries WHERE id=$1`, [entry.id]
      );
      const clockIn = teRes.rows[0]?.clock_in;
      const realDuration = clockIn
        ? Math.round((autoClockOut.getTime() - clockIn.getTime()) / 60000)
        : null;

      await pool.query(
        `UPDATE time_entries
         SET clock_out=$1, duration_minutes=$2, auto_clocked_out=true
         WHERE id=$3`,
        [autoClockOut, realDuration, entry.id]
      );

      // Notify the employee
      try {
        const userRes = await pool.query<{ name: string }>(
          `SELECT name FROM users WHERE id=$1`, [entry.user_id]
        );
        const name = userRes.rows[0]?.name ?? "Employee";
        const hrs = realDuration ? (realDuration / 60).toFixed(1) : "?";
        await notifyStaff({
          userId: entry.user_id,
          type: "auto_clocked_out",
          title: "Auto Clock-Out",
          message: `You were automatically clocked out after ${hrs}h because no response was received to the reminder.`,
          link: "/time",
          channels: ["inApp", "email"],
          emailSubject: "Chapin Landscapes — You were automatically clocked out",
          emailHtml: `<p>Hi ${name},</p><p>You were automatically clocked out after <strong>${hrs} hours</strong> because your clock-out reminder went unanswered for 30 minutes.</p><p>Please review your time entry at <a href="https://chapinhq.com/time">chapinhq.com/time</a> and contact your manager if an adjustment is needed.</p>`,
        });
        log(`[clockout-scheduler] Auto clocked out entry ${entry.id} for user ${entry.user_id} (${hrs}h)`, "scheduler");
      } catch {}
    }

    // ── Step 2: Send reminders for entries ≥8h with no recent ping ────────────
    const openRes = await pool.query<{
      id: string; user_id: string; clock_in: Date; last_reminder_at: Date | null;
    }>(`
      SELECT id, user_id, clock_in, last_reminder_at
      FROM time_entries
      WHERE clock_out IS NULL
        AND auto_clocked_out = false
        AND NOW() - clock_in >= INTERVAL '8 hours'
        AND (
          last_reminder_at IS NULL
          OR last_reminder_at <= NOW() - INTERVAL '2 hours'
        )
    `);

    for (const entry of openRes.rows) {
      const hoursIn = ((now.getTime() - new Date(entry.clock_in).getTime()) / 3_600_000).toFixed(1);

      await pool.query(
        `UPDATE time_entries SET last_reminder_at=NOW() WHERE id=$1`,
        [entry.id]
      );

      try {
        const userRes = await pool.query<{ name: string }>(
          `SELECT name FROM users WHERE id=$1`, [entry.user_id]
        );
        const name = userRes.rows[0]?.name ?? "Employee";
        await notifyStaff({
          userId: entry.user_id,
          type: "clockout_reminder",
          title: "Still working?",
          message: `You've been clocked in for ${hoursIn} hours. Please clock out when done — you'll be auto clocked out in 30 minutes if no action is taken.`,
          link: "/time",
          channels: ["inApp", "email"],
          emailSubject: "Chapin Landscapes — Clock-out reminder",
          emailHtml: `<p>Hi ${name},</p><p>You've been clocked in for <strong>${hoursIn} hours</strong>.</p><p>Please <a href="https://chapinhq.com/time">clock out</a> when you're done. If we don't hear back in 30 minutes, you'll be automatically clocked out.</p>`,
        });
        log(`[clockout-scheduler] Sent reminder for entry ${entry.id} (${hoursIn}h)`, "scheduler");
      } catch {}
    }
  } catch (err: any) {
    log(`[clockout-scheduler] Auto-clockout check error: ${err.message}`, "scheduler");
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
    const admins = users.filter((u: any) => ["Admin", "Manager", "Master Admin"].includes(u.role) || u.isMasterAdmin);
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
  setTimeout(async () => {
    await checkInterviewReminders();
    await checkPendingApplicationFollowups();
    await checkAutoClockout();
  }, 30_000);
  schedulerInterval = setInterval(async () => {
    await checkInterviewReminders();
    await checkPendingApplicationFollowups();
    await checkAutoClockout();
  }, CHECK_INTERVAL_MS);
}

export function stopNotificationScheduler(): void {
  if (schedulerInterval) { clearInterval(schedulerInterval); schedulerInterval = null; log("Notification scheduler stopped", "scheduler"); }
}
