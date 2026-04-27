import React, { useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

export default function PortalCustomerRedeem() {
  const token =
    window.location.pathname.split("/portal/customer/")[1]?.split("?")[0] ?? "";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid invite link.");
      return;
    }
    fetch(`/api/portal/customer/${token}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(body.message || "This invite link is invalid or has expired.");
        } else {
          window.location.href = body.redirect || "/customer-hub";
        }
      })
      .catch(() => setError("Unable to validate link. Please try again."));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 max-w-sm px-4">
          <AlertTriangle className="h-10 w-10 mx-auto text-destructive" />
          <h2 className="text-lg font-semibold">Invite Link Invalid</h2>
          <p className="text-muted-foreground text-sm">{error}</p>
          <a href="/" className="text-sm text-primary underline underline-offset-4">
            Return to home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Accessing your customer portal…</p>
      </div>
    </div>
  );
}
