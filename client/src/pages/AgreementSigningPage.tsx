import React, { useRef, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, FileSignature, Clock, XCircle } from "lucide-react";
import SignaturePad from "@/components/forms/SignaturePad";

export default function AgreementSigningPage() {
  const token = window.location.pathname.split("/agreement/")[1]?.split("?")[0] || "";
  const [signature, setSignature] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(10);

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
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Your Signature
          </h3>

          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Sign below using your mouse, trackpad, or finger (on mobile).
            </p>
            <SignaturePad
              onChange={setSignature}
              data-testid="signature-pad-agreement"
            />
          </div>

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
            ) : "I Accept &amp; Sign This Agreement"}
          </Button>

          {!canSubmit && (
            <p className="text-xs text-center text-muted-foreground">
              {!signature ? "Please provide your signature above." : "Please check the acknowledgment box to continue."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
