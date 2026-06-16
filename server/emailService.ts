import sgMail from "@sendgrid/mail";

let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.error("[emailService] SENDGRID_API_KEY is not set");
    return;
  }
  sgMail.setApiKey(apiKey);
  initialized = true;
}

function getFromEmail(): string {
  return process.env.FROM_EMAIL || "noreply@chapinlandscapes.com";
}

function getAppUrl(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN;
  return domain ? `https://${domain}` : "http://localhost:5000";
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  try {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[emailService] DEV MODE — email suppressed. To: ${to}, Subject: "${subject}"`);
      return true;
    }

    ensureInitialized();
    if (!initialized) {
      console.error("[emailService] SendGrid not initialized — skipping email to:", to);
      return false;
    }

    const msg = {
      to,
      from: getFromEmail(),
      subject,
      html: body,
    };

    await sgMail.send(msg);
    console.log(`[emailService] Email sent to ${to}: "${subject}"`);
    return true;
  } catch (err: any) {
    const responseBody = err?.response?.body;
    const errorDetail = responseBody
      ? JSON.stringify(responseBody, null, 2)
      : err.message;
    console.error(`[emailService] Failed to send email to ${to} | Subject: "${subject}" | Error: ${errorDetail}`);
    return false;
  }
}

export async function sendTestEmail(): Promise<boolean> {
  const fromEmail = getFromEmail();
  console.log("[emailService] Sending test email to:", fromEmail);
  return sendEmail(
    fromEmail,
    "Company HQ — SendGrid Test",
    `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Company HQ</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">SendGrid Integration Test</h2>
        <p style="color: #4b5563;">This confirms your SendGrid email service is working correctly.</p>
        <p style="color: #4b5563;">Sent at: ${new Date().toISOString()}</p>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>Company HQ - Landscape Management</p>
      </div>
    </div>
    `
  );
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendOfferAcceptanceEmail(
  to: string,
  name: string,
  role: string,
  acceptanceUrl: string,
  offerLetterUrl?: string
): Promise<boolean> {
  const subject = `Action Required: Review & Accept Your Offer — ${role}`;
  const body = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Chapin Landscapes</h1>
        <p style="color: #bbf7d0; margin: 6px 0 0; font-size: 14px;">Official Offer of Employment</p>
      </div>
      <div style="padding: 32px; background-color: #f9fafb;">
        <h2 style="color: #1f2937; margin-top: 0;">Congratulations, ${escapeHtml(name)}!</h2>
        <p style="color: #4b5563; line-height: 1.6;">
          We are pleased to extend to you an official offer of employment for the position of 
          <strong>${escapeHtml(role)}</strong> at Chapin Landscapes.
        </p>
        <p style="color: #4b5563; line-height: 1.6;">
          Please click the button below to review your offer letter and provide your digital signature to accept.
          This link will expire in <strong>30 days</strong>.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${acceptanceUrl}" 
             style="display: inline-block; background-color: #166534; color: white; padding: 14px 32px; 
                    text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            Review &amp; Accept Offer
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
          If you have any questions before accepting, please reach out to us directly. 
          We look forward to welcoming you to the team!
        </p>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; background-color: #f3f4f6;">
        <p style="margin: 0;">Chapin Landscapes — Company HQ</p>
        <p style="margin: 4px 0 0;">This is an automated message. Do not reply to this email.</p>
      </div>
    </div>
  `;
  return sendEmail(to, subject, body);
}

export { getAppUrl };
