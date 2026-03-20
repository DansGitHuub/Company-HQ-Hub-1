import { storage } from "./storage";
import { pool } from "./db";

const DEFAULT_TEMPLATES: Array<{ stage: string; subject: string; body: string }> = [
  {
    stage: "Application Received",
    subject: "We Received Your Application — {{position}}",
    body: `<p>Dear {{name}},</p>
<p>Thank you for applying for the <strong>{{position}}</strong> position at Chapin Landscapes. We have received your application and our team will review it shortly.</p>
<p>We appreciate your interest and will be in touch with next steps.</p>
<p>Best regards,<br>Chapin Landscapes HR Team</p>`,
  },
  {
    stage: "1st Interview",
    subject: "Next Steps: 1st Interview — {{position}}",
    body: `<p>Dear {{name}},</p>
<p>We were impressed with your application for the <strong>{{position}}</strong> position and would like to invite you for a first interview. Our team will follow up with specific details shortly.</p>
<p>Please let us know if you have any questions.</p>
<p>Best regards,<br>Chapin Landscapes HR Team</p>`,
  },
  {
    stage: "Offer Extended",
    subject: "Offer of Employment — {{position}} at Chapin Landscapes",
    body: `<p>Dear {{name}},</p>
<p>We are pleased to extend an offer of employment for the <strong>{{position}}</strong> position at Chapin Landscapes. A formal offer letter with all details will be provided separately.</p>
<p>We are excited about the prospect of you joining our team and look forward to hearing from you.</p>
<p>Best regards,<br>Chapin Landscapes HR Team</p>`,
  },
  {
    stage: "Declined / Not a Fit",
    subject: "Your Application to Chapin Landscapes — {{position}}",
    body: `<p>Dear {{name}},</p>
<p>Thank you for your time and interest in the <strong>{{position}}</strong> position at Chapin Landscapes. After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current needs.</p>
<p>We appreciate the effort you put into your application and encourage you to apply for future positions that align with your skills.</p>
<p>Best regards,<br>Chapin Landscapes HR Team</p>`,
  },
];

export async function seedHiringEmailTemplates(): Promise<void> {
  try {
    const existing = await storage.getHiringEmailTemplates();
    const existingStages = new Set(existing.map((t) => t.stage));

    for (const tmpl of DEFAULT_TEMPLATES) {
      if (!existingStages.has(tmpl.stage)) {
        await storage.upsertHiringEmailTemplate(tmpl.stage, {
          subject: tmpl.subject,
          body: tmpl.body,
          isEnabled: false,
        });
        console.log(`[hiring-templates] Seeded default template for stage: ${tmpl.stage}`);
      }
    }
  } catch (err: any) {
    console.error("[hiring-templates] Failed to seed default templates:", err.message);
  }
}

export async function checkExpiringTokens(): Promise<void> {
  try {
    const expiring = await storage.getExpiringApplicationTokens(3);
    if (expiring.length === 0) return;

    const adminsResult = await pool.query(
      `SELECT id FROM users WHERE role IN ('Admin', 'Manager', 'Master Admin')`
    );
    const adminIds: string[] = adminsResult.rows.map((r: any) => r.id);

    for (const app of expiring) {
      const expiresAt = new Date(app.expires_at);
      const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const name = app.applicant_name || "An applicant";
      const position = app.position || "an open position";

      for (const adminId of adminIds) {
        await storage.createStaffNotification({
          userId: adminId,
          type: "application_token_expiring",
          title: "Application Link Expiring Soon",
          message: `${name}'s application link for ${position} expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. Consider resending the link if needed.`,
          link: "/admin?tab=application-links",
          isRead: false,
        });
      }

      await pool.query(
        `UPDATE job_applications SET expiry_notification_sent_at = NOW() WHERE id = $1`,
        [app.id]
      );
      console.log(`[token-scheduler] Expiry notification sent for application: ${app.id}`);
    }
  } catch (err: any) {
    console.error("[token-scheduler] Error checking expiring tokens:", err.message);
  }
}

export function startApplicationTokenScheduler(): void {
  checkExpiringTokens();

  setInterval(checkExpiringTokens, 24 * 60 * 60 * 1000);

  console.log("[token-scheduler] Application token expiry scheduler started (checking every 24h)");
}
