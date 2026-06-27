import sgMail from "@sendgrid/mail";

// ── helpers ───────────────────────────────────────────────────────────────────

function getFromEmail(): string {
  return process.env.FROM_EMAIL || "noreply@chapinlandscapes.com";
}

function getAppUrl(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN;
  return domain ? `https://${domain}` : "http://localhost:5000";
}

/**
 * Resolve effective recipient and annotate body when in test/redirect mode.
 *
 * Rules:
 *  - If SENDGRID_API_KEY is absent  → log "email skipped" and short-circuit.
 *  - If EMAIL_SENDING_LIVE !== 'true' → redirect every outbound email to
 *    EMAIL_TEST_REDIRECT (default: dan@chapinlandscapes.com) and prepend a
 *    visible banner noting the original intended recipient.
 */
function resolveRecipient(
  to: string,
  body: string,
): { actualTo: string; finalBody: string } {
  const live = process.env.EMAIL_SENDING_LIVE === "true";
  if (live) {
    return { actualTo: to, finalBody: body };
  }

  const redirect = process.env.EMAIL_TEST_REDIRECT || "dan@chapinlandscapes.com";
  const banner = `
    <div style="background:#fef3c7;border:2px solid #f59e0b;padding:10px 14px;
                margin-bottom:16px;border-radius:6px;font-family:Arial,sans-serif;
                font-size:12px;color:#92400e;">
      <strong>⚠ TEST / REDIRECT MODE</strong> — This email was redirected from its
      intended recipient: <strong>${to}</strong>.
      Set <code>EMAIL_SENDING_LIVE=true</code> to send to real addresses.
    </div>`;

  return { actualTo: redirect, finalBody: banner + body };
}

// ── core send ─────────────────────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.log(`[emailService] email skipped (no API key) — To: ${to}, Subject: "${subject}"`);
    return true;
  }

  const { actualTo, finalBody } = resolveRecipient(to, body);

  try {
    sgMail.setApiKey(apiKey);
    await sgMail.send({
      from: getFromEmail(),
      to: actualTo,
      subject,
      html: finalBody,
    });

    console.log(`[emailService] Email sent → ${actualTo} (intended: ${to}), Subject: "${subject}"`);
    return true;
  } catch (err: any) {
    const detail = err.response?.body ? JSON.stringify(err.response.body) : err.message;
    console.error(`[emailService] Failed — To: ${actualTo}, Subject: "${subject}" | ${detail}`);
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
