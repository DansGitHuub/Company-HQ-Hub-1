import { useState, useEffect, useCallback } from "react";
import {
  Loader2, CheckCircle2, FileText, AlertCircle, XCircle, ThumbsDown, MessageSquare,
  DollarSign, CalendarDays, Clock, Briefcase, Shield, StickyNote, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import SignaturePad from "@/components/forms/SignaturePad";

interface OfferDetails {
  candidateId: string;
  name: string;
  role: string;
  alreadyAccepted: boolean;
  acceptedAt?: string;
  alreadyDeclined?: boolean;
  declinedAt?: string;
  alreadyCountered?: boolean;
  offerLetterUrl?: string | null;
  expiresAt?: string;
  offerPay?: string | null;
  offerPayType?: string | null;
  offerStartDate?: string | null;
  offerEmploymentType?: string | null;
  offerSchedule?: string | null;
  offerBenefits?: string[];
  offerNotes?: string | null;
}

function formatPay(pay?: string | null, type?: string | null) {
  if (!pay) return null;
  const num = parseFloat(pay);
  if (isNaN(num)) return pay;
  const formatted = num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (type === "Salary") return `$${formatted} / year`;
  return `$${formatted} / hour`;
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  } catch {
    return dateStr;
  }
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

  // Decline flow
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [decliningOffer, setDecliningOffer] = useState(false);
  const [declined, setDeclined] = useState(false);

  // Counter-proposal flow
  const [showCounter, setShowCounter] = useState(false);
  const [counterNote, setCounterNote] = useState("");
  const [submittingCounter, setSubmittingCounter] = useState(false);
  const [countered, setCountered] = useState(false);

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
        if (data.alreadyDeclined) setDeclined(true);
        if (data.alreadyCountered) setCountered(true);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSignatureChange = useCallback((dataUrl: string) => {
    setSignature(dataUrl);
  }, []);

  async function handleAccept() {
    if (!signature) { alert("Please provide your signature before accepting."); return; }
    if (!agreed) { alert("Please check the acknowledgment box to confirm."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/offer/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to accept offer.");
      setAccepted(true);
    } catch (err: any) {
      alert(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    setDecliningOffer(true);
    try {
      const res = await fetch(`/api/offer/${token}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit response.");
      setDeclined(true);
    } catch (err: any) {
      alert(err.message || "Something went wrong. Please try again.");
    } finally {
      setDecliningOffer(false);
    }
  }

  async function handleCounter() {
    if (!counterNote.trim()) { alert("Please describe what you'd like to discuss or change."); return; }
    setSubmittingCounter(true);
    try {
      const res = await fetch(`/api/offer/${token}/counter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: counterNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit request.");
      setCountered(true);
    } catch (err: any) {
      alert(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmittingCounter(false);
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
            <p className="text-sm text-gray-500">If you believe this is a mistake, please contact Chapin Landscapes directly.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!offer) return null;

  if (declined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <Card className="max-w-lg w-full shadow-xl">
          <CardContent className="pt-10 pb-10 text-center space-y-5">
            <div className="mx-auto w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
              <ThumbsDown className="h-10 w-10 text-gray-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Response Recorded</h2>
            <p className="text-gray-600 leading-relaxed">
              Thank you for letting us know, <strong>{offer.name}</strong>. We've received your decision and wish you all the best.
            </p>
            <p className="text-sm text-gray-500">
              If you change your mind or have any questions, please reach out to Chapin Landscapes directly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (countered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100 p-4">
        <Card className="max-w-lg w-full shadow-xl">
          <CardContent className="pt-10 pb-10 text-center space-y-5">
            <div className="mx-auto w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
              <MessageSquare className="h-10 w-10 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Request Received</h2>
            <p className="text-gray-600 leading-relaxed">
              Thanks, <strong>{offer.name}</strong>! Your request has been sent to the Chapin Landscapes team. Someone will follow up with you shortly.
            </p>
            <p className="text-sm text-gray-500">
              Please check your email for a response within 1–2 business days.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
              Congratulations, <strong>{offer.name}</strong>! Your acceptance for the{" "}
              <strong>{offer.role}</strong> position at Chapin Landscapes has been recorded.
            </p>
            {offer.alreadyAccepted && offer.acceptedAt ? (
              <p className="text-sm text-gray-500">
                Accepted on {new Date(offer.acceptedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left space-y-1">
                <p className="font-semibold text-green-800 text-sm">What happens next?</p>
                <p className="text-sm text-green-700">The team has been notified and will reach out with your onboarding details and login credentials by email before your start date.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const payFormatted = formatPay(offer.offerPay, offer.offerPayType);
  const startDateFormatted = formatDate(offer.offerStartDate);
  const hasOfferDetails = payFormatted || startDateFormatted || offer.offerEmploymentType || offer.offerSchedule || (offer.offerBenefits && offer.offerBenefits.length > 0) || offer.offerNotes;

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
          <p className="text-gray-600">Please review your offer details and sign to accept.</p>
        </div>

        {/* Candidate + Role */}
        <Card className="shadow-lg overflow-hidden">
          <CardHeader className="bg-green-800 text-white rounded-t-xl py-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-green-300 text-xs uppercase tracking-widest font-medium mb-1">Offer Extended To</p>
                <CardTitle className="text-2xl text-white" data-testid="text-candidate-name">{offer.name}</CardTitle>
              </div>
              <div className="text-right">
                <p className="text-green-300 text-xs uppercase tracking-widest font-medium mb-1">Position</p>
                <p className="text-xl font-semibold text-white" data-testid="text-offer-role">{offer.role}</p>
              </div>
            </div>
            {offer.expiresAt && (
              <CardDescription className="text-green-300 text-xs mt-2">
                This offer expires on {new Date(offer.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </CardDescription>
            )}
          </CardHeader>

          {hasOfferDetails && (
            <CardContent className="pt-5 pb-6 space-y-5">
              {(payFormatted || startDateFormatted || offer.offerEmploymentType || offer.offerSchedule) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {payFormatted && (
                    <div className="flex items-start gap-3 bg-green-50 rounded-lg p-4">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <DollarSign className="h-4 w-4 text-green-700" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">Compensation</p>
                        <p className="font-semibold text-gray-900" data-testid="text-offer-pay">{payFormatted}</p>
                      </div>
                    </div>
                  )}
                  {startDateFormatted && (
                    <div className="flex items-start gap-3 bg-blue-50 rounded-lg p-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <CalendarDays className="h-4 w-4 text-blue-700" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">Start Date</p>
                        <p className="font-semibold text-gray-900" data-testid="text-offer-start-date">{startDateFormatted}</p>
                      </div>
                    </div>
                  )}
                  {offer.offerEmploymentType && (
                    <div className="flex items-start gap-3 bg-purple-50 rounded-lg p-4">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Briefcase className="h-4 w-4 text-purple-700" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">Employment Type</p>
                        <p className="font-semibold text-gray-900">{offer.offerEmploymentType}</p>
                      </div>
                    </div>
                  )}
                  {offer.offerSchedule && (
                    <div className="flex items-start gap-3 bg-amber-50 rounded-lg p-4">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-4 w-4 text-amber-700" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">Work Schedule</p>
                        <p className="font-semibold text-gray-900">{offer.offerSchedule}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {offer.offerBenefits && offer.offerBenefits.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Shield className="h-4 w-4 text-green-600" />
                    Benefits Package
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {offer.offerBenefits.map((b) => (
                      <Badge key={b} className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 border font-normal" data-testid={`badge-benefit-${b.toLowerCase().replace(/\W+/g, "-")}`}>
                        <CheckCircle2 className="h-3 w-3 mr-1.5" />{b}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {offer.offerNotes && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <StickyNote className="h-4 w-4 text-gray-500" />
                    Additional Notes
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {offer.offerNotes}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Info notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            By accepting this offer, you are confirming your intent to join Chapin Landscapes as a{" "}
            <strong>{offer.role}</strong>. Your onboarding information and login credentials will be sent to your email before your start date.
          </p>
        </div>

        {/* Offer Letter PDF (if attached) */}
        {offer.offerLetterUrl && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-green-700" />
                Attached Offer Letter
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden bg-gray-100" style={{ height: 400 }}>
                <iframe src={offer.offerLetterUrl} className="w-full h-full" title="Offer Letter" data-testid="iframe-offer-letter" />
              </div>
              <a href={offer.offerLetterUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-green-700 underline mt-2 inline-block" data-testid="link-download-offer">
                Open in new tab
              </a>
            </CardContent>
          </Card>
        )}

        {/* Signature & Accept */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-base">Your Digital Signature</CardTitle>
            <CardDescription>Sign below using your mouse or finger to accept this offer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-2 bg-white">
              <SignaturePad value={signature} onChange={handleSignatureChange} height={140} testId="signature-pad-offer" />
            </div>
            {signature && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Signature captured
              </p>
            )}

            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <Checkbox id="agree" checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} data-testid="checkbox-offer-agree" className="mt-0.5" />
              <Label htmlFor="agree" className="text-sm text-amber-900 leading-relaxed cursor-pointer">
                I, <strong>{offer.name}</strong>, have reviewed and understood the offer of employment for the position of{" "}
                <strong>{offer.role}</strong> at Chapin Landscapes, and I accept the terms as described above.
              </Label>
            </div>

            <Button
              className="w-full bg-green-700 hover:bg-green-800 text-white py-5 text-base font-semibold"
              onClick={handleAccept}
              disabled={submitting || !signature || !agreed}
              data-testid="button-accept-offer"
            >
              {submitting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</>
                : <><CheckCircle2 className="mr-2 h-5 w-5" />I Accept This Offer</>}
            </Button>

            <p className="text-xs text-center text-gray-500">
              Clicking "I Accept This Offer" constitutes a legally binding digital signature. A record of your acceptance is stored securely.
            </p>
          </CardContent>
        </Card>

        {/* Decline section */}
        <Card className="shadow-lg border-gray-200">
          <CardContent className="pt-5 pb-5">
            <button
              className="w-full flex items-center justify-between text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => { setShowDecline(v => !v); setShowCounter(false); }}
              data-testid="button-toggle-decline"
            >
              <span className="flex items-center gap-2">
                <ThumbsDown className="h-4 w-4" />
                Decline This Offer
              </span>
              {showDecline ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showDecline && (
              <div className="mt-4 space-y-4 border-t pt-4">
                <p className="text-sm text-gray-600">
                  We're sorry to hear that. You can optionally share why you're declining — this helps the team.
                </p>
                <div>
                  <Label htmlFor="decline-reason" className="text-sm">Reason (optional)</Label>
                  <Textarea
                    id="decline-reason"
                    value={declineReason}
                    onChange={e => setDeclineReason(e.target.value)}
                    placeholder="e.g. Accepted another offer, compensation doesn't fit my needs, etc."
                    rows={3}
                    className="mt-1.5 text-sm"
                    data-testid="textarea-decline-reason"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowDecline(false)}
                    disabled={decliningOffer}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleDecline}
                    disabled={decliningOffer}
                    data-testid="button-confirm-decline"
                  >
                    {decliningOffer
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
                      : "Confirm Decline"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Counter-proposal section */}
        <Card className="shadow-lg border-gray-200">
          <CardContent className="pt-5 pb-5">
            <button
              className="w-full flex items-center justify-between text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => { setShowCounter(v => !v); setShowDecline(false); }}
              data-testid="button-toggle-counter"
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Request Changes / Negotiate
              </span>
              {showCounter ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showCounter && (
              <div className="mt-4 space-y-4 border-t pt-4">
                <p className="text-sm text-gray-600">
                  Interested but want to discuss the terms? Describe what you'd like to change and the team will follow up with you.
                </p>
                <div>
                  <Label htmlFor="counter-note" className="text-sm">Your request <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="counter-note"
                    value={counterNote}
                    onChange={e => setCounterNote(e.target.value)}
                    placeholder="e.g. I'd like to discuss the pay rate, start date, or schedule…"
                    rows={4}
                    className="mt-1.5 text-sm"
                    data-testid="textarea-counter-note"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowCounter(false)}
                    disabled={submittingCounter}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={handleCounter}
                    disabled={submittingCounter || !counterNote.trim()}
                    data-testid="button-submit-counter"
                  >
                    {submittingCounter
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>
                      : "Send Request"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-gray-400 pb-6">
          &copy; {new Date().getFullYear()} Chapin Landscapes · Company HQ Platform
        </div>
      </div>
    </div>
  );
}
