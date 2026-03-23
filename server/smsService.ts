// Twilio SMS Service — Server-to-Server
// Required secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

export function isSmsConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
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
    const payload = new URLSearchParams({ To: normalized, From: from, Body: body }).toString();

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
