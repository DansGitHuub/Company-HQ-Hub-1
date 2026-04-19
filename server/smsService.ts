// Twilio SMS Service — Server-to-Server
// Required secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID (preferred) or TWILIO_PHONE_NUMBER

export function isSmsConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_PHONE_NUMBER)
  );
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || (!messagingServiceSid && !from)) {
    console.warn("[sms] Twilio credentials not configured — skipping SMS to:", to);
    return false;
  }

  // Normalize phone number to E.164 format
  const normalized = normalizePhone(to);
  if (!normalized) {
    console.warn("[sms] Invalid phone number, skipping:", to);
    return false;
  }

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    // Prefer MessagingServiceSid over From number
    const params: Record<string, string> = { To: normalized, Body: body };
    if (messagingServiceSid) {
      params.MessagingServiceSid = messagingServiceSid;
    } else {
      params.From = from!;
    }

    const payload = new URLSearchParams(params).toString();

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload,
      }
    );

    const data = await response.json() as any;

    if (!response.ok) {
      console.error("[sms] Twilio error:", data?.message || data);
      return false;
    }

    console.log(`[sms] SMS sent to ${normalized} (SID: ${data.sid})`);
    return true;
  } catch (err: any) {
    console.error("[sms] Failed to send SMS:", err.message);
    return false;
  }
}

function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return null;
}

export async function sendStageSms(
  to: string,
  candidateName: string,
  stage: string,
  position: string
): Promise<boolean> {
  const firstName = candidateName.split(" ")[0];
  const pos = position || "the position";
  const messages: Record<string, string> = {
    "Application Received": `Hi ${firstName}, we received your application for the ${pos} position at Chapin Landscapes. We'll be in touch soon!`,
    "Review & Rate": `Hi ${firstName}, your application for the ${pos} position at Chapin Landscapes is currently under review. We'll update you soon.`,
    "Phone Screen": `Hi ${firstName}, we'd like to schedule a brief phone call with you regarding the ${pos} position at Chapin Landscapes. Please watch for our call!`,
    "1st Interview": `Hi ${firstName}, thank you for interviewing with Chapin Landscapes for the ${pos} position! We're reviewing and will be in touch soon.`,
    "2nd Interview": `Hi ${firstName}, we'd like to invite you for a second interview for the ${pos} position at Chapin Landscapes. We'll contact you with details.`,
    "Offer Extended": `Hi ${firstName}, we're excited to extend an offer for the ${pos} position! Please check your email for the full offer details and acceptance link.`,
    "Hired": `Hi ${firstName}, welcome to the Chapin Landscapes team! Check your email for your account credentials and onboarding information.`,
    "Declined / Not a Fit": `Hi ${firstName}, thank you for your interest in Chapin Landscapes. After careful consideration, we've decided to move forward with other candidates at this time. We wish you the best!`,
  };
  const body = messages[stage] || `Hi ${firstName}, your application status for the ${pos} position at Chapin Landscapes has been updated. Please check your email for details.`;
  return sendSms(to, body);
}

export async function sendHireSms(
  to: string,
  candidateName: string,
  position: string
): Promise<boolean> {
  const firstName = candidateName.split(" ")[0];
  const body = `Hi ${firstName}, welcome to the Chapin Landscapes team! Your account credentials and onboarding information have been sent to your email.`;
  return sendSms(to, body);
}

export async function sendInterviewSms(
  to: string,
  candidateName: string,
  date: string,
  time: string,
  type: "zoom" | "in-person",
  zoomUrl?: string,
  location?: string
): Promise<boolean> {
  let message: string;

  if (type === "zoom" && zoomUrl) {
    message = `Hi ${candidateName.split(" ")[0]}, your Zoom interview with Chapin Landscapes is scheduled for ${date} at ${time}. Join here: ${zoomUrl}`;
  } else {
    message = `Hi ${candidateName.split(" ")[0]}, your interview with Chapin Landscapes is scheduled for ${date} at ${time}${location ? ` at ${location}` : ""}. We look forward to meeting you!`;
  }

  return sendSms(to, message);
}
