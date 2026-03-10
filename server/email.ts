import { sendEmail, escapeHtml, getAppUrl } from "./emailService";

export async function sendPasswordRecoveryEmail(toEmail: string, recoveryToken: string, userName: string) {
  console.log("[email] Sending password recovery email to:", toEmail);
  const recoveryUrl = `${getAppUrl()}/auth?recovery=${recoveryToken}`;

  return sendEmail(toEmail, "Password Recovery - Company HQ", `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Company HQ</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Password Recovery</h2>
        <p style="color: #4b5563;">Hi ${escapeHtml(userName || "there")},</p>
        <p style="color: #4b5563;">We received a request to reset your password. Use the token below to reset your password:</p>
        <div style="background-color: #e5e7eb; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <code style="font-size: 18px; font-weight: bold; color: #166534;">${recoveryToken}</code>
        </div>
        <p style="color: #4b5563;">Or click the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${recoveryUrl}" style="background-color: #166534; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This token expires in 1 hour. If you didn't request this, please ignore this email.</p>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>Company HQ - Landscape Management</p>
      </div>
    </div>
  `);
}

export async function sendSOPEmail(
  toEmail: string,
  sopTitle: string,
  sopCategory: string,
  sopContent: string,
  lastUpdated?: string
) {
  const appUrl = getAppUrl();
  return sendEmail(toEmail, `SOP: ${sopTitle}`, `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Company HQ</h1>
        <p style="color: #bbf7d0; margin: 4px 0 0 0; font-size: 14px;">Standard Operating Procedure</p>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <div style="margin-bottom: 16px;">
          <span style="background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">${escapeHtml(sopCategory || "Uncategorized")}</span>
        </div>
        <h2 style="color: #166534; margin: 0 0 8px 0; font-size: 24px; border-bottom: 2px solid #166534; padding-bottom: 8px;">${escapeHtml(sopTitle)}</h2>
        <p style="color: #6b7280; font-size: 12px; margin-bottom: 24px;">Last updated: ${lastUpdated ? new Date(lastUpdated).toLocaleDateString() : "N/A"}</p>
        <div style="background: white; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb;">
          ${sopContent}
        </div>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${appUrl}/sops" style="background-color: #166534; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">View in Company HQ</a>
        </div>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>Company HQ - Landscape Management</p>
      </div>
    </div>
  `);
}

export async function sendMaintenanceReminderEmail(
  toEmail: string,
  equipmentName: string,
  taskName: string,
  dueDate?: Date,
  dueMileage?: number,
  dueHours?: number
) {
  let dueInfo = "";
  if (dueDate) {
    dueInfo = `Due on ${dueDate.toLocaleDateString()}`;
  } else if (dueMileage) {
    dueInfo = `Due at ${dueMileage.toLocaleString()} miles`;
  } else if (dueHours) {
    dueInfo = `Due at ${dueHours.toLocaleString()} hours`;
  }

  return sendEmail(toEmail, `Maintenance Reminder: ${taskName} for ${equipmentName}`, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Company HQ</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Maintenance Reminder</h2>
        <p style="color: #4b5563;">A scheduled maintenance task is coming up:</p>
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #92400e; margin: 0 0 10px 0;">${escapeHtml(taskName)}</h3>
          <p style="color: #92400e; margin: 0;"><strong>Equipment:</strong> ${escapeHtml(equipmentName)}</p>
          <p style="color: #92400e; margin: 5px 0 0 0;"><strong>${dueInfo}</strong></p>
        </div>
        <p style="color: #4b5563;">Please schedule this maintenance to keep your equipment in top condition.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${getAppUrl()}/equipment" style="background-color: #166534; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Equipment Tracker</a>
        </div>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>Company HQ - Landscape Management</p>
      </div>
    </div>
  `);
}

export async function sendMessageNotificationEmail(
  toEmail: string,
  recipientName: string,
  senderName: string,
  subject: string,
  messagePreview: string,
  threadId: string
) {
  const messageUrl = `${getAppUrl()}/communications`;
  const truncatedPreview = messagePreview.length > 200
    ? messagePreview.substring(0, 200) + "..."
    : messagePreview;

  return sendEmail(toEmail, `New Message: ${subject}`, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Company HQ</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">New Message</h2>
        <p style="color: #4b5563;">Hi ${escapeHtml(recipientName || "there")}, you have a new message:</p>
        <div style="background-color: #eff6ff; border: 1px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #1e40af; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; font-weight: 600;">Re: ${escapeHtml(subject)}</p>
          <p style="color: #1e3a5f; margin: 0 0 12px 0; font-weight: 600;">From: ${escapeHtml(senderName)}</p>
          <p style="color: #374151; margin: 0; line-height: 1.5;">${escapeHtml(truncatedPreview)}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${messageUrl}" style="background-color: #166534; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Conversation</a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">You can manage email notifications in your profile settings.</p>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>Company HQ - Landscape Management</p>
      </div>
    </div>
  `);
}

export async function sendHiringStageEmail(
  toEmail: string,
  recipientName: string,
  subject: string,
  body: string
) {
  return sendEmail(toEmail, subject, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Chapin Landscapes</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <p style="color: #4b5563;">Hi ${escapeHtml(recipientName || "there")},</p>
        <p style="color: #374151; line-height: 1.6;">${escapeHtml(body)}</p>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>Chapin Landscapes — Hiring Team</p>
      </div>
    </div>
  `);
}

export async function sendHiringWelcomeEmail(
  toEmail: string,
  employeeName: string,
  position: string,
  startDate: string
) {
  return sendEmail(toEmail, `Welcome to Chapin Landscapes — Onboarding Information`, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Chapin Landscapes</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Welcome to the Team!</h2>
        <p style="color: #4b5563;">Hi ${escapeHtml(employeeName)},</p>
        <p style="color: #374151; line-height: 1.6;">Congratulations! We're excited to have you join Chapin Landscapes as a <strong>${escapeHtml(position)}</strong>.</p>
        <div style="background-color: #dcfce7; border: 1px solid #16a34a; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #166534; margin: 0 0 10px 0;">Your Start Date</h3>
          <p style="color: #166534; margin: 0; font-size: 18px; font-weight: bold;">${escapeHtml(startDate)}</p>
        </div>
        <h3 style="color: #1f2937;">What to Expect</h3>
        <ul style="color: #374151; line-height: 1.8;">
          <li>Complete onboarding paperwork (W-4, I-9, direct deposit)</li>
          <li>Attend orientation session on your first day</li>
          <li>Receive your Company HQ login credentials</li>
          <li>Get assigned to your crew and department</li>
        </ul>
        <p style="color: #4b5563;">If you have any questions before your start date, don't hesitate to reach out.</p>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>Chapin Landscapes — Hiring Team</p>
      </div>
    </div>
  `);
}

export async function sendCustomerWelcomeEmail(
  toEmail: string,
  customerName: string,
  tempPassword: string
) {
  const appUrl = getAppUrl();
  return sendEmail(toEmail, "Welcome to Your Chapin Landscapes Customer Portal", `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F7F3EC;">
      <div style="background-color: #1E3A2F; padding: 30px; text-align: center;">
        <h1 style="color: #C9A84C; margin: 0; font-size: 24px;">Chapin Landscapes</h1>
        <p style="color: #F7F3EC; margin: 8px 0 0; font-size: 14px;">Customer Portal</p>
      </div>
      <div style="padding: 30px;">
        <h2 style="color: #1E3A2F; margin-top: 0;">Welcome, ${escapeHtml(customerName)}!</h2>
        <p style="color: #4b5563; line-height: 1.6;">Your customer portal account has been created. You can now view your projects, access documents, read care guides, and message our team.</p>
        <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">Your temporary password:</p>
          <p style="margin: 0; font-size: 18px; font-weight: bold; color: #1E3A2F; letter-spacing: 1px;">${escapeHtml(tempPassword)}</p>
        </div>
        <a href="${appUrl}/auth" style="display: inline-block; background-color: #1E3A2F; color: #C9A84C; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Log In to Your Portal</a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">Please change your password after your first login.</p>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
        <p>Chapin Landscapes</p>
      </div>
    </div>
  `);
}

export async function sendCustomerNotificationEmail(
  toEmail: string,
  customerName: string,
  subject: string,
  message: string,
  ctaText?: string,
  ctaLink?: string
) {
  const appUrl = getAppUrl();
  const ctaHtml = ctaText && ctaLink
    ? `<a href="${appUrl}${ctaLink}" style="display: inline-block; background-color: #1E3A2F; color: #C9A84C; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 16px;">${escapeHtml(ctaText)}</a>`
    : "";

  return sendEmail(toEmail, subject, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F7F3EC;">
      <div style="background-color: #1E3A2F; padding: 20px; text-align: center;">
        <h1 style="color: #C9A84C; margin: 0; font-size: 20px;">Chapin Landscapes</h1>
      </div>
      <div style="padding: 30px;">
        <p style="color: #4b5563;">Hi ${escapeHtml(customerName)},</p>
        <p style="color: #374151; line-height: 1.6;">${escapeHtml(message)}</p>
        ${ctaHtml}
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
        <p>Chapin Landscapes</p>
      </div>
    </div>
  `);
}
