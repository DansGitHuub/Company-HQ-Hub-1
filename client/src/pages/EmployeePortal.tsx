import React, { useState, useMemo } from "react";
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
import { useToast } from "@/hooks/use-toast";
import {
  User, Home, CreditCard, Stethoscope, Plane, Save,
  Shield, Calendar, Clock, DollarSign, Heart, Umbrella,
  CheckCircle2, AlertCircle, FileText, LogOut, Loader2,
  ClipboardList
} from "lucide-react";
import ResignationLetterForm from "@/components/forms/ResignationLetterForm";

type Section = "profile" | "address" | "payroll" | "health" | "vacation" | "resignation";

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

  const ptoDays = calcDays(ptoStart, ptoEnd);

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

  const handleSave = () => {
    toast({ title: t("common.saved"), description: t("common.changesSaved") });
  };
  const handleDiscard = () => {
    toast({ title: t("common.cancelled"), description: t("common.changesSaved") });
  };

  const navItems: { id: Section; icon: React.ElementType; label: string }[] = [
    { id: "profile", icon: User, label: "Personal Profile" },
    { id: "address", icon: Home, label: "Address & Contact" },
    { id: "payroll", icon: CreditCard, label: "Payroll & Taxes" },
    { id: "health", icon: Stethoscope, label: "Health Insurance" },
    { id: "vacation", icon: Plane, label: "Vacation & Time Off" },
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
                  <Input id="firstName" defaultValue={myEmployee?.firstName || user?.name?.split(" ")[0] || ""} data-testid="input-first-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t("employees.lastName")}</Label>
                  <Input id="lastName" defaultValue={myEmployee?.lastName || user?.name?.split(" ").slice(1).join(" ") || ""} data-testid="input-last-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("common.email")}</Label>
                  <Input id="email" defaultValue={myEmployee?.personalEmail || user?.email || ""} data-testid="input-email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("common.phone")}</Label>
                  <Input id="phone" defaultValue={myEmployee?.personalPhone || ""} placeholder="(555) 123-4567" data-testid="input-phone" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">{t("employees.startDate")}</Label>
                  <Input id="startDate" type="date" defaultValue={myEmployee?.startDate || ""} data-testid="input-start-date" />
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
                    <Input defaultValue={myEmployee?.emergencyContactName || ""} placeholder="Jane Doe" data-testid="input-emergency-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("common.type")}</Label>
                    <Input defaultValue={myEmployee?.emergencyContactRelationship || ""} placeholder="Spouse" data-testid="input-emergency-relationship" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("common.phone")}</Label>
                    <Input defaultValue={myEmployee?.emergencyContactPhone || ""} placeholder="(555) 987-6543" data-testid="input-emergency-phone" />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t flex justify-end gap-3">
                <Button variant="outline" onClick={handleDiscard}>{t("common.cancel")}</Button>
                <Button className="gap-2" onClick={handleSave} data-testid="button-save-profile">
                  <Save className="w-4 h-4" /> {t("common.saveChanges")}
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
                  <Input id="street" defaultValue={myEmployee?.address || ""} placeholder="123 Landscape Way" data-testid="input-street" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" defaultValue={myEmployee?.city || ""} placeholder="Garden City" data-testid="input-city" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" defaultValue={myEmployee?.state || ""} placeholder="OH" data-testid="input-state" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input id="zip" defaultValue={myEmployee?.zip || ""} placeholder="12345" data-testid="input-zip" />
                  </div>
                </div>
              </div>
              <div className="pt-6 border-t flex justify-end gap-3">
                <Button variant="outline" onClick={handleDiscard}>Discard Changes</Button>
                <Button className="gap-2" onClick={handleSave} data-testid="button-save-address"><Save className="w-4 h-4" /> Save Address</Button>
              </div>
            </CardContent>
          </>
        );

      case "payroll":
        return (
          <>
            <CardHeader className="border-b">
              <CardTitle>Payroll & Tax Settings</CardTitle>
              <CardDescription>Manage direct deposit and tax withholdings.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <h3 className="font-heading font-bold text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" /> Direct Deposit
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input placeholder="First National Bank" data-testid="input-bank-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="select-account-type">
                      <option>Checking</option>
                      <option>Savings</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Routing Number</Label>
                    <Input type="password" placeholder="•••••••••" data-testid="input-routing" />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input type="password" placeholder="•••••••••••••" data-testid="input-account" />
                  </div>
                </div>
              </div>
              <div className="pt-6 border-t space-y-4">
                <h3 className="font-heading font-bold text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" /> Tax Withholding (W-4)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Filing Status</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="select-filing-status">
                      <option>Single or Married filing separately</option>
                      <option>Married filing jointly</option>
                      <option>Head of household</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Number of Dependents</Label>
                    <Input type="number" defaultValue="0" min="0" data-testid="input-dependents" />
                  </div>
                  <div className="space-y-2">
                    <Label>Extra Withholding per Paycheck</Label>
                    <Input type="number" placeholder="$0.00" data-testid="input-extra-withholding" />
                  </div>
                </div>
              </div>
              <div className="pt-6 border-t flex justify-end gap-3">
                <Button variant="outline" onClick={handleDiscard}>Discard Changes</Button>
                <Button className="gap-2" onClick={handleSave} data-testid="button-save-payroll"><Save className="w-4 h-4" /> Save Payroll Settings</Button>
              </div>
            </CardContent>
          </>
        );

      case "health":
        return (
          <>
            <CardHeader className="border-b">
              <CardTitle>Health Insurance & Benefits</CardTitle>
              <CardDescription>View and manage your health insurance elections.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Heart className="w-6 h-6 text-green-600" />
                      <div>
                        <h4 className="font-bold">Medical Insurance</h4>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">Enrolled</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">Premium Health Plan - PPO</p>
                    <p className="text-xs text-muted-foreground mt-1">Coverage: Employee + Family</p>
                    <p className="text-sm font-medium mt-2">$185.00/paycheck</p>
                  </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Stethoscope className="w-6 h-6 text-blue-600" />
                      <div>
                        <h4 className="font-bold">Dental Insurance</h4>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">Enrolled</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">Dental Plus Plan</p>
                    <p className="text-xs text-muted-foreground mt-1">Coverage: Employee + Family</p>
                    <p className="text-sm font-medium mt-2">$35.00/paycheck</p>
                  </CardContent>
                </Card>
                <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Umbrella className="w-6 h-6 text-purple-600" />
                      <div>
                        <h4 className="font-bold">Vision Insurance</h4>
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800">Enrolled</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">Vision Care Basic</p>
                    <p className="text-xs text-muted-foreground mt-1">Coverage: Employee Only</p>
                    <p className="text-sm font-medium mt-2">$12.00/paycheck</p>
                  </CardContent>
                </Card>
                <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Shield className="w-6 h-6 text-orange-600" />
                      <div>
                        <h4 className="font-bold">Life Insurance</h4>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">Enrolled</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">Basic Life - 2x Salary</p>
                    <p className="text-xs text-muted-foreground mt-1">Beneficiary: Jane Doe</p>
                    <p className="text-sm font-medium mt-2">Company Paid</p>
                  </CardContent>
                </Card>
              </div>
              <div className="pt-6 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Open Enrollment Period</p>
                    <p className="font-medium">November 1 - November 30</p>
                  </div>
                  <Button variant="outline" onClick={() => toast({ title: "Benefits Guide", description: "Contact HR for your benefits guide." })}>View Benefits Guide</Button>
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

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
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
                className={`w-full justify-start gap-3 ${activeSection === item.id ? "bg-secondary" : ""} ${item.id === "resignation" ? "text-destructive hover:text-destructive hover:bg-destructive/10" : ""}`}
                onClick={() => setActiveSection(item.id)}
                data-testid={`nav-${item.id}`}
              >
                <item.icon className="w-4 h-4" /> {item.label}
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
