import { escapeHtml } from "./emailService";

/**
 * Builds an HTML email body summarising a completed route day.
 *
 * @param ctx.employeeName   Display name of the crew member who submitted.
 * @param ctx.date           ISO date string of the route day (YYYY-MM-DD).
 * @param ctx.weather        Array of weather condition strings selected at start.
 * @param ctx.summaryNotes   HTML string entered in the RichTextEditor (may be empty).
 * @param ctx.stops          Stop rows enriched with clock_in / clock_out times.
 * @param ctx.skippedStops   Subset of stops where session_status = 'skipped'.
 */
export function buildRouteDayEmail(ctx: {
  employeeName: string;
  date: string;
  weather: string[];
  summaryNotes: string;
  stops: Array<{
    title: string;
    customer_name: string | null;
    address: string | null;
    session_status: string | null;
    skip_reason: string | null;
    clock_in: string | null;
    clock_out: string | null;
  }>;
}): string {
  const esc = (v: any) => escapeHtml(String(v ?? ""));

  const formattedDate = (() => {
    const d = new Date(ctx.date + "T12:00:00Z");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  })();

  function fmtTime(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }

  const completedStatuses = ["pending_review", "submitted", "approved"];
  const completedStops = ctx.stops.filter(
    (s) => s.session_status != null && completedStatuses.includes(s.session_status)
  );
  const skippedStops = ctx.stops.filter((s) => s.session_status === "skipped");

  const stopRows = completedStops.map((s, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f9f9f9"}">
      <td style="padding:6px 8px;border:1px solid #ddd">${i + 1}</td>
      <td style="padding:6px 8px;border:1px solid #ddd"><strong>${esc(s.title)}</strong>${s.customer_name ? `<br><span style="color:#666;font-size:12px">${esc(s.customer_name)}</span>` : ""}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:13px">${esc(s.address)}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:13px">${fmtTime(s.clock_in)}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:13px">${fmtTime(s.clock_out)}</td>
    </tr>`).join("");

  const skippedRows = skippedStops.map((s) => `
    <li style="margin:4px 0"><strong>${esc(s.title)}</strong>${s.customer_name ? ` — ${esc(s.customer_name)}` : ""}${s.skip_reason ? `<br><span style="color:#666;font-size:12px">${esc(s.skip_reason)}</span>` : ""}</li>`).join("");

  const weatherChips = ctx.weather.length > 0
    ? ctx.weather.map((w) =>
        `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#2d6a4f;color:#fff;font-size:12px;margin:2px">${esc(w)}</span>`
      ).join(" ")
    : "<em style='color:#999'>None recorded</em>";

  return `
<div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;color:#333">
  <div style="background:#2d6a4f;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:20px">Chapin Landscapes — Route Day Submitted</h1>
    <p style="margin:6px 0 0;opacity:.85">${esc(ctx.employeeName)} · ${esc(formattedDate)}</p>
  </div>
  <div style="padding:20px 24px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px">

    <h3 style="color:#2d6a4f;border-bottom:1px solid #eee;padding-bottom:6px">Summary</h3>
    <table style="border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:4px 8px;font-weight:bold;width:160px">Employee</td><td style="padding:4px 8px">${esc(ctx.employeeName)}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold">Date</td><td style="padding:4px 8px">${esc(formattedDate)}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold">Total Stops</td><td style="padding:4px 8px">${ctx.stops.length}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold">Completed</td><td style="padding:4px 8px">${completedStops.length}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold">Skipped</td><td style="padding:4px 8px">${skippedStops.length}</td></tr>
    </table>

    ${stopRows ? `
    <h3 style="color:#2d6a4f;border-bottom:1px solid #eee;padding-bottom:6px">Completed Stops</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <thead><tr style="background:#f5f5f5">
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">#</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Job</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Address</th>
        <th style="padding:6px 8px;border:1px solid #ddd">Clock In</th>
        <th style="padding:6px 8px;border:1px solid #ddd">Clock Out</th>
      </tr></thead>
      <tbody>${stopRows}</tbody>
    </table>` : ""}

    ${skippedRows ? `
    <h3 style="color:#2d6a4f;border-bottom:1px solid #eee;padding-bottom:6px">Skipped Stops</h3>
    <ul style="margin:0 0 16px;padding-left:20px">${skippedRows}</ul>` : ""}

    <h3 style="color:#2d6a4f;border-bottom:1px solid #eee;padding-bottom:6px">Weather Conditions</h3>
    <p style="margin:0 0 16px">${weatherChips}</p>

    ${ctx.summaryNotes ? `
    <h3 style="color:#2d6a4f;border-bottom:1px solid #eee;padding-bottom:6px">Day Notes</h3>
    <div style="margin:0 0 16px;padding:12px;background:#f9f9f9;border:1px solid #ddd;border-radius:6px;font-size:14px;line-height:1.6">
      ${ctx.summaryNotes}
    </div>` : ""}

    <div style="background:#f9f9f9;border:1px solid #ddd;border-radius:6px;padding:12px;margin-top:16px">
      <p style="margin:0;font-size:13px;color:#666">Submitted by: <strong>${esc(ctx.employeeName)}</strong> on ${new Date().toLocaleString()}</p>
    </div>
  </div>
</div>`;
}
