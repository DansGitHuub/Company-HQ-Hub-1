/**
 * notificationDispatcher.ts
 *
 * Core dispatcher for the B.2 Notification Center.
 * Reads company defaults + per-user overrides, then:
 *   immediate  → insert staff_notification + optionally email/SMS
 *   daily_digest / weekly → queue in notification_digest_queue
 *   off  → no-op
 *
 * NOTE: SMS defaults are OFF for every notification type.
 * Real SMS requires SMS_SENDING_LIVE=true AND the notification type's
 * chan_sms to be explicitly enabled by an admin.
 */
import { pool } from "./db";
import { sendEmail } from "./emailService";
import { sendSms } from "./smsService";

export interface DispatchOptions {
  type: string;
  userId: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  /** Recipient email — only used when chan_email is true */
  recipientEmail?: string;
  /** Recipient phone — only used when chan_sms is true */
  recipientPhone?: string;
}

interface EffectiveSettings {
  in_app: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
  cadence: string;
}

async function getEffectiveSettings(
  type: string,
  userId: string
): Promise<EffectiveSettings> {
  try {
    const { rows } = await pool.query(
      `SELECT
         c.chan_in_app, c.chan_email, c.chan_sms, c.chan_push, c.cadence,
         p.chan_in_app  AS u_in_app,
         p.chan_email   AS u_email,
         p.chan_sms     AS u_sms,
         p.chan_push    AS u_push,
         p.cadence      AS u_cadence
       FROM notification_type_config c
       LEFT JOIN user_notification_prefs p
         ON p.notification_type = c.type AND p.user_id = $2
       WHERE c.type = $1`,
      [type, userId]
    );
    if (!rows[0]) {
      // No config found — safe fallback: in-app immediate only
      return { in_app: true, email: false, sms: false, push: false, cadence: "immediate" };
    }
    const r = rows[0];
    return {
      in_app: r.u_in_app  ?? r.chan_in_app,
      email:  r.u_email   ?? r.chan_email,
      sms:    r.u_sms     ?? r.chan_sms,
      push:   r.u_push    ?? r.chan_push,
      cadence:r.u_cadence ?? r.cadence,
    };
  } catch {
    // If notification_type_config table doesn't exist yet (cold start race),
    // fall back to safe defaults
    return { in_app: true, email: false, sms: false, push: false, cadence: "immediate" };
  }
}

export async function dispatchNotification(opts: DispatchOptions): Promise<void> {
  try {
    const eff = await getEffectiveSettings(opts.type, opts.userId);

    if (eff.cadence === "off") return;

    // Batched cadences → queue, do NOT deliver now
    if (eff.cadence === "daily_digest" || eff.cadence === "weekly") {
      if (eff.in_app || eff.email) {
        await pool.query(
          `INSERT INTO notification_digest_queue
             (user_id, notification_type, cadence, title, message, link, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            opts.userId,
            opts.type,
            eff.cadence,
            opts.title,
            opts.message,
            opts.link   ?? null,
            JSON.stringify(opts.metadata ?? {}),
          ]
        );
      }
      return;
    }

    // ── Immediate delivery ──────────────────────────────────────────────────

    if (eff.in_app) {
      await pool.query(
        `INSERT INTO staff_notifications
           (id, user_id, type, title, message, link, metadata)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
        [
          opts.userId,
          opts.type,
          opts.title,
          opts.message,
          opts.link   ?? null,
          JSON.stringify(opts.metadata ?? {}),
        ]
      );
    }

    if (eff.email && opts.recipientEmail) {
      const html = `<p>${opts.message}</p>${
        opts.link
          ? `<p><a href="${opts.link}">View in CompanyHQ →</a></p>`
          : ""
      }`;
      sendEmail(opts.recipientEmail, opts.title, html).catch((e: Error) =>
        console.error("[dispatcher] email:", e.message)
      );
    }

    // SMS — deliberately requires explicit opt-in AND SMS_SENDING_LIVE=true
    if (eff.sms && opts.recipientPhone) {
      sendSms(opts.recipientPhone, `${opts.title}: ${opts.message}`, "employee").catch(
        (e: Error) => console.error("[dispatcher] sms:", e.message)
      );
    }
  } catch (e: any) {
    console.error("[dispatcher] dispatchNotification error:", e.message);
  }
}
