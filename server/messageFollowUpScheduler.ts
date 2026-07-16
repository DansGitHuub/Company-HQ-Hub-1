/**
 * messageFollowUpScheduler.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Stage-1 message accountability layer.
 *
 * Responsibilities:
 *   1. Expire snoozes: reset snoozed threads / DM conversations whose
 *      snooze_until has passed back to an actionable state.
 *   2. First nudge: fire a staff_notification to the assignee (or all admins)
 *      when a messaging_thread has an unanswered customer message older than
 *      FIRST_NUDGE_HOURS without a staff reply.
 *   3. Escalation: if still unanswered after ESCALATION_HOURS, also notify
 *      all Admins/Managers.
 *   4. Direct messages: same two-tier logic for 1:1 DM conversations where the
 *      other party's last message has no reply after FIRST_NUDGE_HOURS.
 *
 * ── Configurable thresholds ──────────────────────────────────────────────────
 * Stage 1: thresholds are constants here.
 * To make them configurable via Admin > Business Rules later, add rows to the
 * business_rules table with keys 'msg_first_nudge_hours' and
 * 'msg_escalation_hours', then replace the constants below with a DB read.
 */

import { pool } from "./db";

// ── Thresholds (hours) ───────────────────────────────────────────────────────
const FIRST_NUDGE_HOURS = 24;   // 1 business day before first nudge
const ESCALATION_HOURS  = 72;   // 3 business days before manager escalation
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // run every 15 minutes

// ── One-time additive migration ───────────────────────────────────────────────
async function migrateSchedulerColumns(): Promise<void> {
  try {
    // Triage columns on direct_messages
    await pool.query(`
      ALTER TABLE direct_messages
        ADD COLUMN IF NOT EXISTS follow_up_notified_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS escalated_at          TIMESTAMP WITH TIME ZONE
    `);

    // Staleness-tracking columns on messaging_threads
    await pool.query(`
      ALTER TABLE messaging_threads
        ADD COLUMN IF NOT EXISTS follow_up_notified_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS escalated_at          TIMESTAMP WITH TIME ZONE
    `);

    console.log("[MsgFollowUp] Scheduler columns verified");
  } catch (err) {
    console.error("[MsgFollowUp] Migration error:", err);
  }
}

// ── Helper: insert a staff_notifications row ──────────────────────────────────
async function notify(
  userId: string,
  type: string,
  title: string,
  message: string,
  link: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await pool.query(
    `INSERT INTO staff_notifications (id, user_id, type, title, message, link, metadata)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
    [userId, type, title, message, link, JSON.stringify(metadata)]
  );
}

// ── Helper: fetch admin/manager user IDs ─────────────────────────────────────
async function getAdminIds(): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT id FROM users WHERE (role = 'Admin' OR role = 'Manager') AND is_active = TRUE`
  );
  return rows.map((r: any) => r.id);
}

// ── 1. Expire snoozes ─────────────────────────────────────────────────────────
async function expireSnoozes(): Promise<void> {
  try {
    // Customer-thread snoozes
    const { rowCount: tCount } = await pool.query(`
      UPDATE messaging_threads
      SET    status               = 'open',
             snooze_until         = NULL,
             follow_up_notified_at = NULL
      WHERE  status       = 'snoozed'
        AND  snooze_until <= NOW()
    `);

    // DM-conversation snoozes
    const { rowCount: dCount } = await pool.query(`
      UPDATE direct_messages
      SET    follow_up_state       = 'open',
             snooze_until          = NULL,
             follow_up_notified_at = NULL
      WHERE  follow_up_state = 'snoozed'
        AND  snooze_until   <= NOW()
    `);

    const total = (tCount ?? 0) + (dCount ?? 0);
    if (total > 0) {
      console.log(`[MsgFollowUp] Expired ${tCount ?? 0} thread snooze(s), ${dCount ?? 0} DM snooze(s)`);
    }
  } catch (err) {
    console.error("[MsgFollowUp] expireSnoozes error:", err);
  }
}

// ── 2. Check messaging_threads for unanswered customer messages ───────────────
async function checkMessageThreads(): Promise<void> {
  try {
    const nudgeThreshold = `NOW() - INTERVAL '${FIRST_NUDGE_HOURS} hours'`;
    const escalateThreshold = `NOW() - INTERVAL '${ESCALATION_HOURS} hours'`;

    // Threads where customer had the last word and nothing from staff since
    const { rows: staleThreads } = await pool.query(`
      SELECT
        mt.id,
        mt.subject,
        mt.assigned_employee_id   AS "assignedEmployeeId",
        mt.customer_id            AS "customerId",
        mt.priority,
        mt.last_customer_message_at AS "lastCustomerMessageAt",
        mt.last_staff_reply_at      AS "lastStaffReplyAt",
        mt.follow_up_notified_at    AS "followUpNotifiedAt",
        mt.escalated_at             AS "escalatedAt"
      FROM messaging_threads mt
      WHERE mt.status NOT IN ('resolved', 'closed', 'snoozed')
        AND (mt.snooze_until IS NULL OR mt.snooze_until <= NOW())
        AND mt.last_customer_message_at IS NOT NULL
        AND (
          mt.last_staff_reply_at IS NULL
          OR mt.last_customer_message_at > mt.last_staff_reply_at
        )
        AND mt.last_customer_message_at < ${nudgeThreshold}
    `);

    for (const thread of staleThreads) {
      const link = `/customer-messages`;
      const meta = { threadId: thread.id, subject: thread.subject };

      // ── First nudge ──────────────────────────────────────────────────────
      if (!thread.followUpNotifiedAt) {
        const recipientIds: string[] = thread.assignedEmployeeId
          ? [thread.assignedEmployeeId]
          : await getAdminIds();

        for (const uid of recipientIds) {
          await notify(
            uid,
            "message_needs_reply",
            `Awaiting reply: "${thread.subject}"`,
            `A customer message has gone unanswered for over ${FIRST_NUDGE_HOURS} hours.`,
            link,
            meta
          );
        }

        await pool.query(
          `UPDATE messaging_threads SET follow_up_notified_at = NOW() WHERE id = $1`,
          [thread.id]
        );

        console.log(`[MsgFollowUp] First nudge sent — thread ${thread.id}`);
        continue;
      }

      // ── Escalation ───────────────────────────────────────────────────────
      const customerMsgTime = new Date(thread.lastCustomerMessageAt).getTime();
      const nowTime         = Date.now();
      const hoursElapsed    = (nowTime - customerMsgTime) / 3_600_000;

      if (hoursElapsed >= ESCALATION_HOURS && !thread.escalatedAt) {
        const adminIds = await getAdminIds();
        for (const uid of adminIds) {
          await notify(
            uid,
            "message_needs_reply",
            `ESCALATION: "${thread.subject}" still unanswered`,
            `A customer message has now gone unanswered for over ${ESCALATION_HOURS} hours.`,
            link,
            { ...meta, escalation: true }
          );
        }

        await pool.query(
          `UPDATE messaging_threads SET escalated_at = NOW() WHERE id = $1`,
          [thread.id]
        );

        console.log(`[MsgFollowUp] Escalation sent — thread ${thread.id}`);
      }
    }
  } catch (err) {
    console.error("[MsgFollowUp] checkMessageThreads error:", err);
  }
}

// ── 3. Check direct_messages for unanswered DM conversations ─────────────────
//
// "Un-actioned" definition for DMs:
//   The most recent message in a staff-user's inbox is FROM another person,
//   the recipient has READ it (read_at IS NOT NULL),
//   the recipient has NOT sent a reply after it,
//   the conversation is not resolved/snoozed,
//   and the message is older than FIRST_NUDGE_HOURS.
async function checkDirectMessages(): Promise<void> {
  try {
    // One row per (sender, recipient) pair representing the latest inbound
    // message for each recipient that hasn't been replied to.
    const { rows: staleDMs } = await pool.query(`
      SELECT DISTINCT ON (dm.sender_id, dm.recipient_id)
        dm.id,
        dm.sender_id            AS "senderId",
        dm.recipient_id         AS "recipientId",
        dm.body,
        dm.sent_at              AS "sentAt",
        dm.follow_up_notified_at AS "followUpNotifiedAt",
        dm.escalated_at          AS "escalatedAt"
      FROM direct_messages dm
      WHERE dm.follow_up_state = 'open'
        AND dm.read_at          IS NOT NULL
        AND dm.deleted_by_recipient = FALSE
        AND dm.sent_at < NOW() - INTERVAL '${FIRST_NUDGE_HOURS} hours'
        AND (dm.snooze_until IS NULL OR dm.snooze_until <= NOW())
        -- Recipient hasn't sent a message back after this one
        AND NOT EXISTS (
          SELECT 1
          FROM   direct_messages reply
          WHERE  reply.sender_id    = dm.recipient_id
            AND  reply.recipient_id = dm.sender_id
            AND  reply.sent_at      > dm.sent_at
            AND  reply.deleted_by_sender = FALSE
        )
      ORDER BY dm.sender_id, dm.recipient_id, dm.sent_at DESC
    `);

    for (const dm of staleDMs) {
      const link = `/messages`;
      const meta = { dmId: dm.id, senderId: dm.senderId };

      // Look up sender's name for the notification text
      const { rows: senderRows } = await pool.query(
        `SELECT name, username FROM users WHERE id = $1`,
        [dm.senderId]
      );
      const senderName = senderRows[0]?.name || senderRows[0]?.username || "Someone";

      // ── First nudge ──────────────────────────────────────────────────────
      if (!dm.followUpNotifiedAt) {
        await notify(
          dm.recipientId,
          "message_needs_reply",
          `Awaiting reply: message from ${senderName}`,
          `You have an unread message from ${senderName} that hasn't been replied to in ${FIRST_NUDGE_HOURS}+ hours.`,
          link,
          meta
        );

        // Mark the whole conversation (all inbound msgs from this sender)
        await pool.query(
          `UPDATE direct_messages
           SET    follow_up_notified_at = NOW()
           WHERE  sender_id    = $1
             AND  recipient_id = $2
             AND  follow_up_state = 'open'`,
          [dm.senderId, dm.recipientId]
        );

        console.log(`[MsgFollowUp] DM first nudge → recipient ${dm.recipientId} (from ${dm.senderId})`);
        continue;
      }

      // ── Escalation ───────────────────────────────────────────────────────
      const sentTime     = new Date(dm.sentAt).getTime();
      const hoursElapsed = (Date.now() - sentTime) / 3_600_000;

      if (hoursElapsed >= ESCALATION_HOURS && !dm.escalatedAt) {
        const adminIds = await getAdminIds();
        for (const uid of adminIds) {
          if (uid === dm.recipientId) continue; // don't double-notify if recipient is admin
          await notify(
            uid,
            "message_needs_reply",
            `ESCALATION: DM from ${senderName} unanswered`,
            `${senderName}'s message to a staff member has gone unanswered for over ${ESCALATION_HOURS} hours.`,
            link,
            { ...meta, escalation: true }
          );
        }

        await pool.query(
          `UPDATE direct_messages
           SET    escalated_at = NOW()
           WHERE  sender_id    = $1
             AND  recipient_id = $2
             AND  follow_up_state = 'open'`,
          [dm.senderId, dm.recipientId]
        );

        console.log(`[MsgFollowUp] DM escalation → admins (sender ${dm.senderId})`);
      }
    }
  } catch (err) {
    console.error("[MsgFollowUp] checkDirectMessages error:", err);
  }
}

// ── Scheduler wiring ──────────────────────────────────────────────────────────
let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function runChecks(): Promise<void> {
  await expireSnoozes();
  await checkMessageThreads();
  await checkDirectMessages();
}

export async function startMessageFollowUpScheduler(): Promise<void> {
  console.log("[MsgFollowUp] Starting message follow-up scheduler (checking every 15 min)...");

  await migrateSchedulerColumns();

  intervalHandle = setInterval(runChecks, CHECK_INTERVAL_MS);

  // Initial run after 20 s so the server is fully booted
  setTimeout(runChecks, 20_000);
}

export function stopMessageFollowUpScheduler(): void {
  if (intervalHandle) clearInterval(intervalHandle);
}
