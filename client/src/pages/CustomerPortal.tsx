import React, { useState, useRef, useEffect, useCallback } from "react";

const GREEN = "#2d5016";

type LineItem = {
  id: string; description: string; quantity: number; unit_price: number; amount: number;
};
type WorkArea = {
  id: string; name: string; line_items: LineItem[];
};
type Estimate = {
  id: string; title: string; estimate_number: string; status: string;
  total: string; subtotal: string; customer_name: string; customer_email: string;
  property_address: string; salesperson_name: string;
  terms_and_conditions_override: string | null;
  terms: string | null;
  deposit_percentage: number | null;
  work_areas: WorkArea[];
  signature_data: string | null; initials: string | null; customer_response: string | null;
};

type ActiveTC = { id: string; content: string; title: string };

function fmt(v: string | number | null | undefined) {
  const n = parseFloat(String(v ?? "0"));
  return isNaN(n) ? "$0.00" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CustomerPortal() {
  const token = window.location.pathname.split("/portal/")[1]?.split("?")[0] ?? "";

  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [activeTC, setActiveTC] = useState<ActiveTC | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"viewing" | "declined-note" | "done">("viewing");
  const [doneAction, setDoneAction] = useState<"approved" | "declined" | null>(null);

  // Acceptance form state
  const [tcScrolled, setTcScrolled] = useState(false);
  const [initials, setInitials] = useState("");
  const [declineNote, setDeclineNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Canvas signature
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const tcBoxRef = useRef<HTMLDivElement>(null);

  // Fetch estimate + active T&C
  useEffect(() => {
    if (!token) { setError("Invalid link."); setLoading(false); return; }
    Promise.all([
      fetch(`/api/portal/${token}`).then(r => r.json()),
      fetch("/api/settings/terms/active/install").then(r => r.json()).catch(() => null),
    ]).then(([est, tc]) => {
      if (est?.message) { setError(est.message); return; }
      setEstimate(est);
      setActiveTC(tc);
    }).catch(() => setError("Failed to load proposal. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  // Signature canvas helpers
  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    const pos = getPos(e, canvas);
    lastPoint.current = pos;
    setIsDrawing(true);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const pos = getPos(e, canvas);
    if (lastPoint.current) {
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      setHasSig(true);
    }
    lastPoint.current = pos;
  }, [isDrawing]);

  const endDraw = useCallback(() => { setIsDrawing(false); lastPoint.current = null; }, []);

  const clearSig = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  };

  const onTcScroll = () => {
    const box = tcBoxRef.current; if (!box) return;
    if (box.scrollHeight - box.scrollTop <= box.clientHeight + 10) setTcScrolled(true);
  };

  const tcContent = estimate?.terms_and_conditions_override || activeTC?.content || "";
  const canAccept = tcScrolled && initials.trim().length > 0 && hasSig;

  async function submit(action: "approved" | "declined") {
    if (!estimate) return;
    setSubmitting(true);
    try {
      const sig = action === "approved" && canvasRef.current
        ? canvasRef.current.toDataURL("image/png") : null;

      const body: Record<string, any> = {
        action,
        initials: action === "approved" ? initials.trim() : undefined,
        signature_data: sig,
        note: action === "declined" ? declineNote : "",
      };

      const resp = await fetch(`/api/portal/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Failed");
      setDoneAction(action);
      setPhase("done");
    } catch (err: any) {
      alert(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f8f9fa" }}>
        <p style={{ color: "#666" }}>Loading proposal…</p>
      </div>
    );
  }

  if (error || !estimate) {
    return (
      <div style={{ fontFamily: "system-ui, sans-serif", background: "#f8f9fa", minHeight: "100vh" }}>
        <header style={{ background: GREEN, color: "#fff", padding: "18px 24px" }}>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Chapin Landscapes</h1>
        </header>
        <div style={{ maxWidth: 600, margin: "60px auto", padding: "0 24px", textAlign: "center" }}>
          <p style={{ color: "#dc3545", fontSize: "1.1rem" }}>{error || "Proposal not found."}</p>
        </div>
      </div>
    );
  }

  const isAlreadyActed = ["approved", "declined"].includes(estimate.status);

  const s: Record<string, React.CSSProperties> = {
    page: { fontFamily: "system-ui, -apple-system, sans-serif", background: "#f8f9fa", minHeight: "100vh", color: "#212529" },
    header: { background: GREEN, color: "#fff", padding: "18px 24px" },
    headerH1: { margin: 0, fontSize: "1.3rem", fontWeight: 700, letterSpacing: "0.3px" },
    headerSub: { margin: "4px 0 0", fontSize: "0.85rem", opacity: 0.85 },
    main: { maxWidth: 760, margin: "0 auto", padding: "32px 24px 80px" },
    card: { background: "#fff", borderRadius: 10, boxShadow: "0 1px 6px rgba(0,0,0,.08)", marginBottom: 24, overflow: "hidden" },
    cardHead: { background: "#f5f7f5", borderBottom: "1px solid #e9ecef", padding: "14px 20px" },
    cardTitle: { margin: 0, fontSize: "0.95rem", fontWeight: 700, color: GREEN },
    cardBody: { padding: "16px 20px" },
    row: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid #f0f0f0", fontSize: "0.9rem" },
    totalRow: { display: "flex", justifyContent: "space-between", padding: "10px 0 4px", fontWeight: 700, fontSize: "1rem", color: GREEN },
    tcBox: { height: 260, overflowY: "auto", border: "1px solid #dee2e6", borderRadius: 6, padding: "12px 14px", fontSize: "0.82rem", lineHeight: 1.6, color: "#444", background: "#fafafa", whiteSpace: "pre-wrap" },
    tcHint: { fontSize: "0.8rem", color: "#888", marginTop: 8, textAlign: "center" as const },
    label: { display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.9rem", color: "#333" },
    sublabel: { fontSize: "0.82rem", color: "#666", fontWeight: 400, display: "block", marginBottom: 10 },
    input: { width: "100%", padding: "9px 12px", border: "1px solid #ced4da", borderRadius: 6, fontSize: "1rem", outline: "none", boxSizing: "border-box" as const },
    canvasWrap: { border: "2px dashed #ced4da", borderRadius: 8, background: "#fff", position: "relative" as const, cursor: "crosshair", userSelect: "none" as const },
    clearBtn: { position: "absolute" as const, top: 6, right: 8, fontSize: "0.75rem", color: "#888", cursor: "pointer", background: "none", border: "none", padding: "2px 6px" },
    acceptBtn: { width: "100%", padding: "14px", background: canAccept ? GREEN : "#ccc", color: "#fff", border: "none", borderRadius: 8, fontSize: "1.05rem", fontWeight: 700, cursor: canAccept ? "pointer" : "not-allowed", marginBottom: 12, transition: "background 0.2s" },
    declineBtn: { width: "100%", padding: "12px", background: "transparent", color: "#666", border: "1px solid #ced4da", borderRadius: 8, fontSize: "0.95rem", cursor: "pointer" },
    successCard: { background: "#d4edda", border: "1px solid #c3e6cb", borderRadius: 10, padding: "28px 24px", textAlign: "center" as const },
    successTitle: { color: "#155724", fontSize: "1.4rem", fontWeight: 700, margin: "0 0 10px" },
    successText: { color: "#155724", fontSize: "0.95rem", margin: 0 },
    declineCard: { background: "#fff3cd", border: "1px solid #ffeeba", borderRadius: 10, padding: "24px", textAlign: "center" as const },
    textarea: { width: "100%", padding: "9px 12px", border: "1px solid #ced4da", borderRadius: 6, fontSize: "0.95rem", minHeight: 100, boxSizing: "border-box" as const, resize: "vertical" as const },
  };

  if (phase === "done") {
    return (
      <div style={s.page}>
        <header style={s.header}>
          <h1 style={s.headerH1}>Chapin Landscapes</h1>
          <p style={s.headerSub}>Proposal Review</p>
        </header>
        <div style={s.main}>
          {doneAction === "approved" ? (
            <div style={s.successCard} data-testid="portal-approved-confirmation">
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>✅</div>
              <h2 style={s.successTitle}>Thank you, {estimate.customer_name}!</h2>
              <p style={s.successText}>Your approval has been confirmed. Our team will be in touch shortly to schedule your project. A deposit invoice will be sent to you soon.</p>
            </div>
          ) : (
            <div style={s.declineCard} data-testid="portal-declined-confirmation">
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>🙏</div>
              <h2 style={{ color: "#856404", fontSize: "1.3rem", fontWeight: 700, margin: "0 0 10px" }}>Response Recorded</h2>
              <p style={{ color: "#856404", fontSize: "0.95rem", margin: 0 }}>Thank you for letting us know. We appreciate your consideration and hope to work with you in the future.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === "declined-note") {
    return (
      <div style={s.page}>
        <header style={s.header}>
          <h1 style={s.headerH1}>Chapin Landscapes</h1>
          <p style={s.headerSub}>Proposal Review</p>
        </header>
        <div style={s.main}>
          <div style={s.card}>
            <div style={s.cardHead}><h3 style={s.cardTitle}>Decline Proposal</h3></div>
            <div style={s.cardBody}>
              <p style={{ color: "#555", marginBottom: 14, fontSize: "0.9rem" }}>We're sorry to hear that. Would you like to share any feedback? (optional)</p>
              <textarea
                style={s.textarea}
                placeholder="Let us know why you're declining…"
                value={declineNote}
                onChange={e => setDeclineNote(e.target.value)}
                data-testid="input-decline-note"
              />
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => setPhase("viewing")} style={{ ...s.declineBtn, flex: 1 }}>Go Back</button>
                <button
                  onClick={() => submit("declined")}
                  disabled={submitting}
                  style={{ flex: 2, padding: "12px", background: "#dc3545", color: "#fff", border: "none", borderRadius: 8, fontSize: "0.95rem", fontWeight: 700, cursor: "pointer" }}
                  data-testid="btn-confirm-decline"
                >
                  {submitting ? "Submitting…" : "Decline Proposal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <h1 style={s.headerH1}>Chapin Landscapes</h1>
        <p style={s.headerSub}>Landscaping &amp; Maintenance Services</p>
      </header>

      <div style={s.main}>
        {/* Already acted */}
        {isAlreadyActed && (
          <div style={{ background: "#e8f4e8", border: "1px solid #c3e6cb", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: "0.9rem", color: "#2d5016" }}>
            {estimate.status === "approved"
              ? "✅ You have already approved this proposal. Thank you!"
              : "This proposal has been declined."}
          </div>
        )}

        {/* 1 — Estimate Header */}
        <div style={s.card}>
          <div style={s.cardHead}><h3 style={s.cardTitle}>Proposal Details</h3></div>
          <div style={s.cardBody}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", fontSize: "0.9rem" }}>
              <div><span style={{ color: "#888", fontSize: "0.8rem" }}>Proposal #</span><div style={{ fontWeight: 700 }}>{estimate.estimate_number || "—"}</div></div>
              <div><span style={{ color: "#888", fontSize: "0.8rem" }}>Title</span><div>{estimate.title}</div></div>
              <div><span style={{ color: "#888", fontSize: "0.8rem" }}>Customer</span><div>{estimate.customer_name}</div></div>
              {estimate.property_address && <div><span style={{ color: "#888", fontSize: "0.8rem" }}>Property</span><div>{estimate.property_address}</div></div>}
              {estimate.salesperson_name && <div><span style={{ color: "#888", fontSize: "0.8rem" }}>Prepared by</span><div>{estimate.salesperson_name}</div></div>}
            </div>
          </div>
        </div>

        {/* 2 — Scope of Work */}
        {estimate.work_areas?.length > 0 && (
          <div style={s.card}>
            <div style={s.cardHead}><h3 style={s.cardTitle}>Scope of Work</h3></div>
            <div style={s.cardBody}>
              {estimate.work_areas.map(area => (
                <div key={area.id} style={{ marginBottom: 18 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: GREEN, marginBottom: 6, borderBottom: "1px solid #e9ecef", paddingBottom: 4 }}>{area.name}</div>
                  {area.line_items?.map(item => (
                    <div key={item.id} style={s.row} data-testid={`row-lineitem-${item.id}`}>
                      <span style={{ flex: 1, paddingRight: 12 }}>{item.description}</span>
                      <span style={{ color: "#888", marginRight: 16, whiteSpace: "nowrap" as const }}>{item.quantity} × {fmt(item.unit_price)}</span>
                      <span style={{ fontWeight: 600, whiteSpace: "nowrap" as const }}>{fmt(item.amount)}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div style={s.totalRow} data-testid="text-estimate-total">
                <span>Total</span>
                <span>{fmt(estimate.total)}</span>
              </div>
              {(estimate.deposit_percentage ?? 50) > 0 && (
                <div style={{ fontSize: "0.85rem", color: "#666", marginTop: 4 }}>
                  Deposit required: {estimate.deposit_percentage ?? 50}% ({fmt(parseFloat(estimate.total ?? "0") * (estimate.deposit_percentage ?? 50) / 100)}) due within 7 days of signing
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3 — Terms & Conditions */}
        {tcContent && !isAlreadyActed && (
          <div style={s.card}>
            <div style={s.cardHead}><h3 style={s.cardTitle}>Terms &amp; Conditions</h3></div>
            <div style={s.cardBody}>
              <p style={{ fontSize: "0.85rem", color: "#555", marginBottom: 10 }}>Please read the full terms and conditions below before signing.</p>
              <div
                ref={tcBoxRef}
                style={s.tcBox}
                onScroll={onTcScroll}
                data-testid="tc-scrollbox"
              >
                {tcContent}
              </div>
              {!tcScrolled && (
                <p style={s.tcHint}>↓ Scroll to the bottom to unlock the signature fields</p>
              )}
              {tcScrolled && (
                <p style={{ ...s.tcHint, color: GREEN, fontWeight: 600 }}>✓ You have read the Terms &amp; Conditions</p>
              )}
            </div>
          </div>
        )}

        {/* 4 — Initials */}
        {!isAlreadyActed && (
          <div style={s.card}>
            <div style={s.cardHead}><h3 style={s.cardTitle}>Initials</h3></div>
            <div style={s.cardBody}>
              <label style={s.label} htmlFor="initials-input">
                Type your initials to confirm you have read and agree to the Terms &amp; Conditions above
                <span style={s.sublabel}>(required)</span>
              </label>
              <input
                id="initials-input"
                style={{
                  ...s.input,
                  opacity: (tcContent && !tcScrolled) ? 0.4 : 1,
                  cursor: (tcContent && !tcScrolled) ? "not-allowed" : "text",
                  maxWidth: 200, textTransform: "uppercase" as const, letterSpacing: "0.1em", fontWeight: 700
                }}
                disabled={!!(tcContent && !tcScrolled)}
                value={initials}
                onChange={e => setInitials(e.target.value.toUpperCase())}
                placeholder="e.g. JD"
                maxLength={6}
                data-testid="input-initials"
              />
            </div>
          </div>
        )}

        {/* 5 — Signature Pad */}
        {!isAlreadyActed && (
          <div style={s.card}>
            <div style={s.cardHead}><h3 style={s.cardTitle}>Signature</h3></div>
            <div style={s.cardBody}>
              <label style={s.label}>Draw your signature below <span style={s.sublabel}>(use mouse or finger)</span></label>
              <div
                style={{
                  ...s.canvasWrap,
                  opacity: (tcContent && !tcScrolled) || !initials.trim() ? 0.4 : 1,
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={680}
                  height={140}
                  style={{ display: "block", width: "100%", height: 140, touchAction: "none" }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                  data-testid="canvas-signature"
                />
                <button onClick={clearSig} style={s.clearBtn}>Clear</button>
              </div>
              {!hasSig && initials.trim() && (
                <p style={s.tcHint}>Draw your signature in the box above</p>
              )}
            </div>
          </div>
        )}

        {/* 6/7 — Accept / Decline */}
        {!isAlreadyActed && (
          <div style={s.card}>
            <div style={s.cardBody}>
              {!canAccept && (
                <p style={{ fontSize: "0.83rem", color: "#888", textAlign: "center", marginBottom: 12 }}>
                  {!tcScrolled && tcContent ? "Scroll through the terms" : !initials.trim() ? "Enter your initials" : "Draw your signature"} to enable approval
                </p>
              )}
              <button
                onClick={() => canAccept && submit("approved")}
                disabled={!canAccept || submitting}
                style={s.acceptBtn}
                data-testid="btn-accept-proposal"
              >
                {submitting ? "Submitting…" : "✅ Accept & Approve Proposal"}
              </button>
              <button
                onClick={() => setPhase("declined-note")}
                disabled={submitting}
                style={s.declineBtn}
                data-testid="btn-decline-proposal"
              >
                Decline Proposal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
