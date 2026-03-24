import { Express } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import { getAppUrl, sendEmail } from "./emailService";

const SOFTSCAPE_FOREMAN_BODY = `<h1 style="text-align: center">{{year}} SOFTSCAPE FOREMAN</h1><h1 style="text-align: center">EMPLOYMENT AGREEMENT</h1><p style="text-align: center"><em>"Do Whatever It Takes to Achieve Exceptional Results"</em></p><hr><p>The following agreement stipulates the terms of employment that must be adhered to by all Foremen employed by CHAPIN LANDSCAPES.</p><h2>Company Values</h2><p>CHAPIN LANDSCAPES' values form the foundation of the company. Adhering to our values will help us build &amp; maintain a strong, healthy organization.</p><ul><li><p>Willingness to Help</p></li><li><p>Accountability</p></li><li><p>Listen &amp; Provide</p></li><li><p>Attention to Detail</p></li></ul><h2>ACCOUNTABILITIES</h2><p>The Foreman is the key to fulfilling the promises we make to our customers. The company's brand and financial performance rely on the proper execution of the responsibilities of this role.</p><p><strong>Deliverables:</strong></p><ul><li><p>Complete Projects on Budget &amp; on Schedule with Estimated Hours Per Job Planner</p></li><li><p>Responsibility for Customer Experience</p></li><li><p>Development &amp; Employee Training</p></li><li><p>Complete All Required Administrative Tasks</p></li></ul><h3>Deliverable 1 – Revenue Production Achievement</h3><ol><li><p>Take ownership of booked projects from the Production Manager and with extreme clarity, arrange them into production for efficient and profitable completion.</p></li><li><p>Schedule and organize your crew, tools, hand equipment, and machinery to complete projects in the most efficient way possible.</p></li><li><p>Set and discuss daily and weekly goals with your crew by facilitating Daily Huddles. The crew plays an essential role in reaching your targets as a Foreman and you will need an effective plan.</p></li><li><p>Ensure all necessary tools, hand equipment, and machinery are available at least three days in advance to prevent delays to the production schedule.</p></li><li><p>Oversee and report production daily to ensure assigned projects are completed on time and on budget.</p></li><li><p>Ensure all Change Orders and/or extras are approved. Approval is required from the Production Manager and point of contact before commencement of the work.</p></li><li><p>Maintain regular contact with Production Manager, suppliers, point of contact, and employees to ensure that all project progress is on track.</p></li></ol><h3>Deliverable 2 – Customer Service Maintenance</h3><ol><li><p>Communicate with all customers to answer any questions they may have. Check in with customers as required to ensure they are happy with the progression of the project.</p></li><li><p>Update all customers with any changes to their project schedule.</p></li><li><p>Ensure all Chapin Landscapes employees are introduced to the customer and communicate in a warm, professional, and polite manner.</p></li><li><p>Maintain a job site presence that is free of loud music, swearing, and/or inappropriate discussion.</p></li><li><p>Relay any customer complaints to ensure they are resolved in a timely manner. Complaints must be brought immediately to the Production Manager along with a suggested method of resolution.</p></li><li><p>Immediately report any hour overages to project supervisor.</p></li></ol><h3>Deliverable 3 – Development &amp; Employee Training</h3><ol><li><p>Demonstrate leadership by pursuing ongoing growth and development through attending courses and/or workshops.</p></li><li><p>Ensure all employees understand the importance of ongoing growth and development and are committed to the attendance of their courses and/or workshops.</p></li><li><p>Conduct an initial Chapin Landscapes on-site orientation to ensure that all new employees are briefed on site organization and basic Chapin Landscapes' policies.</p></li><li><p>Conduct initial safety training to ensure that all new employees clearly understand Chapin Landscapes' safety practices and are committed to their execution.</p></li><li><p>Ensure all new employees have a clear understanding of tools, hand equipment, and machinery: their use, how to operate them safely, cleaning procedures, as well as storage and organization. This includes softscape-specific equipment such as pruners, hand saws, sprayers, aerators, dethatchers, planting tools, and irrigation equipment.</p></li><li><p>Conduct all the training necessary for each employee to develop the required skills in their specific role in order to produce jobs confidently and efficiently.</p></li><li><p>Ensure all employees understand the importance of goal setting and are committed to tracking their productivity on site.</p></li><li><p>Train all crew members on plant identification, proper planting techniques, pruning timing and methods, seasonal care schedules, and horticultural best practices relevant to the scope of Chapin Landscapes' softscape services.</p></li></ol><h3>Deliverable 4 – Administrative Responsibility Completion</h3><ol><li><p>Maintain and update accurate time sheets for yourself and your assigned crew daily. Submissions are due on a daily basis and are to be updated in the Foreman GSR File by Friday at 5:00 pm. Payroll is processed weekly.</p></li><li><p>Ensure all Change Orders and/or extras are approved. Approval is required from the Production Manager and customer before commencement of the work.</p></li><li><p>Complete Weekly Tasks Form for Production Manager daily with the assistance of the Lead Hand.</p></li><li><p>Accurately record and sort all project-related receipts. Receipts are to be attached to the job sheet and delivered to the office daily.</p></li></ol><h2>REPORTING</h2><ol><li><p>Report directly to the Production Manager.</p></li><li><p>Attend weekly GSR meetings on time with prep completed by Friday at 3:30 pm.</p></li><li><p>Maintain and update accurate data for all previously listed administrative responsibilities as per individual submission deadlines.</p></li></ol><p>The following will require sign off and/or notification of the Production Manager:</p><ol><li><p>Any injury or accident occurring on a Chapin Landscapes job site.</p></li><li><p>Any liability, warranty, or damage issue.</p></li><li><p>Any incidence of fraud or theft within the company.</p></li><li><p>All purchasing of new tools, hand equipment and/or machinery.</p></li><li><p>Any incident involving damage to Chapin Landscapes' or customer's assets.</p></li></ol><h2>COMPENSATION STRUCTURE</h2><p>All Foremen are paid weekly. Bonus pay for projects will be paid within 2 weeks of project completion. All payments will be made via direct deposit.</p><h3>Hours of Work</h3><p>Monday to Friday, 7:00 am – 5:00 pm. It is expected that you will arrive at the shop by 6:45 am each day. Full time is assumed but not guaranteed. When working conditions permit, and pending the Production Manager's approval, employees are entitled to one 30-minute unpaid break for every eight hours worked. Chapin Landscapes requests that employees not receive personal calls while on duty. If urgent, please keep personal calls to a minimum and conversations brief.</p><h3>Overtime Hours</h3><p>Hours worked more than 40 hours per week will be paid at 1.5× regular hourly pay.</p><h3>Employee Benefits</h3><p>Employee Benefits are currently not provided by Chapin Landscapes.</p><h3>Professional Development</h3><p>At Chapin Landscapes we want you to be the best in the business at what you do. Because of this, we encourage and financially support all our employees with professional development opportunities arranged both internally and externally. Chapin Landscapes Owner Dan Chapin has an associate of applied science in landscape contracting &amp; construction from Ohio State University and can apprentice those interested in pursuing a long-term career in the landscaping industry. In addition, Chapin Landscapes supports employee enrollment in PLANET (Professional Landcare Network) online programs and supports participation in other professional landscaping courses and trade association programs.</p><h3>Company Vehicle Use</h3><p>It is expected that all Foremen have &amp; maintain a valid driver's license. Each Foreman has access to a Chapin Landscapes truck. These trucks are to be used for the transport of all tools, hand equipment and machinery to and from Chapin Landscapes job sites. This includes the transport of plant materials, mulch, soil, and other softscape supplies, which must be properly secured and handled to prevent damage in transit. Foremen will not be paid for the use of their personal vehicle for business use unless a separate agreement is made and signed by both the Foreman and a Chapin Landscapes representative.</p><h3>Driving Record</h3><p>Chapin Landscapes has a zero alcohol and drug policy for any Foreman driving a company truck. Foremen are responsible for all tickets, fines and/or penalties which occur while they are operating the company truck. Foremen are not to operate a company truck outside work and transportation hours (Monday to Friday, 7:00 am – 4:30 pm) as all company trucks, tools, hand equipment, and machinery are to be used strictly for business purposes. Trucks must always be full of fuel, empty of garbage, and in organized, clean condition at all times.</p><h3>Cell Phone Usage</h3><p>All Foremen are required to maintain a properly working cellular phone &amp; data plan. Cell phones are to only be used for work-related communication purposes during work hours. Personal use is restricted to before and after work hours except the daily 30-minute lunch time required by the state of Ohio when working 8 hours or more per day. Personal use of your phone during work hours is NOT ALLOWED.</p><h3>Performance and Wage Review</h3><p>Performance reviews will take place on a set milestone basis, twice per year. Raises are based on performance and experience and are not guaranteed. Factors considered include: quality of work, attitude, knowledge of work, knowledge of horticulture, job skills, attendance and punctuality, teamwork and cooperation, compliance with company policy, past performance reviews, improvement, and acceptance of responsibility and constructive feedback.</p><h3>Probationary Period</h3><p>A 3-month probationary period will be in effect from the start of employment.</p><h2>GENERAL EXPECTATIONS</h2><h3>Uniforms</h3><p>All employees are expected to wear a Chapin Landscapes uniform (T-shirts, hats, and safety vests). You will be required to sign for these, and they are expected back at the time of resignation or termination. Work boots (steel toe, shank, and heel) are always required. Tennis shoes and shorts are not permitted.</p><h3>Safety</h3><p>Foremen must always adhere to OSHA practices. In the event of an accident or injury, employees must notify the Production Manager immediately. Physical discomfort caused by repetitive tasks must also be reported. If an employee is injured or becomes ill because of their job, it is the employee's responsibility to immediately notify the Production Manager. If necessary, injured employees will be referred to a medical care facility. Employees should retain all paperwork provided by medical personnel.</p><h3>Respect of Environment</h3><p>All employees must refrain from the use of inappropriate language on and around Chapin Landscapes job sites and while wearing Chapin Landscapes attire in the community. Any music played on a Chapin Landscapes job site must contain appropriate language. Smoking is not permitted on or around Chapin Landscapes' job sites, or while wearing Chapin Landscapes' attire in the community.</p><h3>Tools, Hand Equipment &amp; Machinery</h3><p>All tools, hand equipment and machinery provided by Chapin Landscapes are expected to be used and taken care of as if they were your own. They must be kept clean, organized, and in safe working condition always through daily maintenance. Machinery must always be in proper working order when transferred from one Chapin Landscapes crew to another, as well as when being returned to the shop.</p><p>Tools, hand equipment and machinery belonging to Chapin Landscapes must be kept in the designated toolbox, truck, and trailer and are not to be stored in personal vehicles at any time. The tool storage areas must be kept clean and always organized and locked when unattended. Foremen must confirm on a weekly basis that all Chapin Landscapes' tools, hand equipment and machinery are accounted for. Anything found in need of repair should be repaired by the Foreman on the job site where possible, or reported to management immediately.</p><h2>ABSENTEEISM</h2><h3>Time Off</h3><p>Time off must be requested at least one week in advance. There is also currently no paid vacation.</p><h3>Sick Days</h3><p>There are no paid sick days according to Ohio Labor Standards. Foremen must notify the Production Manager by 6 am if they are sick and require a day off. A doctor's note will be required for illnesses requiring more than 3 consecutive days off.</p><h3>Extended Medical Leave</h3><p>An employee absent from work for a period of more than three days due to illness or injury will be required to present a note from a licensed physician upon their return. The Production Manager must be notified of any extended leave as soon as possible.</p><h2>RESIGNATION &amp; TERMINATION</h2><h3>Resignation</h3><p>Foremen agree to give a full two weeks' notice to the Production Manager, prior to resignation. Upon resignation, Foremen are required to continue working until the last scheduled day of employment, turn in all reports and paperwork, and return all equipment and property belonging to Chapin Landscapes.</p><h3>Enforcement</h3><p>Certain circumstances may lead to reprimanding prior to termination by way of a "3 strikes you're out" scenario. Such actions may include but are not limited to: unsatisfactory completion of work, not showing up to work without proper notice, general disinterest that brings down crew morale, or an overall bad attitude. At the first incident an official verbal warning will be given. Upon a second incident, an official written warning will be issued. If management has reason to issue a third notice, termination of the employment agreement may be considered.</p><h3>Grounds for Termination</h3><p>Chapin Landscapes reserves the right to discipline and/or terminate any employee who violates company policies, practices or rules of conduct. Unacceptable conduct includes but is not limited to: discrimination or harassment, possession or use of controlled substances, unauthorized use or damage of company property, falsification of records, insubordination, excessive absenteeism, disclosing confidential information, illegal or violent activity, and disregard for safety procedures.</p><p>Upon termination, Foremen are required to continue to work until the last scheduled day of employment, turn in all reports and paperwork, and return all equipment and property belonging to Chapin Landscapes.</p><hr><h2>Agreement &amp; Signature</h2><p><em>All terms of this Employment Agreement are subject to change. No terms of this agreement should be considered precedent-setting for upcoming employment contracts. By signing this document, I agree to and understand all of the preceding policies.</em></p><p>I, <strong>{{employee_name}}</strong>, and Chapin Landscapes agree to an hourly wage of <strong>\${{pay_rate}}</strong> per hour as of <strong>{{start_date}}</strong>.</p><p>I hereby acknowledge the job requirements and furthermore accept the job duties and responsibilities outlined in this agreement.</p><p><br></p><p><strong>Employee Name:</strong> {{employee_name}}</p><p><strong>Position:</strong> {{position}}</p><p><br></p><p>Employee Signature: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: _______________________</p><p>On behalf of Chapin Landscapes:</p><p>Authorized Signature: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: _______________________</p>`.trim();

async function seedAgreementTemplates() {
  try {
    const existing = await db.execute(sql`SELECT id FROM agreement_templates WHERE position_title = 'Softscape Foreman' LIMIT 1`);
    if (existing.rows.length === 0) {
      await db.execute(sql`
        INSERT INTO agreement_templates (id, position_title, year, template_body, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Softscape Foreman', 2026, ${SOFTSCAPE_FOREMAN_BODY}, NOW(), NOW())
      `);
      console.log("[agreements] Seeded Softscape Foreman agreement template");
    } else {
      await db.execute(sql`
        UPDATE agreement_templates
        SET template_body = ${SOFTSCAPE_FOREMAN_BODY}, updated_at = NOW()
        WHERE position_title = 'Softscape Foreman'
      `);
      console.log("[agreements] Refreshed Softscape Foreman agreement template");
    }
  } catch (e: any) {
    console.error("[agreements] Seed error:", e.message);
  }
}

function fillVariables(body: string, vars: Record<string, string>) {
  let result = body;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value || "");
  }
  return result;
}

export function registerAgreementRoutes(app: Express, requireAuth: any, requireAdmin: any) {
  seedAgreementTemplates();

  // ── List all templates ────────────────────────────────────────────────────
  app.get("/api/agreement-templates", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT id, position_title, year, updated_at, created_at
        FROM agreement_templates ORDER BY position_title, year DESC
      `);
      res.json(rows.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Get one template (with body) ──────────────────────────────────────────
  app.get("/api/agreement-templates/:id", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const rows = await db.execute(sql`SELECT * FROM agreement_templates WHERE id = ${req.params.id}`);
      if (!rows.rows.length) return res.status(404).json({ message: "Not found" });
      res.json(rows.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Create template ───────────────────────────────────────────────────────
  app.post("/api/agreement-templates", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { positionTitle, year, templateBody } = req.body;
      if (!positionTitle || !year || !templateBody) return res.status(400).json({ message: "positionTitle, year, and templateBody are required" });
      const rows = await db.execute(sql`
        INSERT INTO agreement_templates (id, position_title, year, template_body, created_by, created_at, updated_at)
        VALUES (gen_random_uuid(), ${positionTitle}, ${year}, ${templateBody}, ${req.user.id}, NOW(), NOW())
        RETURNING *
      `);
      res.status(201).json(rows.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Update template ───────────────────────────────────────────────────────
  app.put("/api/agreement-templates/:id", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { positionTitle, year, templateBody } = req.body;
      const rows = await db.execute(sql`
        UPDATE agreement_templates
        SET position_title = ${positionTitle}, year = ${year}, template_body = ${templateBody}, updated_at = NOW()
        WHERE id = ${req.params.id}
        RETURNING *
      `);
      if (!rows.rows.length) return res.status(404).json({ message: "Not found" });
      res.json(rows.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Delete template ───────────────────────────────────────────────────────
  app.delete("/api/agreement-templates/:id", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      await db.execute(sql`DELETE FROM agreement_templates WHERE id = ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Send agreement to employee ────────────────────────────────────────────
  app.post("/api/employees/:employeeId/send-agreement", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { employeeId } = req.params;
      const { templateId, payRate, startDate } = req.body;
      if (!templateId) return res.status(400).json({ message: "templateId is required" });

      const empRow = await db.execute(sql`
        SELECT e.*, u.email, u.name as user_name
        FROM employees e
        LEFT JOIN users u ON u.id = e.user_id
        WHERE e.id = ${employeeId}
      `);
      if (!empRow.rows.length) return res.status(404).json({ message: "Employee not found" });
      const emp = empRow.rows[0] as any;

      const tmplRow = await db.execute(sql`SELECT * FROM agreement_templates WHERE id = ${templateId}`);
      if (!tmplRow.rows.length) return res.status(404).json({ message: "Template not found" });
      const tmpl = tmplRow.rows[0] as any;

      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const employeeName = `${emp.first_name} ${emp.last_name}`;
      const renderedBody = fillVariables(tmpl.template_body, {
        employee_name: employeeName,
        year: String(tmpl.year),
        pay_rate: payRate || "",
        start_date: startDate || "",
        position: tmpl.position_title,
      });

      const row = await db.execute(sql`
        INSERT INTO employee_agreements
          (id, employee_id, template_id, sent_by_user_id, token, token_expires_at, rendered_body, pay_rate, start_date, status, sent_at, created_at)
        VALUES
          (gen_random_uuid(), ${employeeId}, ${templateId}, ${req.user.id}, ${token}, ${expires.toISOString()}, ${renderedBody}, ${payRate || null}, ${startDate || null}, 'Pending', NOW(), NOW())
        RETURNING *
      `);

      const signingUrl = `${getAppUrl()}/agreement/${token}`;

      if (emp.email) {
        await sendEmail({
          to: emp.email,
          subject: `Your ${tmpl.year} Employment Agreement – Chapin Landscapes`,
          html: `
            <div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:24px;">
              <h2 style="color:#1a472a;">Employment Agreement Ready to Sign</h2>
              <p>Hi ${employeeName},</p>
              <p>Your <strong>${tmpl.year} ${tmpl.position_title} Employment Agreement</strong> with Chapin Landscapes is ready for your review and signature.</p>
              <p>Please click the button below to read the full agreement and sign digitally. This link is valid for 30 days.</p>
              <div style="text-align:center; margin:32px 0;">
                <a href="${signingUrl}" style="background:#1a472a; color:#fff; padding:14px 32px; border-radius:6px; text-decoration:none; font-weight:600;">
                  Review &amp; Sign Agreement
                </a>
              </div>
              <p style="color:#666; font-size:0.875rem;">If you have any questions, please reach out to your manager or HR.</p>
              <p style="color:#666; font-size:0.875rem;">— Chapin Landscapes Team</p>
            </div>
          `,
        });
      }

      res.status(201).json({ id: row.rows[0].id, signingUrl });
    } catch (e: any) {
      console.error("[agreements] send error:", e.message);
      res.status(500).json({ message: e.message });
    }
  });

  // ── Get agreements for an employee (admin view) ───────────────────────────
  app.get("/api/employees/:employeeId/agreements", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT ea.*, at.position_title, at.year
        FROM employee_agreements ea
        JOIN agreement_templates at ON at.id = ea.template_id
        WHERE ea.employee_id = ${req.params.employeeId}
        ORDER BY ea.sent_at DESC
      `);
      res.json(rows.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── PUBLIC: Get agreement for signing ─────────────────────────────────────
  app.get("/api/agreement/:token", async (req, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT ea.*, at.position_title, at.year
        FROM employee_agreements ea
        JOIN agreement_templates at ON at.id = ea.template_id
        WHERE ea.token = ${req.params.token}
      `);
      if (!rows.rows.length) return res.status(404).json({ message: "Agreement not found or link is invalid." });
      const ag = rows.rows[0] as any;
      if (ag.status === "Signed") return res.json({ alreadySigned: true, signedAt: ag.signed_at, positionTitle: ag.position_title, year: ag.year });
      if (ag.token_expires_at && new Date(ag.token_expires_at) < new Date()) return res.status(410).json({ message: "This agreement link has expired. Please contact your manager." });
      res.json({
        id: ag.id,
        positionTitle: ag.position_title,
        year: ag.year,
        renderedBody: ag.rendered_body,
        payRate: ag.pay_rate,
        startDate: ag.start_date,
        expiresAt: ag.token_expires_at,
        alreadySigned: false,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── PUBLIC: Sign agreement ────────────────────────────────────────────────
  app.post("/api/agreement/:token/sign", async (req, res) => {
    try {
      const { signatureDataUrl, signerName } = req.body;
      if (!signatureDataUrl) return res.status(400).json({ message: "Signature is required." });

      const rows = await db.execute(sql`SELECT * FROM employee_agreements WHERE token = ${req.params.token}`);
      if (!rows.rows.length) return res.status(404).json({ message: "Agreement not found." });
      const ag = rows.rows[0] as any;

      if (ag.status === "Signed") return res.status(409).json({ message: "This agreement has already been signed." });
      if (ag.token_expires_at && new Date(ag.token_expires_at) < new Date()) return res.status(410).json({ message: "This link has expired." });

      await db.execute(sql`
        UPDATE employee_agreements
        SET status = 'Signed', signed_at = NOW(), signature_data_url = ${signatureDataUrl}, signer_name = ${signerName || null}
        WHERE token = ${req.params.token}
      `);

      const empRow = await db.execute(sql`
        SELECT e.*, u.email, at.position_title, at.year
        FROM employee_agreements ea
        JOIN employees e ON e.id = ea.employee_id
        JOIN agreement_templates at ON at.id = ea.template_id
        LEFT JOIN users u ON u.id = e.user_id
        WHERE ea.token = ${req.params.token}
      `);
      const empData = empRow.rows[0] as any;
      const empName = `${empData?.first_name} ${empData?.last_name}`;

      const admins = await db.execute(sql`SELECT email, name FROM users WHERE role IN ('Admin','Manager') AND is_active = true`);
      for (const admin of admins.rows as any[]) {
        if (admin.email) {
          await sendEmail({
            to: admin.email,
            subject: `Agreement Signed – ${empName}`,
            html: `<div style="font-family:sans-serif;padding:20px;"><p><strong>${empName}</strong> has signed their ${empData?.year} ${empData?.position_title} Employment Agreement. You can view the signed copy in their employee file.</p></div>`,
          });
        }
      }

      res.json({ success: true });
    } catch (e: any) {
      console.error("[agreements] sign error:", e.message);
      res.status(500).json({ message: e.message });
    }
  });
}
