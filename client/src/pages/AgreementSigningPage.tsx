import React, { useRef, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, FileSignature, Clock, XCircle, PenLine, Type } from "lucide-react";
import SignaturePad from "@/components/forms/SignaturePad";
import { cn } from "@/lib/utils";

type SignMode = "draw" | "type";

function TypedSignature({ onChange }: { onChange: (dataUrl: string) => void }) {
  const [name, setName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const render = useCallback(async (text: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth || 480;
    const h = 120;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    if (!text.trim()) { onChange(""); return; }
    // Wait for font
    try { await document.fonts.load(`bold 52px "Dancing Script"`); } catch (_) {}
    ctx.font = `bold 52px "Dancing Script", cursive`;
    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 - 4);
    // Signature line
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, h - 18);
    ctx.lineTo(w - 20, h - 18);
    ctx.stroke();
    onChange(canvas.toDataURL("image/png"));
  }, [onChange]);

  useEffect(() => { render(name); }, [name, render]);

  return (
    <div className="space-y-3">
      <Input
        placeholder="Type your full legal name"
        value={name}
        onChange={e => setName(e.target.value)}
        className="text-base"
        data-testid="input-typed-signature"
      />
      {name.trim() && (
        <div className="rounded-lg border-2 border-muted-foreground/20 bg-white overflow-hidden relative">
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ display: "block", height: 120 }}
            data-testid="canvas-typed-signature"
          />
          <p className="text-[10px] text-muted-foreground/40 absolute bottom-1 left-3">Your signature</p>
        </div>
      )}
      {!name.trim() && (
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 bg-white h-[120px] flex items-center justify-center">
          <p className="text-sm text-muted-foreground/50">Your signature preview will appear here</p>
        </div>
      )}
      {name.trim() && (
        <button
          className="text-xs text-muted-foreground underline"
          onClick={() => { setName(""); onChange(""); }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

export default function AgreementSigningPage() {
  const token = window.location.pathname.split("/agreement/")[1]?.split("?")[0] || "";
  const [signature, setSignature] = useState<string>("");
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [signMode, setSignMode] = useState<SignMode>("type");

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/agreement", token],
    queryFn: async () => {
      const res = await fetch(`/api/agreement/${token}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to load agreement.");
      return json;
    },
    retry: false,
  });

  useEffect(() => {
    if (!submitted) return;
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [submitted]);

  useEffect(() => {
    if (submitted && countdown <= 0) window.location.href = "/auth";
  }, [submitted, countdown]);

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!signature) throw new Error("Please provide your signature.");
      const res = await fetch(`/api/agreement/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl: signature }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to sign.");
      return json;
    },
    onSuccess: () => setSubmitted(true),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Link Invalid or Expired</h2>
          <p className="text-muted-foreground">{(error as any)?.message || "This agreement link is no longer valid. Please contact your manager."}</p>
        </div>
      </div>
    );
  }

  if (data.alreadySigned) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Agreement Already Signed</h2>
          <p className="text-muted-foreground">
            You signed your {data.year} {data.positionTitle} Employment Agreement
            {data.signedAt ? ` on ${new Date(data.signedAt).toLocaleDateString()}` : ""}.
          </p>
          <p className="text-sm text-muted-foreground mt-4">Your manager has a copy on file.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Agreement Signed!</h2>
          <p className="text-muted-foreground">Thank you. Your signed agreement has been recorded and your manager has been notified.</p>
          <p className="text-sm text-muted-foreground mt-4">
            Redirecting to login in <strong>{countdown}</strong> second{countdown !== 1 ? "s" : ""}...
          </p>
          <Button className="mt-4" onClick={() => window.location.href = "/auth"}>Go to Login</Button>
        </div>
      </div>
    );
  }

  const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  const canSubmit = !!signature && agreed;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl border shadow-sm p-6 mb-6 text-center">
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 rounded-full px-4 py-1.5 text-sm font-semibold mb-4">
            <FileSignature className="h-4 w-4" />
            Employment Agreement – Please Review &amp; Sign
          </div>
          <h1 className="text-2xl font-bold">{data.year} {data.positionTitle}</h1>
          <p className="text-muted-foreground mt-1">Chapin Landscapes</p>
          {expiresAt && (
            <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              This link expires {expiresAt.toLocaleDateString()}
            </div>
          )}
          {data.payRate && (
            <div className="flex justify-center gap-3 mt-4 flex-wrap">
              <Badge variant="secondary" className="text-sm">Pay Rate: ${data.payRate}/hr</Badge>
              {data.startDate && <Badge variant="secondary" className="text-sm">Start Date: {new Date(data.startDate + "T12:00:00").toLocaleDateString()}</Badge>}
            </div>
          )}
        </div>

        {/* Agreement body */}
        <div
          className="bg-white rounded-xl border shadow-sm p-8 mb-6 agreement-prose"
          style={{ lineHeight: "1.8" }}
          data-testid="agreement-body"
          dangerouslySetInnerHTML={{ __html: data.renderedBody }}
        />

        {/* Signature section */}
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-1">
              <FileSignature className="h-5 w-5 text-primary" />
              Sign This Agreement
            </h3>
            <p className="text-sm text-muted-foreground">
              Choose how you'd like to sign — no printing required. Your electronic signature is legally binding.
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-lg border overflow-hidden w-fit">
            <button
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
                signMode === "type" ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-muted/50"
              )}
              onClick={() => { setSignMode("type"); setSignature(""); }}
              data-testid="tab-type-signature"
            >
              <Type className="h-4 w-4" /> Type Your Name
            </button>
            <button
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-l",
                signMode === "draw" ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-muted/50"
              )}
              onClick={() => { setSignMode("draw"); setSignature(""); }}
              data-testid="tab-draw-signature"
            >
              <PenLine className="h-4 w-4" /> Draw
            </button>
          </div>

          {/* Signature input */}
          {signMode === "type" ? (
            <TypedSignature onChange={setSignature} />
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Sign using your mouse, trackpad, or finger on mobile.
              </p>
              <SignaturePad
                value={signature}
                onChange={setSignature}
                data-testid="signature-pad-agreement"
              />
            </div>
          )}

          {/* Acknowledgment */}
          <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
            <Checkbox
              id="agreement-ack"
              checked={agreed}
              onCheckedChange={(v) => setAgreed(!!v)}
              data-testid="checkbox-agreement-ack"
            />
            <label htmlFor="agreement-ack" className="text-sm leading-relaxed cursor-pointer">
              I have read, understand, and agree to the terms of this Employment Agreement with Chapin Landscapes.
              I acknowledge this electronic signature is legally binding.
            </label>
          </div>

          {signMutation.isError && (
            <p className="text-sm text-destructive">{(signMutation.error as any)?.message}</p>
          )}

          <Button
            className="w-full h-12 text-base font-semibold"
            onClick={() => signMutation.mutate()}
            disabled={!canSubmit || signMutation.isPending}
            data-testid="button-sign-agreement"
          >
            {signMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
            ) : "I Accept & Sign This Agreement"}
          </Button>

          {!canSubmit && (
            <p className="text-xs text-center text-muted-foreground">
              {!signature
                ? signMode === "type"
                  ? "Type your full name above to create your signature."
                  : "Please draw your signature above."
                : "Please check the acknowledgment box to continue."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
