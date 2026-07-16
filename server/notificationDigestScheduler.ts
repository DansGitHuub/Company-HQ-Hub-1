/**
 * notificationDigestScheduler.ts
 *
 * Runs every hour. At 6:00 AM (server time):
 *   - Processes daily_digest queue: sends one email per user summarising the day's queued notifications
 * At 6:00 AM Monday:
 *   - Also processes weekly queue
 *
 * Queued in-app items are delivered as a batch staff_notification per user.
 * Email is sent only if the user has an email address on record.
 * SMS is never used for digest sends (the batch format doesn't suit single texts).
 */
import { pool } from "./db";
import { sendEmail } from "./emailService";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let lastDailyDigestDate = "";
let lastWeeklyDigestDate = "";

async function buildHtmlDigest(
  items: Array<{ title: string; message: string; link?: string | null }>,
  heading: string
): Promise<string> {
  const rows = items
    .map(
      (n) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">
            <strong>${n.title}</strong><br/>
            <span style="color:#4b5563">${n.message}</span>
            ${n.link ? `<br/><a href="${n.link}" style="color:#16a34a;font-size:12px">${n.link}</a>` : ""}
          </td>
        </tr>`
    )
    .join("");
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#166534;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;font-size:18px">${heading}</h2>
        <p style="margin:4px 0 0;font-size:13px;opacity:.8">CompanyHQ Notification Digest</p>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb">
        ${rows}
      </table>
      <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:12px">
        To change how often you receive these digests, visit
        <a href="/notifications/settings">Notification Preferences</a>.
      </p>
    </div>`;
}

async function processDigest(cadence: "daily_digest" | "weekly"): Promise<void> {
  const windowHours = cadence === "weekly" ? 168 : 24;
  try {
    // Collect all unsent queued items for this cadence within the window
    const { rows: pending } = await pool.query(
      `SELECT id, user_id, notification_type, title, message, link
       FROM notification_digest_queue
       WHERE cadence = $1
         AND sent_at IS NULL
         AND created_at >= NOW() - ($2 || ' hours')::INTERVAL
       ORDER BY user_id, created_at`,
      [cadence, windowHours]
    );
    if (!pending.length) return;

    // Group by user
    const byUser = new Map<string, typeof pending>();
    for (const row of pending) {
      if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
      byUser.get(row.user_id)!.push(row);
    }

    const label = cadence === "weekly" ? "Weekly" : "Daily";

    for (const [userId, items] of byUser) {
      const ids = items.map((r) => r.id);
      try {
        // 1. In-app: insert one summarising staff_notification per user
        await pool.query(
          `INSERT INTO staff_notifications (id, user_id, type, title, message, link)
           VALUES (gen_random_uuid(), $1, 'digest', $2, $3, '/notifications')`,
          [
            userId,
            `${label} Digest — ${items.length} notification${items.length > 1 ? "s" : ""}`,
            items.map((i) => `• ${i.title}`).join("\n"),
          ]
        );

        // 2. Email if user has one
        const uRow = await pool.query(
          `SELECT email FROM users WHERE id::text = $1 LIMIT 1`,
          [userId]
        );
        const email: string | undefined = uRow.rows[0]?.email;
        if (email) {
          const html = await buildHtmlDigest(items, `${label} Notification Digest`);
          sendEmail(email, `CompanyHQ ${label} Digest — ${items.length} update${items.length > 1 ? "s" : ""}`, html).catch(
            (e: Error) => console.error("[digest] email:", e.message)
          );
        }

        // 3. Mark items as sent
        await pool.query(
          `UPDATE notification_digest_queue SET sent_at = NOW() WHERE id = ANY($1::int[])`,
          [ids]
        );

        // 4. Log
        await pool.query(
          `INSERT INTO notification_digest_log (user_id, cadence, item_count) VALUES ($1, $2, $3)`,
          [userId, cadence, items.length]
        );
      } catch (userErr: any) {
        console.error(`[digest] user ${userId}:`, userErr.message);
      }
    }
    console.log(`[digest] ${cadence}: processed ${pending.length} items for ${byUser.size} users`);
  } catch (e: any) {
    console.error("[digest] processDigest error:", e.message);
  }
}

export function startNotificationDigestScheduler() {
  setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0=Sun, 1=Mon
    const dateStr = now.toISOString().slice(0, 10);

    // Daily digest runs at 6 AM once per day
    if (hour === 6 && lastDailyDigestDate !== dateStr) {
      lastDailyDigestDate = dateStr;
      await processDigest("daily_digest");

      // Weekly also runs at Monday 6 AM
      if (day === 1 && lastWeeklyDigestDate !== dateStr) {
        lastWeeklyDigestDate = dateStr;
        await processDigest("weekly");
      }
    }
  }, CHECK_INTERVAL_MS);

  console.log("[notification-digest] Digest scheduler started (hourly check, fires at 6 AM)");
}
