export interface MessageBlastManualVariable {
  key: string;
  label: string;
  placeholder?: string;
}

export interface MessageBlastTemplate {
  key: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  autoVariables: string[];
  manualVariables: MessageBlastManualVariable[];
  suggestedFilters?: string[];
}

const REVIEW_LINK = "https://g.page/r/CTIAEga798WHEB0/review";

export const MESSAGE_BLAST_TEMPLATES: MessageBlastTemplate[] = [
  {
    key: "mowing_delay",
    name: "Mowing Delay Notice",
    description: "Let customers know a mowing visit has been pushed back.",
    subject: "Your mowing service has been delayed",
    body: `<p>Hi {{customer_name}},</p><p>We wanted to let you know that your mowing service originally scheduled for {{original_date}} has been pushed to {{new_date}}. We apologize for any inconvenience this may cause.</p><p>Thank you for your patience.</p><p>— Chapin Landscapes</p>`,
    autoVariables: ["customer_name"],
    manualVariables: [
      { key: "original_date", label: "Original Date", placeholder: "e.g. July 10" },
      { key: "new_date", label: "New Date", placeholder: "e.g. July 12" },
    ],
    suggestedFilters: ["service_type"],
  },
  {
    key: "weather_delay",
    name: "Weather Delay",
    description: "Notify a group that service is delayed due to weather.",
    subject: "Service delay due to weather",
    body: `<p>Hi {{customer_name}},</p><p>Due to {{delay_reason}}, your scheduled service has been delayed. {{reschedule_note}}</p><p>Thank you for your understanding.</p><p>— Chapin Landscapes</p>`,
    autoVariables: ["customer_name"],
    manualVariables: [
      { key: "delay_reason", label: "Delay Reason", placeholder: "e.g. severe thunderstorms" },
      { key: "reschedule_note", label: "Reschedule Note", placeholder: "e.g. We'll reschedule within 48 hours." },
    ],
    suggestedFilters: ["scheduled_between", "division"],
  },
  {
    key: "invoice_reminder",
    name: "Invoice Reminder",
    description: "Remind customers with an overdue or upcoming invoice balance.",
    subject: "Reminder: Invoice payment due",
    body: `<p>Hi {{customer_name}},</p><p>This is a friendly reminder that your invoice for {{invoice_amount}} is due on {{due_date}}.</p><p><a href="{{portal_link}}">View &amp; Pay Invoice</a></p><p>Thank you!</p><p>— Chapin Landscapes</p>`,
    autoVariables: ["customer_name", "invoice_amount", "due_date", "portal_link"],
    manualVariables: [],
    suggestedFilters: ["overdue_invoice"],
  },
  {
    key: "job_start",
    name: "Job Start Notice",
    description: "Let customers know a crew is about to start their job.",
    subject: "Our crew is starting your project soon",
    body: `<p>Hi {{customer_name}},</p><p>Our crew is scheduled to begin work on {{job_title}} on {{schedule_date}}. {{crew_lead}} will be leading the team.</p><p>— Chapin Landscapes</p>`,
    autoVariables: ["customer_name", "job_title", "schedule_date"],
    manualVariables: [
      { key: "crew_lead", label: "Crew Lead", placeholder: "e.g. Matt H" },
    ],
    suggestedFilters: ["scheduled_between", "job_status"],
  },
  {
    key: "job_completion",
    name: "Job Completion",
    description: "Let customers know their project just wrapped up.",
    subject: "Your project is complete!",
    body: `<p>Hi {{customer_name}},</p><p>We're happy to let you know that {{job_title}} was completed on {{completion_date}}. Thank you for choosing Chapin Landscapes!</p><p>— Chapin Landscapes</p>`,
    autoVariables: ["customer_name", "job_title", "completion_date"],
    manualVariables: [],
    suggestedFilters: ["job_status"],
  },
  {
    key: "review_request",
    name: "Review Request",
    description: "Ask recently-closed-out customers for a review.",
    subject: "How did we do?",
    body: `<p>Hi {{customer_name}},</p><p>We hope you're happy with the work on {{job_title}}! If you have a moment, we'd really appreciate a review:</p><p><a href="${REVIEW_LINK}">Leave a Review</a></p><p>Thank you for your support!</p><p>— Chapin Landscapes</p>`,
    autoVariables: ["customer_name", "job_title"],
    manualVariables: [],
    suggestedFilters: ["job_status"],
  },
  {
    key: "custom",
    name: "Custom Message",
    description: "Write a one-off message from scratch.",
    subject: "",
    body: "",
    autoVariables: ["customer_name"],
    manualVariables: [],
  },
];

export function getTemplate(key: string): MessageBlastTemplate | undefined {
  return MESSAGE_BLAST_TEMPLATES.find((t) => t.key === key);
}

export function substituteVariables(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return values[varName] !== undefined && values[varName] !== null && values[varName] !== ""
      ? String(values[varName])
      : match;
  });
}
