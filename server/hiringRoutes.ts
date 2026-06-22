import type { Express, RequestHandler } from "express";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import { sendHiringStageEmail, sendHiringWelcomeEmail, sendNewHireAccountEmail, sendZoomInterviewEmail, sendInPersonInterviewEmail, sendHiredNotificationEmail } from "./email";
import { getAppUrl, sendOfferAcceptanceEmail } from "./emailService";
import { hashPassword } from "./auth";
import { createZoomMeeting, isZoomConfigured } from "./zoomService";
import { sendInterviewSms, sendStageSms, sendHireSms, isSmsConfigured } from "./smsService";
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

async function handleStageChange(candidateId: string, newStage: string, candidate: any, userId?: string, sendCandidateNotification: boolean = true) {
  // Look up status URL from job application token
  let statusUrl: string | undefined;
  try {
    const jobApp = await storage.getJobApplicationByCandidateId(candidateId);
    if (jobApp?.token) {
      statusUrl = `${getAppUrl()}/status/${jobApp.token}`;
    }
  } catch {}

  // Always notify HR/managers internally
  await notifyHRAndManagers(
    "hiring_stage_change",
    `Applicant Moved: ${candidate.name}`,
    `${candidate.name} has been moved to "${newStage}" for the ${candidate.role || "open"} position.`,
    "/hiring",
    { candidateId, newStage, candidateName: candidate.name, position: candidate.role }
  );

  if (!sendCandidateNotification) return;

  // Send candidate email (stage template)
  const template = await storage.getHiringEmailTemplate(newStage);
  if (template && template.isEnabled && candidate.email) {
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
      const sent = await sendHiringStageEmail(candidate.email, candidate.name, subject, body, statusUrl);
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

        // Notify all admin staff of hiring stage change via in-app + SMS
        try {
          const ns = await import("./notificationService");
          const adminUsers = await storage.getAllUsers();
          const adminIds = adminUsers
            .filter((u: any) => u.role === "Admin" || u.role === "Manager")
            .map((u: any) => u.id);
          await ns.notifyStageChange(
            adminIds,
            candidate.name || "Applicant",
            candidate.role || "the position",
            newStage,
            candidateId
          );
        } catch (ne: any) { console.error("[notify] stage change:", ne.message); }
  // Send SMS notification for all stages (if candidate has a phone)
  if (!isSmsConfigured()) {
    console.warn("[hiring] SMS skipped — Twilio not configured");
  } else if (!candidate.phone) {
    console.warn(`[hiring] SMS skipped for ${candidate.name} — no phone number on file`);
  } else {
    try {
      const smsSent = await sendStageSms(candidate.phone, candidate.name, newStage, candidate.role || "");
      console.log(`[hiring] Stage SMS for ${newStage} to ${candidate.name}: ${smsSent ? "sent" : "failed"}`);
    } catch (err: any) {
      console.error(`[hiring] Stage SMS failed for ${newStage}:`, err.message);
    }
  }

  // Send offer acceptance email when moving to Offer Extended
  if (newStage === "Offer Extended" && candidate.email) {
    try {
      const token = randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await storage.updateCandidate(candidateId, {
        offerAcceptanceToken: token,
        offerAcceptanceExpiresAt: expiresAt,
      } as any);
      const acceptanceUrl = `${getAppUrl()}/offer/${token}`;
      let offerLetterUrl: string | undefined;
      try {
        const docs = await storage.getCandidateDocuments(candidateId);
        const offerLetterDoc = docs.find((d: any) => d.type === "offer_letter");
        if (offerLetterDoc?.url) offerLetterUrl = offerLetterDoc.url;
      } catch {}
      await sendOfferAcceptanceEmail(
        candidate.email,
        candidate.name,
        candidate.role || "Team Member",
        acceptanceUrl,
        offerLetterUrl
      );
      console.log(`[hiring] Offer acceptance email sent to ${candidate.email} with token ${token}`);
    } catch (err: any) {
      console.error("[hiring] Failed to send offer acceptance email:", err.message);
    }
  }

  // Legacy hired path (via handleStageChange) — send welcome email
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
          await sendHiringWelcomeEmail(candidate.email, candidate.name, candidate.role || "Team Member", new Date(startDate).toLocaleDateString());
        } catch (err: any) {
          console.error("Failed to send welcome/onboarding email:", err.message);
        }
      }
    }
  }
}

async function executeHireFlow(candidateId: string, startDate?: string, sendEmail: boolean = true) {
  const candidate = await storage.getCandidate(candidateId);
  if (!candidate) throw new Error("Candidate not found");

  const nameParts = candidate.name.trim().split(/\s+/);
  const firstName = nameParts[0] || candidate.name;
  const lastName = nameParts.slice(1).join(" ") || "";

  const existingEmployees = await storage.getEmployees();
  const alreadyLinked = existingEmployees.find((e: any) => e.candidateId === candidateId);

  let employee: any;
  if (!alreadyLinked) {
    employee = await storage.createEmployee({
      candidateId,
      firstName,
      lastName,
      personalEmail: candidate.email || undefined,
      personalPhone: candidate.phone || undefined,
      jobTitle: candidate.role || undefined,
      startDate: startDate || new Date().toISOString().split("T")[0],
      status: "Active",
      employmentType: "Full-time",
    });
  } else {
    employee = alreadyLinked;
  }

  await storage.updateCandidate(candidateId, { stage: "Hired" });

  const ONBOARDING_FORMS = [
    { title: "Emergency Contact Form", category: "Forms" },
    { title: "I-9 Employment Eligibility Verification", category: "Compliance" },
    { title: "W-4 Federal Tax Withholding", category: "Compliance" },
    { title: "IT-4 State Tax Withholding (Ohio)", category: "Compliance" },
    { title: "NDA Agreement", category: "Legal" },
    { title: "OSHA 301 Incident Report Acknowledgment", category: "Safety" },
    { title: "Employee Handbook Acknowledgment", category: "Policy" },
    { title: "Offer Letter Review & Acceptance", category: "HR" },
    { title: "Direct Deposit Form", category: "Payroll" },
  ];

  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  for (const form of ONBOARDING_FORMS) {
    try {
      await storage.createOnboardingItem({
        employeeId: employee.id,
        title: form.title,
        category: form.category,
        assignedTo: candidate.name,
        status: "Pending",
        dueDate,
      });
    } catch {}
  }

  const candidateDocs = await storage.getCandidateDocuments(candidateId);
  const offerLetter = candidateDocs.find((d: any) => d.type === "offer_letter");
  if (offerLetter) {
    try {
      await storage.createHrFormSubmission({
        employeeId: employee.id,
        candidateId,
        formType: "offer_letter",
        formData: { documentId: offerLetter.id, url: offerLetter.url, uploadedAt: offerLetter.uploadedAt },
        status: "Completed",
      });
    } catch {}
  }

  // Backfill employeeId on any form submissions already linked to this candidate
  // (e.g., forms submitted during the pre-hire process that only had candidateId)
  try {
    const existingCandidateForms = await storage.getHrFormSubmissions(undefined, candidateId);
    for (const form of existingCandidateForms) {
      if (!form.employeeId) {
        await storage.updateHrFormSubmission(form.id, { employeeId: employee.id });
      }
    }
  } catch {}

  let username = "";
  let tempPassword = "";
  let accountCreated = false;
  let emailSent = false;

  if (!candidate.userId) {
    const baseUsername = slugifyName(candidate.name) || "crew.member";
    username = baseUsername;
    let suffix = 1;
    while (await storage.getUserByUsername(username)) {
      username = `${baseUsername}${suffix++}`;
    }

    const existingByEmail = candidate.email ? await storage.getUserByEmail(candidate.email) : null;
    if (!existingByEmail) {
      tempPassword = generateTempPassword();
      const hashedPassword = await hashPassword(tempPassword);
      const newUser = await storage.createUser({
        username,
        password: hashedPassword,
        email: candidate.email || `${username}@chapinlandscapes.com`,
        name: candidate.name,
        role: "Crew",
      });
      await storage.updateCandidate(candidateId, { userId: newUser.id });
      await storage.updateEmployee(employee.id, { userId: newUser.id });
      accountCreated = true;
      if (sendEmail && candidate.email) {
        try {
          await sendNewHireAccountEmail(candidate.email, candidate.name, username, tempPassword, candidate.role || "Team Member");
          emailSent = true;
        } catch (err: any) {
          console.error("[hiring] Welcome email failed:", err.message);
        }
      }
      if (sendEmail && candidate.phone && isSmsConfigured()) {
        try {
          await sendHireSms(candidate.phone, candidate.name, candidate.role || "Team Member");
        } catch (err: any) {
          console.error("[hiring] Hire SMS failed:", err.message);
        }
      }
    } else {
      username = existingByEmail.username;
      await storage.updateCandidate(candidateId, { userId: existingByEmail.id });
      await storage.updateEmployee(employee.id, { userId: existingByEmail.id });
    }
  } else {
    const existingUser = await storage.getUser(candidate.userId);
    username = existingUser?.username || "";
  }

  try {
    const allUsers = await storage.getAllUsers();
    const recipients = allUsers.filter((u: any) => u.role === "Admin" || u.role === "Manager" || u.role === "Master Admin");
    for (const recipient of recipients) {
      await storage.createStaffNotification({
        userId: recipient.id,
        type: "candidate_hired",
        title: "New Hire",
        message: `${candidate.name} has been hired as ${candidate.role || "Team Member"}. Employee record, onboarding checklist, and Crew account created.`,
        link: "/hiring",
        isRead: false,
      });
      if (recipient.email) {
        try {
          await sendHiredNotificationEmail(recipient.email, recipient.name || recipient.username, candidate.name, candidate.role || "Team Member", username);
        } catch {}
      }
    }
  } catch {}

  return {
    success: true,
    employeeId: employee.id,
    accountCreated,
    emailSent,
    username,
    onboardingItems: ONBOARDING_FORMS.length,
    message: "Candidate hired — employee record, onboarding, and account all created.",
  };
}

export function registerHiringRoutes(app: Express, requireAuth: RequestHandler) {
  const requireHRAccess: RequestHandler = (req: any, res, next) => {
    const role = req.user?.role;
    const isMasterAdmin = req.user?.isMasterAdmin;
    if (!["Admin", "Manager"].includes(role) && !isMasterAdmin) {
      return res.status(403).json({ message: "Not authorized" });
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
      const { stage, sendNotification = true } = req.body;
      const candidate = await storage.getCandidate(req.params.id);
      if (!candidate) return res.status(404).json({ message: "Candidate not found" });

      const updated = await storage.updateCandidate(req.params.id, { stage, updatedAt: new Date() });

      await handleStageChange(req.params.id, stage, { ...candidate, stage }, (req as any).user?.id, sendNotification !== false);

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Employees
  app.get("/api/employees/me", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { pool } = await import("./db");
      const result = await pool.query(
        `SELECT * FROM employees WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "No employee record found" });
      const emp = result.rows[0];
      res.json({
        id: emp.id,
        userId: emp.userId,
        firstName: emp.first_name,
        lastName: emp.last_name,
        jobTitle: emp.job_title,
        department: emp.department,
        startDate: emp.start_date,
        personalEmail: emp.personal_email,
        personalPhone: emp.personal_phone,
        address: emp.address,
        city: emp.city,
        state: emp.state,
        zip: emp.zip,
        emergencyContactName: emp.emergency_contact_name,
        emergencyContactRelationship: emp.emergency_contact_relationship,
        emergencyContactPhone: emp.emergency_contact_phone,
        profilePhoto: emp.profile_photo,
        status: emp.status,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/employees/me", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { pool } = await import("./db");
      const result = await pool.query(`SELECT id FROM employees WHERE user_id = $1 LIMIT 1`, [userId]);
      if (result.rows.length === 0) return res.status(404).json({ message: "No employee record found" });
      const empId = result.rows[0].id;

      const allowed: Record<string, string> = {
        firstName: "first_name",
        lastName: "last_name",
        personalEmail: "personal_email",
        personalPhone: "personal_phone",
        address: "address",
        city: "city",
        state: "state",
        zip: "zip",
        emergencyContactName: "emergency_contact_name",
        emergencyContactRelationship: "emergency_contact_relationship",
        emergencyContactPhone: "emergency_contact_phone",
      };

      const setClauses: string[] = [];
      const values: any[] = [];
      let p = 1;
      for (const [bodyKey, col] of Object.entries(allowed)) {
        if (bodyKey in req.body) {
          setClauses.push(`${col} = $${p++}`);
          values.push(req.body[bodyKey] ?? null);
        }
      }
      if (setClauses.length === 0) return res.status(400).json({ message: "No valid fields provided" });

      values.push(empId);
      const updated = await pool.query(
        `UPDATE employees SET ${setClauses.join(", ")} WHERE id = $${p} RETURNING
          id, first_name, last_name, personal_email, personal_phone,
          address, city, state, zip,
          emergency_contact_name, emergency_contact_relationship, emergency_contact_phone`,
        values
      );
      const e = updated.rows[0];
      res.json({
        id: e.id,
        firstName: e.first_name,
        lastName: e.last_name,
        personalEmail: e.personal_email,
        personalPhone: e.personal_phone,
        address: e.address,
        city: e.city,
        state: e.state,
        zip: e.zip,
        emergencyContactName: e.emergency_contact_name,
        emergencyContactRelationship: e.emergency_contact_relationship,
        emergencyContactPhone: e.emergency_contact_phone,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin-only: list all employees
  app.get("/api/employees", requireAuth, requireHRAccess, async (req: any, res) => {
    const role = req.user?.role;
    const isMasterAdmin = req.user?.isMasterAdmin;
    if (!["Admin"].includes(role) && !isMasterAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    try {
      const emps = await storage.getEmployees();
      res.json(emps);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin OR own employee record
  app.get("/api/employees/:id", requireAuth, async (req: any, res) => {
    try {
      const role = req.user?.role;
      const isMasterAdmin = req.user?.isMasterAdmin;
      const emp = await storage.getEmployee(req.params.id);
      if (!emp) return res.status(404).json({ message: "Employee not found" });
      const isAdmin = ["Admin", "Manager"].includes(role) || isMasterAdmin;
      const isOwn = emp.userId === req.user?.id;
      if (!isAdmin && !isOwn) return res.status(403).json({ message: "Access denied" });
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

  // Admin OR own employee record
  app.patch("/api/employees/:id", requireAuth, async (req: any, res) => {
    try {
      const role = req.user?.role;
      const isMasterAdmin = req.user?.isMasterAdmin;
      const emp = await storage.getEmployee(req.params.id);
      if (!emp) return res.status(404).json({ message: "Employee not found" });
      const isAdmin = ["Admin", "Manager"].includes(role) || isMasterAdmin;
      const isOwn = emp.userId === req.user?.id;
      if (!isAdmin && !isOwn) return res.status(403).json({ message: "Access denied" });
      const updated = await storage.updateEmployee(req.params.id, req.body);
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

  app.put("/api/hiring-email-templates/:stage", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const { stage } = req.params;
      const { subject, body, isEnabled } = req.body;
      if (!subject || !body) return res.status(400).json({ message: "subject and body are required" });
      const template = await storage.upsertHiringEmailTemplate(stage, { subject, body, isEnabled: isEnabled !== false });
      res.json(template);
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
      const { date, time, duration = 30, type = "zoom", location = "", notes = "", interviewerName = "", sendNotification = true } = req.body as {
        date: string; time: string; duration?: number; type?: string;
        location?: string; notes?: string; interviewerName?: string; sendNotification?: boolean;
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

      // ── Send email & SMS to applicant (if sendNotification is true) ──────
      let emailSent = false;
      let smsSent = false;
      let interviewStatusUrl: string | undefined;
      try {
        const jobApp = await storage.getJobApplicationByCandidateId(id);
        if (jobApp?.token) interviewStatusUrl = `${getAppUrl()}/status/${jobApp.token}`;
      } catch {}

      if (sendNotification !== false) {
        if (candidate.email) {
          try {
            const dateLabel = startDatetime.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
            if (type === "zoom" && zoomResult) {
              await sendZoomInterviewEmail(candidate.email, candidate.name, candidate.role, dateLabel, time, zoomResult.joinUrl, zoomResult.passcode, interviewerName, notes, interviewStatusUrl);
            } else {
              await sendInPersonInterviewEmail(candidate.email, candidate.name, candidate.role, dateLabel, time, location, interviewerName, notes, interviewStatusUrl);
            }
            emailSent = true;
          } catch (emailErr: any) {
            console.error("[hiring] Interview email failed:", emailErr.message);
          }
        }

        if (candidate.phone && isSmsConfigured()) {
          try {
            const dateLabel = startDatetime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
            smsSent = await sendInterviewSms(
              candidate.phone,
              candidate.name,
              dateLabel,
              time,
              type === "zoom" ? "zoom" : "in-person",
              zoomResult?.joinUrl,
              location
            );
          } catch (smsErr: any) {
            console.error("[hiring] Interview SMS failed:", smsErr.message);
          }
        }
      }

      // ── Always notify HR / Managers ───────────────────────────────────────
      const updatedCandidate = await storage.getCandidate(id);
      await notifyHRAndManagers(
        "hiring_stage_change",
        `Interview Scheduled: ${candidate.name}`,
        `${candidate.name} has been scheduled for a ${type === "zoom" ? "Zoom" : "In-Person"} interview on ${startDatetime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at ${time}.`,
        "/hiring",
        { candidateId: id, newStage: "Interview Scheduled", candidateName: candidate.name, position: candidate.role }
      );

      return res.json({
        success: true,
        zoomMeeting: zoomResult,
        calendarEventCreated,
        emailSent,
        smsSent,
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

  // GET /api/candidates/:id/offer-letter-upload-url — signed URL for direct-to-storage upload
  app.get("/api/candidates/:id/offer-letter-upload-url", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
      const objService = new ObjectStorageService();
      const signedUrl = await objService.getObjectEntityUploadURL();
      const objectKey = signedUrl.split("?")[0].split("/uploads/").pop() || "";
      res.json({ signedUrl, objectKey });
    } catch (err: any) {
      console.error("[hiring] offer-letter upload URL error:", err.message);
      res.status(500).json({ message: "Failed to get upload URL. Object storage may not be configured." });
    }
  });

  // POST /api/candidates/:id/hire — full hire automation
  app.post("/api/candidates/:id/hire", requireAuth, requireHRAccess, async (req: any, res) => {
    try {
      const sendEmail = req.body.sendNotification !== false;
      const result = await executeHireFlow(req.params.id, req.body.startDate, sendEmail);
      res.json(result);
    } catch (err: any) {
      console.error("[hiring] hire error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // ── PUBLIC OFFER ACCEPTANCE ROUTES (no auth required) ────────────────────

  // GET /api/offer/:token — fetch offer details for candidate
  app.get("/api/offer/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const candidates = await storage.getCandidates();
      const candidate = candidates.find((c: any) => c.offerAcceptanceToken === token);
      if (!candidate) return res.status(404).json({ message: "Offer link not found or expired." });

      const now = new Date();
      if (candidate.offerAcceptanceExpiresAt && new Date(candidate.offerAcceptanceExpiresAt) < now) {
        return res.status(410).json({ message: "This offer link has expired." });
      }

      const docs = await storage.getCandidateDocuments(candidate.id);
      const offerLetterDoc = docs.find((d: any) => d.type === "offer_letter");

      res.json({
        candidateId: candidate.id,
        name: candidate.name,
        role: candidate.role,
        alreadyAccepted: !!candidate.offerAcceptedAt,
        acceptedAt: candidate.offerAcceptedAt,
        offerLetterUrl: offerLetterDoc?.url || null,
        expiresAt: candidate.offerAcceptanceExpiresAt,
        offerPay: candidate.offerPay || null,
        offerPayType: candidate.offerPayType || null,
        offerStartDate: candidate.offerStartDate || null,
        offerEmploymentType: candidate.offerEmploymentType || null,
        offerSchedule: candidate.offerSchedule || null,
        offerBenefits: candidate.offerBenefits ? (candidate.offerBenefits as string).split(",").filter(Boolean) : [],
        offerNotes: candidate.offerNotes || null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/offer/:token/accept — candidate digitally accepts offer → triggers full hire flow
  app.post("/api/offer/:token/accept", async (req, res) => {
    try {
      const { token } = req.params;
      const { signature } = req.body;

      const candidates = await storage.getCandidates();
      const candidate = candidates.find((c: any) => c.offerAcceptanceToken === token);
      if (!candidate) return res.status(404).json({ message: "Offer link not found or expired." });

      const now = new Date();
      if (candidate.offerAcceptanceExpiresAt && new Date(candidate.offerAcceptanceExpiresAt) < now) {
        return res.status(410).json({ message: "This offer link has expired." });
      }

      if (candidate.offerAcceptedAt) {
        return res.status(409).json({ message: "Offer has already been accepted." });
      }

      // Save signature and mark accepted
      await storage.updateCandidate(candidate.id, {
        offerAcceptedAt: now,
        offerAcceptanceSignature: signature || null,
      } as any);

      // Run the full hire flow
      const result = await executeHireFlow(candidate.id);

      res.json({
        success: true,
        message: "Offer accepted! Your account credentials have been sent to your email.",
        username: result.username,
        accountCreated: result.accountCreated,
      });
    } catch (err: any) {
      console.error("[hiring] offer-accept error:", err);
      res.status(500).json({ message: err.message });
    }
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
