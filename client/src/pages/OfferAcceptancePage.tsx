import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle2, FileText, AlertCircle, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import SignaturePad from "@/components/forms/SignaturePad";

interface OfferDetails {
  candidateId: string;
  name: string;
  role: string;
  alreadyAccepted: boolean;
  acceptedAt?: string;
  offerLetterUrl?: string | null;
  expiresAt?: string;
}

export default function OfferAcceptancePage() {
  const token = window.location.pathname.split("/offer/")[1];

  const [offer, setOffer] = useState<OfferDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string>("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptResult, setAcceptResult] = useState<{ username?: string; accountCreated?: boolean } | null>(null);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (!token) {
      setError("No offer token found in this link.");
      setLoading(false);
      return;
    }
    fetch(`/api/offer/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load offer.");
        setOffer(data);
        if (data.alreadyAccepted) setAccepted(true);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!accepted) return;
    if (countdown <= 0) {
      window.location.href = "/auth";
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [accepted, countdown]);

  const handleSignatureChange = useCallback((dataUrl: string) => {
    setSignature(dataUrl);
  }, []);

  async function handleAccept() {
    if (!signature) {
      alert("Please sign before accepting.");
      return;
    }
    if (!agreed) {
      alert("Please check the acknowledgment box.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/offer/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to accept offer.");
      setAcceptResult(data);
      setAccepted(true);
    } catch (err: any) {
      alert(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-green-700 mx-auto" />
          <p className="text-green-800 font-medium">Loading your offer…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <XCircle className="h-14 w-14 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-800">Link Not Valid</h2>
            <p className="text-gray-600">{error}</p>
            <p className="text-sm text-gray-500">
              If you believe this is a mistake, please contact Chapin Landscapes directly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!offer) return null;

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 p-4">
        <Card className="max-w-lg w-full shadow-xl">
          <CardContent className="pt-10 pb-10 text-center space-y-5">
            <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Offer Accepted!</h2>
            <p className="text-gray-600 text-base leading-relaxed">
              Congratulations, <strong>{offer.name}</strong>! Your offer for{" "}
              <strong>{offer.role}</strong> at Chapin Landscapes has been accepted and recorded.
            </p>
            {offer.alreadyAccepted && offer.acceptedAt ? (
              <p className="text-sm text-gray-500">
                Accepted on {new Date(offer.acceptedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            ) : (
              acceptResult?.accountCreated && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left space-y-1">
                  <p className="font-semibold text-green-800 text-sm">Your Account is Ready</p>
                  <p className="text-sm text-green-700">
                    Your login credentials have been sent to your email. Keep them safe!
                  </p>
                  {acceptResult.username && (
                    <p className="text-sm text-green-700">
                      Username: <strong>{acceptResult.username}</strong>
                    </p>
                  )}
                </div>
              )
            )}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">
                Redirecting to login in{" "}
                <span className="font-bold text-green-700">{countdown}</span> seconds…
              </p>
            </div>
            <Button
              className="w-full bg-green-700 hover:bg-green-800 text-white"
              onClick={() => (window.location.href = "/auth")}
              data-testid="button-go-to-login"
            >
              Go to Login <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-green-800 text-white px-5 py-2 rounded-full text-sm font-semibold">
            <FileText className="h-4 w-4" />
            Official Offer of Employment
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Chapin Landscapes</h1>
          <p className="text-gray-600">Please review and digitally accept your offer below.</p>
        </div>

        {/* Offer Details Card */}
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-green-800 text-white rounded-t-xl">
            <CardTitle className="text-xl">Offer Details</CardTitle>
            <CardDescription className="text-green-200">
              This offer is valid until{" "}
              {offer.expiresAt
                ? new Date(offer.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                : "30 days from issue"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Candidate</p>
                <p className="font-semibold text-gray-900 text-lg" data-testid="text-candidate-name">{offer.name}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Position</p>
                <p className="font-semibold text-gray-900 text-lg" data-testid="text-offer-role">{offer.role}</p>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                By accepting this offer, you are confirming your intent to join Chapin Landscapes as a{" "}
                <strong>{offer.role}</strong>. You will receive your login credentials and onboarding information via email.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Offer Letter PDF Viewer */}
        {offer.offerLetterUrl && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-green-700" />
                Your Offer Letter
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden bg-gray-100" style={{ height: 420 }}>
                <iframe
                  src={offer.offerLetterUrl}
                  className="w-full h-full"
                  title="Offer Letter"
                  data-testid="iframe-offer-letter"
                />
              </div>
              <a
                href={offer.offerLetterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-700 underline mt-2 inline-block"
                data-testid="link-download-offer"
              >
                Open / Download Offer Letter
              </a>
            </CardContent>
          </Card>
        )}

        {/* Signature Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-base">Digital Signature</CardTitle>
            <CardDescription>Sign below to confirm your acceptance of this offer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-2 bg-white">
              <SignaturePad
                value={signature}
                onChange={handleSignatureChange}
                height={130}
                testId="signature-pad-offer"
              />
            </div>
            {signature && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Signature captured
              </p>
            )}

            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <Checkbox
                id="agree"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(!!v)}
                data-testid="checkbox-offer-agree"
                className="mt-0.5"
              />
              <Label htmlFor="agree" className="text-sm text-amber-900 leading-relaxed cursor-pointer">
                I, <strong>{offer.name}</strong>, have read and understood this offer of employment. I accept the
                position of <strong>{offer.role}</strong> at Chapin Landscapes and agree to the terms described.
              </Label>
            </div>

            <Button
              className="w-full bg-green-700 hover:bg-green-800 text-white py-5 text-base font-semibold"
              onClick={handleAccept}
              disabled={submitting || !signature || !agreed}
              data-testid="button-accept-offer"
            >
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
              ) : (
                <><CheckCircle2 className="mr-2 h-5 w-5" /> I Accept This Offer</>
              )}
            </Button>

            <p className="text-xs text-center text-gray-500">
              By clicking "I Accept This Offer", you are providing a legally binding digital signature.
              A copy of your accepted offer will be stored in your employee file.
            </p>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-gray-400 pb-6">
          &copy; {new Date().getFullYear()} Chapin Landscapes · Company HQ Platform
        </div>
      </div>
    </div>
  );
}
