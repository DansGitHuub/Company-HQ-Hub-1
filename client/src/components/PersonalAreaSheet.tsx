import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Profile from "@/pages/Profile";
import EmployeePortal from "@/pages/EmployeePortal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DollarSign, TrendingUp, Clock, Calendar,
  Loader2, AlertCircle, CheckCircle2, Plane, Info,
} from "lucide-react";

const REQUEST_TYPE_OPTIONS = [
  "Vacation", "Sick Leave", "Personal Day", "Unpaid Leave", "Bereavement", "Other",
];

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
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function MyPayPanel() {
  const { t } = useTranslation();

  const { data: myEmployee, isLoading: empLoading } = useQuery({
    queryKey: ["/api/employees/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/employees/me");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: payPeriod, isLoading: ppLoading } = useQuery({
    queryKey: ["/api/time/my-hours/pay-period"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/time/my-hours/pay-period");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const { data: payHistory = [], isLoading: phLoading } = useQuery({
    queryKey: ["/api/employees/me/pay-history"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/employees/me/pay-history");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  if (empLoading || ppLoading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>{t("common.loading")}</span>
      </div>
    );
  }

  if (!myEmployee) {
    return (
      <div className="p-6">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          {t("personalArea.pay.noPayData")}
        </div>
      </div>
    );
  }

  const payRate = parseFloat(myEmployee.payRate || "0");
  const payType = myEmployee.payType || "";
  const payPeriodLabel = myEmployee.payPeriod || "";
  const paymentMethod = myEmployee.paymentMethod || "";
  const isHourly = payType.toLowerCase().includes("hour") || payType.toLowerCase().includes("hourly");

  const regularHours = parseFloat(payPeriod?.summary?.regularHours || "0");
  const overtimeHours = parseFloat(payPeriod?.summary?.overtimeHours || "0");
  const daysWorked = payPeriod?.summary?.daysWorked || 0;

  const estimatedGross = regularHours * payRate + overtimeHours * payRate * 1.5;
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">{t("personalArea.pay.currentPeriod")}</CardTitle>
          </div>
          {payPeriod && (
            <CardDescription>
              {payPeriod.payPeriodStart} — {payPeriod.payPeriodEnd}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{regularHours.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("personalArea.pay.regularHours")}</p>
            </div>
            {overtimeHours > 0 ? (
              <div className="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-100">
                <p className="text-2xl font-bold text-orange-600">{overtimeHours.toFixed(1)}</p>
                <p className="text-xs text-orange-600/80 mt-1">{t("personalArea.pay.overtimeHours")}</p>
              </div>
            ) : (
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">0.0</p>
                <p className="text-xs text-muted-foreground mt-1">{t("personalArea.pay.overtimeHours")}</p>
              </div>
            )}
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{daysWorked}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("personalArea.pay.daysWorked")}</p>
            </div>
            {isHourly && payRate > 0 ? (
              <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-2xl font-bold text-primary">{fmt(estimatedGross)}</p>
                <p className="text-xs text-primary/70 mt-1">{t("personalArea.pay.estimatedGross")}</p>
              </div>
            ) : (
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">—</p>
                <p className="text-xs text-muted-foreground mt-1">{t("personalArea.pay.estimatedGross")}</p>
              </div>
            )}
          </div>
          {isHourly && payRate > 0 && (
            <p className="text-xs text-muted-foreground mt-4 flex items-start gap-1.5">
              <Info className="w-3 h-3 shrink-0 mt-0.5" />
              {t("personalArea.pay.estimatedNote")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">{t("personalArea.pay.payInfo")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">{t("personalArea.pay.currentRate")}</dt>
              <dd className="font-semibold mt-0.5">{payRate > 0 ? `$${payRate.toFixed(2)}/hr` : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">{t("personalArea.pay.payType")}</dt>
              <dd className="font-semibold mt-0.5">{payType || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">{t("personalArea.pay.payPeriodLabel")}</dt>
              <dd className="font-semibold mt-0.5">{payPeriodLabel || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">{t("personalArea.pay.paymentMethod")}</dt>
              <dd className="font-semibold mt-0.5">{paymentMethod || "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">{t("personalArea.pay.rateHistory")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {phLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> {t("common.loading")}
            </div>
          ) : (payHistory as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("personalArea.pay.noHistory")}</p>
          ) : (
            <div className="space-y-2">
              {(payHistory as any[]).map((h: any) => (
                <div
                  key={h.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border text-sm"
                  data-testid={`pay-history-row-${h.id}`}
                >
                  <div className="flex-1">
                    <span className="font-medium">
                      ${h.old_rate} → ${h.new_rate}
                    </span>
                    {h.reason && (
                      <span className="text-muted-foreground ml-2">· {h.reason}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {h.created_at ? new Date(h.created_at).toLocaleDateString() : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TimeOffPanel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
      const res = await apiRequest(
        "GET",
        `/api/employees/${myEmployee!.id}/time-off-requests`
      );
      return res.json();
    },
    enabled: !!myEmployee?.id,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const submitPTO = useMutation({
    mutationFn: async () => {
      if (!myEmployee?.id) throw new Error(t("personalArea.timeoff.noEmployeeRecord"));
      if (!ptoStart || !ptoEnd) throw new Error(t("personalArea.timeoff.selectDates"));
      if (ptoDays <= 0) throw new Error(t("personalArea.timeoff.invalidDates"));
      const res = await apiRequest("POST", "/api/time-off-requests", {
        employeeId: myEmployee.id,
        requestType: ptoType,
        startDate: ptoStart,
        endDate: ptoEnd,
        totalDays: ptoDays,
        notes: ptoNotes || null,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t("personalArea.timeoff.submitSuccess"),
        description: t("personalArea.timeoff.submitSuccessDesc"),
      });
      setPtoStart("");
      setPtoEnd("");
      setPtoNotes("");
      setPtoType("Vacation");
      queryClient.invalidateQueries({
        queryKey: ["/api/employees", myEmployee?.id, "time-off-requests"],
      });
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      {!myEmployee && !empLoading && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          {t("personalArea.timeoff.noEmployeeRecord")}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">{t("personalArea.timeoff.requestTitle")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t("personalArea.timeoff.requestType")}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={ptoType}
                onChange={(e) => setPtoType(e.target.value)}
                data-testid="select-personal-pto-type"
              >
                {REQUEST_TYPE_OPTIONS.map((opt) => (
                  <option key={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("personalArea.timeoff.startDate")}</Label>
              <Input
                type="date"
                value={ptoStart}
                onChange={(e) => setPtoStart(e.target.value)}
                data-testid="input-personal-pto-start"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("personalArea.timeoff.endDate")}</Label>
              <Input
                type="date"
                value={ptoEnd}
                onChange={(e) => setPtoEnd(e.target.value)}
                data-testid="input-personal-pto-end"
              />
            </div>
          </div>

          {ptoDays > 0 && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{ptoDays}</span>{" "}
              {ptoDays !== 1
                ? t("personalArea.timeoff.businessDaysPlural")
                : t("personalArea.timeoff.businessDays")}{" "}
              {t("personalArea.timeoff.requested")}
            </p>
          )}

          <div className="space-y-2">
            <Label>{t("personalArea.timeoff.notesOptional")}</Label>
            <Textarea
              placeholder={t("personalArea.timeoff.notesPlaceholder")}
              value={ptoNotes}
              onChange={(e) => setPtoNotes(e.target.value)}
              rows={2}
              data-testid="textarea-personal-pto-notes"
            />
          </div>

          <Button
            onClick={() => submitPTO.mutate()}
            disabled={submitPTO.isPending || !myEmployee}
            data-testid="button-personal-submit-pto"
          >
            {submitPTO.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("personalArea.timeoff.submitting")}
              </>
            ) : (
              t("personalArea.timeoff.submit")
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">{t("personalArea.timeoff.history")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {torLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> {t("common.loading")}
            </div>
          ) : (timeOffRequests as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("personalArea.timeoff.noRequests")}</p>
          ) : (
            <div className="space-y-2">
              {(timeOffRequests as any[]).map((req: any) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                  data-testid={`personal-tor-row-${req.id}`}
                >
                  <div className="flex items-center gap-3">
                    {STATUS_ICON[req.status] || (
                      <AlertCircle className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium text-sm">
                        {req.request_type} — {req.start_date}{" "}
                        {t("personalArea.timeoff.to")} {req.end_date}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {req.total_days}{" "}
                        {req.total_days !== 1
                          ? t("personalArea.timeoff.businessDaysPlural")
                          : t("personalArea.timeoff.businessDays")}
                        {req.notes ? ` · ${req.notes}` : ""}
                        {req.review_notes ? ` · ${req.review_notes}` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge className={STATUS_COLORS[req.status] || ""}>{req.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PersonalAreaSheet({
  open,
  onOpenChange,
  defaultTab,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTab?: "pay" | "info" | "preferences" | "timeoff";
}) {
  const { user, effectiveRole, previewRole } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"pay" | "info" | "preferences" | "timeoff">(
    defaultTab || "pay"
  );

  React.useEffect(() => {
    if (open && defaultTab) setActiveTab(defaultTab);
  }, [open, defaultTab]);

  const initials =
    user?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase() || "?";
  const displayRole = previewRole || effectiveRole || user?.role;

  const TAB_LABELS: Record<string, string> = {
    pay: t("personalArea.tabs.pay"),
    info: t("personalArea.tabs.info"),
    preferences: t("personalArea.tabs.preferences"),
    timeoff: t("personalArea.tabs.timeoff"),
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="p-0 sm:max-w-[1000px] w-full border-l shadow-2xl flex flex-col overflow-hidden"
      >
        <SheetTitle className="sr-only">{t("personalArea.title")}</SheetTitle>

        <div className="shrink-0 p-4 border-b flex items-center gap-3 bg-muted/30">
          <Avatar className="h-10 w-10 border-2 border-primary/20 shrink-0">
            <AvatarFallback className="bg-primary/10 font-bold text-primary text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-none truncate">
              {t("personalArea.title")}
            </h2>
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {user?.name} ·{" "}
              <span className="uppercase text-xs font-semibold tracking-wide">
                {displayRole}
              </span>
            </p>
          </div>
        </div>

        <div className="shrink-0 flex border-b bg-background">
          {(["pay", "info", "preferences", "timeoff"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              data-testid={`personal-tab-${tab}`}
              className={cn(
                "flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2",
                activeTab === tab
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === "pay" && <MyPayPanel />}
          {activeTab === "info" && <EmployeePortal />}
          {activeTab === "preferences" && <Profile />}
          {activeTab === "timeoff" && <TimeOffPanel />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
