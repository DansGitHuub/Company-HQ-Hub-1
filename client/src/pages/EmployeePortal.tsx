import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  User, Home, CreditCard, Stethoscope, Plane, Save,
  CheckCircle2, AlertCircle, FileText, LogOut, Loader2,
  ClipboardList, ShieldAlert, PenLine, Type, Pen
} from "lucide-react";
import ResignationLetterForm from "@/components/forms/ResignationLetterForm";
import SignaturePad from "@/components/forms/SignaturePad";
import { cn } from "@/lib/utils";

type Section = "profile" | "address" | "payroll" | "health" | "vacation" | "corrective" | "resignation";

const CA_ACTION_COLORS: Record<string, string> = {
  "Verbal Warning": "bg-yellow-100 text-yellow-800 border-yellow-300",
  "Written Warning": "bg-orange-100 text-orange-800 border-orange-300",
  "Final Warning": "bg-red-100 text-red-800 border-red-300",
  "Suspension": "bg-purple-100 text-purple-800 border-purple-300",
  "Termination": "bg-gray-900 text-white border-gray-700",
};

function TypedSignatureInline({ onChange }: { onChange: (dataUrl: string) => void }) {
  const [name, setName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const render = useCallback(async (text: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth || 400;
    const h = 100;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    if (!text.trim()) { onChange(""); return; }
    try { await document.fonts.load(`bold 44px "Dancing Script"`); } catch (_) {}
    ctx.font = `bold 44px "Dancing Script", cursive`;
    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 - 4);
    ctx.strokeStyle = "#d1d5db"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(20, h - 14); ctx.lineTo(w - 20, h - 14); ctx.stroke();
    onChange(canvas.toDataURL("image/png"));
  }, [onChange]);

  useEffect(() => { render(name); }, [name, render]);

  return (
    <div className="space-y-2">
      <Input placeholder="Type your full legal name" value={name} onChange={e => setName(e.target.value)} data-testid="input-ca-typed-sig" />
      {name.trim() ? (
        <div className="relative rounded border bg-white overflow-hidden">
          <canvas ref={canvasRef} className="w-full" style={{ display: "block", height: 100 }} />
        </div>
      ) : (
        <div className="rounded border border-dashed bg-white h-[100px] flex items-center justify-center">
          <p className="text-xs text-muted-foreground/50">Signature preview</p>
        </div>
      )}
      {name && <button className="text-xs text-muted-foreground underline" onClick={() => { setName(""); onChange(""); }}>Clear</button>}
    </div>
  );
}

const REQUEST_TYPE_OPTIONS = ["Vacation", "Sick Leave", "Personal Day", "Unpaid Leave", "Bereavement", "Other"];

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Approved: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  Denied: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  Pending: <AlertCircle className="w-4 h-4 text-amber-500" />,
  Approved: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  Denied: <AlertCircle className="w-4 h-4 text-red-500" />,
};

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start); const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export default function EmployeePortal() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<Section>("profile");

  const [ptoType, setPtoType] = useState("Vacation");
  const [ptoStart, setPtoStart] = useState("");
  const [ptoEnd, setPtoEnd] = useState("");
  const [ptoNotes, setPtoNotes] = useState("");

  // Corrective action signing state
  const [forcedCAModal, setForcedCAModal] = useState<any>(null);
  const [caSignMode, setCASignMode] = useState<"type" | "draw">("type");
  const [caSignature, setCASignature] = useState("");
  const [viewCAOpen, setViewCAOpen] = useState<any>(null);

  const ptoDays = calcDays(ptoStart, ptoEnd);

  const [profileForm, setProfileForm] = useState({
    firstName: "", lastName: "", personalEmail: "", personalPhone: "",
    emergencyContactName: "", emergencyContactRelationship: "", emergencyContactPhone: "",
  });
  const [addressForm, setAddressForm] = useState({ address: "", city: "", state: "", zip: "" });

  const { data: myEmployee, isLoading: empLoading } = useQuery({
    queryKey: ["/api/employees/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/employees/me");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: timeOffRequests = [], isLoading: torLoading } = useQuery({
    queryKey: ["/api/employees", myEmployee?.id, "time-off-requests"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/employees/${myEmployee!.id}/time-off-requests`);
      return res.json();
    },
    enabled: !!myEmployee?.id,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: resignationLetters = [] } = useQuery({
    queryKey: ["/api/employees", myEmployee?.id, "resignation-letters"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/employees/${myEmployee!.id}/resignation-letters`);
      return res.json();
    },
    enabled: !!myEmployee?.id,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: correctiveActions = [], refetch: refetchCAs } = useQuery({
    queryKey: ["/api/employees", myEmployee?.id, "corrective-actions"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/employees/${myEmployee!.id}/corrective-actions`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!myEmployee?.id,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const pendingCAs = useMemo(
    () => (correctiveActions as any[]).filter((ca) => ca.status === "Pending Signature"),
    [correctiveActions]
  );

  // Auto-open forced modal for the first pending CA
  useEffect(() => {
    if (pendingCAs.length > 0 && !forcedCAModal) {
      setForcedCAModal(pendingCAs[0]);
      setCASignature("");
      setCASignMode("type");
    }
  }, [pendingCAs]);

  const signCAmutation = useMutation({
    mutationFn: async ({ id, signatureDataUrl }: { id: string; signatureDataUrl: string }) => {
      const res = await apiRequest("POST", `/api/corrective-actions/${id}/employee-sign`, {
        signatureDataUrl,
        signatureDate: new Date().toISOString().split("T")[0],
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed to submit signature"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Signature submitted", description: "Your acknowledgment has been recorded and HR has been notified." });
      setForcedCAModal(null);
      setCASignature("");
      queryClient.invalidateQueries({ queryKey: ["/api/employees", myEmployee?.id, "corrective-actions"] });
    },
    onError: (err: any) => {
      toast({ title: "Signature failed", description: err.message, variant: "destructive" });
    },
  });

  // Seed controlled form state when employee record loads
  useEffect(() => {
    if (myEmployee) {
      setProfileForm({
        firstName: myEmployee.firstName || "",
        lastName: myEmployee.lastName || "",
        personalEmail: myEmployee.personalEmail || "",
        personalPhone: myEmployee.personalPhone || "",
        emergencyContactName: myEmployee.emergencyContactName || "",
        emergencyContactRelationship: myEmployee.emergencyContactRelationship || "",
        emergencyContactPhone: myEmployee.emergencyContactPhone || "",
      });
      setAddressForm({
        address: myEmployee.address || "",
        city: myEmployee.city || "",
        state: myEmployee.state || "",
        zip: myEmployee.zip || "",
      });
    }
  }, [myEmployee]);

  const submitPTO = useMutation({
    mutationFn: async () => {
      if (!myEmployee?.id) throw new Error("No employee record found for your account.");
      if (!ptoStart || !ptoEnd) throw new Error("Please select start and end dates.");
      if (ptoDays <= 0) throw new Error("End date must be after start date.");
      const res = await apiRequest("POST", "/api/time-off-requests", {
        employeeId: myEmployee.id,
        requestType: ptoType,
        startDate: ptoStart,
        endDate: ptoEnd,
        totalDays: ptoDays,
        notes: ptoNotes || null,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed to submit"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Time off request submitted", description: "Your manager has been notified." });
      setPtoStart(""); setPtoEnd(""); setPtoNotes(""); setPtoType("Vacation");
      queryClient.invalidateQueries({ queryKey: ["/api/employees", myEmployee?.id, "time-off-requests"] });
    },
    onError: (err: any) => {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (data: typeof profileForm) => {
      const res = await apiRequest("PATCH", "/api/employees/me", data);
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed to save"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile saved", description: "Your profile has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/employees/me"] });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const saveAddressMutation = useMutation({
    mutationFn: async (data: typeof addressForm) => {
      const res = await apiRequest("PATCH", "/api/employees/me", data);
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed to save"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Address saved", description: "Your address has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/employees/me"] });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const navItems: { id: Section; icon: React.ElementType; label: string; badge?: number }[] = [
    { id: "profile", icon: User, label: "Personal Profile" },
    { id: "address", icon: Home, label: "Address & Contact" },
    { id: "payroll", icon: CreditCard, label: "Payroll & Taxes" },
    { id: "health", icon: Stethoscope, label: "Health Insurance" },
    { id: "vacation", icon: Plane, label: "Vacation & Time Off" },
    { id: "corrective", icon: ShieldAlert, label: "Corrective Actions", badge: pendingCAs.length },
    { id: "resignation", icon: LogOut, label: "Resignation Letter" },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case "profile":
        return (
          <>
            <CardHeader className="border-b">
              <CardTitle>{t("employees.personalDetails")}</CardTitle>
              <CardDescription>Update your basic profile information.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t("employees.firstName")}</Label>
                  <Input id="firstName" value={profileForm.firstName} onChange={e => setProfileForm(f => ({ ...f, firstName: e.target.value }))} data-testid="input-first-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t("employees.lastName")}</Label>
                  <Input id="lastName" value={profileForm.lastName} onChange={e => setProfileForm(f => ({ ...f, lastName: e.target.value }))} data-testid="input-last-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("common.email")}</Label>
                  <Input id="email" value={profileForm.personalEmail} onChange={e => setProfileForm(f => ({ ...f, personalEmail: e.target.value }))} data-testid="input-email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("common.phone")}</Label>
                  <Input id="phone" value={profileForm.personalPhone} onChange={e => setProfileForm(f => ({ ...f, personalPhone: e.target.value }))} placeholder="(555) 123-4567" data-testid="input-phone" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">{t("employees.startDate")}</Label>
                  <Input id="startDate" type="date" defaultValue={myEmployee?.startDate || ""} readOnly className="bg-muted" data-testid="input-start-date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">{t("employees.department")}</Label>
                  <Input id="department" defaultValue={myEmployee?.department || myEmployee?.jobTitle || ""} readOnly className="bg-muted" data-testid="input-department" />
                </div>
              </div>

              <div className="pt-6 border-t space-y-4">
                <h3 className="font-heading font-bold text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" /> {t("employees.emergencyContact")}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t("common.name")}</Label>
                    <Input value={profileForm.emergencyContactName} onChange={e => setProfileForm(f => ({ ...f, emergencyContactName: e.target.value }))} placeholder="Jane Doe" data-testid="input-emergency-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("common.type")}</Label>
                    <Input value={profileForm.emergencyContactRelationship} onChange={e => setProfileForm(f => ({ ...f, emergencyContactRelationship: e.target.value }))} placeholder="Spouse" data-testid="input-emergency-relationship" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("common.phone")}</Label>
                    <Input value={profileForm.emergencyContactPhone} onChange={e => setProfileForm(f => ({ ...f, emergencyContactPhone: e.target.value }))} placeholder="(555) 987-6543" data-testid="input-emergency-phone" />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t flex justify-end gap-3">
                <Button variant="outline" disabled={saveProfileMutation.isPending} onClick={() => {
                  if (myEmployee) setProfileForm({
                    firstName: myEmployee.firstName || "",
                    lastName: myEmployee.lastName || "",
                    personalEmail: myEmployee.personalEmail || "",
                    personalPhone: myEmployee.personalPhone || "",
                    emergencyContactName: myEmployee.emergencyContactName || "",
                    emergencyContactRelationship: myEmployee.emergencyContactRelationship || "",
                    emergencyContactPhone: myEmployee.emergencyContactPhone || "",
                  });
                }}>{t("common.cancel")}</Button>
                <Button className="gap-2" disabled={saveProfileMutation.isPending} onClick={() => saveProfileMutation.mutate(profileForm)} data-testid="button-save-profile">
                  {saveProfileMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> {t("common.saveChanges")}</>}
                </Button>
              </div>
            </CardContent>
          </>
        );

      case "address":
        return (
          <>
            <CardHeader className="border-b">
              <CardTitle>Address & Contact</CardTitle>
              <CardDescription>Keep your mailing address up to date for tax documents.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="street">Street Address</Label>
                  <Input id="street" value={addressForm.address} onChange={e => setAddressForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Landscape Way" data-testid="input-street" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" value={addressForm.city} onChange={e => setAddressForm(f => ({ ...f, city: e.target.value }))} placeholder="Garden City" data-testid="input-city" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" value={addressForm.state} onChange={e => setAddressForm(f => ({ ...f, state: e.target.value }))} placeholder="OH" data-testid="input-state" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input id="zip" value={addressForm.zip} onChange={e => setAddressForm(f => ({ ...f, zip: e.target.value }))} placeholder="12345" data-testid="input-zip" />
                  </div>
                </div>
              </div>
              <div className="pt-6 border-t flex justify-end gap-3">
                <Button variant="outline" disabled={saveAddressMutation.isPending} onClick={() => {
                  if (myEmployee) setAddressForm({ address: myEmployee.address || "", city: myEmployee.city || "", state: myEmployee.state || "", zip: myEmployee.zip || "" });
                }}>Discard Changes</Button>
                <Button className="gap-2" disabled={saveAddressMutation.isPending} onClick={() => saveAddressMutation.mutate(addressForm)} data-testid="button-save-address">
                  {saveAddressMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Address</>}
                </Button>
              </div>
            </CardContent>
          </>
        );

      case "payroll":
        return (
          <>
            <CardHeader className="border-b">
              <CardTitle>Payroll & Tax Settings</CardTitle>
              <CardDescription>Direct deposit, tax withholdings, and W-4 information.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-start gap-4 p-4 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950/20 dark:border-amber-800">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-200">Contact HR to Update</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">Changes to direct deposit, routing numbers, and tax withholdings must be processed by HR. Please reach out to your HR administrator directly.</p>
                </div>
              </div>
            </CardContent>
          </>
        );

      case "health":
        return (
          <>
            <CardHeader className="border-b">
              <CardTitle>Health Insurance & Benefits</CardTitle>
              <CardDescription>Your health insurance elections and benefit enrollments.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-start gap-4 p-4 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950/20 dark:border-amber-800">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-200">Contact HR to Update</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">Benefit elections, plan changes, and beneficiary updates must be processed by HR. Please contact your HR administrator or wait for the open enrollment period (November 1 – November 30).</p>
                </div>
              </div>
            </CardContent>
          </>
        );

      case "vacation":
        return (
          <>
            <CardHeader className="border-b">
              <CardTitle>Vacation & Time Off</CardTitle>
              <CardDescription>Request time off and view your request history.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {!myEmployee && !empLoading && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  No employee record is linked to your account. Contact your administrator to set up your employee profile before submitting time off requests.
                </div>
              )}

              <div className="pt-2 border-t space-y-4">
                <h3 className="font-heading font-bold text-lg">Request Time Off</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={ptoType}
                      onChange={(e) => setPtoType(e.target.value)}
                      data-testid="select-pto-type"
                    >
                      {REQUEST_TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={ptoStart} onChange={(e) => setPtoStart(e.target.value)} data-testid="input-pto-start" />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={ptoEnd} onChange={(e) => setPtoEnd(e.target.value)} data-testid="input-pto-end" />
                  </div>
                </div>

                {ptoDays > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{ptoDays}</span> business day{ptoDays !== 1 ? "s" : ""} requested
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Textarea
                    placeholder="Any details your manager should know..."
                    value={ptoNotes}
                    onChange={(e) => setPtoNotes(e.target.value)}
                    rows={2}
                    data-testid="textarea-pto-notes"
                  />
                </div>

                <Button
                  onClick={() => submitPTO.mutate()}
                  disabled={submitPTO.isPending || !myEmployee}
                  data-testid="button-submit-pto"
                >
                  {submitPTO.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                  ) : "Submit Request"}
                </Button>
              </div>

              <div className="pt-6 border-t space-y-4">
                <h3 className="font-heading font-bold text-lg">My Requests</h3>
                {torLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
                ) : timeOffRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No time off requests yet.</p>
                ) : (
                  <div className="space-y-2">
                    {timeOffRequests.map((req: any) => (
                      <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border" data-testid={`tor-row-${req.id}`}>
                        <div className="flex items-center gap-3">
                          {STATUS_ICON[req.status] || <AlertCircle className="w-4 h-4 text-muted-foreground" />}
                          <div>
                            <p className="font-medium text-sm">
                              {req.request_type} — {req.start_date} to {req.end_date}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {req.total_days} day{req.total_days !== 1 ? "s" : ""}
                              {req.notes ? ` · ${req.notes}` : ""}
                              {req.review_notes ? ` · Note: ${req.review_notes}` : ""}
                            </p>
                          </div>
                        </div>
                        <Badge className={STATUS_COLORS[req.status] || ""}>{req.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </>
        );

      case "corrective":
        return (
          <>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-orange-500" />
                Corrective Action Reports
                {pendingCAs.length > 0 && (
                  <Badge className="bg-red-100 text-red-700 border-red-300 ml-1">{pendingCAs.length} Pending Signature</Badge>
                )}
              </CardTitle>
              <CardDescription>Records of any corrective actions issued to you. Pending reports require your signature.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {(correctiveActions as any[]).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
                  <ShieldAlert className="w-10 h-10 opacity-20" />
                  <p className="text-sm">No corrective action reports on file.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(correctiveActions as any[]).map((ca: any) => (
                    <div key={ca.id} className="border rounded-lg p-4 space-y-2" data-testid={`ca-row-${ca.id}`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Badge className={cn("border text-xs", CA_ACTION_COLORS[ca.action_taken] || "bg-gray-100 text-gray-800")}>{ca.action_taken}</Badge>
                          <span className="text-sm text-muted-foreground">Incident: {ca.date_of_incident}</span>
                        </div>
                        <Badge variant="outline" className={ca.status === "Signed" ? "text-green-700 border-green-300 bg-green-50" : "text-amber-700 border-amber-300 bg-amber-50"}>
                          {ca.status === "Signed" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                          {ca.status}
                        </Badge>
                      </div>
                      <p className="text-sm">{ca.description_of_issue}</p>
                      <div className="flex gap-2 pt-1">
                        {ca.status === "Pending Signature" ? (
                          <Button size="sm" variant="destructive" onClick={() => { setForcedCAModal(ca); setCASignature(""); setCASignMode("type"); }} data-testid={`btn-sign-ca-${ca.id}`}>
                            <PenLine className="w-3.5 h-3.5 mr-1" /> Review & Sign
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setViewCAOpen(ca)} data-testid={`btn-view-ca-${ca.id}`}>
                            <FileText className="w-3.5 h-3.5 mr-1" /> View Report
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </>
        );

      case "resignation":
        return (
          <>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <LogOut className="w-5 h-5 text-destructive" />
                Resignation Letter
              </CardTitle>
              <CardDescription>
                Submit a formal resignation notice. Your manager and HR will be notified immediately.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {!myEmployee && !empLoading && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 mb-4">
                  No employee record is linked to your account. Contact your administrator.
                </div>
              )}

              {resignationLetters.length > 0 ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-800 text-sm">Resignation Letter on File</p>
                      <p className="text-xs text-green-700 mt-0.5">Submitted on {new Date(resignationLetters[0].submitted_at).toLocaleDateString()}. Last day: {resignationLetters[0].last_day_of_work}.</p>
                    </div>
                  </div>
                  <div className="border rounded-lg p-4 space-y-3 text-sm">
                    {resignationLetters[0].reason_for_leaving && (
                      <div><Label className="text-xs text-muted-foreground">Reason for Leaving</Label><p className="mt-0.5">{resignationLetters[0].reason_for_leaving}</p></div>
                    )}
                    {resignationLetters[0].signature_data_url && (
                      <div><Label className="text-xs text-muted-foreground">Your Signature</Label><img src={resignationLetters[0].signature_data_url} alt="Signature" className="h-14 border rounded bg-white p-1 mt-1" /></div>
                    )}
                  </div>
                </div>
              ) : myEmployee ? (
                <ResignationLetterForm
                  employeeId={myEmployee.id}
                  employeeName={`${myEmployee.firstName} ${myEmployee.lastName}`}
                  onComplete={() => queryClient.invalidateQueries({ queryKey: ["/api/employees", myEmployee.id, "resignation-letters"] })}
                />
              ) : (
                <div className="text-sm text-muted-foreground">Loading employee record...</div>
              )}
            </CardContent>
          </>
        );
    }
  };

  // ── Forced corrective action sign modal (no dismiss until signed) ────────────
  const ForcedCAModal = forcedCAModal ? (
    <Dialog open modal>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-500" />
            <DialogTitle>Corrective Action Report — Signature Required</DialogTitle>
          </div>
          <DialogDescription>
            This report has been issued by management. You must review and acknowledge it with your signature before continuing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Report details */}
          <div className="bg-muted/40 border rounded-lg p-4 space-y-3 text-sm">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className={cn("border", CA_ACTION_COLORS[forcedCAModal.action_taken] || "bg-gray-100 text-gray-800")}>
                {forcedCAModal.action_taken}
              </Badge>
              <span className="text-muted-foreground text-xs">Date of Incident: <strong className="text-foreground">{forcedCAModal.date_of_incident}</strong></span>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Description of Issue</Label>
              <p className="mt-1 whitespace-pre-wrap">{forcedCAModal.description_of_issue}</p>
            </div>
            {forcedCAModal.previous_warnings && (
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Previous Warnings</Label>
                <p className="mt-1">{forcedCAModal.previous_warnings_description || "Yes"}</p>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Manager Signature</Label>
              {forcedCAModal.manager_signature ? (
                <img src={forcedCAModal.manager_signature} alt="Manager signature" className="h-14 border rounded bg-white p-1 mt-1" />
              ) : <p className="mt-1 text-muted-foreground italic">On file</p>}
              <p className="text-xs text-muted-foreground">{forcedCAModal.manager_signature_date}</p>
            </div>
          </div>

          <Separator />

          {/* Employee signature section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <PenLine className="w-4 h-4 text-primary" />
              Your Acknowledgment Signature
            </h3>
            <p className="text-xs text-muted-foreground">
              By signing, you confirm you have received and read this corrective action report. This does not necessarily mean you agree with its contents.
            </p>

            {/* Sign mode tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-md w-fit">
              <button
                onClick={() => { setCASignMode("type"); setCASignature(""); }}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors", caSignMode === "type" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}
              >
                <Type className="w-3.5 h-3.5" /> Type
              </button>
              <button
                onClick={() => { setCASignMode("draw"); setCASignature(""); }}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors", caSignMode === "draw" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}
              >
                <Pen className="w-3.5 h-3.5" /> Draw
              </button>
            </div>

            {caSignMode === "type" ? (
              <TypedSignatureInline onChange={setCASignature} />
            ) : (
              <SignaturePad value={caSignature} onChange={setCASignature} />
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => {
                if (!caSignature) { toast({ title: "Signature required", description: "Please sign before submitting.", variant: "destructive" }); return; }
                signCAmutation.mutate({ id: forcedCAModal.id, signatureDataUrl: caSignature });
              }}
              disabled={signCAmutation.isPending || !caSignature}
              className="gap-2"
              data-testid="button-submit-ca-signature"
            >
              {signCAmutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Acknowledge & Sign</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;

  // ── Read-only view modal for signed CAs ───────────────────────────────────
  const ViewCAModal = viewCAOpen ? (
    <Dialog open onOpenChange={() => setViewCAOpen(null)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> Corrective Action Report
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={cn("border", CA_ACTION_COLORS[viewCAOpen.action_taken] || "")}>{viewCAOpen.action_taken}</Badge>
            <span className="text-muted-foreground text-xs">Incident: {viewCAOpen.date_of_incident}</span>
            <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50"><CheckCircle2 className="w-3 h-3 mr-1" /> Signed</Badge>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Description</Label>
            <p className="mt-1 whitespace-pre-wrap">{viewCAOpen.description_of_issue}</p>
          </div>
          {viewCAOpen.previous_warnings && (
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Previous Warnings</Label>
              <p className="mt-1">{viewCAOpen.previous_warnings_description || "Yes"}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Manager Signature</Label>
              {viewCAOpen.manager_signature && <img src={viewCAOpen.manager_signature} alt="Manager" className="h-14 border rounded bg-white p-1 mt-1" />}
              <p className="text-xs text-muted-foreground">{viewCAOpen.manager_signature_date}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Your Signature</Label>
              {viewCAOpen.employee_acknowledgment_signature && <img src={viewCAOpen.employee_acknowledgment_signature} alt="Your signature" className="h-14 border rounded bg-white p-1 mt-1" />}
              <p className="text-xs text-muted-foreground">{viewCAOpen.employee_acknowledgment_date}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {ForcedCAModal}
      {ViewCAModal}

      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Employee Portal</h1>
          <p className="text-muted-foreground">
            {myEmployee ? `${myEmployee.firstName} ${myEmployee.lastName} · ${myEmployee.jobTitle || "Team Member"}` : "Manage your personal information and benefits."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <Card className="lg:col-span-1 h-fit">
          <nav className="p-2 space-y-1">
            {navItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3",
                  activeSection === item.id ? "bg-secondary" : "",
                  item.id === "resignation" ? "text-destructive hover:text-destructive hover:bg-destructive/10" : "",
                  item.id === "corrective" && pendingCAs.length > 0 ? "text-orange-600" : ""
                )}
                onClick={() => setActiveSection(item.id)}
                data-testid={`nav-${item.id}`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge ? (
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">{item.badge}</span>
                ) : null}
              </Button>
            ))}
          </nav>
        </Card>

        <Card className="lg:col-span-3">
          {empLoading ? (
            <div className="p-8 flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading your employee record...
            </div>
          ) : renderSection()}
        </Card>
      </div>
    </div>
  );
}
