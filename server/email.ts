import { sendEmail, escapeHtml, getAppUrl } from "./emailService";
import { emailT } from "./emailTranslations";

export async function sendPasswordRecoveryEmail(toEmail: string, recoveryToken: string, userName: string, language?: string) {
  console.log("[email] Sending password recovery email to:", toEmail);
  const recoveryUrl = `${getAppUrl()}/auth?recovery=${recoveryToken}`;
  const t = (key: string) => emailT(language, key);

  return sendEmail(toEmail, t("passwordRecoverySubject"), `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Company HQ</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">${t("passwordRecovery")}</h2>
        <p style="color: #4b5563;">${t("hi")} ${escapeHtml(userName || t("there"))},</p>
        <p style="color: #4b5563;">${t("resetRequest")}</p>
        <div style="background-color: #e5e7eb; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <code style="font-size: 18px; font-weight: bold; color: #166534;">${recoveryToken}</code>
        </div>
        <p style="color: #4b5563;">${t("orClickBelow")}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${recoveryUrl}" style="background-color: #166534; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">${t("resetPassword")}</a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">${t("tokenExpires")}</p>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>${t("companyFooter")}</p>
      </div>
    </div>
  `);
}

export async function sendSOPEmail(
  toEmail: string,
  sopTitle: string,
  sopCategory: string,
  sopContent: string,
  lastUpdated?: string,
  language?: string
) {
  const appUrl = getAppUrl();
  const t = (key: string) => emailT(language, key);
  return sendEmail(toEmail, `${t("sop")}: ${sopTitle}`, `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Company HQ</h1>
        <p style="color: #bbf7d0; margin: 4px 0 0 0; font-size: 14px;">${t("sop")}</p>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <div style="margin-bottom: 16px;">
          <span style="background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">${escapeHtml(sopCategory || "Uncategorized")}</span>
        </div>
        <h2 style="color: #166534; margin: 0 0 8px 0; font-size: 24px; border-bottom: 2px solid #166534; padding-bottom: 8px;">${escapeHtml(sopTitle)}</h2>
        <p style="color: #6b7280; font-size: 12px; margin-bottom: 24px;">${t("lastUpdated")}: ${lastUpdated ? new Date(lastUpdated).toLocaleDateString() : "N/A"}</p>
        <div style="background: white; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb;">
          ${sopContent}
        </div>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${appUrl}/sops" style="background-color: #166534; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">${t("viewInCompanyHQ")}</a>
        </div>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>${t("companyFooter")}</p>
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
  dueHours?: number,
  language?: string
) {
  const t = (key: string) => emailT(language, key);
  let dueInfo = "";
  if (dueDate) {
    dueInfo = `${t("dueOn")} ${dueDate.toLocaleDateString()}`;
  } else if (dueMileage) {
    dueInfo = t("dueAtMiles").replace("{{miles}}", dueMileage.toLocaleString());
  } else if (dueHours) {
    dueInfo = t("dueAtHours").replace("{{hours}}", dueHours.toLocaleString());
  }

  return sendEmail(toEmail, `${t("maintenanceSubject")}: ${taskName} - ${equipmentName}`, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Company HQ</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">${t("maintenanceReminder")}</h2>
        <p style="color: #4b5563;">${t("maintenanceIntro")}</p>
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #92400e; margin: 0 0 10px 0;">${escapeHtml(taskName)}</h3>
          <p style="color: #92400e; margin: 0;"><strong>${t("equipment")}:</strong> ${escapeHtml(equipmentName)}</p>
          <p style="color: #92400e; margin: 5px 0 0 0;"><strong>${dueInfo}</strong></p>
        </div>
        <p style="color: #4b5563;">${t("maintenanceSchedulePrompt")}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${getAppUrl()}/equipment" style="background-color: #166534; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">${t("viewEquipmentTracker")}</a>
        </div>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>${t("companyFooter")}</p>
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
  threadId: string,
  language?: string
) {
  const t = (key: string) => emailT(language, key);
  const messageUrl = `${getAppUrl()}/communications`;
  const truncatedPreview = messagePreview.length > 200
    ? messagePreview.substring(0, 200) + "..."
    : messagePreview;

  return sendEmail(toEmail, `${t("newMessage")}: ${subject}`, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Company HQ</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">${t("newMessage")}</h2>
        <p style="color: #4b5563;">${t("hi")} ${escapeHtml(recipientName || t("there"))}, ${t("newMessageIntro")}</p>
        <div style="background-color: #eff6ff; border: 1px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #1e40af; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; font-weight: 600;">Re: ${escapeHtml(subject)}</p>
          <p style="color: #1e3a5f; margin: 0 0 12px 0; font-weight: 600;">${t("from")}: ${escapeHtml(senderName)}</p>
          <p style="color: #374151; margin: 0; line-height: 1.5;">${escapeHtml(truncatedPreview)}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${messageUrl}" style="background-color: #166534; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">${t("viewConversation")}</a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">${t("manageNotifications")}</p>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>${t("companyFooter")}</p>
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
  startDate: string,
  language?: string
) {
  const t = (key: string) => emailT(language, key);
  return sendEmail(toEmail, t("welcomeOnboarding"), `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Chapin Landscapes</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">${t("welcomeTeam")}</h2>
        <p style="color: #4b5563;">${t("hi")} ${escapeHtml(employeeName)},</p>
        <p style="color: #374151; line-height: 1.6;">${t("congratulations")} <strong>${escapeHtml(position)}</strong>.</p>
        <div style="background-color: #dcfce7; border: 1px solid #16a34a; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #166534; margin: 0 0 10px 0;">${t("yourStartDate")}</h3>
          <p style="color: #166534; margin: 0; font-size: 18px; font-weight: bold;">${escapeHtml(startDate)}</p>
        </div>
        <h3 style="color: #1f2937;">${t("whatToExpect")}</h3>
        <ul style="color: #374151; line-height: 1.8;">
          <li>${t("onboardingItem1")}</li>
          <li>${t("onboardingItem2")}</li>
          <li>${t("onboardingItem3")}</li>
          <li>${t("onboardingItem4")}</li>
        </ul>
        <p style="color: #4b5563;">${t("questionsBeforeStart")}</p>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>Chapin Landscapes — ${t("hiringTeam")}</p>
      </div>
    </div>
  `);
}

export async function sendNewHireAccountEmail(
  toEmail: string,
  employeeName: string,
  username: string,
  tempPassword: string,
  position: string,
  language?: string
) {
  const appUrl = getAppUrl();
  const t = (key: string) => emailT(language, key);
  return sendEmail(toEmail, `Your Company HQ Account is Ready — ${escapeHtml(position)}`, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Chapin Landscapes</h1>
        <p style="color: #bbf7d0; margin: 6px 0 0; font-size: 14px;">Company HQ — Employee Portal</p>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Welcome to the team, ${escapeHtml(employeeName)}!</h2>
        <p style="color: #4b5563; line-height: 1.6;">Your Company HQ account has been created. You can log in to complete your onboarding forms and access your employee portal.</p>
        <div style="background-color: #dcfce7; border: 1px solid #16a34a; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #166534; margin: 0 0 12px 0;">Your Login Credentials</h3>
          <p style="margin: 6px 0; color: #374151;"><strong>Username:</strong> <code style="background:#fff; padding:2px 6px; border-radius:4px; font-size:15px;">${escapeHtml(username)}</code></p>
          <p style="margin: 6px 0; color: #374151;"><strong>Temporary Password:</strong> <code style="background:#fff; padding:2px 6px; border-radius:4px; font-size:15px;">${escapeHtml(tempPassword)}</code></p>
        </div>
        <p style="color: #6b7280; font-size: 13px;">Please log in and change your password on your first visit. Keep these credentials private.</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${appUrl}" style="background-color: #166534; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Log In to Company HQ</a>
        </div>
        <p style="color: #4b5563; font-size: 14px;">Once logged in, head to your <strong>Onboarding</strong> section to complete your new hire paperwork.</p>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>Chapin Landscapes — HR Team</p>
      </div>
    </div>
  `);
}

export async function sendCustomerWelcomeEmail(
  toEmail: string,
  customerName: string,
  tempPassword: string,
  language?: string
) {
  const appUrl = getAppUrl();
  const t = (key: string) => emailT(language, key);
  return sendEmail(toEmail, t("welcomePortalSubject"), `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F7F3EC;">
      <div style="background-color: #1E3A2F; padding: 30px; text-align: center;">
        <h1 style="color: #C9A84C; margin: 0; font-size: 24px;">Chapin Landscapes</h1>
        <p style="color: #F7F3EC; margin: 8px 0 0; font-size: 14px;">${t("customerPortal")}</p>
      </div>
      <div style="padding: 30px;">
        <h2 style="color: #1E3A2F; margin-top: 0;">${t("welcomeCustomer")}, ${escapeHtml(customerName)}!</h2>
        <p style="color: #4b5563; line-height: 1.6;">${t("customerPortalIntro")}</p>
        <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">${t("tempPassword")}</p>
          <p style="margin: 0; font-size: 18px; font-weight: bold; color: #1E3A2F; letter-spacing: 1px;">${escapeHtml(tempPassword)}</p>
        </div>
        <a href="${appUrl}/auth" style="display: inline-block; background-color: #1E3A2F; color: #C9A84C; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">${t("loginToPortal")}</a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">${t("changePasswordPrompt")}</p>
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
  ctaLink?: string,
  language?: string
) {
  const appUrl = getAppUrl();
  const t = (key: string) => emailT(language, key);
  const ctaHtml = ctaText && ctaLink
    ? `<a href="${appUrl}${ctaLink}" style="display: inline-block; background-color: #1E3A2F; color: #C9A84C; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 16px;">${escapeHtml(ctaText)}</a>`
    : "";

  return sendEmail(toEmail, subject, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F7F3EC;">
      <div style="background-color: #1E3A2F; padding: 20px; text-align: center;">
        <h1 style="color: #C9A84C; margin: 0; font-size: 20px;">Chapin Landscapes</h1>
      </div>
      <div style="padding: 30px;">
        <p style="color: #4b5563;">${t("hi")} ${escapeHtml(customerName)},</p>
        <p style="color: #374151; line-height: 1.6;">${escapeHtml(message)}</p>
        ${ctaHtml}
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
        <p>Chapin Landscapes</p>
      </div>
    </div>
  `);
}

export async function sendSuggestionConfirmationEmail(toEmail: string, customerName: string, suggestionTitle: string, language?: string) {
  const t = (key: string) => emailT(language, key);
  return sendEmail(toEmail, t("suggestionReceived"), `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F7F3EC;">
      <div style="background-color: #1E3A2F; padding: 20px; text-align: center;">
        <h1 style="color: #C9A84C; margin: 0; font-size: 20px;">Chapin Landscapes</h1>
      </div>
      <div style="padding: 30px;">
        <p style="color: #4b5563;">${t("hi")} ${escapeHtml(customerName)},</p>
        <p style="color: #374151; line-height: 1.6;">${t("suggestionThanks")}</p>
        <div style="background-color: #e5e7eb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #1f2937; font-weight: bold; margin: 0;">${t("yourSuggestion")}</p>
          <p style="color: #374151; margin: 8px 0 0 0;">${escapeHtml(suggestionTitle)}</p>
        </div>
        <p style="color: #374151; line-height: 1.6;">${t("suggestionFollowUp")}</p>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
        <p>Chapin Landscapes</p>
      </div>
    </div>
  `);
}

export async function sendSuggestionStatusUpdateEmail(
  toEmail: string,
  customerName: string,
  suggestionTitle: string,
  newStatus: string,
  adminNote?: string | null,
  language?: string
) {
  const t = (key: string) => emailT(language, key);
  const statusLabels: Record<string, string> = {
    received: t("received"),
    reviewing: t("reviewing"),
    planned: t("planned"),
    completed: t("completed"),
    not_planned: t("notPlanned"),
  };
  const statusLabel = statusLabels[newStatus] || newStatus;

  const noteHtml = adminNote
    ? `<div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #1E3A2F;">
        <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">${t("noteFromTeam")}</p>
        <p style="color: #374151; margin: 0;">${escapeHtml(adminNote)}</p>
      </div>`
    : "";

  return sendEmail(toEmail, `${t("updateOnSuggestion")}: ${suggestionTitle}`, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F7F3EC;">
      <div style="background-color: #1E3A2F; padding: 20px; text-align: center;">
        <h1 style="color: #C9A84C; margin: 0; font-size: 20px;">Chapin Landscapes</h1>
      </div>
      <div style="padding: 30px;">
        <p style="color: #4b5563;">${t("hi")} ${escapeHtml(customerName)},</p>
        <p style="color: #374151; line-height: 1.6;">${t("suggestionUpdate")}</p>
        <div style="background-color: #e5e7eb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #1f2937; font-weight: bold; margin: 0;">${escapeHtml(suggestionTitle)}</p>
          <p style="color: #374151; margin: 8px 0 0 0;">${t("newStatus")}: <strong>${escapeHtml(statusLabel)}</strong></p>
        </div>
        ${noteHtml}
        <p style="color: #374151; line-height: 1.6;">${t("suggestionFeedbackThanks")}</p>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
        <p>Chapin Landscapes</p>
      </div>
    </div>
  `);
}

export async function sendNewApplicationNotificationEmail(
  toEmail: string,
  applicantName: string,
  position: string,
  appUrl: string
) {
  return sendEmail(toEmail, `New Job Application Received — ${applicantName}`, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Chapin Landscapes</h1>
        <p style="color: #bbf7d0; margin: 4px 0 0 0; font-size: 14px;">New Application Received</p>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">New Application from ${escapeHtml(applicantName)}</h2>
        <p style="color: #4b5563;">A new job application has been submitted for the position of <strong>${escapeHtml(position)}</strong>.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${appUrl}/hiring" style="background-color: #166534; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">View in Company HQ</a>
        </div>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
        <p>Chapin Landscapes · 440.724.8006 · chapinlandscapes.com</p>
      </div>
    </div>
  `);
}
