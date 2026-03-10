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
    console.error("[emailService] Failed to send email:", {
      to,
      subject,
      error: responseBody || err.message,
    });
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

export { getAppUrl };
