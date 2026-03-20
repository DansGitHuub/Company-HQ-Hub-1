import { Express, RequestHandler } from "express";
import { pool } from "./db";
import { sendResignationNotificationEmail, sendTimeOffRequestEmail } from "./email";

type UserRow = { id: string; username: string; email: string | null; role: string; name: string };

async function getAdminsAndManagers(): Promise<UserRow[]> {
  const result = await pool.query(
    `SELECT id, username, email, role, name FROM users WHERE role IN ('Admin', 'Manager') AND id IS NOT NULL`
  );
  return result.rows;
}

async function getEmployee(employeeId: string) {
  const result = await pool.query(
    `SELECT e.*, u.role as user_role FROM employees e LEFT JOIN users u ON u.id = e.user_id WHERE e.id = $1`,
    [employeeId]
  );
  return result.rows[0] || null;
}

async function createNotification(userId: string, type: string, title: string, message: string, link: string) {
  await pool.query(
    `INSERT INTO staff_notifications (id, user_id, type, title, message, link, is_read, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false, now())`,
    [userId, type, title, message, link]
  );
}

export function registerEmployeeFormsRoutes(app: Express, requireAuth: RequestHandler) {
  const requireHR: RequestHandler = (req: any, res, next) => {
    const role = req.user?.role;
    if (!role || (role !== "Admin" && role !== "Manager" && !req.user?.isMasterAdmin)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };

  // ══════════════════════════════════════════════════════════════════════════
  // TIME OFF REQUESTS
  // ══════════════════════════════════════════════════════════════════════════

  app.post("/api/time-off-requests", requireAuth, async (req: any, res) => {
    try {
      const { employeeId, requestType, startDate, endDate, totalDays, notes } = req.body;
      if (!employeeId || !requestType || !startDate || !endDate || !totalDays) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const result = await pool.query(
        `INSERT INTO time_off_requests (id, employee_id, request_type, start_date, end_date, total_days, notes, status, submitted_at, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'Pending', now(), now())
         RETURNING *`,
        [employeeId, requestType, startDate, endDate, totalDays, notes || null]
      );
      const request = result.rows[0];

      const employee = await getEmployee(employeeId);
      const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : "An employee";
      const position = employee?.job_title || "Team Member";

      const admins = await getAdminsAndManagers();
      for (const admin of admins) {
        await createNotification(
          admin.id,
          "time_off_request",
          "Time Off Request",
          `${employeeName} submitted a ${requestType} request (${startDate} → ${endDate}, ${totalDays} day${totalDays !== 1 ? "s" : ""})`,
          "/employees"
        );
        if (admin.email) {
          sendTimeOffRequestEmail(
            admin.email,
            admin.name || admin.username,
            employeeName,
            requestType,
            startDate,
            endDate,
            totalDays,
            notes
          ).catch(console.error);
        }
      }

      res.json(request);
    } catch (err: any) {
      console.error("[TimeOff] POST error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/time-off-requests", requireAuth, requireHR, async (req: any, res) => {
    try {
      const result = await pool.query(
        `SELECT tor.*, e.first_name, e.last_name, e.job_title,
                u.username as reviewed_by_username, u.name as reviewed_by_name
         FROM time_off_requests tor
         JOIN employees e ON e.id = tor.employee_id
         LEFT JOIN users u ON u.id = tor.reviewed_by
         ORDER BY tor.submitted_at DESC`
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/employees/:id/time-off-requests", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const role = user?.role;

      const employee = await getEmployee(id);
      if (!employee) return res.status(404).json({ message: "Employee not found" });

      if (role !== "Admin" && role !== "Manager" && !user?.isMasterAdmin) {
        if (employee.user_id !== user.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const result = await pool.query(
        `SELECT tor.*, u.name as reviewed_by_name, u.username as reviewed_by_username
         FROM time_off_requests tor
         LEFT JOIN users u ON u.id = tor.reviewed_by
         WHERE tor.employee_id = $1
         ORDER BY tor.submitted_at DESC`,
        [id]
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/time-off-requests/:id", requireAuth, requireHR, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status, reviewNotes } = req.body;
      if (!["Approved", "Denied"].includes(status)) {
        return res.status(400).json({ message: "Status must be Approved or Denied" });
      }
      const result = await pool.query(
        `UPDATE time_off_requests SET status = $1, review_notes = $2, reviewed_by = $3, reviewed_at = now()
         WHERE id = $4 RETURNING *`,
        [status, reviewNotes || null, req.user.id, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "Request not found" });
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RESIGNATION LETTERS
  // ══════════════════════════════════════════════════════════════════════════

  app.post("/api/resignation-letters", requireAuth, async (req: any, res) => {
    try {
      const { employeeId, lastDayOfWork, reasonForLeaving, additionalNotes, signatureDataUrl, signatureDate } = req.body;
      if (!employeeId || !lastDayOfWork || !signatureDataUrl || !signatureDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const result = await pool.query(
        `INSERT INTO resignation_letters (id, employee_id, last_day_of_work, reason_for_leaving, additional_notes, signature_data_url, signature_date, submitted_at, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now(), now())
         RETURNING *`,
        [employeeId, lastDayOfWork, reasonForLeaving || null, additionalNotes || null, signatureDataUrl, signatureDate]
      );
      const letter = result.rows[0];

      const employee = await getEmployee(employeeId);
      const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : "An employee";
      const position = employee?.job_title || "Team Member";

      const admins = await getAdminsAndManagers();
      for (const admin of admins) {
        await createNotification(
          admin.id,
          "resignation",
          "Resignation Notice",
          `${employeeName} (${position}) has submitted a resignation letter. Last day: ${lastDayOfWork}`,
          "/employees"
        );
        if (admin.email) {
          sendResignationNotificationEmail(
            admin.email,
            admin.name || admin.username,
            employeeName,
            position,
            lastDayOfWork
          ).catch(console.error);
        }
      }

      res.json(letter);
    } catch (err: any) {
      console.error("[Resignation] POST error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/employees/:id/resignation-letters", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const role = user?.role;

      const employee = await getEmployee(id);
      if (!employee) return res.status(404).json({ message: "Employee not found" });

      if (role !== "Admin" && role !== "Manager" && !user?.isMasterAdmin) {
        if (employee.user_id !== user.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const result = await pool.query(
        `SELECT * FROM resignation_letters WHERE employee_id = $1 ORDER BY submitted_at DESC`,
        [id]
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/resignation-letters", requireAuth, requireHR, async (req: any, res) => {
    try {
      const result = await pool.query(
        `SELECT rl.*, e.first_name, e.last_name, e.job_title
         FROM resignation_letters rl
         JOIN employees e ON e.id = rl.employee_id
         ORDER BY rl.submitted_at DESC`
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CORRECTIVE ACTIONS
  // ══════════════════════════════════════════════════════════════════════════

  app.post("/api/corrective-actions", requireAuth, requireHR, async (req: any, res) => {
    try {
      const user = req.user;
      const role = user?.role;
      const {
        employeeId, dateOfIncident, descriptionOfIssue, previousWarnings,
        previousWarningsDescription, actionTaken,
        employeeAcknowledgmentSignature, employeeAcknowledgmentDate,
        managerSignature, managerSignatureDate
      } = req.body;

      if (!employeeId || !dateOfIncident || !descriptionOfIssue || !actionTaken || !managerSignature || !managerSignatureDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (role === "Manager") {
        const emp = await getEmployee(employeeId);
        if (!emp) return res.status(404).json({ message: "Employee not found" });
        if (emp.user_role !== "Crew" && emp.user_role !== null) {
          const empUserResult = await pool.query(`SELECT role FROM users WHERE id = $1`, [emp.user_id]);
          const empRole = empUserResult.rows[0]?.role;
          if (empRole && empRole !== "Crew") {
            return res.status(403).json({ message: "Managers can only issue corrective actions for Crew employees" });
          }
        }
      }

      const result = await pool.query(
        `INSERT INTO corrective_actions (
          id, employee_id, issued_by_user_id, date_of_incident, description_of_issue,
          previous_warnings, previous_warnings_description, action_taken,
          employee_acknowledgment_signature, employee_acknowledgment_date,
          manager_signature, manager_signature_date, created_at
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
        RETURNING *`,
        [
          employeeId, user.id, dateOfIncident, descriptionOfIssue,
          previousWarnings || false, previousWarningsDescription || null,
          actionTaken, employeeAcknowledgmentSignature || null, employeeAcknowledgmentDate || null,
          managerSignature, managerSignatureDate
        ]
      );

      const action = result.rows[0];

      const employee = await getEmployee(employeeId);
      const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : "An employee";

      const admins = await pool.query(`SELECT id FROM users WHERE role = 'Admin' AND id IS NOT NULL`);
      for (const admin of admins.rows) {
        if (admin.id !== user.id) {
          await createNotification(
            admin.id,
            "corrective_action",
            "Corrective Action Issued",
            `A ${actionTaken} was issued for ${employeeName}`,
            "/employees"
          );
        }
      }

      res.json(action);
    } catch (err: any) {
      console.error("[CorrectiveAction] POST error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/corrective-actions", requireAuth, requireHR, async (req: any, res) => {
    try {
      const user = req.user;
      const role = user?.role;

      let query: string;
      let params: any[];

      if (role === "Admin" || user?.isMasterAdmin) {
        query = `
          SELECT ca.*, e.first_name, e.last_name, e.job_title,
                 u.name as issued_by_name, u.username as issued_by_username
          FROM corrective_actions ca
          JOIN employees e ON e.id = ca.employee_id
          JOIN users u ON u.id = ca.issued_by_user_id
          ORDER BY ca.created_at DESC
        `;
        params = [];
      } else {
        query = `
          SELECT ca.*, e.first_name, e.last_name, e.job_title,
                 u.name as issued_by_name, u.username as issued_by_username
          FROM corrective_actions ca
          JOIN employees e ON e.id = ca.employee_id
          JOIN users u ON u.id = ca.issued_by_user_id
          WHERE ca.issued_by_user_id = $1
          ORDER BY ca.created_at DESC
        `;
        params = [user.id];
      }

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/employees/:id/corrective-actions", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const role = user?.role;

      const employee = await getEmployee(id);
      if (!employee) return res.status(404).json({ message: "Employee not found" });

      let query: string;
      let params: any[];

      if (role === "Admin" || user?.isMasterAdmin) {
        query = `
          SELECT ca.*, u.name as issued_by_name, u.username as issued_by_username
          FROM corrective_actions ca
          JOIN users u ON u.id = ca.issued_by_user_id
          WHERE ca.employee_id = $1
          ORDER BY ca.created_at DESC
        `;
        params = [id];
      } else if (role === "Manager") {
        query = `
          SELECT ca.*, u.name as issued_by_name, u.username as issued_by_username
          FROM corrective_actions ca
          JOIN users u ON u.id = ca.issued_by_user_id
          WHERE ca.employee_id = $1 AND ca.issued_by_user_id = $2
          ORDER BY ca.created_at DESC
        `;
        params = [id, user.id];
      } else {
        if (employee.user_id !== user.id) {
          return res.status(403).json({ message: "Access denied" });
        }
        query = `
          SELECT ca.*, u.name as issued_by_name, u.username as issued_by_username
          FROM corrective_actions ca
          JOIN users u ON u.id = ca.issued_by_user_id
          WHERE ca.employee_id = $1
          ORDER BY ca.created_at DESC
        `;
        params = [id];
      }

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
