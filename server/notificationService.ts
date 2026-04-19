/**
 * Centralized Notification Service
 *
 * Handles all in-app, email, and SMS notifications for staff and customers.
 * Reads user preferences before dispatching each channel.
 */

import { storage } from "./storage";
import { sendSms, isSmsConfigured } from "./smsService";
import { sendEmail as _sendEmailRaw } from "./emailService";
import { log } from "./index";

const sendEmail = ({ to, subject, html }: { to: string; subject: string; html: string }) =>
  _sendEmailRaw(to, subject, html);

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type NotificationChannel = "inApp" | "email" | "sms";

export interface StaffNotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  /** Channels to attempt. Defaults to ["inApp","email","sms"] */
  channels?: NotificationChannel[];
  /** For email channel */
  emailSubject?: string;
  emailHtml?: string;
  /** For SMS channel (falls back to message if omitted) */
  smsBody?: string;
}

export interface CustomerNotificationPayload {
  customerId: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  /** Channels to attempt. Defaults to ["inApp","email","sms"] */
  channels?: NotificationChannel[];
  /** For email channel */
  toEmail?: string;
  emailSubject?: string;
  emailHtml?: string;
  /** For SMS channel */
  toPhone?: string;
  smsBody?: string;
}

// ─────────────────────────────────────────────────────────────
// Staff Notifications
// ─────────────────────────────────────────────────────────────

export async function notifyStaff(payload: StaffNotificationPayload): Promise<void> {
  const {
    userId,
    type,
    title,
    message,
    link,
    metadata,
    channels = ["inApp", "email", "sms"],
    emailSubject,
    emailHtml,
    smsBody,
  } = payload;

  // Fetch user to read preferences
  let user: any;
  try {
    user = await storage.getUser(userId);
  } catch {
    log(`[notify] Could not fetch user ${userId}`, "notify");
  }

  // 1. In-app notification (always attempt unless explicitly excluded)
  if (channels.includes("inApp")) {
    try {
      await storage.createStaffNotification({
        userId,
        type,
        title,
        message,
        link: link || null,
        metadata: metadata || {},
      });
    } catch (err: any) {
      log(`[notify] In-app notification failed for user ${userId}: ${err.message}`, "notify");
    }
  }

  // 2. Email
  if (channels.includes("email") && user?.email && user?.emailNotifications !== false) {
    try {
      await sendEmail({
        to: user.email,
        subject: emailSubject || title,
        html: emailHtml || `<p>${message}</p>`,
      });
    } catch (err: any) {
      log(`[notify] Email notification failed for user ${userId}: ${err.message}`, "notify");
    }
  }

  // 3. SMS
  if (
    channels.includes("sms") &&
    user?.phone &&
    user?.smsNotifications !== false &&
    isSmsConfigured()
  ) {
    try {
      await sendSms(user.phone, smsBody || message);
    } catch (err: any) {
      log(`[notify] SMS notification failed for user ${userId}: ${err.message}`, "notify");
    }
  }
}

/**
 * Notify all staff users with a given role (or all staff if role omitted).
 */
export async function notifyAllStaff(
  payload: Omit<StaffNotificationPayload, "userId">,
  roleFilter?: string
): Promise<void> {
  try {
    const allUsers = await storage.getAllUsers();
    const targets = roleFilter
      ? allUsers.filter((u: any) => u.role === roleFilter)
      : allUsers;

    await Promise.allSettled(
      targets.map((u: any) => notifyStaff({ ...payload, userId: u.id }))
    );
  } catch (err: any) {
    log(`[notify] notifyAllStaff error: ${err.message}`, "notify");
  }
}

// ─────────────────────────────────────────────────────────────
// Customer Notifications
// ─────────────────────────────────────────────────────────────

export async function notifyCustomer(payload: CustomerNotificationPayload): Promise<void> {
  const {
    customerId,
    type,
    title,
    message,
    link,
    channels = ["inApp", "email", "sms"],
    toEmail,
    emailSubject,
    emailHtml,
    toPhone,
    smsBody,
  } = payload;

  // Fetch customer for prefs
  let customer: any;
  try {
    customer = await storage.getCustomer(customerId);
  } catch {
    log(`[notify] Could not fetch customer ${customerId}`, "notify");
  }

  // 1. In-app
  if (channels.includes("inApp")) {
    try {
      await storage.createCustomerNotification({
        customerId,
        type,
        title,
        message,
        link: link || null,
      });
    } catch (err: any) {
      log(`[notify] Customer in-app notification failed (id ${customerId}): ${err.message}`, "notify");
    }
  }

  // 2. Email
  const emailAddr = toEmail || customer?.email;
  if (channels.includes("email") && emailAddr) {
    try {
      await sendEmail({
        to: emailAddr,
        subject: emailSubject || title,
        html: emailHtml || `<p>${message}</p>`,
      });
    } catch (err: any) {
      log(`[notify] Customer email failed (id ${customerId}): ${err.message}`, "notify");
    }
  }

  // 3. SMS
  const phoneNum = toPhone || customer?.phone;
  if (channels.includes("sms") && phoneNum && isSmsConfigured()) {
    try {
      await sendSms(phoneNum, smsBody || message);
    } catch (err: any) {
      log(`[notify] Customer SMS failed (id ${customerId}): ${err.message}`, "notify");
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Convenience helpers — Hiring
// ─────────────────────────────────────────────────────────────

export async function notifyApplicationReceived(
  adminUserIds: string[],
  applicantName: string,
  position: string,
  applicationId: number
): Promise<void> {
  for (const uid of adminUserIds) {
    await notifyStaff({
      userId: uid,
      type: "application_received",
      title: "New Application Received",
      message: `${applicantName} applied for ${position}.`,
      link: `/hiring/${applicationId}`,
      channels: ["inApp", "email"],
      emailSubject: `New Application: ${applicantName} — ${position}`,
      emailHtml: `<p><strong>${applicantName}</strong> submitted an application for <strong>${position}</strong>.</p><p><a href="/hiring/${applicationId}">View Application</a></p>`,
    });
  }
}

export async function notifyStageChange(
  adminUserIds: string[],
  applicantName: string,
  position: string,
  newStage: string,
  applicationId: number
): Promise<void> {
  for (const uid of adminUserIds) {
    await notifyStaff({
      userId: uid,
      type: "stage_change",
      title: `Application Stage Updated`,
      message: `${applicantName} moved to "${newStage}" for ${position}.`,
      link: `/hiring/${applicationId}`,
      channels: ["inApp"],
    });
  }
}

export async function notifyInterviewScheduled(
  adminUserIds: string[],
  applicantName: string,
  position: string,
  date: string,
  time: string,
  applicationId: number
): Promise<void> {
  for (const uid of adminUserIds) {
    await notifyStaff({
      userId: uid,
      type: "interview_scheduled",
      title: "Interview Scheduled",
      message: `Interview with ${applicantName} for ${position} on ${date} at ${time}.`,
      link: `/hiring/${applicationId}`,
      channels: ["inApp", "email"],
      emailSubject: `Interview Scheduled: ${applicantName} — ${date}`,
      emailHtml: `<p>Interview with <strong>${applicantName}</strong> for <strong>${position}</strong> has been scheduled for ${date} at ${time}.</p>`,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Convenience helpers — Customer
// ─────────────────────────────────────────────────────────────

export async function notifyEstimateSent(
  customerId: number,
  customerEmail: string,
  customerPhone: string | undefined,
  estimateId: number,
  amount: string
): Promise<void> {
  await notifyCustomer({
    customerId,
    type: "estimate_sent",
    title: "Your Estimate is Ready",
    message: `Your estimate for $${amount} from Chapin Landscapes is ready to review.`,
    link: `/customer-hub/estimates/${estimateId}`,
    toEmail: customerEmail,
    toPhone: customerPhone,
    emailSubject: "Your Estimate from Chapin Landscapes",
    emailHtml: `<p>Hi there,</p><p>Your estimate of <strong>$${amount}</strong> is ready. <a href="/customer-hub/estimates/${estimateId}">Click here to review and approve it.</a></p><p>— Chapin Landscapes Team</p>`,
    smsBody: `Hi! Your estimate from Chapin Landscapes is ready to review. Log in to your portal to view and approve it.`,
  });
}

export async function notifyJobStatusUpdate(
  customerId: number,
  customerEmail: string,
  customerPhone: string | undefined,
  jobId: number,
  jobName: string,
  status: string
): Promise<void> {
  await notifyCustomer({
    customerId,
    type: "job_status_update",
    title: `Job Update: ${jobName}`,
    message: `Your job "${jobName}" status has been updated to: ${status}.`,
    link: `/customer-hub/jobs/${jobId}`,
    toEmail: customerEmail,
    toPhone: customerPhone,
    emailSubject: `Job Update: ${jobName}`,
    emailHtml: `<p>Hi there,</p><p>Your job <strong>${jobName}</strong> has been updated to: <strong>${status}</strong>.</p><p><a href="/customer-hub/jobs/${jobId}">View Job</a></p>`,
    smsBody: `Update from Chapin Landscapes: Your job "${jobName}" is now ${status}. Log in to your portal for details.`,
  });
}

export async function notifyPaymentReceived(
  customerId: number,
  customerEmail: string,
  amount: string,
  invoiceId: number
): Promise<void> {
  await notifyCustomer({
    customerId,
    type: "payment_received",
    title: "Payment Confirmed",
    message: `Your payment of $${amount} has been received. Thank you!`,
    link: `/customer-hub/invoices/${invoiceId}`,
    toEmail: customerEmail,
    channels: ["inApp", "email"],
    emailSubject: "Payment Confirmation — Chapin Landscapes",
    emailHtml: `<p>Hi there,</p><p>We've received your payment of <strong>$${amount}</strong>. Thank you!</p><p><a href="/customer-hub/invoices/${invoiceId}">View Receipt</a></p>`,
  });
}

export async function notifyPortalMessage(
  customerId: number,
  customerEmail: string,
  customerPhone: string | undefined,
  senderName: string
): Promise<void> {
  await notifyCustomer({
    customerId,
    type: "portal_message",
    title: "New Message from Chapin Landscapes",
    message: `You have a new message from ${senderName}.`,
    link: `/customer-hub/messages`,
    toEmail: customerEmail,
    toPhone: customerPhone,
    emailSubject: `New Message from Chapin Landscapes`,
    emailHtml: `<p>Hi there,</p><p>You have a new message from <strong>${senderName}</strong> at Chapin Landscapes.</p><p><a href="/customer-hub/messages">View Message</a></p>`,
    smsBody: `You have a new message from Chapin Landscapes. Log in to your portal to reply.`,
  });
}
