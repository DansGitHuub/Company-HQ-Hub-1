// Twilio SMS Service — Server-to-Server
//
// Two audiences:
//   "customer"  — outbound to customers (inquiries, estimates, job status, invoices,
//                 scheduling, route notices, review requests, portal messages, blasts)
//                 From: app_settings.sms_customer_number, then TWILIO_CUSTOMER_MESSAGING_SERVICE_SID,
//                       then TWILIO_CUSTOMER_PHONE_NUMBER
//   "employee"  — outbound to applicants, candidates, and internal staff
//                 (application confirmations, interview scheduling, hiring decisions,
//                  crew / employee notifications)
//                 From: app_settings.sms_employee_number, then TWILIO_MESSAGING_SERVICE_SID,
//                       then TWILIO_PHONE_NUMBER
//                 SAFETY FALLBACK: if the employee number is rejected with a sender-restriction
//                 error (e.g. 30034 unregistered 10DLC), the message is retried once from
//                 the customer number and a warning is logged. This keeps hiring texts working
//                 while A2P registration is pending, and stops firing once the number is approved.
//
// Priority for "From" (when no MessagingServiceSid is configured):
//   1. app_settings DB value  (admin-editable in Settings → Company → SMS Phone Numbers)
//   2. Env-var phone number   (TWILIO_CUSTOMER_PHONE_NUMBER / TWILIO_PHONE_NUMBER)
//
// Test / live gate:
//   SMS_SENDING_LIVE !== 'true' → no real Twilio API call is ever made
//   SMS_TEST_REDIRECT_PHONE     → redirect all sends there with a banner noting original recipient

import { pool } from "./db";

export type SmsChannel = "customer" | "employee";

// ── Sender-restriction error codes ───────────────────────────────────────────
// These indicate that the From number is blocked / not permitted to send.
// Receiving one of these on the employee channel triggers the customer-number fallback.
const SENDER_RESTRICTED_CODES = new Set([
  21606, // The 'From' number is not a valid message-capable phone number
  21608, // The outbound phone number is not permitted to send messages
  21610, // Message cannot be sent to the 'From' phone number
  21617, // Concatenated message body exceeds the 1600 character limit
  30033, // Unregistered 10DLC campaign
  30034, // Message blocked for compliance / unregistered sender
  30007, // Carrier violation (spam filter)
]);

function isSenderRestrictedCode(code: number | string | undefined): boolean {
  if (code === undefined || code === null) return false;
  const n = Number(code);
  // Named codes + broad 30030–30050 compliance range
  return SENDER_RESTRICTED_CODES.has(n) || (n >= 30030 && n <= 30050);
}

// ── Test / live helpers ───────────────────────────────────────────────────────

function isSmsLive(): boolean {
  return process.env.SMS_SENDING_LIVE === "true";
}

function resolveSmsRecipient(
  to: string,
  body: string
): { actualTo: string | null; finalBody: string } {
  if (isSmsLive()) {
    return { actualTo: to, finalBody: body };
  }

  const redirect = process.env.SMS_TEST_REDIRECT_PHONE;
  if (!redirect) {
    return { actualTo: null, finalBody: body };
  }

  const banner = `[TEST/REDIRECT MODE — intended for ${to}] `;
  return { actualTo: redirect, finalBody: banner + body };
}

// ── From-number resolution ────────────────────────────────────────────────────

/**
 * Look up the admin-configured From number from app_settings, falling back to
 * the legacy env-var phone number.  MessagingServiceSid callers skip this entirely.
 */
async function getFromNumber(channel: SmsChannel): Promise<string | undefined> {
  const key = channel === "customer" ? "sms_customer_number" : "sms_employee_number";
  const envFallback = channel === "customer"
    ? process.env.TWILIO_CUSTOMER_PHONE_NUMBER
    : process.env.TWILIO_PHONE_NUMBER;
  try {
    const { rows } = await pool.query(`SELECT value FROM app_settings WHERE key = $1`, [key]);
    const dbVal = rows[0]?.value?.trim();
    return dbVal || envFallback;
  } catch {
    return envFallback;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if Twilio credentials are present (the From number is read from
 * app_settings which is always seeded, so creds are the only remaining gate).
 */
export function isSmsConfigured(_channel: SmsChannel = "employee"): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

/**
 * Send an SMS message.
 *
 * @param to       Destination phone number (any common format; normalised internally)
 * @param body     Message text
 * @param channel  "customer" | "employee"  (default: "employee")
 *
 * Employee→customer fallback: if the employee number is rejected with a sender-restriction
 * Twilio error, the message is automatically retried from the customer number.
 */
export async function sendSms(
  to: string,
  body: string,
  channel: SmsChannel = "employee"
): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  // MessagingServiceSid lets Twilio pick the From; it takes priority over a From number.
  const messagingServiceSid = channel === "customer"
    ? process.env.TWILIO_CUSTOMER_MESSAGING_SERVICE_SID
    : process.env.TWILIO_MESSAGING_SERVICE_SID;

  // Only do the DB look-up when we actually need a From number
  const from = messagingServiceSid ? undefined : await getFromNumber(channel);

  if (!accountSid || !authToken || (!messagingServiceSid && !from)) {
    console.warn(`[sms] Twilio not configured for "${channel}" channel — skipping SMS to:`, to);
    return false;
  }

  const normalized = normalizePhone(to);
  if (!normalized) {
    console.warn("[sms] Invalid phone number, skipping:", to);
    return false;
  }

  const { actualTo, finalBody } = resolveSmsRecipient(normalized, body);
  if (!actualTo) {
    console.log(
      `[sms] TEST MODE (SMS_SENDING_LIVE not set) — skipping real Twilio send.` +
      ` Would have sent via "${channel}" to: ${normalized}, Body: "${body}"`
    );
    return true;
  }
  if (actualTo !== normalized) {
    console.log(`[sms] TEST/REDIRECT MODE — redirecting SMS intended for ${normalized} to ${actualTo}`);
  }

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const params: Record<string, string> = { To: actualTo, Body: finalBody };
    if (messagingServiceSid) {
      params.MessagingServiceSid = messagingServiceSid;
    } else {
      params.From = from!;
    }

    const payload = new URLSearchParams(params).toString();

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload,
      }
    );

    const data = await response.json() as any;

    if (!response.ok) {
      const errorCode = data?.code;

      // ── Employee → customer fallback ──────────────────────────────────────
      // If the employee number (440) is not yet A2P-approved and Twilio rejects
      // with a sender-restriction error, retry once from the customer number (844).
      if (channel === "employee" && isSenderRestrictedCode(errorCode)) {
        console.warn(
          `[SMS FALLBACK] employee number rejected (code ${errorCode}), re-sent from customer number`
        );
        return sendSms(to, body, "customer");
      }

      console.error(
        `[sms] Twilio error on channel "${channel}" (HTTP ${response.status}):`,
        JSON.stringify(data)
      );
      return false;
    }

    console.log(`[sms] SMS sent via "${channel}" channel to ${normalized} (SID: ${data.sid})`);
    return true;
  } catch (err: any) {
    console.error(`[sms] Failed to send SMS on channel "${channel}":`, err.message);
    return false;
  }
}

function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return null;
}

// ── Employee-channel helpers ──────────────────────────────────────────────────
// All of these send via the "employee" channel (440 hiring number → with customer fallback).

export async function sendStageSms(
  to: string,
  candidateName: string,
  stage: string,
  position: string
): Promise<boolean> {
  const firstName = candidateName.split(" ")[0];
  const pos = position || "the position";
  const messages: Record<string, string> = {
    "Application Received":   `Hi ${firstName}, we received your application for the ${pos} position at Chapin Landscapes. We'll be in touch soon!`,
    "Review & Rate":          `Hi ${firstName}, your application for the ${pos} position at Chapin Landscapes is currently under review. We'll update you soon.`,
    "Phone Screen":           `Hi ${firstName}, we'd like to schedule a brief phone call with you regarding the ${pos} position at Chapin Landscapes. Please watch for our call!`,
    "1st Interview":          `Hi ${firstName}, thank you for interviewing with Chapin Landscapes for the ${pos} position! We're reviewing and will be in touch soon.`,
    "2nd Interview":          `Hi ${firstName}, we'd like to invite you for a second interview for the ${pos} position at Chapin Landscapes. We'll contact you with details.`,
    "Offer Extended":         `Hi ${firstName}, we're excited to extend an offer for the ${pos} position! Please check your email for the full offer details and acceptance link.`,
    "Hired":                  `Hi ${firstName}, welcome to the Chapin Landscapes team! Check your email for your account credentials and onboarding information.`,
    "Declined / Not a Fit":   `Hi ${firstName}, thank you for your interest in Chapin Landscapes. After careful consideration, we've decided to move forward with other candidates at this time. We wish you the best!`,
  };
  const body = messages[stage] ||
    `Hi ${firstName}, your application status for the ${pos} position at Chapin Landscapes has been updated. Please check your email for details.`;
  return sendSms(to, body, "employee");
}

export async function sendHireSms(
  to: string,
  candidateName: string,
  position: string
): Promise<boolean> {
  const firstName = candidateName.split(" ")[0];
  const body = `Hi ${firstName}, welcome to the Chapin Landscapes team! Your account credentials and onboarding information have been sent to your email.`;
  return sendSms(to, body, "employee");
}

export async function sendInterviewSms(
  to: string,
  candidateName: string,
  date: string,
  time: string,
  type: "zoom" | "in-person",
  zoomUrl?: string,
  location?: string
): Promise<boolean> {
  let message: string;

  if (type === "zoom" && zoomUrl) {
    message = `Hi ${candidateName.split(" ")[0]}, your Zoom interview with Chapin Landscapes is scheduled for ${date} at ${time}. Join here: ${zoomUrl}`;
  } else {
    message = `Hi ${candidateName.split(" ")[0]}, your interview with Chapin Landscapes is scheduled for ${date} at ${time}${location ? ` at ${location}` : ""}. We look forward to meeting you!`;
  }

  return sendSms(to, message, "employee");
}
