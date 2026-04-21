import type { Express } from "express";
import { pool } from "./db";
import { sendEmail, escapeHtml, getAppUrl } from "./emailService";

async function sendStaffNotification(userId: string, type: string, title: string, message: string, link: string) {
  try {
    await pool.query(
      `INSERT INTO staff_notifications (id, user_id, type, title, message, link, is_read, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, FALSE, NOW())`,
      [userId, type, title, message, link]
    );
  } catch (err: any) {
    console.error("[booking-notification]", err.message);
  }
}

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function addMinutes(time24: string, mins: number): string {
  const [h, m] = time24.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function compareTime(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return ah * 60 + am - (bh * 60 + bm);
}

export function registerPublicBookingRoutes(app: Express) {

  // ── GET AVAILABLE SLOTS ───────────────────────────────────────────────────────
  app.get("/api/book/:username/slots", async (req, res) => {
    const { username } = req.params;
    const { from, to } = req.query as { from?: string; to?: string };

    try {
      // Look up user
      const { rows: userRows } = await pool.query(
        `SELECT id, name, username, role FROM users WHERE username = $1 LIMIT 1`,
        [username]
      );
      if (!userRows[0]) {
        return res.status(404).json({ error: "Salesperson not found" });
      }
      const user = userRows[0];

      // Get availability config
      const { rows: availRows } = await pool.query(
        `SELECT schedule, slot_duration, buffer_minutes, timezone
         FROM user_availability WHERE user_id = $1 LIMIT 1`,
        [user.id]
      );

      const avail = availRows[0];
      const schedule = avail?.schedule as Record<string, { enabled: boolean; start: string; end: string }> | null;
      const slotDuration = avail?.slot_duration || 60;
      const bufferMins = avail?.buffer_minutes || 0;

      if (!schedule) {
        return res.json({ slots: [], profile: { name: user.name, title: "Sales Consultant" } });
      }

      // Date range
      const fromDate = from ? new Date(from + "T00:00:00") : new Date();
      const toDate   = to   ? new Date(to   + "T23:59:59") : new Date(Date.now() + 28 * 86400000);

      const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

      // Fetch already-booked consultations for this user in range
      const fromStr = fromDate.toISOString().split("T")[0];
      const toStr   = toDate.toISOString().split("T")[0];
      const { rows: booked } = await pool.query(
        `SELECT scheduled_date, scheduled_time, duration_minutes
         FROM consultations
         WHERE assigned_to = $1
           AND scheduled_date >= $2 AND scheduled_date <= $3
           AND status NOT IN ('cancelled')`,
        [user.id, fromStr, toStr]
      );

      // Build booked map: date -> [{ start, end }]
      const bookedMap: Record<string, Array<{ start: string; end: string }>> = {};
      for (const b of booked) {
        const d = b.scheduled_date.toISOString ? b.scheduled_date.toISOString().split("T")[0] : b.scheduled_date.slice(0, 10);
        if (!bookedMap[d]) bookedMap[d] = [];
        bookedMap[d].push({
          start: b.scheduled_time?.slice(0, 5) || "00:00",
          end: addMinutes(b.scheduled_time?.slice(0, 5) || "00:00", Number(b.duration_minutes) || 60),
        });
      }

      const slots: Array<{ date: string; time: string; label: string }> = [];
      const cursor = new Date(fromDate);

      while (cursor <= toDate) {
        const dayName = DAY_NAMES[cursor.getDay()];
        const dayConf = schedule[dayName];
        const dateStr = cursor.toISOString().split("T")[0];

        if (dayConf?.enabled) {
          let current = dayConf.start;
          const dayBookings = bookedMap[dateStr] || [];

          while (compareTime(current, dayConf.end) < 0) {
            const slotEnd = addMinutes(current, slotDuration);
            if (compareTime(slotEnd, dayConf.end) > 0) break;

            // Check overlap with existing bookings
            const overlap = dayBookings.some(b =>
              compareTime(current, b.end) < 0 && compareTime(slotEnd, b.start) > 0
            );

            if (!overlap) {
              slots.push({ date: dateStr, time: current, label: formatTime12h(current) });
            }

            current = addMinutes(current, slotDuration + bufferMins);
          }
        }

        cursor.setDate(cursor.getDate() + 1);
      }

      return res.json({
        slots,
        profile: { name: user.name, title: "Sales Consultant" },
      });
    } catch (err: any) {
      console.error("[booking/slots]", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── CONFIRM BOOKING (public, no auth) ─────────────────────────────────────────
  app.post("/api/book/:username/book", async (req, res) => {
    const { username } = req.params;
    const {
      first_name, last_name, email, phone, address,
      service_type, notes, date, time, duration_minutes,
    } = req.body;

    if (!first_name || !last_name || !email || !date || !time) {
      return res.status(400).json({ error: "Name, email, date, and time are required" });
    }

    try {
      const { rows: userRows } = await pool.query(
        `SELECT id, name, email FROM users WHERE username = $1`,
        [username]
      );
      if (!userRows[0]) return res.status(404).json({ error: "Salesperson not found" });
      const salesperson = userRows[0];

      const contactName = `${first_name} ${last_name}`;

      const { rows } = await pool.query(`
        INSERT INTO consultations (
          contact_name, contact_phone, contact_email, address,
          scheduled_date, scheduled_time, duration_minutes,
          pipeline_stage, service_type, notes,
          assigned_to, status, lead_source
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'appointment_scheduled',$8,$9,$10,'scheduled','Online Booking')
        RETURNING *
      `, [
        contactName, phone || null, email, address || null,
        date, time, duration_minutes || 60,
        service_type || null, notes || null,
        salesperson.id,
      ]);

      const consultation = rows[0];

      const dateStr = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
      const timeStr = formatTime12h(time);

      // Send confirmation to customer
      await sendEmail(email, "Appointment Confirmed — Chapin Landscapes", `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #166534; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">Chapin Landscapes</h1>
            <p style="color: #bbf7d0; margin: 6px 0 0; font-size: 14px;">Appointment Confirmed</p>
          </div>
          <div style="padding: 32px; background-color: #f9fafb;">
            <h2 style="color: #1f2937; margin-top: 0;">Your appointment is confirmed!</h2>
            <p style="color: #4b5563;">Hi ${escapeHtml(first_name)}, we look forward to meeting with you.</p>
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="margin: 4px 0;"><strong>Date:</strong> ${escapeHtml(dateStr)}</p>
              <p style="margin: 4px 0;"><strong>Time:</strong> ${escapeHtml(timeStr)}</p>
              <p style="margin: 4px 0;"><strong>With:</strong> ${escapeHtml(salesperson.name)}</p>
              ${address ? `<p style="margin: 4px 0;"><strong>Address:</strong> ${escapeHtml(address)}</p>` : ""}
              ${service_type ? `<p style="margin: 4px 0;"><strong>Service:</strong> ${escapeHtml(service_type)}</p>` : ""}
            </div>
            <p style="color: #6b7280; font-size: 13px;">Need to reschedule? Give us a call and we'll be happy to help.</p>
          </div>
          <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
            <p>Chapin Landscapes — Professional Landscape Management</p>
          </div>
        </div>
      `);

      // Notify salesperson
      await sendStaffNotification(
        salesperson.id,
        "appointment_booked",
        "New Appointment Booked",
        `${contactName} booked an appointment on ${dateStr} at ${timeStr}`,
        `/consultations`
      );

      if (salesperson.email) {
        await sendEmail(salesperson.email, `New Appointment Booked — ${contactName}`, `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #166534; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">New Appointment</h1>
            </div>
            <div style="padding: 30px; background-color: #f9fafb;">
              <p><strong>Customer:</strong> ${escapeHtml(contactName)}</p>
              <p><strong>Date:</strong> ${escapeHtml(dateStr)}</p>
              <p><strong>Time:</strong> ${escapeHtml(timeStr)}</p>
              <p><strong>Phone:</strong> ${escapeHtml(phone || "N/A")}</p>
              <p><strong>Email:</strong> ${escapeHtml(email)}</p>
              ${service_type ? `<p><strong>Service:</strong> ${escapeHtml(service_type)}</p>` : ""}
              ${notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ""}
              <div style="text-align:center;margin-top:24px;">
                <a href="${getAppUrl()}/consultations" style="background-color:#166534;color:white;padding:10px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">View in CompanyHQ</a>
              </div>
            </div>
          </div>
        `);
      }

      res.status(201).json({ success: true, id: consultation.id });
    } catch (err: any) {
      console.error("[booking/book]", err.message);
      res.status(500).json({ error: err.message });
    }
  });
}
