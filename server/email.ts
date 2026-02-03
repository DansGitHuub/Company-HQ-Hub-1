import { Resend } from 'resend';

let connectionSettings: any;

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
  
  const recoveryUrl = `${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}/auth?recovery=${recoveryToken}`;
  
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
            <a href="${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}/equipment" style="background-color: #166534; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Equipment Tracker</a>
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
