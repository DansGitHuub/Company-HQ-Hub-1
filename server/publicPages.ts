import { type Express, type Request, type Response } from "express";
import { pool } from "./db";

// ── Shared HTML shell ────────────────────────────────────────────────────────
const GREEN = "#2d5016";

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Chapin Landscapes</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8f9fa; color: #212529; line-height: 1.6; }
    header { background: ${GREEN}; color: #fff; padding: 18px 24px; }
    header h1 { font-size: 1.25rem; font-weight: 700; letter-spacing: .5px; }
    header p  { font-size: .85rem; opacity: .85; margin-top: 2px; }
    main { max-width: 800px; margin: 40px auto; padding: 0 24px 60px; background: #fff; border-radius: 8px; box-shadow: 0 1px 6px rgba(0,0,0,.08); }
    main > * { padding: 0 36px; }
    h2 { font-size: 1.5rem; font-weight: 700; color: ${GREEN}; padding-top: 36px; padding-bottom: 4px; }
    h3 { font-size: 1.05rem; font-weight: 600; margin-top: 22px; margin-bottom: 6px; color: #333; }
    p  { margin-top: 10px; font-size: .95rem; color: #444; }
    ul { margin-top: 8px; padding-left: 20px; }
    li { margin-bottom: 5px; font-size: .95rem; color: #444; }
    a  { color: ${GREEN}; }
    .nav-links { display: flex; gap: 16px; padding-top: 28px; padding-bottom: 20px; font-size: .9rem; border-top: 1px solid #e9ecef; margin-top: 36px; }
    /* form styles */
    form { padding-top: 24px; }
    label { display: block; font-weight: 600; font-size: .9rem; margin-top: 16px; margin-bottom: 4px; color: #333; }
    input[type=text], input[type=tel], input[type=email] {
      width: 100%; padding: 9px 12px; border: 1px solid #ced4da; border-radius: 5px;
      font-size: .95rem; outline: none;
    }
    input[type=text]:focus, input[type=tel]:focus, input[type=email]:focus { border-color: ${GREEN}; box-shadow: 0 0 0 2px rgba(45,80,22,.15); }
    .checkbox-row { display: flex; align-items: flex-start; gap: 10px; margin-top: 18px; }
    .checkbox-row input { margin-top: 3px; flex-shrink: 0; }
    .checkbox-row span { font-size: .88rem; color: #555; }
    button[type=submit] {
      margin-top: 24px; padding: 11px 32px; background: ${GREEN}; color: #fff;
      border: none; border-radius: 6px; font-size: 1rem; font-weight: 600;
      cursor: pointer; width: 100%;
    }
    button[type=submit]:hover { background: #3a6b1e; }
    .fine-print { font-size: .8rem; color: #777; margin-top: 20px; }
    .success-box { background: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 20px 24px; margin: 30px 0; }
    .success-box h3 { color: #155724; }
    .success-box p  { color: #155724; margin-top: 6px; }
  </style>
</head>
<body>
  <header>
    <h1>Chapin Landscapes</h1>
    <p>Landscaping &amp; Maintenance Services</p>
  </header>
  <main>${body}</main>
</body>
</html>`;
}

// ── Privacy Policy ────────────────────────────────────────────────────────────
const privacyBody = `
  <h2>Privacy Policy</h2>
  <p><strong>Effective Date:</strong> January 1, 2025</p>

  <h3>About Us</h3>
  <p>Chapin Landscapes ("Company," "we," "our") is a landscaping and maintenance company based in Ohio. For privacy questions, contact us at <a href="mailto:dan@chapinlandscapes.com">dan@chapinlandscapes.com</a>.</p>

  <h3>Information We Collect</h3>
  <p>We collect the following types of personal information:</p>
  <ul>
    <li>Name and contact details (address, phone number, email address)</li>
    <li>Service history, job records, and estimates</li>
    <li>Payment information (processed securely; we do not store card numbers)</li>
    <li>Communications you send us via phone, email, text, or our website forms</li>
  </ul>

  <h3>How We Use Your Information</h3>
  <p>We use your information to:</p>
  <ul>
    <li>Schedule and perform landscaping and maintenance services</li>
    <li>Send invoices, estimates, and payment confirmations</li>
    <li>Communicate appointment reminders, job updates, and service notifications via SMS and email</li>
    <li>Improve the quality of our services</li>
    <li>Comply with legal obligations</li>
  </ul>

  <h3>SMS Messaging</h3>
  <p>We collect phone numbers to send transactional text messages including appointment reminders, job status updates, estimate notifications, and invoice alerts. Standard message and data rates may apply. Message frequency varies based on your service activity. Reply <strong>STOP</strong> at any time to unsubscribe. Reply <strong>HELP</strong> for assistance, or contact us at <a href="mailto:dan@chapinlandscapes.com">dan@chapinlandscapes.com</a>.</p>

  <h3>We Do Not Sell Your Data</h3>
  <p>We do not sell, rent, trade, or otherwise transfer your personal information to third parties for marketing purposes.</p>

  <h3>Data Sharing</h3>
  <p>We may share your information with trusted service providers (e.g., payment processors, scheduling software) solely to operate our business. These providers are contractually required to protect your data.</p>

  <h3>Data Security</h3>
  <p>We use industry-standard safeguards to protect your personal information from unauthorized access, disclosure, alteration, or destruction. However, no method of transmission over the internet is 100% secure.</p>

  <h3>Your Rights & Data Deletion</h3>
  <p>You have the right to access, correct, or request deletion of your personal information. To make a request, email us at <a href="mailto:dan@chapinlandscapes.com">dan@chapinlandscapes.com</a> with your name and contact details. We will respond within 30 days.</p>

  <h3>Changes to This Policy</h3>
  <p>We may update this Privacy Policy periodically. The effective date at the top reflects the most recent revision.</p>

  <div class="nav-links">
    <a href="/terms">Terms of Service</a>
    <a href="/sms-consent">SMS Opt-In</a>
  </div>
`;

// ── Terms of Service ──────────────────────────────────────────────────────────
const termsBody = `
  <h2>Terms of Service</h2>
  <p><strong>Effective Date:</strong> January 1, 2025</p>

  <h3>Services</h3>
  <p>Chapin Landscapes provides residential and commercial landscaping, lawn maintenance, landscape installation, snow removal, and related services in Ohio. Specific service details are outlined in individual estimates or agreements.</p>

  <h3>Scheduling & Cancellations</h3>
  <p>Services are scheduled by mutual agreement. We ask for at least 24 hours notice for cancellations. Repeated last-minute cancellations may result in a cancellation fee or termination of service.</p>

  <h3>Payment Terms</h3>
  <p>Payment is due upon completion of service unless otherwise agreed in writing. Invoices unpaid after 30 days may be subject to a late fee. We accept cash, check, and major credit cards.</p>

  <h3>SMS Communications</h3>
  <p>By providing your phone number to Chapin Landscapes, you may receive transactional text messages including appointment reminders, estimate notifications, job updates, and invoice alerts. Reply <strong>STOP</strong> to unsubscribe from SMS messages at any time. Reply <strong>HELP</strong> for assistance. Message and data rates may apply. Message frequency varies.</p>

  <h3>Limitation of Liability</h3>
  <p>Chapin Landscapes' liability for any claim arising from our services shall not exceed the total amount paid for the specific service giving rise to the claim. We are not liable for indirect, incidental, or consequential damages.</p>

  <h3>Property Access</h3>
  <p>By scheduling service, you grant Chapin Landscapes personnel reasonable access to the service area on the agreed service date. Please ensure gates are unlocked and pets are secured.</p>

  <h3>Governing Law</h3>
  <p>These Terms are governed by and construed in accordance with the laws of the State of Ohio. Any disputes shall be resolved in the appropriate courts of Ohio.</p>

  <h3>Contact Us</h3>
  <p>For questions about these Terms, contact us at <a href="mailto:dan@chapinlandscapes.com">dan@chapinlandscapes.com</a>.</p>

  <div class="nav-links">
    <a href="/privacy">Privacy Policy</a>
    <a href="/sms-consent">SMS Opt-In</a>
  </div>
`;

// ── SMS Consent Form ──────────────────────────────────────────────────────────
function smsConsentBody(success = false): string {
  const successBlock = success ? `
    <div class="success-box">
      <h3>Thank you!</h3>
      <p>You have successfully opted in to receive SMS messages from Chapin Landscapes. You can reply STOP at any time to unsubscribe.</p>
    </div>` : "";

  const formBlock = success ? "" : `
  <form method="POST" action="/sms-consent">
    <label for="first_name">First Name *</label>
    <input type="text" id="first_name" name="first_name" required placeholder="Jane" />

    <label for="last_name">Last Name *</label>
    <input type="text" id="last_name" name="last_name" required placeholder="Smith" />

    <label for="phone">Phone Number *</label>
    <input type="tel" id="phone" name="phone" required placeholder="(555) 123-4567" />

    <label for="email">Email Address</label>
    <input type="email" id="email" name="email" placeholder="jane@example.com" />

    <div class="checkbox-row" style="margin-top:24px;">
      <input type="checkbox" id="sms_consent" name="sms_consent" value="1" required />
      <span><label for="sms_consent">I agree to receive SMS text messages from Chapin Landscapes, including appointment reminders, estimate notifications, job updates, and invoice alerts. Message and data rates may apply. Reply STOP at any time to unsubscribe. Reply HELP for help. <strong>(Required)</strong></label></span>
    </div>

    <div class="checkbox-row">
      <input type="checkbox" id="promo_consent" name="promo_consent" value="1" />
      <span><label for="promo_consent">I also agree to receive occasional promotional messages about seasonal services and special offers. <em>(Optional)</em></label></span>
    </div>

    <button type="submit">Submit &amp; Opt In</button>

    <p class="fine-print">
      Message frequency varies. To opt out at any time, reply STOP to any message. For help, reply HELP or contact us at <a href="mailto:dan@chapinlandscapes.com">dan@chapinlandscapes.com</a>.
    </p>
  </form>`;

  return `
  <h2>SMS Message Opt-In</h2>
  <p>By submitting this form, you agree to receive text messages from Chapin Landscapes including appointment reminders, estimate notifications, job updates, and invoice alerts.</p>
  ${successBlock}
  ${formBlock}
  <div class="nav-links">
    <a href="/privacy">Privacy Policy</a>
    <a href="/terms">Terms of Service</a>
  </div>
`;
}

// ── Register public routes ────────────────────────────────────────────────────
export function registerPublicPages(app: Express) {
  app.get("/privacy", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(page("Privacy Policy", privacyBody));
  });

  app.get("/terms", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(page("Terms of Service", termsBody));
  });

  app.get("/sms-consent", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(page("SMS Opt-In Consent", smsConsentBody(false)));
  });

  app.post("/sms-consent", async (req: Request, res: Response) => {
    try {
      const { first_name, last_name, phone, email, promo_consent } = req.body;
      if (!first_name || !last_name || !phone) {
        res.setHeader("Content-Type", "text/html");
        return res.status(400).send(page("SMS Opt-In Consent", smsConsentBody(false)));
      }
      await pool.query(
        `INSERT INTO sms_opt_ins (first_name, last_name, phone, email, promotional_consent)
         VALUES ($1, $2, $3, $4, $5)`,
        [first_name.trim(), last_name.trim(), phone.trim(), email?.trim() || null, promo_consent === "1"]
      );
      res.setHeader("Content-Type", "text/html");
      res.send(page("SMS Opt-In Consent", smsConsentBody(true)));
    } catch (err) {
      console.error("[sms-consent] POST error:", err);
      res.setHeader("Content-Type", "text/html");
      res.status(500).send(page("SMS Opt-In Consent", `<p style="color:red;padding:24px;">Something went wrong. Please try again or email <a href="mailto:dan@chapinlandscapes.com">dan@chapinlandscapes.com</a>.</p>`));
    }
  });
}
