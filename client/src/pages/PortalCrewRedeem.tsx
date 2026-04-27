import React, { useEffect, useState } from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortalCrewRedeem() {
  const token = window.location.pathname.split("/portal/crew/")[1] ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No invite token found in the link.");
      return;
    }

    fetch(`/api/portal/crew/${token}`, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus("error");
          setMessage(data.message || "Invite link is invalid or has expired.");
          return;
        }
        setStatus("success");
        // Give toast a moment then redirect
        setTimeout(() => {
          window.location.href = data.redirect ?? "/employee-portal";
        }, 1200);
      })
      .catch(() => {
        setStatus("error");
        setMessage("Network error. Please try again or contact your manager.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="bg-white rounded-xl shadow-lg p-10 max-w-sm w-full text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground text-sm">Validating your invite link…</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
            <p className="font-semibold text-green-700">Access granted!</p>
            <p className="text-muted-foreground text-sm">Redirecting to your crew portal…</p>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="font-semibold text-destructive">Invite link invalid</p>
            <p className="text-muted-foreground text-sm">{message}</p>
            <Button variant="outline" size="sm" onClick={() => (window.location.href = "/")}>
              Go to home
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
