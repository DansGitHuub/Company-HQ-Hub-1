import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import { sendHiringStageEmail, sendHiringWelcomeEmail } from "./email";

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

  // ---- Core Candidate CRUD ----
  app.get("/api/candidates", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const candidates = await storage.getCandidates();
      res.json(candidates);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/candidates/:id", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const candidate = await storage.getCandidate(req.params.id);
      if (!candidate) return res.status(404).json({ message: "Candidate not found" });
      res.json(candidate);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/candidates", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const { name, role, email, phone, address, city, state, zip, source, rating, stage } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Name is required" });
      }
      if (!role || !role.trim()) {
        return res.status(400).json({ message: "Position is required" });
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      if (phone && !/^[\d\s()+-]{7,20}$/.test(phone)) {
        return res.status(400).json({ message: "Invalid phone format" });
      }
      const candidate = await storage.createCandidate({
        name: name.trim(),
        role,
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        source: source || null,
        rating: rating || "green",
        stage: stage || "New Application",
      });

      await notifyHRAndManagers(
        "new_applicant",
        `New Applicant: ${candidate.name}`,
        `${candidate.name} has applied for the ${candidate.role || "open"} position.`,
        "/hiring",
        { candidateId: candidate.id, candidateName: candidate.name, position: candidate.role }
      );

      res.status(201).json(candidate);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/candidates/:id", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const candidate = await storage.getCandidate(req.params.id);
      if (!candidate) return res.status(404).json({ message: "Candidate not found" });

      if (req.body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      if (req.body.phone && !/^[\d\s()+-]{7,20}$/.test(req.body.phone)) {
        return res.status(400).json({ message: "Invalid phone format" });
      }

      const updated = await storage.updateCandidate(req.params.id, {
        ...req.body,
        updatedAt: new Date(),
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/candidates/:id", requireAuth, requireManagerAccess, async (req, res) => {
    try {
      const deleted = await storage.deleteCandidate(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Candidate not found" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ---- Candidate Documents ----
  app.get("/api/candidates/:id/documents", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const docs = await storage.getCandidateDocuments(req.params.id);
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/candidates/:id/documents", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const doc = await storage.createCandidateDocument({
        candidateId: req.params.id,
        name: req.body.name,
        type: req.body.type || "general",
        url: req.body.url || null,
        status: req.body.status || "Not Sent",
      });
      res.status(201).json(doc);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/candidate-documents/:id", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const updated = await storage.updateCandidateDocument(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Document not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/candidate-documents/:id", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const deleted = await storage.deleteCandidateDocument(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Document not found" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ---- Employee by Candidate (optimized lookup) ----
  app.get("/api/candidates/:id/employee", requireAuth, requireHRAccess, async (req, res) => {
    try {
      const employee = await storage.getEmployeeByCandidateId(req.params.id);
      if (!employee) return res.status(404).json({ message: "No employee found for this candidate" });
      res.json(employee);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

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
}
