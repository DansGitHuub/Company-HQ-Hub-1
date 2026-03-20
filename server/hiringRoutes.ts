import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import { sendHiringStageEmail, sendHiringWelcomeEmail, sendNewHireAccountEmail, sendZoomInterviewEmail, sendInPersonInterviewEmail } from "./email";
import { hashPassword } from "./auth";
import { createZoomMeeting, isZoomConfigured } from "./zoomService";
import { createCalendarEvent, refreshAccessToken, isTokenExpired } from "./googleOAuth";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$";
  const chars = [
    upper[Math.floor(Math.random() * upper.length)],
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    lower[Math.floor(Math.random() * lower.length)],
    lower[Math.floor(Math.random() * lower.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    digits[Math.floor(Math.random() * digits.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, ".");
}

const ONBOARDING_EMPLOYEE_ITEMS = [
  "Fill out W-4",
  "Fill out I-9 (+ upload ID documents)",
  "Fill out Ohio IT-4",
  "Set up direct deposit",
  "Sign Employee Handbook",
  "Complete new hire orientation quiz",
  "Submit emergency contact info",
  "Submit photo for employee profile",
];

const ONBOARDING_OFFICE_ITEMS = [
  "Verify I-9 documents",
  "Set up payroll in system",
  "Create system login (CompanyHQ account)",
  "Assign role and permissions",
  "Assign crew/department",
  "Add to group chat/communications",
  "Order uniform/equipment if needed",
  "Schedule first day orientation",
];

async function createOnboardingChecklist(employeeId: string) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 2);

  for (const title of ONBOARDING_EMPLOYEE_ITEMS) {
    await storage.createOnboardingItem({
      employeeId,
      title,
      category: "Employee",
      assignedTo: "employee",
      status: "Pending",
      dueDate,
    });
  }
  for (const title of ONBOARDING_OFFICE_ITEMS) {
    await storage.createOnboardingItem({
      employeeId,
      title,
      category: "Office/HR",
      assignedTo: "office",
      status: "Pending",
      dueDate,
    });
  }
}

async function createHiredDocuments(candidateId: string) {
  const hiredDocs = [
    "W-4 (Federal Tax Withholding)",
    "I-9 (Employment Eligibility)",
    "Ohio IT-4 (State Tax)",
    "Direct Deposit Authorization",
    "Employee Handbook Acknowledgment",
    "Non-Disclosure Agreement",
    "Emergency Contact Form",
  ];
  for (const name of hiredDocs) {
    await storage.createCandidateDocument({
      candidateId,
      name,
      type: name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      status: "Not Sent",
    });
  }
}

async function notifyHRAndManagers(type: string, title: string, message: string, link: string, metadata: any) {
  try {
    const { pool } = await import("./db");
    const result = await pool.query(
      `SELECT id FROM users WHERE role IN ('Admin', 'Manager', 'HR') AND id IS NOT NULL`
    );
    for (const row of result.rows) {
      await storage.createStaffNotification({
        userId: row.id,
        type,
        title,
        message,
        link,
        metadata,
        isRead: false,
      });
    }
  } catch (err: any) {
    console.error("[notifications] Failed to create staff notifications:", err.message);
  }
}

async function handleStageChange(candidateId: string, newStage: string, candidate: any, userId?: string) {
  const template = await storage.getHiringEmailTemplate(newStage);

  if (template && candidate.email) {
    let subject = template.subject;
    let body = template.body;
    const replacements: Record<string, string> = {
      "{{position}}": candidate.role || "the position",
      "{{name}}": candidate.name,
      "{{date}}": candidate.interviewDate ? new Date(candidate.interviewDate).toLocaleDateString() : "[TBD]",
      "{{time}}": candidate.interviewTime || "[TBD]",
      "{{location}}": candidate.interviewLocation || "[TBD]",
    };
    for (const [key, value] of Object.entries(replacements)) {
      subject = subject.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "g"), value);
      body = body.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "g"), value);
    }

    try {
      const sent = await sendHiringStageEmail(candidate.email, candidate.name, subject, body);
      if (sent) {
        await storage.createApplicantCommunication({
          candidateId,
          type: "Email",
          subject,
          content: body,
          sentBy: userId || null,
          sentByName: "System",
        });
      } else {
        console.error(`[hiring] Email delivery failed for ${newStage} to ${candidate.email}`);
      }
    } catch (err: any) {
      console.error(`Failed to send stage email for ${newStage}:`, err.message);
    }
  }

  await notifyHRAndManagers(
    "hiring_stage_change",
    `Applicant Moved: ${candidate.name}`,
    `${candidate.name} has been moved to "${newStage}" for the ${candidate.role || "open"} position.`,
    "/hiring",
    { candidateId, newStage, candidateName: candidate.name, position: candidate.role }
  );

  if (newStage === "Hired") {
    const existingEmployees = await storage.getEmployees();
    const alreadyHired = existingEmployees.find((e: any) => e.candidateId === candidateId);

    if (!alreadyHired) {
      await createHiredDocuments(candidateId);

      const nameParts = candidate.name.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      const startDate = new Date().toISOString().split("T")[0];

      const employee = await storage.createEmployee({
        candidateId,
        firstName,
        lastName,
        personalEmail: candidate.email || undefined,
        personalPhone: candidate.phone || undefined,
        address: candidate.address || undefined,
        city: candidate.city || undefined,
        state: candidate.state || undefined,
        zip: candidate.zip || undefined,
        jobTitle: candidate.role || undefined,
        startDate,
      });

      await createOnboardingChecklist(employee.id);

      if (candidate.email) {
        try {
          await sendHiringWelcomeEmail(
            candidate.email,
            candidate.name,
            candidate.role || "Team Member",
            new Date(startDate).toLocaleDateString()
          );
        } catch (err: any) {
          console.error("Failed to send welcome/onboarding email:", err.message);
        }
      }
    }
  }
}

export function registerHiringRoutes(app: Express, requireAuth: RequestHandler) {
  const requireHRAccess: RequestHandler = (req: any, res, next) => {
    const role = req.user?.role;
    const isMasterAdmin = req.user?.isMasterAdmin;
    if (role === "Customer" || role === "Crew") {
      if (!isMasterAdmin) return res.status(403).json({ message: "Not authorized" });
    }
    next();
  };

  const requireManagerAccess: RequestHandler = (req: any, res, next) => {
    const role = req.user?.role;
    const isMasterAdmin = req.user?.isMasterAdmin;
    if (!["Admin", "Manager"].includes(role) && !isMasterAdmin) {
      return res.status(403).json({ message: "Not authorized" });
    }
    next();
  };

  // Applicant Notes
  app.get("/api/candidates/:id/notes", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const notes = await storage.getApplicantNotes(req.params.id);
      res.json(notes);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/candidates/:id/notes", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const note = await storage.createApplicantNote({
        candidateId: req.params.id,
        content: req.body.content,
        authorId: (req as any).user?.id,
        authorName: (req as any).user?.name || (req as any).user?.username,
      });
      res.status(201).json(note);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Applicant Communications
  app.get("/api/candidates/:id/communications", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const comms = await storage.getApplicantCommunications(req.params.id);
      res.json(comms);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/candidates/:id/communications", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const comm = await storage.createApplicantCommunication({
        candidateId: req.params.id,
        type: req.body.type || "Note",
        subject: req.body.subject,
        content: req.body.content,
        sentBy: (req as any).user?.id,
        sentByName: (req as any).user?.name || (req as any).user?.username,
      });
      res.status(201).json(comm);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Stage change with notifications
  app.post("/api/candidates/:id/stage", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const { stage } = req.body;
      const candidate = await storage.getCandidate(req.params.id);
      if (!candidate) return res.status(404).json({ message: "Candidate not found" });

      const updated = await storage.updateCandidate(req.params.id, { stage, updatedAt: new Date() });

      await handleStageChange(req.params.id, stage, { ...candidate, stage }, (req as any).user?.id);

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Employees
  app.get("/api/employees", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const emps = await storage.getEmployees();
      res.json(emps);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/employees/:id", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const emp = await storage.getEmployee(req.params.id);
      if (!emp) return res.status(404).json({ message: "Employee not found" });
      res.json(emp);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/employees", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const emp = await storage.createEmployee(req.body);
      await createOnboardingChecklist(emp.id);
      res.status(201).json(emp);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/employees/:id", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const updated = await storage.updateEmployee(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Employee not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/employees/:id", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const deleted = await storage.deleteEmployee(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Employee not found" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Employee Pay History
  app.get("/api/employees/:id/pay-history", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const history = await storage.getEmployeePayHistory(req.params.id);
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/employees/:id/pay-history", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const entry = await storage.createEmployeePayHistory({
        employeeId: req.params.id,
        ...req.body,
      });
      res.status(201).json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Employee History
  app.get("/api/employees/:id/history", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const history = await storage.getEmployeeHistory(req.params.id);
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/employees/:id/history", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const entry = await storage.createEmployeeHistory({
        employeeId: req.params.id,
        changeType: req.body.changeType,
        details: req.body.details,
        recordedBy: (req as any).user?.name || (req as any).user?.username,
      });
      res.status(201).json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Employee Notes
  app.get("/api/employees/:id/notes", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const notes = await storage.getEmployeeNotes(req.params.id);
      res.json(notes);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/employees/:id/notes", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const note = await storage.createEmployeeNote({
        employeeId: req.params.id,
        content: req.body.content,
        authorId: (req as any).user?.id,
        authorName: (req as any).user?.name || (req as any).user?.username,
      });
      res.status(201).json(note);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Employee Documents
  app.get("/api/employees/:id/documents", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const docs = await storage.getEmployeeDocuments(req.params.id);
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/employees/:id/documents", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const doc = await storage.createEmployeeDocument({
        employeeId: req.params.id,
        ...req.body,
      });
      res.status(201).json(doc);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/employee-documents/:id", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const updated = await storage.updateEmployeeDocument(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Document not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/employee-documents/:id", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const deleted = await storage.deleteEmployeeDocument(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Document not found" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Onboarding Items
  app.get("/api/employees/:id/onboarding", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const items = await storage.getOnboardingItems(req.params.id);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/onboarding-items/:id", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const updates: any = { ...req.body };
      if (updates.status === "Complete" && !updates.completedAt) {
        updates.completedAt = new Date();
      }
      const updated = await storage.updateOnboardingItem(req.params.id, updates);
      if (!updated) return res.status(404).json({ message: "Item not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // HR Form Submissions
  app.get("/api/hr-forms", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const { employeeId, candidateId } = req.query;
      const forms = await storage.getHrFormSubmissions(
        employeeId as string | undefined,
        candidateId as string | undefined
      );
      res.json(forms);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/hr-forms/:id", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const form = await storage.getHrFormSubmission(req.params.id);
      if (!form) return res.status(404).json({ message: "Form not found" });
      res.json(form);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/hr-forms", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const form = await storage.createHrFormSubmission(req.body);
      res.status(201).json(form);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/hr-forms/:id", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const updated = await storage.updateHrFormSubmission(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Form not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Hiring Email Templates
  app.get("/api/hiring-email-templates", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const templates = await storage.getHiringEmailTemplates();
      res.json(templates);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/hiring-email-templates/:id", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const updated = await storage.updateHiringEmailTemplate(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Template not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Create CompanyHQ user account for a hired candidate
  app.post("/api/candidates/:id/create-account", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const candidateId = req.params.id;
      const candidate = await storage.getCandidate(candidateId);
      if (!candidate) return res.status(404).json({ message: "Candidate not found" });
      if (candidate.stage !== "Hired") {
        return res.status(400).json({ message: "Account can only be created for hired candidates" });
      }
      if (candidate.userId) {
        return res.status(400).json({ message: "This candidate already has an account" });
      }

      // Build a unique username from their name
      const baseUsername = slugifyName(candidate.name) || "crew.member";
      let username = baseUsername;
      let suffix = 1;
      while (await storage.getUserByUsername(username)) {
        username = `${baseUsername}${suffix++}`;
      }

      // Check email uniqueness if email exists
      if (candidate.email) {
        const existingByEmail = await storage.getUserByEmail(candidate.email);
        if (existingByEmail) {
          return res.status(400).json({ message: "A user with this email already exists" });
        }
      }

      const tempPassword = generateTempPassword();
      const hashedPassword = await hashPassword(tempPassword);

      const newUser = await storage.createUser({
        username,
        password: hashedPassword,
        email: candidate.email || `${username}@chapinlandscapes.com`,
        name: candidate.name,
        role: "Crew",
        storedPassword: tempPassword,
      });

      // Link user to candidate
      await storage.updateCandidate(candidateId, { userId: newUser.id });

      // Link user to the employee record if one exists
      const employees = await storage.getEmployees();
      const employeeRecord = employees.find((e: any) => e.candidateId === candidateId);
      if (employeeRecord) {
        await storage.updateEmployee(employeeRecord.id, { userId: newUser.id });
      }

      // Send credentials email if candidate has an email address
      if (candidate.email) {
        try {
          await sendNewHireAccountEmail(
            candidate.email,
            candidate.name,
            username,
            tempPassword,
            candidate.role || "Team Member"
          );
        } catch (emailErr: any) {
          console.error("[hiring] Failed to send account credentials email:", emailErr.message);
        }
      }

      res.json({
        success: true,
        username,
        tempPassword,
        userId: newUser.id,
        emailSent: !!candidate.email,
      });
    } catch (err: any) {
      console.error("[hiring] create-account error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/candidates/:id/schedule-interview
  app.post("/api/candidates/:id/schedule-interview", requireAuth, requireHRAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { date, time, duration = 30, type = "zoom", location = "", notes = "", interviewerName = "" } = req.body as {
        date: string; time: string; duration?: number; type?: string;
        location?: string; notes?: string; interviewerName?: string;
      };

      if (!date || !time) return res.status(400).json({ message: "Date and time are required" });

      const candidate = await storage.getCandidate(id);
      if (!candidate) return res.status(404).json({ message: "Candidate not found" });

      // Build the start datetime
      const startDatetime = new Date(`${date}T${convertTo24h(time)}`);
      const endDatetime = new Date(startDatetime.getTime() + duration * 60_000);

      let zoomResult: { joinUrl: string; meetingId: string; passcode: string } | null = null;
      let calendarEventCreated = false;

      // ── Zoom meeting ──────────────────────────────────────────────────────
      if (type === "zoom") {
        if (!isZoomConfigured()) {
          console.warn("[hiring] Zoom credentials not configured, skipping Zoom meeting creation");
        } else {
          try {
            zoomResult = await createZoomMeeting(
              `Interview — ${candidate.name} for ${candidate.role}`,
              startDatetime,
              duration
            );
          } catch (zoomErr: any) {
            console.error("[hiring] Zoom meeting creation failed:", zoomErr.message);
          }
        }
      }

      // ── Google Calendar event ─────────────────────────────────────────────
      try {
        const currentUser = req.user;
        let accessToken: string | null = null;

        if (currentUser?.googleRefreshToken) {
          if (currentUser.googleAccessToken && currentUser.googleTokenExpiry && !isTokenExpired(new Date(currentUser.googleTokenExpiry))) {
            accessToken = currentUser.googleAccessToken;
          } else {
            const creds = await refreshAccessToken(currentUser.googleRefreshToken);
            accessToken = creds.access_token || null;
            if (creds.access_token) {
              await db.update(users).set({
                googleAccessToken: creds.access_token,
                googleTokenExpiry: creds.expiry_date ? new Date(creds.expiry_date) : undefined,
              }).where(eq(users.id, currentUser.id));
            }
          }
        }

        if (accessToken) {
          const description = type === "zoom" && zoomResult
            ? `Zoom Interview\nJoin: ${zoomResult.joinUrl}\nPasscode: ${zoomResult.passcode}\n\n${notes}`
            : `In-Person Interview\nLocation: ${location}\n\n${notes}`;

          await createCalendarEvent(accessToken, {
            summary: `Interview: ${candidate.name} — ${candidate.role}`,
            description,
            location: type === "zoom" ? (zoomResult?.joinUrl || "") : location,
            start: { dateTime: startDatetime.toISOString() },
            end: { dateTime: endDatetime.toISOString() },
          });
          calendarEventCreated = true;
        }
      } catch (calErr: any) {
        console.error("[hiring] Calendar event creation failed:", calErr.message);
      }

      // ── Update candidate record ───────────────────────────────────────────
      const updates: Record<string, any> = {
        stage: "Interview Scheduled",
        interviewDate: startDatetime,
        interviewTime: time,
        interviewType: type,
        interviewLocation: type === "in-person" ? location : "",
        interviewerName,
        interviewNotes: notes,
        ...(zoomResult ? {
          zoomMeetingUrl: zoomResult.joinUrl,
          zoomMeetingId: zoomResult.meetingId,
          zoomPasscode: zoomResult.passcode,
        } : {}),
      };

      await storage.updateCandidate(id, updates);

      // ── Send email to applicant ───────────────────────────────────────────
      let emailSent = false;
      if (candidate.email) {
        try {
          const dateLabel = startDatetime.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
          if (type === "zoom" && zoomResult) {
            await sendZoomInterviewEmail(candidate.email, candidate.name, candidate.role, dateLabel, time, zoomResult.joinUrl, zoomResult.passcode, interviewerName, notes);
          } else {
            await sendInPersonInterviewEmail(candidate.email, candidate.name, candidate.role, dateLabel, time, location, interviewerName, notes);
          }
          emailSent = true;
        } catch (emailErr: any) {
          console.error("[hiring] Interview email failed:", emailErr.message);
        }
      }

      return res.json({
        success: true,
        zoomMeeting: zoomResult,
        calendarEventCreated,
        emailSent,
        message: "Interview scheduled successfully",
      });
    } catch (err: any) {
      console.error("[hiring] schedule-interview error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // GET /api/zoom/status — check if Zoom is configured
  app.get("/api/zoom/status", requireAuth, requireHRAccess, (req, res) => {
    res.json({ configured: isZoomConfigured() });
  });
}

function convertTo24h(timeStr: string): string {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return timeStr.includes(":") ? timeStr : "09:00:00";
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${minutes}:00`;
}
