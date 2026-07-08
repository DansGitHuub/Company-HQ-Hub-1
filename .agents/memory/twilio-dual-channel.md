---
name: Twilio dual-channel SMS routing
description: The app has two distinct SMS senders (customer and hiring). Using the wrong one causes Twilio Error 30034 (A2P unregistered).
---

## Rule
`sendSms()` accepts a `channel: SmsChannel = "hiring"` parameter. Always pass the correct channel at every call site — defaulting to "hiring" without thinking will route customer messages through the wrong number.

**Customer channel** (`"customer"`) → `TWILIO_CUSTOMER_MESSAGING_SERVICE_SID` (preferred) or `TWILIO_CUSTOMER_PHONE_NUMBER` (+18444409258, the 844 toll-free, fully registered A2P).

**Hiring channel** (`"hiring"`) → `TWILIO_MESSAGING_SERVICE_SID` (preferred) or `TWILIO_PHONE_NUMBER` (+14402764144, the 440 "Interview Notifications" service — A2P campaign pending as of 2026-07-08, causes Error 30034 undelivered until approved).

**Why:** Both env var sets existed but only the hiring SID was configured; `sendSms` preferred MessagingServiceSid over the phone number, so all SMS including customer-facing contact went through the unregistered 440 channel. Fixed by adding `TWILIO_CUSTOMER_PHONE_NUMBER=+18444409258` and adding channel routing to `smsService.ts`.

**How to apply:**
- New customer-facing SMS (Contact Customer, notifyCustomer, notifyStaff) → pass `"customer"`
- New hiring/applicant SMS (stage changes, interviews, hire conversion) → pass `"hiring"` (or use the named wrappers `sendStageSms`/`sendInterviewSms`/`sendHireSms` which hardcode `"hiring"`)
- If a Messaging Service SID is ever obtained for the 844 toll-free number, add it as secret `TWILIO_CUSTOMER_MESSAGING_SERVICE_SID` — the code already prefers it automatically
