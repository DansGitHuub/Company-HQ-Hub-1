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
  body: string,
  statusUrl?: string
) {
  return sendEmail(toEmail, subject, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Chapin Landscapes</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <p style="color: #4b5563;">Hi ${escapeHtml(recipientName || "there")},</p>
        <p style="color: #374151; line-height: 1.6;">${escapeHtml(body)}</p>
        ${statusUrl ? `
        <div style="margin: 24px 0; text-align: center;">
          <a href="${statusUrl}" style="background-color: #166534; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">Check Your Application Status</a>
          <p style="margin: 10px 0 0; color: #9ca3af; font-size: 11px;">Or visit: ${escapeHtml(statusUrl)}</p>
        </div>` : ""}
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

export async function sendZoomInterviewEmail(
  toEmail: string,
  applicantName: string,
  position: string,
  interviewDate: string,
  interviewTime: string,
  zoomUrl: string,
  passcode: string,
  interviewerName?: string,
  notes?: string,
  statusUrl?: string
) {
  return sendEmail(toEmail, `Interview Scheduled — Chapin Landscapes`, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Chapin Landscapes</h1>
        <p style="color: #bbf7d0; margin: 4px 0 0 0; font-size: 14px;">Interview Confirmation</p>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Hi ${escapeHtml(applicantName)},</h2>
        <p style="color: #4b5563;">We are pleased to invite you to an interview for the <strong>${escapeHtml(position)}</strong> position at Chapin Landscapes.</p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; color: #374151;"><strong>📅 Date:</strong> ${escapeHtml(interviewDate)}</p>
          <p style="margin: 0 0 8px 0; color: #374151;"><strong>🕐 Time:</strong> ${escapeHtml(interviewTime)}</p>
          <p style="margin: 0 0 8px 0; color: #374151;"><strong>📹 Format:</strong> Zoom Video Call</p>
          ${interviewerName ? `<p style="margin: 0 0 8px 0; color: #374151;"><strong>👤 Interviewer:</strong> ${escapeHtml(interviewerName)}</p>` : ""}
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
          <p style="margin: 0 0 12px 0; color: #1e40af; font-weight: bold;">Join Your Zoom Interview</p>
          <a href="${zoomUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Join Zoom Meeting</a>
          ${passcode ? `<p style="margin: 12px 0 0 0; color: #4b5563; font-size: 13px;">Passcode: <strong>${escapeHtml(passcode)}</strong></p>` : ""}
          <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 11px; word-break: break-all;">${escapeHtml(zoomUrl)}</p>
        </div>
        ${notes ? `<p style="color: #4b5563;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ""}
        ${statusUrl ? `
        <div style="margin: 24px 0; text-align: center; padding: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
          <p style="margin: 0 0 10px; color: #166534; font-weight: bold; font-size: 13px;">Track Your Application</p>
          <a href="${statusUrl}" style="background-color: #166534; color: white; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px;">View Application Status</a>
        </div>` : ""}
        <p style="color: #4b5563;">If you have any questions or need to reschedule, please contact us:</p>
        <p style="color: #374151;"><strong>Email:</strong> office@chapinlandscapes.com<br><strong>Phone/Text:</strong> 440.226.0518</p>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
        <p>Chapin Landscapes · design • build • maintain · 440.724.8006 · chapinlandscapes.com</p>
      </div>
    </div>
  `);
}

export async function sendInPersonInterviewEmail(
  toEmail: string,
  applicantName: string,
  position: string,
  interviewDate: string,
  interviewTime: string,
  location: string,
  interviewerName?: string,
  notes?: string,
  statusUrl?: string
) {
  return sendEmail(toEmail, `Interview Scheduled — Chapin Landscapes`, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Chapin Landscapes</h1>
        <p style="color: #bbf7d0; margin: 4px 0 0 0; font-size: 14px;">Interview Confirmation</p>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Hi ${escapeHtml(applicantName)},</h2>
        <p style="color: #4b5563;">We are pleased to invite you to an interview for the <strong>${escapeHtml(position)}</strong> position at Chapin Landscapes.</p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; color: #374151;"><strong>📅 Date:</strong> ${escapeHtml(interviewDate)}</p>
          <p style="margin: 0 0 8px 0; color: #374151;"><strong>🕐 Time:</strong> ${escapeHtml(interviewTime)}</p>
          <p style="margin: 0 0 8px 0; color: #374151;"><strong>📍 Location:</strong> ${escapeHtml(location || "To be confirmed")}</p>
          ${interviewerName ? `<p style="margin: 0 0 8px 0; color: #374151;"><strong>👤 Interviewer:</strong> ${escapeHtml(interviewerName)}</p>` : ""}
        </div>
        ${notes ? `<p style="color: #4b5563;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ""}
        ${statusUrl ? `
        <div style="margin: 24px 0; text-align: center; padding: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
          <p style="margin: 0 0 10px; color: #166534; font-weight: bold; font-size: 13px;">Track Your Application</p>
          <a href="${statusUrl}" style="background-color: #166534; color: white; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px;">View Application Status</a>
        </div>` : ""}
        <p style="color: #4b5563;">If you have any questions or need to reschedule, please contact us:</p>
        <p style="color: #374151;"><strong>Email:</strong> office@chapinlandscapes.com<br><strong>Phone/Text:</strong> 440.226.0518</p>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
        <p>Chapin Landscapes · design • build • maintain · 440.724.8006 · chapinlandscapes.com</p>
      </div>
    </div>
  `);
}

export async function sendResignationNotificationEmail(
  toEmail: string,
  adminName: string,
  employeeName: string,
  position: string,
  lastDayOfWork: string
) {
  const appUrl = getAppUrl();
  return sendEmail(toEmail, `Resignation Notice — ${escapeHtml(employeeName)}`, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #7c2d12; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Chapin Landscapes</h1>
        <p style="color: #fed7aa; margin: 4px 0 0 0; font-size: 14px;">HR — Resignation Notice</p>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Hi ${escapeHtml(adminName)},</h2>
        <p style="color: #4b5563; line-height: 1.6;"><strong>${escapeHtml(employeeName)}</strong> (${escapeHtml(position)}) has submitted a resignation letter.</p>
        <div style="background: #fff7ed; border: 1px solid #ea580c; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0; color: #9a3412; font-size: 14px;"><strong>Last Day of Work:</strong> ${escapeHtml(lastDayOfWork)}</p>
        </div>
        <p style="color: #4b5563; line-height: 1.6;">Please review the resignation letter in the employee's file and take appropriate next steps.</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${appUrl}/employees" style="background-color: #7c2d12; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Employee File</a>
        </div>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
        <p>Chapin Landscapes - design, build, maintain - 440.724.8006 - chapinlandscapes.com</p>
      </div>
    </div>
  `);
}

export async function sendTimeOffRequestEmail(
  toEmail: string,
  adminName: string,
  employeeName: string,
  requestType: string,
  startDate: string,
  endDate: string,
  totalDays: number,
  notes?: string
) {
  const appUrl = getAppUrl();
  return sendEmail(toEmail, `Time Off Request — ${escapeHtml(employeeName)}`, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1e40af; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Chapin Landscapes</h1>
        <p style="color: #bfdbfe; margin: 4px 0 0 0; font-size: 14px;">HR — Time Off Request</p>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Hi ${escapeHtml(adminName)},</h2>
        <p style="color: #4b5563; line-height: 1.6;"><strong>${escapeHtml(employeeName)}</strong> has submitted a time off request.</p>
        <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; color: #1e40af; font-size: 14px;"><strong>Type:</strong> ${escapeHtml(requestType)}</p>
          <p style="margin: 0 0 8px 0; color: #1e40af; font-size: 14px;"><strong>Start Date:</strong> ${escapeHtml(startDate)}</p>
          <p style="margin: 0 0 8px 0; color: #1e40af; font-size: 14px;"><strong>End Date:</strong> ${escapeHtml(endDate)}</p>
          <p style="margin: 0 0 8px 0; color: #1e40af; font-size: 14px;"><strong>Total Days:</strong> ${totalDays}</p>
          ${notes ? `<p style="margin: 0; color: #1e40af; font-size: 14px;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ""}
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${appUrl}/employees" style="background-color: #1e40af; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Review Request</a>
        </div>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
        <p>Chapin Landscapes - design, build, maintain - 440.724.8006 - chapinlandscapes.com</p>
      </div>
    </div>
  `);
}

export async function sendHiredNotificationEmail(
  toEmail: string,
  adminName: string,
  candidateName: string,
  position: string,
  username: string
) {
  const appUrl = getAppUrl();
  return sendEmail(toEmail, `New Hire — ${escapeHtml(candidateName)} (${escapeHtml(position)})`, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #166534; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Chapin Landscapes</h1>
        <p style="color: #bbf7d0; margin: 4px 0 0 0; font-size: 14px;">HR — New Hire Notification</p>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Hi ${escapeHtml(adminName)},</h2>
        <p style="color: #4b5563; line-height: 1.6;"><strong>${escapeHtml(candidateName)}</strong> has been hired as <strong>${escapeHtml(position)}</strong>.</p>
        <div style="background: #dcfce7; border: 1px solid #16a34a; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; color: #166534; font-size: 14px;">Employee record created automatically</p>
          <p style="margin: 0 0 8px 0; color: #166534; font-size: 14px;">Onboarding checklist generated (I-9, W-4, NDA and more)</p>
          <p style="margin: 0 0 8px 0; color: #166534; font-size: 14px;">Crew account created — username: <strong>${escapeHtml(username)}</strong></p>
          <p style="margin: 0; color: #166534; font-size: 14px;">Welcome email with login credentials sent to employee</p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${appUrl}/hiring" style="background-color: #166534; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Hiring Pipeline</a>
        </div>
      </div>
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
        <p>Chapin Landscapes - design, build, maintain - 440.724.8006 - chapinlandscapes.com</p>
      </div>
    </div>
  `);
}
