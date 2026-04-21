import { Express, RequestHandler } from "express";
import { pool } from "./db";
import { sendEmail, escapeHtml } from "./emailService";

const CHEMICALS = [
  { key: "dimension",   name: "Dimension 62719-542" },
  { key: "brush_master", name: "Brush Master 2217-774" },
  { key: "cross_check", name: "Cross Check 279315610404" },
  { key: "three_way",   name: "Three Way 10404-43" },
  { key: "roundup",     name: "Round-Up Quik Pro" },
];

const EQUIPMENT = [
  { key: "skid_steer",       name: "Skid Steer" },
  { key: "excavator",        name: "Excavator" },
  { key: "mt50",             name: "MT-50" },
  { key: "other_equipment",  name: "Other Equipment" },
];

function calcHours(arrival: string, departure: string): string {
  if (!arrival || !departure) return "";
  const parse = (t: string) => {
    const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return NaN;
    let h = parseInt(m[1]); const min = parseInt(m[2]); const ap = (m[3] || "").toUpperCase();
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return h * 60 + min;
  };
  const a = parse(arrival), d = parse(departure);
  if (isNaN(a) || isNaN(d) || d <= a) return "";
  return ((d - a) / 60).toFixed(2).replace(/\.?0+$/, "");
}

async function getAdminManagerEmails(): Promise<{ name: string; email: string }[]> {
  const res = await pool.query(
    `SELECT name, username, email FROM users WHERE role IN ('Admin','Manager') AND email IS NOT NULL`
  );
  return res.rows.map((r: any) => ({ name: r.name || r.username, email: r.email }));
}

function buildWorksheetEmail(ws: any): string {
  const esc = (v: any) => escapeHtml(String(v ?? ""));
  const teamRows = (ws.team_members || []).map((m: any, i: number) => `
    <tr>
      <td style="padding:4px 8px;border:1px solid #ddd">Team Member ${i + 1}</td>
      <td style="padding:4px 8px;border:1px solid #ddd">${esc(m.name)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd">${esc(m.arrival_time)} – ${esc(m.departure_time)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd">${esc(m.total_hours)} hrs</td>
      <td style="padding:4px 8px;border:1px solid #ddd">${esc(m.notes)}</td>
    </tr>`).join("");

  const workRows = (ws.work_items || []).map((w: any, i: number) => `
    <tr>
      <td style="padding:4px 8px;border:1px solid #ddd">${i + 1}</td>
      <td style="padding:4px 8px;border:1px solid #ddd">${esc(w.description)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd">${esc(w.man_hours)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd">${esc(w.material)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd">${esc(w.quantity)}</td>
    </tr>`).join("");

  const punchRows = (ws.punch_items || []).filter((p: any) => p.description).map((p: any, i: number) => `
    <li style="margin:4px 0">${i + 1}. ${esc(p.description)}</li>`).join("");

  const chemRows = CHEMICALS.map(c => {
    const log = (ws.chemical_log || {})[c.key] || {};
    if (!log.quantity_gallons && !log.location_of_spray) return "";
    return `<tr>
      <td style="padding:4px 8px;border:1px solid #ddd">${esc(c.name)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd">${esc(log.quantity_gallons)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd">${esc(log.location_of_spray)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd">${esc(log.vendor)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd">$${esc(log.amount_dollars)}</td>
    </tr>`;
  }).filter(Boolean).join("");

  const eqRows = EQUIPMENT.map(e => {
    const log = (ws.equipment_log || {})[e.key] || {};
    if (!log.purpose && !log.hours) return "";
    return `<tr>
      <td style="padding:4px 8px;border:1px solid #ddd">${esc(e.name)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd">${esc(log.purpose)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd">${esc(log.hours)} hrs</td>
    </tr>`;
  }).filter(Boolean).join("");

  return `
<div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;color:#333">
  <div style="background:#2d6a4f;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:20px">Chapin Landscapes — Daily Crew Worksheet</h1>
    <p style="margin:6px 0 0;opacity:.85">${esc(ws.customer_name)} · ${esc(ws.date)} (${esc(ws.day_of_week || "")})</p>
  </div>
  <div style="padding:20px 24px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px">

    <h3 style="color:#2d6a4f;border-bottom:1px solid #eee;padding-bottom:6px">Job Information</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:4px 8px;font-weight:bold;width:180px">Customer</td><td style="padding:4px 8px">${esc(ws.customer_name)}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold">Date</td><td style="padding:4px 8px">${esc(ws.date)}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold">Address</td><td style="padding:4px 8px">${esc(ws.address_line_1)} ${esc(ws.address_line_2)}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold">Estimate #</td><td style="padding:4px 8px">${esc(ws.estimate_number)}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold">Conditions</td><td style="padding:4px 8px">${esc((ws.weather_conditions || []).join(", "))}</td></tr>
    </table>

    <h3 style="color:#2d6a4f;border-bottom:1px solid #eee;padding-bottom:6px">Team & Time</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <thead><tr style="background:#f5f5f5">
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Role</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Name</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Time</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Hours</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Notes</th>
      </tr></thead>
      <tbody>
        <tr>
          <td style="padding:4px 8px;border:1px solid #ddd"><strong>Foreman</strong></td>
          <td style="padding:4px 8px;border:1px solid #ddd">${esc(ws.foreman_name)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd">${esc(ws.foreman_arrival_time)} – ${esc(ws.foreman_departure_time)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd">${esc(ws.foreman_total_hours)} hrs</td>
          <td style="padding:4px 8px;border:1px solid #ddd">${esc(ws.foreman_notes)}</td>
        </tr>
        ${teamRows}
      </tbody>
    </table>

    ${workRows ? `<h3 style="color:#2d6a4f;border-bottom:1px solid #eee;padding-bottom:6px">Work Description</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <thead><tr style="background:#f5f5f5">
        <th style="padding:6px 8px;border:1px solid #ddd">#</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Description</th>
        <th style="padding:6px 8px;border:1px solid #ddd">Man Hrs</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Material</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Qty</th>
      </tr></thead>
      <tbody>${workRows}</tbody>
    </table>` : ""}

    ${punchRows ? `<h3 style="color:#2d6a4f;border-bottom:1px solid #eee;padding-bottom:6px">Punch List</h3>
    <ul style="margin:0 0 16px;padding-left:20px">${punchRows}</ul>` : ""}

    ${chemRows ? `<h3 style="color:#2d6a4f;border-bottom:1px solid #eee;padding-bottom:6px">Chemical Application Log</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <thead><tr style="background:#f5f5f5">
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Chemical</th>
        <th style="padding:6px 8px;border:1px solid #ddd">Qty/Gal</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Location</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Vendor</th>
        <th style="padding:6px 8px;border:1px solid #ddd">Amount</th>
      </tr></thead>
      <tbody>${chemRows}</tbody>
    </table>` : ""}

    ${eqRows ? `<h3 style="color:#2d6a4f;border-bottom:1px solid #eee;padding-bottom:6px">Equipment Log</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <thead><tr style="background:#f5f5f5">
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Equipment</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Purpose</th>
        <th style="padding:6px 8px;border:1px solid #ddd">Hours</th>
      </tr></thead>
      <tbody>${eqRows}</tbody>
    </table>` : ""}

    ${ws.additional_notes ? `<h3 style="color:#2d6a4f;border-bottom:1px solid #eee;padding-bottom:6px">Additional Notes</h3>
    <p style="margin:0 0 16px">${esc(ws.additional_notes)}</p>` : ""}

    <div style="background:#f9f9f9;border:1px solid #ddd;border-radius:6px;padding:12px;margin-top:16px">
      <p style="margin:0;font-size:13px;color:#666">Submitted by: <strong>${esc(ws.submitted_by_name || "")}</strong> on ${new Date(ws.submitted_at || ws.updated_at).toLocaleString()}</p>
      ${ws.signature_name ? `<p style="margin:4px 0 0;font-size:13px;color:#666">Signed: <strong>${esc(ws.signature_name)}</strong> · ${esc(ws.date_signed)}</p>` : ""}
    </div>
  </div>
</div>`;
}

export function registerDailyWorksheetRoutes(app: Express, requireAuth: RequestHandler) {

  // GET /api/daily-worksheets — list
  app.get("/api/daily-worksheets", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const role = user?.role;
      const isAdmin = role === "Admin" || role === "Manager" || user?.isMasterAdmin;

      let rows;
      if (isAdmin) {
        const result = await pool.query(
          `SELECT dw.*, u.name as submitted_by_name, u.username as submitted_by_username
           FROM daily_worksheets dw
           LEFT JOIN users u ON u.id = dw.submitted_by
           ORDER BY dw.updated_at DESC`
        );
        rows = result.rows;
      } else {
        const result = await pool.query(
          `SELECT dw.*, u.name as submitted_by_name, u.username as submitted_by_username
           FROM daily_worksheets dw
           LEFT JOIN users u ON u.id = dw.submitted_by
           WHERE dw.submitted_by = $1
           ORDER BY dw.updated_at DESC`,
          [user.id]
        );
        rows = result.rows;
      }
      res.json(rows);
    } catch (err: any) {
      console.error("[DailyWorksheet] GET list error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/daily-worksheets/:id
  app.get("/api/daily-worksheets/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const result = await pool.query(
        `SELECT dw.*, u.name as submitted_by_name FROM daily_worksheets dw LEFT JOIN users u ON u.id = dw.submitted_by WHERE dw.id = $1`,
        [id]
      );
      const ws = result.rows[0];
      if (!ws) return res.status(404).json({ message: "Worksheet not found" });
      if (ws.submitted_by !== user.id && user.role !== "Admin" && user.role !== "Manager" && !user.isMasterAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(ws);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/daily-worksheets — create new draft
  app.post("/api/daily-worksheets", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const body = req.body;
      const result = await pool.query(
        `INSERT INTO daily_worksheets (
          id, submitted_by, status, weather_conditions,
          customer_name, date, day_of_week, address_line_1, address_line_2,
          estimate_number, contact_phone,
          foreman_name, foreman_arrival_time, foreman_departure_time, foreman_total_hours, foreman_notes,
          team_members, work_items, punch_items, chemical_log, equipment_log,
          additional_notes, signature_name, date_signed,
          job_id,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, 'draft', $2,
          $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22,
          $23,
          NOW(), NOW()
        ) RETURNING *`,
        [
          user.id,
          body.weatherConditions || [],
          body.customerName || "", body.date || "", body.dayOfWeek || null,
          body.addressLine1 || null, body.addressLine2 || null,
          body.estimateNumber || null, body.contactPhone || null,
          body.foremanName || null, body.foremanArrivalTime || null,
          body.foremanDepartureTime || null, body.foremanTotalHours || null, body.foremanNotes || null,
          JSON.stringify(body.teamMembers || []),
          JSON.stringify(body.workItems || []),
          JSON.stringify(body.punchItems || []),
          JSON.stringify(body.chemicalLog || {}),
          JSON.stringify(body.equipmentLog || {}),
          body.additionalNotes || null, body.signatureName || null, body.dateSigned || null,
          body.jobId || null,
        ]
      );
      res.json(result.rows[0]);
    } catch (err: any) {
      console.error("[DailyWorksheet] POST error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // PATCH /api/daily-worksheets/:id — save draft
  app.patch("/api/daily-worksheets/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const body = req.body;

      const existing = await pool.query(`SELECT submitted_by, status FROM daily_worksheets WHERE id = $1`, [id]);
      if (!existing.rows[0]) return res.status(404).json({ message: "Not found" });
      if (existing.rows[0].submitted_by !== user.id && user.role !== "Admin" && user.role !== "Manager" && !user.isMasterAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (existing.rows[0].status === "submitted" && user.role !== "Admin" && !user.isMasterAdmin) {
        return res.status(400).json({ message: "Cannot edit a submitted worksheet" });
      }

      const result = await pool.query(
        `UPDATE daily_worksheets SET
          weather_conditions = $1, customer_name = $2, date = $3, day_of_week = $4,
          address_line_1 = $5, address_line_2 = $6, estimate_number = $7, contact_phone = $8,
          foreman_name = $9, foreman_arrival_time = $10, foreman_departure_time = $11,
          foreman_total_hours = $12, foreman_notes = $13,
          team_members = $14, work_items = $15, punch_items = $16,
          chemical_log = $17, equipment_log = $18,
          additional_notes = $19, signature_name = $20, date_signed = $21,
          job_id = $22,
          updated_at = NOW()
        WHERE id = $23 RETURNING *`,
        [
          body.weatherConditions || [],
          body.customerName || "", body.date || "", body.dayOfWeek || null,
          body.addressLine1 || null, body.addressLine2 || null,
          body.estimateNumber || null, body.contactPhone || null,
          body.foremanName || null, body.foremanArrivalTime || null,
          body.foremanDepartureTime || null, body.foremanTotalHours || null, body.foremanNotes || null,
          JSON.stringify(body.teamMembers || []),
          JSON.stringify(body.workItems || []),
          JSON.stringify(body.punchItems || []),
          JSON.stringify(body.chemicalLog || {}),
          JSON.stringify(body.equipmentLog || {}),
          body.additionalNotes || null, body.signatureName || null, body.dateSigned || null,
          body.jobId || null,
          id,
        ]
      );
      res.json(result.rows[0]);
    } catch (err: any) {
      console.error("[DailyWorksheet] PATCH error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/daily-worksheets/:id/submit — submit + email
  app.post("/api/daily-worksheets/:id/submit", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;

      const existing = await pool.query(
        `SELECT dw.*, u.name as submitted_by_name FROM daily_worksheets dw LEFT JOIN users u ON u.id = dw.submitted_by WHERE dw.id = $1`,
        [id]
      );
      if (!existing.rows[0]) return res.status(404).json({ message: "Not found" });
      const ws = existing.rows[0];

      if (ws.submitted_by !== user.id && user.role !== "Admin" && !user.isMasterAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (!ws.customer_name || !ws.date) {
        return res.status(400).json({ message: "Customer name and date are required before submitting." });
      }

      const updated = await pool.query(
        `UPDATE daily_worksheets SET status = 'submitted', submitted_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      const submittedWs = { ...updated.rows[0], submitted_by_name: ws.submitted_by_name };

      // Send email to all Admin/Manager users
      const recipients = await getAdminManagerEmails();
      const htmlBody = buildWorksheetEmail(submittedWs);
      const subject = `Daily Worksheet: ${ws.customer_name} — ${ws.date}`;

      for (const r of recipients) {
        sendEmail(r.email, subject, htmlBody).catch(console.error);
      }

      // Also create an in-app notification for Admin/Manager
      const admins = await pool.query(`SELECT id FROM users WHERE role IN ('Admin','Manager')`);
      for (const admin of admins.rows) {
        await pool.query(
          `INSERT INTO staff_notifications (id, user_id, type, title, message, link, is_read, created_at)
           VALUES (gen_random_uuid(), $1, 'daily_worksheet', $2, $3, '/daily-worksheet', false, now())`,
          [
            admin.id,
            `Daily Worksheet Submitted`,
            `${ws.submitted_by_name || user.name || user.username} submitted a worksheet for ${ws.customer_name} (${ws.date})`,
          ]
        );
      }

      res.json(submittedWs);
    } catch (err: any) {
      console.error("[DailyWorksheet] submit error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE /api/daily-worksheets/:id — delete draft (own draft or Admin)
  app.delete("/api/daily-worksheets/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const existing = await pool.query(`SELECT submitted_by, status FROM daily_worksheets WHERE id = $1`, [id]);
      if (!existing.rows[0]) return res.status(404).json({ message: "Not found" });
      const ws = existing.rows[0];
      if (ws.submitted_by !== user.id && user.role !== "Admin" && !user.isMasterAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (ws.status === "submitted" && user.role !== "Admin" && !user.isMasterAdmin) {
        return res.status(400).json({ message: "Cannot delete a submitted worksheet" });
      }
      await pool.query(`DELETE FROM daily_worksheets WHERE id = $1`, [id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
