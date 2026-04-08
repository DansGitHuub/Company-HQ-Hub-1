import React, { useState, useRef, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Loader2, Printer, FileText, PenLine, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

function fmtMoney(v: any) {
  const n = parseFloat(v ?? "0");
  if (isNaN(n)) return "$0.00";
  return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

function SignatureSection({ est, onSignClick }: { est: any; onSignClick: () => void }) {
  if (est.signedAt) {
    return (
      <div className="mt-8 pt-6 border-t-2 border-green-700">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="text-green-600 h-5 w-5" />
          <h3 className="text-base font-bold text-green-800">Electronically Signed</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
          {est.signatureData && est.signatureType !== "typed" && (
            <div className="col-span-2">
              <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-1">Signature</p>
              <img src={est.signatureData} alt="Customer signature" className="border border-gray-200 rounded max-h-20 bg-white" />
            </div>
          )}
          {est.signatureData && est.signatureType === "typed" && (
            <div className="col-span-2">
              <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-1">Signature</p>
              <p style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "1.5rem", color: "#1E3A2F" }}>{est.signerName}</p>
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-1">Signed By</p>
            <p className="font-medium">{est.signerName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-1">Initials</p>
            <p className="font-medium">{est.signerInitials}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-1">Date &amp; Time</p>
            <p className="font-medium">{format(new Date(est.signedAt), "MMM d, yyyy 'at' h:mm a")}</p>
          </div>
          {est.signerIp && (
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-1">IP Address</p>
              <p className="font-medium font-mono text-xs">{est.signerIp}</p>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-4 italic">This is a legally binding electronic signature record.</p>
      </div>
    );
  }
  return (
    <div className="mt-8 pt-6 border-t border-gray-300">
      <div className="print:hidden">
        <h3 className="text-base font-semibold text-gray-700 mb-2">Approve &amp; Sign</h3>
        <p className="text-sm text-gray-500 mb-4">By signing below, you agree to the scope of work and pricing outlined in this estimate.</p>
        <Button onClick={onSignClick} className="bg-green-700 hover:bg-green-800 text-white gap-2">
          <PenLine className="h-4 w-4" />Sign This Estimate
        </Button>
      </div>
      <div className="hidden print:block">
        <p className="text-sm font-semibold text-gray-700 mb-1">Authorized Signature</p>
        <div className="border-b border-gray-400 mt-8 mb-1" />
        <p className="text-xs text-gray-400">Signature&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Date</p>
        <div className="border-b border-gray-400 mt-8 mb-1" />
        <p className="text-xs text-gray-400">Printed Name&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Initials</p>
      </div>
    </div>
  );
}

function SignatureModal({ open, onClose, onSubmit, isPending }: {
  open: boolean; onClose: () => void;
  onSubmit: (d: { signatureData: string; signatureType: string; signerName: string; signerInitials: string }) => void;
  isPending: boolean;
}) {
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [signerName, setSignerName] = useState("");
  const [signerInitials, setSignerInitials] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [typedSig, setTypedSig] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (open) { setMode("draw"); setSignerName(""); setSignerInitials(""); setConfirmed(false); setTypedSig(""); clearCanvas(); }
  }, [open]);

  function clearCanvas() {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
  }
  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    if ("touches" in e) return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy };
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }
  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault(); const c = canvasRef.current; if (!c) return;
    setIsDrawing(true); lastPos.current = getPos(e, c);
  }
  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault(); if (!isDrawing) return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx || !lastPos.current) return;
    const pos = getPos(e, c);
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1E3A2F"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
    lastPos.current = pos;
  }
  function endDraw() { setIsDrawing(false); lastPos.current = null; }
  function canvasIsBlank() {
    const c = canvasRef.current; if (!c) return true;
    const ctx = c.getContext("2d"); if (!ctx) return true;
    return !ctx.getImageData(0, 0, c.width, c.height).data.some((v) => v !== 0);
  }
  function handleSubmit() {
    if (!signerName.trim() || !signerInitials.trim() || !confirmed) return;
    if (mode === "draw") {
      if (canvasIsBlank()) return;
      onSubmit({ signatureData: canvasRef.current!.toDataURL("image/png"), signatureType: "draw", signerName: signerName.trim(), signerInitials: signerInitials.trim() });
    } else {
      if (!typedSig.trim()) return;
      onSubmit({ signatureData: typedSig.trim(), signatureType: "typed", signerName: signerName.trim(), signerInitials: signerInitials.trim() });
    }
  }
  const canSubmit = !!(signerName.trim() && signerInitials.trim() && confirmed && (mode === "draw" ? !canvasIsBlank() : typedSig.trim()));
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="text-green-800">Sign Estimate</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant={mode === "draw" ? "default" : "outline"} size="sm" onClick={() => setMode("draw")} className={mode === "draw" ? "bg-green-700 hover:bg-green-800" : ""}>Draw Signature</Button>
            <Button variant={mode === "type" ? "default" : "outline"} size="sm" onClick={() => setMode("type")} className={mode === "type" ? "bg-green-700 hover:bg-green-800" : ""}>Type Signature</Button>
          </div>
          {mode === "draw" && (
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Draw your signature below</Label>
              <canvas ref={canvasRef} width={480} height={140} className="border-2 border-gray-300 rounded w-full bg-white cursor-crosshair touch-none" style={{ touchAction: "none" }}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
              <Button variant="ghost" size="sm" onClick={clearCanvas} className="mt-1 text-xs text-gray-400">Clear</Button>
            </div>
          )}
          {mode === "type" && (
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Type your full name to sign</Label>
              <Input value={typedSig} onChange={(e) => setTypedSig(e.target.value)} placeholder="Your full name" style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "1.2rem" }} />
              {typedSig && <p className="mt-2 text-2xl text-green-900 border-b border-gray-400 pb-2" style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}>{typedSig}</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sig-name" className="text-xs text-gray-500 mb-1 block">Full Name *</Label>
              <Input id="sig-name" value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Your full name" />
            </div>
            <div>
              <Label htmlFor="sig-initials" className="text-xs text-gray-500 mb-1 block">Initials *</Label>
              <Input id="sig-initials" value={signerInitials} onChange={(e) => setSignerInitials(e.target.value)} placeholder="e.g. J.D." maxLength={6} />
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded border">
            <Checkbox id="sig-confirm" checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} className="mt-0.5" />
            <Label htmlFor="sig-confirm" className="text-sm text-gray-600 leading-relaxed cursor-pointer">
              I agree that this electronic signature is the legal equivalent of my handwritten signature and I authorize Chapin Landscapes to proceed with the work described in this estimate.
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending} className="bg-green-700 hover:bg-green-800 text-white">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Submit Signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SimpleTemplate({ est, onSign }: { est: any; onSign: () => void }) {
  const items: any[] = est.items ?? [];
  const subtotal = items.reduce((s: number, i: any) => s + parseFloat(i.total ?? "0"), 0);
  const taxRate = parseFloat(est.taxRate ?? "0") / 100;
  const total = subtotal + subtotal * taxRate;
  return (
    <div className="max-w-3xl mx-auto bg-white p-8 print:p-4 font-sans">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-green-800 tracking-tight">CHAPIN LANDSCAPES</h1>
          <p className="text-sm text-gray-500 mt-0.5">Professional Landscape Services</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-gray-800">{est.estimate_number}</div>
          <div className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Estimate</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Prepared For</div>
          <div className="font-semibold text-base">{est.customer_name ?? "—"}</div>
          {est.customer_email && <div className="text-sm text-gray-600">{est.customer_email}</div>}
          {est.customer_phone && <div className="text-sm text-gray-600">{est.customer_phone}</div>}
          {est.property_address && <div className="text-sm text-gray-600 mt-1">{est.property_address}</div>}
        </div>
        <div className="text-right space-y-1">
          <div><span className="text-xs text-gray-400 uppercase tracking-wide">Date:&nbsp;</span><span className="text-sm font-medium">{fmtDate(est.issued_date)}</span></div>
          {est.valid_until && <div><span className="text-xs text-gray-400 uppercase tracking-wide">Valid Until:&nbsp;</span><span className="text-sm font-medium">{fmtDate(est.valid_until)}</span></div>}
          {est.salesperson_name && <div><span className="text-xs text-gray-400 uppercase tracking-wide">Advisor:&nbsp;</span><span className="text-sm font-medium">{est.salesperson_name}</span></div>}
        </div>
      </div>
      {est.customer_message && (
        <section className="p-4 bg-green-50 border border-green-200 rounded mb-6">
          <h2 className="text-sm font-bold text-green-800 mb-2">Dear {est.customer_name ?? "Valued Customer"},</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{est.customer_message}</p>
        </section>
      )}
      <table className="w-full text-sm mb-6">
        <thead><tr className="border-b-2 border-green-700 text-green-800">
          <th className="text-left py-2 font-semibold">Description</th>
          <th className="text-right py-2 font-semibold w-16">Qty</th>
          <th className="text-right py-2 font-semibold w-24">Unit Price</th>
          <th className="text-right py-2 font-semibold w-24">Total</th>
        </tr></thead>
        <tbody>{items.map((item: any, i: number) => (
          <tr key={i} className="border-b border-gray-100">
            <td className="py-2.5"><div className="font-medium">{item.name}</div>{item.description && <div className="text-xs text-gray-500">{item.description}</div>}</td>
            <td className="text-right py-2.5">{item.quantity}</td>
            <td className="text-right py-2.5">{fmtMoney(item.unit_price)}</td>
            <td className="text-right py-2.5">{fmtMoney(item.total)}</td>
          </tr>
        ))}</tbody>
      </table>
      <div className="flex justify-end mb-8">
        <div className="w-56 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{fmtMoney(subtotal)}</span></div>
          {taxRate > 0 && <div className="flex justify-between text-gray-600"><span>Tax ({est.taxRate}%)</span><span>{fmtMoney(subtotal * taxRate)}</span></div>}
          <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-1.5 text-green-800"><span>Total</span><span>{fmtMoney(total)}</span></div>
        </div>
      </div>
      {est.notes && (
        <section className="border-t border-gray-200 pt-4 mb-6">
          <h3 className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-2">Notes</h3>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{est.notes}</p>
        </section>
      )}
      <SignatureSection est={est} onSignClick={onSign} />
    </div>
  );
}

function BookletTemplate({ est, onSign }: { est: any; onSign: () => void }) {
  const items: any[] = est.items ?? [];
  const subtotal = items.reduce((s: number, i: any) => s + parseFloat(i.total ?? "0"), 0);
  const taxRate = parseFloat(est.taxRate ?? "0") / 100;
  const total = subtotal + subtotal * taxRate;
  return (
    <div className="max-w-3xl mx-auto print:max-w-none font-sans">
      <div className="bg-gradient-to-br from-green-900 to-green-700 text-white p-10 print:p-8 rounded-t-lg print:rounded-none min-h-[220px] flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">CHAPIN LANDSCAPES</h1>
            <p className="text-green-300 mt-1 text-sm">Professional Landscape Services</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-green-300 uppercase tracking-widest">Proposal</div>
            <div className="text-2xl font-bold mt-1">{est.estimate_number}</div>
          </div>
        </div>
        <div className="mt-6">
          <div className="text-sm text-green-300 mb-1">Prepared for:</div>
          <div className="text-xl font-semibold">{est.customer_name ?? "—"}</div>
          {est.property_address && <div className="text-green-200 text-sm mt-0.5">{est.property_address}</div>}
        </div>
        <div className="flex gap-8 text-sm text-green-200 mt-4">
          <span>Date: {fmtDate(est.issued_date)}</span>
          {est.valid_until && <span>Valid Until: {fmtDate(est.valid_until)}</span>}
          {est.salesperson_name && <span>Advisor: {est.salesperson_name}</span>}
        </div>
      </div>
      <div className="bg-white p-10 print:p-8 rounded-b-lg print:rounded-none border border-t-0 border-gray-100">
        {est.customer_message && (
          <section className="mb-8 pb-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-green-800 border-b border-green-200 pb-3 mb-3">Dear {est.customer_name ?? "Valued Customer"},</h2>
            <p className="text-sm text-gray-700 leading-relaxed">{est.customer_message}</p>
          </section>
        )}
        {(est.customer_email || est.customer_phone) && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-green-800 border-b border-green-200 pb-3 mb-3">Project Information</h2>
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Customer</div>
                <div className="font-medium">{est.customer_name ?? "—"}</div>
                {est.customer_email && <div className="text-gray-600">{est.customer_email}</div>}
                {est.customer_phone && <div className="text-gray-600">{est.customer_phone}</div>}
              </div>
              <div className="text-right space-y-1">
                <div><span className="text-xs text-gray-400 uppercase tracking-wide">Date:&nbsp;</span><span className="font-medium">{fmtDate(est.issued_date)}</span></div>
                {est.valid_until && <div><span className="text-xs text-gray-400 uppercase tracking-wide">Valid Until:&nbsp;</span><span className="font-medium">{fmtDate(est.valid_until)}</span></div>}
              </div>
            </div>
          </section>
        )}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-green-800 border-b border-green-200 pb-3 mb-3">Scope of Work</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-green-700 text-green-800">
              <th className="text-left py-2 font-semibold">Description</th>
              <th className="text-right py-2 font-semibold w-16">Qty</th>
              <th className="text-right py-2 font-semibold w-24">Unit Price</th>
              <th className="text-right py-2 font-semibold w-24">Total</th>
            </tr></thead>
            <tbody>{items.map((item: any, i: number) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2.5"><div className="font-medium">{item.name}</div>{item.description && <div className="text-xs text-gray-500">{item.description}</div>}</td>
                <td className="text-right py-2.5">{item.quantity}</td>
                <td className="text-right py-2.5">{fmtMoney(item.unit_price)}</td>
                <td className="text-right py-2.5">{fmtMoney(item.total)}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{fmtMoney(subtotal)}</span></div>
            {taxRate > 0 && <div className="flex justify-between text-gray-600"><span>Tax ({est.taxRate}%)</span><span>{fmtMoney(subtotal * taxRate)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t-2 border-green-700 pt-2 text-green-800"><span>Total Investment</span><span>{fmtMoney(total)}</span></div>
          </div>
        </div>
        {est.notes && (
          <section className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded">
            <h3 className="text-xs uppercase tracking-widest text-amber-700 font-semibold mb-2">Notes &amp; Terms</h3>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{est.notes}</p>
          </section>
        )}
        <SignatureSection est={est} onSignClick={onSign} />
      </div>
    </div>
  );
}

export default function EstimatePreview() {
  const [, params] = useRoute("/estimates/:id/preview");
  const id = params?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showSignModal, setShowSignModal] = useState(false);

  const { data: est, isLoading, isError } = useQuery<any>({
    queryKey: [`/api/estimates/${id}`],
    queryFn: () => fetch(`/api/estimates/${id}`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!id,
  });

  const signMutation = useMutation({
    mutationFn: async (payload: { signatureData: string; signatureType: string; signerName: string; signerInitials: string }) => {
      const res = await fetch(`/api/estimates/${id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Failed to submit signature");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/estimates/${id}`] });
      setShowSignModal(false);
      toast({ title: "Estimate signed!", description: "A confirmation has been sent to your email." });
    },
    onError: (err: any) => {
      toast({ title: "Signature failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-green-700" />
    </div>
  );

  if (isError || !est) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">
      <div className="text-center">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Estimate not found.</p>
      </div>
    </div>
  );

  const style = est.template_style ?? "booklet";

  return (
    <>
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <FileText className="h-4 w-4" />
          <span>{est.estimate_number} — {est.customer_name}</span>
          {est.signedAt && (
            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
              <CheckCircle className="h-3 w-3" /> Signed
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {!est.signedAt && (
            <Button size="sm" onClick={() => setShowSignModal(true)} className="bg-green-700 hover:bg-green-800 text-white gap-1.5">
              <PenLine className="h-4 w-4" />Approve &amp; Sign
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5">
            <Printer className="h-4 w-4" />Print
          </Button>
        </div>
      </div>
      <div className="py-6 px-4 print:p-0 bg-gray-50 print:bg-white min-h-screen">
        {style === "booklet"
          ? <BookletTemplate est={est} onSign={() => setShowSignModal(true)} />
          : <SimpleTemplate est={est} onSign={() => setShowSignModal(true)} />}
      </div>
      <SignatureModal
        open={showSignModal}
        onClose={() => setShowSignModal(false)}
        onSubmit={(data) => signMutation.mutate(data)}
        isPending={signMutation.isPending}
      />
      <style>{`@media print { @page { margin: 0.5in; } body { background: white !important; } }`}</style>
    </>
  );
}
