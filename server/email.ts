import { Resend } from 'resend';

let connectionSettings: any;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAppUrl(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || process.env.REPLIT_DEV_DOMAIN;
  return domain ? `https://${domain}` : 'http://localhost:5000';
}

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendPasswordRecoveryEmail(toEmail: string, recoveryToken: string, userName: string) {
  console.log("[email] Attempting to send password recovery email to:", toEmail);
  const { client, fromEmail } = await getResendClient();
  console.log("[email] Got Resend client, fromEmail:", fromEmail);
  
  const recoveryUrl = `${getAppUrl()}/auth?recovery=${recoveryToken}`;
  
  // Use verified domain for sending emails
  const senderEmail = 'Company HQ <noreply@chapinlandscapes.com>';
  
  const { data, error } = await client.emails.send({
    from: senderEmail,
    to: toEmail,
    subject: 'Password Recovery - Company HQ',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #166534; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Company HQ</h1>
        </div>
        <div style="padding: 30px; background-color: #f9fafb;">
          <h2 style="color: #1f2937;">Password Recovery</h2>
          <p style="color: #4b5563;">Hi ${userName || 'there'},</p>
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
    `
  });

  if (error) {
    console.error('Error sending recovery email:', error);
    throw new Error('Failed to send recovery email');
  }

  return data;
}

export async function sendSOPEmail(
  toEmail: string,
  sopTitle: string,
  sopCategory: string,
  sopContent: string,
  lastUpdated?: string
) {
  const { client, fromEmail } = await getResendClient();

  const senderEmail = 'Company HQ <noreply@chapinlandscapes.com>';
  const appUrl = getAppUrl();

  const { data, error } = await client.emails.send({
    from: senderEmail,
    to: toEmail,
    subject: `SOP: ${sopTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <div style="background-color: #166534; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Company HQ</h1>
          <p style="color: #bbf7d0; margin: 4px 0 0 0; font-size: 14px;">Standard Operating Procedure</p>
        </div>
        <div style="padding: 30px; background-color: #f9fafb;">
          <div style="margin-bottom: 16px;">
            <span style="background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">${sopCategory || "Uncategorized"}</span>
          </div>
          <h2 style="color: #166534; margin: 0 0 8px 0; font-size: 24px; border-bottom: 2px solid #166534; padding-bottom: 8px;">${sopTitle}</h2>
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
    `
  });

  if (error) {
    console.error('Error sending SOP email:', error);
    throw new Error('Failed to send SOP email');
  }

  return data;
}

export async function sendMaintenanceReminderEmail(
  toEmail: string, 
  equipmentName: string, 
  taskName: string, 
  dueDate?: Date,
  dueMileage?: number,
  dueHours?: number
) {
  const { client, fromEmail } = await getResendClient();
  
  let dueInfo = '';
  if (dueDate) {
    dueInfo = `Due on ${dueDate.toLocaleDateString()}`;
  } else if (dueMileage) {
    dueInfo = `Due at ${dueMileage.toLocaleString()} miles`;
  } else if (dueHours) {
    dueInfo = `Due at ${dueHours.toLocaleString()} hours`;
  }

  // Use verified domain for sending emails
  const senderEmail = 'Company HQ <noreply@chapinlandscapes.com>';
  
  const { data, error } = await client.emails.send({
    from: senderEmail,
    to: toEmail,
    subject: `Maintenance Reminder: ${taskName} for ${equipmentName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #166534; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Company HQ</h1>
        </div>
        <div style="padding: 30px; background-color: #f9fafb;">
          <h2 style="color: #1f2937;">Maintenance Reminder</h2>
          <p style="color: #4b5563;">A scheduled maintenance task is coming up:</p>
          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #92400e; margin: 0 0 10px 0;">${taskName}</h3>
            <p style="color: #92400e; margin: 0;"><strong>Equipment:</strong> ${equipmentName}</p>
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
    `
  });

  if (error) {
    console.error('Error sending maintenance reminder email:', error);
    throw new Error('Failed to send maintenance reminder email');
  }

  return data;
}

export async function sendMessageNotificationEmail(
  toEmail: string,
  recipientName: string,
  senderName: string,
  subject: string,
  messagePreview: string,
  threadId: string
) {
  const { client } = await getResendClient();
  const senderEmail = 'Company HQ <noreply@chapinlandscapes.com>';
  const appUrl = getAppUrl();
  const messageUrl = `${appUrl}/communications`;

  const truncatedPreview = messagePreview.length > 200
    ? messagePreview.substring(0, 200) + '...'
    : messagePreview;

  const { data, error } = await client.emails.send({
    from: senderEmail,
    to: toEmail,
    subject: `New Message: ${subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #166534; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Company HQ</h1>
        </div>
        <div style="padding: 30px; background-color: #f9fafb;">
          <h2 style="color: #1f2937;">New Message</h2>
          <p style="color: #4b5563;">Hi ${escapeHtml(recipientName || 'there')}, you have a new message:</p>
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
    `
  });

  if (error) {
    console.error('Error sending message notification email:', error);
    throw new Error('Failed to send message notification email');
  }

  return data;
}

export async function sendHiringStageEmail(
  toEmail: string,
  recipientName: string,
  subject: string,
  body: string
) {
  const { client } = await getResendClient();
  const senderEmail = 'Company HQ <noreply@chapinlandscapes.com>';

  const { data, error } = await client.emails.send({
    from: senderEmail,
    to: toEmail,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #166534; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Chapin Landscapes</h1>
        </div>
        <div style="padding: 30px; background-color: #f9fafb;">
          <p style="color: #4b5563;">Hi ${escapeHtml(recipientName || 'there')},</p>
          <p style="color: #374151; line-height: 1.6;">${escapeHtml(body)}</p>
        </div>
        <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>Chapin Landscapes — Hiring Team</p>
        </div>
      </div>
    `
  });

  if (error) {
    console.error('Error sending hiring stage email:', error);
    throw new Error('Failed to send hiring stage email');
  }

  return data;
}
