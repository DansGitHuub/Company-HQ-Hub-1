import type { Express } from "express";
import { pool } from "./db";
import { sendEmail, escapeHtml, getAppUrl } from "./emailService";

async function sendStaffNotificationDb(userId: string, type: string, title: string, message: string, link: string) {
  try {
    await pool.query(
      `INSERT INTO staff_notifications (id, user_id, type, title, message, link, is_read, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, FALSE, NOW())`,
      [userId, type, title, message, link]
    );
  } catch (err: any) {
    console.error("[inquiry-notification]", err.message);
  }
}

export async function registerPublicInquiryRoutes(app: Express) {
  // ── SUBMIT INQUIRY (public, no auth) ─────────────────────────────────────────
  app.post("/api/inquiry/submit", async (req, res) => {
    try {
      const {
        first_name, last_name, email, phone, property_address,
        best_time_to_reach, how_heard, service_type, project_type,
        project_description, desired_timeline, budget_range,
        additional_notes, photo_urls, agreement_accepted, sms_consent,
      } = req.body;

      if (!first_name || !last_name || !email) {
        return res.status(400).json({ error: "First name, last name and email are required" });
      }
      if (!project_description) {
        return res.status(400).json({ error: "Project description is required" });
      }
      if (!agreement_accepted) {
        return res.status(400).json({ error: "Agreement must be accepted" });
      }
      // If SMS consent is given, a phone number is required to receive texts
      if (sms_consent && !phone?.trim()) {
        return res.status(400).json({ error: "A phone number is required when you opt in to text messages." });
      }

      const contactName = `${first_name} ${last_name}`;
      const smsConsentGiven = sms_consent === true;
      const submitterIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() || req.ip || null;

      // Create consultation
      const { rows } = await pool.query(`
        INSERT INTO consultations (
          contact_name, contact_phone, contact_email, address,
          pipeline_stage, service_type, best_time_to_reach, how_heard,
          project_type, project_description, desired_timeline, budget_range,
          additional_notes, photo_urls, status,
          sms_consent, sms_consent_at, sms_consent_ip
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,'scheduled',$15,$16,$17)
        RETURNING *
      `, [
        contactName, phone || null, email, property_address || null,
        "new_lead", service_type || null, best_time_to_reach || null, how_heard || null,
        project_type || null, project_description, desired_timeline || null, budget_range || null,
        additional_notes || null, JSON.stringify(photo_urls || []),
        smsConsentGiven,
        smsConsentGiven ? new Date() : null,
        smsConsentGiven ? submitterIp : null,
      ]);

      const created = rows[0];

      // Send customer confirmation email
      await sendEmail(email, "We received your inquiry — Chapin Landscapes", `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #166534; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">Chapin Landscapes</h1>
            <p style="color: #bbf7d0; margin: 6px 0 0; font-size: 14px;">Landscape Management</p>
          </div>
          <div style="padding: 32px; background-color: #f9fafb;">
            <h2 style="color: #1f2937; margin-top: 0;">Thank you, ${escapeHtml(first_name)}!</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              We've received your inquiry and one of our team members will be in touch with you soon.
            </p>
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #166534; margin: 0 0 12px;">Your Inquiry Summary</h3>
              <p style="margin: 4px 0;"><strong>Service:</strong> ${escapeHtml(service_type || "Not specified")}</p>
              <p style="margin: 4px 0;"><strong>Address:</strong> ${escapeHtml(property_address || "Not provided")}</p>
              <p style="margin: 4px 0;"><strong>Budget:</strong> ${escapeHtml(budget_range || "Not specified")}</p>
            </div>
            <p style="color: #6b7280; font-size: 13px;">Questions? Call us or reply to this email.</p>
          </div>
          <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
            <p>Chapin Landscapes — Professional Landscape Management</p>
          </div>
        </div>
      `);

      // Notify Dan
      const { rows: danRows } = await pool.query(`SELECT id, email, name FROM users WHERE email ILIKE 'dan@chapinlandscapes.com' LIMIT 1`);
      if (danRows[0]) {
        const msg = `New lead received from ${contactName} - ${service_type || "N/A"} - Budget: ${budget_range || "Not provided"}`;
        await sendStaffNotificationDb(danRows[0].id, "new_lead", "New Inquiry Received", msg, `/consultations`);
        await sendEmail(danRows[0].email, "New Website Inquiry — Chapin Landscapes", `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #166534; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">New Website Inquiry</h1>
            </div>
            <div style="padding: 30px; background-color: #f9fafb;">
              <table style="width:100%; border-collapse:collapse; margin:16px 0;">
                <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f3f4f6;">Name</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(contactName)}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f3f4f6;">Email</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(email)}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f3f4f6;">Phone</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(phone || "N/A")}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f3f4f6;">Address</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(property_address || "N/A")}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f3f4f6;">Service</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(service_type || "N/A")}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f3f4f6;">Budget</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(budget_range || "N/A")}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f3f4f6;">How Heard</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(how_heard || "N/A")}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f3f4f6;">Best Time</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(best_time_to_reach || "N/A")}</td></tr>
              </table>
              <h4 style="color:#166534;">Project Description:</h4>
              <p style="background:white;padding:12px;border:1px solid #e5e7eb;border-radius:6px;">${escapeHtml(project_description)}</p>
              <div style="text-align:center;margin-top:24px;">
                <a href="${getAppUrl()}/consultations" style="background-color:#166534;color:white;padding:10px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">View in CompanyHQ</a>
              </div>
            </div>
          </div>
        `);
      }

      res.status(201).json({ success: true, id: created.id });
    } catch (err: any) {
      console.error("[inquiry/submit]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── EMBED CODE for Dan to paste
  app.get("/api/inquiry/embed-code", async (_req, res) => {
    const appUrl = getAppUrl();
    const embedCode = `<!-- Chapin Landscapes Inquiry Form Embed -->
<iframe
  src="${appUrl}/inquiry"
  width="100%"
  height="900"
  style="border: none; border-radius: 8px; box-shadow: 0 2px 16px rgba(0,0,0,0.1);"
  title="Chapin Landscapes - Request a Quote"
></iframe>`;
    res.json({ embedCode });
  });
}
