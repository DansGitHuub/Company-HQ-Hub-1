import { useTranslation } from "react-i18next";

export default function PrivacyPolicy() {
  const { t } = useTranslation("privacy");
  const effectiveDate = "March 23, 2026";
  const companyName = "Chapin Landscapes";
  const contactEmail = "dan@chapinlandscapes.com";
  const contactPhone = "(440) 724-8006";

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-green-800 py-8 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-white">{companyName}</h1>
          <p className="text-green-200 mt-1">{t("subtitle")}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8 text-gray-700 text-sm leading-relaxed">

        <p className="text-xs text-gray-500">{t("effectiveDate")}: {effectiveDate}</p>

        <p>
          {companyName} ("we," "our," or "us") is committed to protecting the privacy of individuals
          who interact with our services. This Privacy Policy explains how we collect, use, disclose,
          and safeguard your personal information, including information collected through our online
          employment application platform and any associated communications.
        </p>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Information We Collect</h2>
          <p>We may collect the following categories of personal information:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><strong>Contact Information:</strong> name, email address, phone number, mailing address</li>
            <li><strong>Employment Application Data:</strong> work history, education, references, availability, and desired salary</li>
            <li><strong>Identification Information:</strong> Social Security Number (where required for employment verification), submitted voluntarily through our application form</li>
            <li><strong>Communications:</strong> messages, notes, and correspondence related to your application or employment</li>
            <li><strong>Device and Usage Data:</strong> IP address, browser type, and interaction data when you use our online platform</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Process and evaluate your employment application</li>
            <li>Schedule and confirm job interviews</li>
            <li>Send notifications related to your application status</li>
            <li>Communicate with you via email and SMS text message regarding interview scheduling</li>
            <li>Maintain employee records for active employees</li>
            <li>Comply with applicable laws and regulations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. SMS Text Message Communications</h2>
          <p>
            By submitting an employment application through our online application form and providing
            your phone number, you consent to receive SMS text messages from {companyName} related
            to your application, including interview scheduling confirmations, date and time reminders,
            and meeting link notifications.
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li><strong>Frequency:</strong> Message frequency varies based on application activity. You may receive one or more messages per interview scheduling event.</li>
            <li><strong>Opt-Out:</strong> You may opt out of SMS communications at any time by replying <strong>STOP</strong> to any text message you receive from us. After opting out, you will no longer receive SMS notifications.</li>
            <li><strong>Help:</strong> Reply <strong>HELP</strong> to any message for assistance, or contact us directly using the information in Section 7.</li>
            <li><strong>Message and Data Rates:</strong> Standard message and data rates may apply depending on your mobile carrier plan.</li>
            <li><strong>Carriers:</strong> {companyName} is not responsible for delayed or undelivered messages due to carrier-related issues.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. How We Share Your Information</h2>
          <p>
            We do not sell, rent, or trade your personal information to third parties. We may share
            your information in the following limited circumstances:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><strong>Service Providers:</strong> We use trusted third-party services (such as Twilio for SMS delivery and SendGrid for email delivery) solely to facilitate communications on our behalf. These providers are contractually obligated to protect your data.</li>
            <li><strong>Legal Requirements:</strong> We may disclose information if required by law or in response to valid legal processes.</li>
            <li><strong>Business Operations:</strong> Authorized {companyName} staff (administrators and managers) may access your application data as part of the hiring process.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Data Security</h2>
          <p>
            We implement reasonable administrative, technical, and physical safeguards to protect your
            personal information from unauthorized access, disclosure, alteration, or destruction.
            Sensitive data such as Social Security Numbers are stored in encrypted form. However, no
            method of transmission over the internet or electronic storage is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Data Retention</h2>
          <p>
            We retain application data for a reasonable period consistent with our hiring needs and
            applicable legal obligations. If your application is not successful, your data may be
            retained for up to 12 months for future opportunities unless you request deletion. Employee
            records are retained as required by federal and state employment laws.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Request access to the personal information we hold about you</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your personal information, subject to legal obligations</li>
            <li>Opt out of SMS communications by replying STOP to any message</li>
          </ul>
          <p className="mt-2">To exercise any of these rights, contact us using the information below.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be reflected by updating
            the effective date at the top of this page. We encourage you to review this policy
            periodically.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Contact Us</h2>
          <p>If you have questions about this Privacy Policy or your personal information, please contact us:</p>
          <div className="mt-2 space-y-1">
            <p><strong>{companyName}</strong></p>
            <p>Email: <a href={`mailto:${contactEmail}`} className="text-green-700 underline">{contactEmail}</a></p>
            <p>Phone: {contactPhone}</p>
          </div>
        </section>

        <p className="text-xs text-gray-400 pt-4 border-t">
          &copy; {new Date().getFullYear()} {companyName}. {t("allRightsReserved")}
        </p>
      </div>
    </div>
  );
}
