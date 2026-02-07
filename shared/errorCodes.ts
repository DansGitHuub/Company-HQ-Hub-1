export interface ErrorCodeEntry {
  code: string;
  description: string;
  fix: string;
  severity: "info" | "warning" | "error" | "critical";
  feature: string;
}

const errorCodeRegistry: Record<string, ErrorCodeEntry> = {
  "AUTH-001": {
    code: "AUTH-001",
    description: "Login failed — incorrect username or password.",
    fix: "Double-check your username and password, then try again.",
    severity: "warning",
    feature: "auth",
  },
  "AUTH-002": {
    code: "AUTH-002",
    description: "Your session has expired.",
    fix: "Please log in again to continue.",
    severity: "info",
    feature: "auth",
  },
  "AUTH-003": {
    code: "AUTH-003",
    description: "You don't have permission to access this feature.",
    fix: "Contact an Admin to request access or a role upgrade.",
    severity: "warning",
    feature: "auth",
  },
  "AUTH-004": {
    code: "AUTH-004",
    description: "Account is deactivated.",
    fix: "Contact an Admin to reactivate your account.",
    severity: "error",
    feature: "auth",
  },
  "AUTH-005": {
    code: "AUTH-005",
    description: "Registration failed.",
    fix: "Make sure all fields are filled in correctly and the username isn't already taken.",
    severity: "warning",
    feature: "auth",
  },

  "IMG-001": {
    code: "IMG-001",
    description: "Image generation service is unavailable.",
    fix: "The AI image service may be temporarily down. Wait a minute and try again.",
    severity: "error",
    feature: "sops",
  },
  "IMG-002": {
    code: "IMG-002",
    description: "Image generation is disabled.",
    fix: "An Admin can enable AI image generation in Company Settings.",
    severity: "warning",
    feature: "settings",
  },
  "IMG-003": {
    code: "IMG-003",
    description: "Your role cannot generate images.",
    fix: "Ask an Admin to add your role to the allowed list in Company Settings.",
    severity: "warning",
    feature: "settings",
  },
  "IMG-004": {
    code: "IMG-004",
    description: "Daily image generation limit reached.",
    fix: "You've used all your image generations for today. Try again tomorrow, or ask an Admin to increase the daily limit.",
    severity: "warning",
    feature: "sops",
  },
  "IMG-005": {
    code: "IMG-005",
    description: "Monthly image generation limit reached.",
    fix: "The monthly image limit has been reached. Ask an Admin to increase it in Company Settings.",
    severity: "warning",
    feature: "sops",
  },
  "IMG-006": {
    code: "IMG-006",
    description: "Image prompt was blocked by content safety.",
    fix: "Rephrase your image description to avoid restricted content, then try again.",
    severity: "warning",
    feature: "sops",
  },
  "IMG-007": {
    code: "IMG-007",
    description: "The AI did not return an image.",
    fix: "Try simplifying your description or using a different style, then generate again.",
    severity: "error",
    feature: "sops",
  },
  "IMG-008": {
    code: "IMG-008",
    description: "Image generation timed out.",
    fix: "The image took too long. Try a simpler description or try again in a few minutes.",
    severity: "error",
    feature: "sops",
  },
  "IMG-009": {
    code: "IMG-009",
    description: "Failed to save the generated image.",
    fix: "The image was created but couldn't be saved. Try generating again.",
    severity: "error",
    feature: "sops",
  },

  "SOP-001": {
    code: "SOP-001",
    description: "Failed to save the SOP.",
    fix: "Check that all required fields are filled in (title, topic) and try saving again.",
    severity: "error",
    feature: "sops",
  },
  "SOP-002": {
    code: "SOP-002",
    description: "AI autofill failed.",
    fix: "Make sure you've entered an SOP title, then try the autofill again. If it keeps failing, the AI service may be busy — wait a moment and retry.",
    severity: "error",
    feature: "sops",
  },
  "SOP-003": {
    code: "SOP-003",
    description: "SOP not found.",
    fix: "This SOP may have been deleted or you may not have access. Go back to the SOP list.",
    severity: "warning",
    feature: "sops",
  },
  "SOP-004": {
    code: "SOP-004",
    description: "You don't have permission to edit this SOP.",
    fix: "Only Admins and Managers can edit SOPs. Contact an Admin if you need to make changes.",
    severity: "warning",
    feature: "sops",
  },

  "MAT-001": {
    code: "MAT-001",
    description: "Failed to save the material.",
    fix: "Check that all required fields are filled in and try again.",
    severity: "error",
    feature: "materials",
  },
  "MAT-002": {
    code: "MAT-002",
    description: "Material category not found.",
    fix: "The selected category may have been removed. Refresh the page and try again.",
    severity: "warning",
    feature: "materials",
  },

  "JOB-001": {
    code: "JOB-001",
    description: "Failed to save the job.",
    fix: "Check that all required fields are filled in and try again.",
    severity: "error",
    feature: "jobs",
  },
  "JOB-002": {
    code: "JOB-002",
    description: "Job not found.",
    fix: "This job may have been deleted. Go back to the job list.",
    severity: "warning",
    feature: "jobs",
  },

  "TODO-001": {
    code: "TODO-001",
    description: "Failed to save the to-do item.",
    fix: "Check that the title is filled in and try again.",
    severity: "error",
    feature: "todos",
  },

  "MSG-001": {
    code: "MSG-001",
    description: "Failed to send the message.",
    fix: "Check your message and try sending again. If it keeps failing, refresh the page.",
    severity: "error",
    feature: "messages",
  },
  "MSG-002": {
    code: "MSG-002",
    description: "Conversation not found.",
    fix: "This conversation may have been deleted. Go back to the messages list.",
    severity: "warning",
    feature: "messages",
  },

  "EQP-001": {
    code: "EQP-001",
    description: "Failed to save the equipment record.",
    fix: "Check that all required fields are filled in and try again.",
    severity: "error",
    feature: "equipment",
  },

  "HIRE-001": {
    code: "HIRE-001",
    description: "Failed to save the candidate.",
    fix: "Check that all required fields are filled in and try again.",
    severity: "error",
    feature: "hiring",
  },

  "FORM-001": {
    code: "FORM-001",
    description: "Failed to save the form.",
    fix: "Check that the form has a title and at least one field, then try again.",
    severity: "error",
    feature: "forms",
  },

  "FILE-001": {
    code: "FILE-001",
    description: "File upload failed.",
    fix: "Make sure the file is under the size limit and in a supported format, then try again.",
    severity: "error",
    feature: "general",
  },
  "FILE-002": {
    code: "FILE-002",
    description: "File not found.",
    fix: "The file may have been deleted. Try uploading it again.",
    severity: "warning",
    feature: "general",
  },

  "AI-001": {
    code: "AI-001",
    description: "AI assistant service is unavailable.",
    fix: "The AI service may be temporarily down. Wait a minute and try again.",
    severity: "error",
    feature: "ai_agents",
  },
  "AI-002": {
    code: "AI-002",
    description: "AI agent run failed.",
    fix: "The AI agent encountered an error. Check the agent details and try running it again.",
    severity: "error",
    feature: "ai_agents",
  },

  "CAL-001": {
    code: "CAL-001",
    description: "Calendar connection failed.",
    fix: "The calendar service couldn't connect. Check your calendar settings and try reconnecting.",
    severity: "error",
    feature: "calendar",
  },

  "PLOW-001": {
    code: "PLOW-001",
    description: "Failed to save the plow site.",
    fix: "Check that the address and site details are filled in, then try again.",
    severity: "error",
    feature: "plow_sites",
  },

  "NET-001": {
    code: "NET-001",
    description: "Network connection lost.",
    fix: "Check your internet connection and try again.",
    severity: "error",
    feature: "general",
  },
  "NET-002": {
    code: "NET-002",
    description: "Request timed out.",
    fix: "The server took too long to respond. Try again in a moment.",
    severity: "error",
    feature: "general",
  },

  "SYS-001": {
    code: "SYS-001",
    description: "An unexpected system error occurred.",
    fix: "Try refreshing the page. If the problem persists, note this error code and contact support.",
    severity: "error",
    feature: "general",
  },
  "SYS-002": {
    code: "SYS-002",
    description: "Database connection error.",
    fix: "The database is temporarily unavailable. Wait a moment and try again.",
    severity: "critical",
    feature: "general",
  },
  "SYS-003": {
    code: "SYS-003",
    description: "Invalid request data.",
    fix: "Some of the information submitted was invalid. Check your inputs and try again.",
    severity: "warning",
    feature: "general",
  },

  "USR-001": {
    code: "USR-001",
    description: "Failed to update user profile.",
    fix: "Check that all fields are valid and try saving again.",
    severity: "error",
    feature: "users",
  },
  "USR-002": {
    code: "USR-002",
    description: "User not found.",
    fix: "This user account may have been removed.",
    severity: "warning",
    feature: "users",
  },

  "EMAIL-001": {
    code: "EMAIL-001",
    description: "Failed to send email notification.",
    fix: "The email service is temporarily unavailable. The action was still completed — the notification just didn't send.",
    severity: "warning",
    feature: "equipment",
  },
};

export function getErrorInfo(code: string): ErrorCodeEntry {
  return errorCodeRegistry[code] || {
    code: code || "SYS-001",
    description: "An unexpected error occurred.",
    fix: "Try again. If the problem persists, note this error code and contact support.",
    severity: "error" as const,
    feature: "general",
  };
}

export function getAllErrorCodes(): ErrorCodeEntry[] {
  return Object.values(errorCodeRegistry);
}

export function getErrorCodesByFeature(feature: string): ErrorCodeEntry[] {
  return Object.values(errorCodeRegistry).filter(e => e.feature === feature);
}

export { errorCodeRegistry };
