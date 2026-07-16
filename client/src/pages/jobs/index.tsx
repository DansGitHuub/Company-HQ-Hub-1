import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Search, Briefcase, ChevronRight, Calendar,
  Mail, MessageSquare, Send, Loader2, AlertCircle, AlertTriangle, CheckCircle2, Download, Pin,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { JobFormModal, EMPTY_JOB } from "./JobFormModal";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { downloadCsv } from "@/lib/csv-export";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface JobRow {
  id: string; title: string; client: string; status: string;
  job_type: string | null; type: string | null;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  progress: number | null;
  is_behind_schedule: boolean;
  has_work_order: boolean;
  price: string | null; value: number | null;
  customer_id: string | null;
  cust_first: string | null; cust_last: string | null; cust_company: string | null;
  prop_address: string | null; prop_city: string | null;
  created_at: string;
}

// ── Status display ────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { labelKey: string; cls: string }> = {
  lead:        { labelKey: "lead",        cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  scheduled:   { labelKey: "scheduled",   cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  in_progress: { labelKey: "inProgress",  cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  completed:   { labelKey: "completed",   cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  invoiced:    { labelKey: "invoiced",    cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  cancelled:   { labelKey: "cancelled",   cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("jobs");
  const s = STATUS_MAP[status] ?? { labelKey: null, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>
      {s.labelKey ? t(s.labelKey) : status}
    </span>
  );
}

function BehindScheduleBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ml-1">
      <AlertCircle className="w-3 h-3" />
      Behind Schedule
    </span>
  );
}

function NoWorkOrderBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 ml-1" data-testid="badge-no-work-order">
      <AlertTriangle className="w-3 h-3" />
      No Work Order
    </span>
  );
}

function custName(j: JobRow) {
  if (!j.customer_id) return "—";
  if (j.cust_first && j.cust_last) return `${j.cust_first} ${j.cust_last}`;
  if (j.cust_company) return j.cust_company;
  return j.client || "—";
}

function propAddr(j: JobRow) {
  if (!j.prop_address) return "—";
  return j.prop_city ? `${j.prop_address}, ${j.prop_city}` : j.prop_address;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

function fmtMoney(v: any) {
  const n = Number(v);
  if (!v && v !== 0) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Contact Customer Dialog ───────────────────────────────────────────────────
function ContactDialog({ job, onClose }: { job: JobRow; onClose: () => void }) {
  const { toast } = useToast();
  const name = custName(job);
  const jobTitle = job.title || job.client || "your job";

  const [viaEmail, setViaEmail] = useState(true);
  const [viaSms, setViaSms] = useState(false);
  const [subject, setSubject] = useState(`Following up on your job with Chapin Landscapes`);
  const [message, setMessage] = useState(
    `Hi ${name},\n\nWe wanted to follow up regarding "${jobTitle}". We'd love to get this scheduled for you!\n\nPlease give us a call or reply to this message and we'll get everything set up.\n\nThank you,\nChapin Landscapes`
  );
  const [result, setResult] = useState<Record<string, string> | null>(null);

  const sendMut = useMutation({
    mutationFn: async () => {
      const via: string[] = [];
      if (viaEmail) via.push("email");
      if (viaSms) via.push("sms");
      const res = await apiRequest("POST", `/api/jobs/${job.id}/contact-customer`, { via, subject, message });
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data.results);
    },
    onError: () => {
      toast({ title: "Failed to send", variant: "destructive" });
    },
  });

  const resultLabel: Record<string, { icon: React.ReactNode; text: string; color: string }> = {
    sent:           { icon: <CheckCircle2 className="w-4 h-4" />, text: "Sent successfully", color: "text-green-700" },
    failed:         { icon: <AlertCircle className="w-4 h-4" />, text: "Failed to send", color: "text-red-600" },
    no_email:       { icon: <AlertCircle className="w-4 h-4" />, text: "No email on file", color: "text-amber-600" },
    no_phone:       { icon: <AlertCircle className="w-4 h-4" />, text: "No phone on file", color: "text-amber-600" },
    not_configured: { icon: <AlertCircle className="w-4 h-4" />, text: "SMS not configured", color: "text-amber-600" },
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" />
            Contact Customer
          </DialogTitle>
        </DialogHeader>

        {result ? (
          // ── Result screen ──
          <div className="space-y-3 py-2">
            <p className="text-sm font-medium text-muted-foreground">Message sent to <span className="font-semibold text-foreground">{name}</span></p>
            {Object.entries(result).map(([channel, status]) => {
              const r = resultLabel[status] ?? { icon: null, text: status, color: "text-muted-foreground" };
              return (
                <div key={channel} className={`flex items-center gap-2 text-sm font-medium ${r.color}`}>
                  {channel === "email" ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                  <span className="capitalize">{channel}:</span>
                  {r.icon}
                  <span>{r.text}</span>
                </div>
              );
            })}
            <div className="flex justify-end pt-2">
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          // ── Compose screen ──
          <div className="space-y-4 mt-1">
            {/* To */}
            <div className="p-3 bg-muted/40 rounded-lg text-sm">
              <span className="text-muted-foreground">To: </span>
              <span className="font-medium">{name}</span>
              <span className="text-muted-foreground ml-1">({job.title || "Job"})</span>
            </div>

            {/* Send via */}
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Send via</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={viaEmail}
                    onCheckedChange={(v) => setViaEmail(!!v)}
                    data-testid="check-via-email"
                  />
                  <Mail className="w-4 h-4 text-blue-600" /> Email
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={viaSms}
                    onCheckedChange={(v) => setViaSms(!!v)}
                    data-testid="check-via-sms"
                  />
                  <MessageSquare className="w-4 h-4 text-green-600" /> Text (SMS)
                </label>
              </div>
            </div>

            {/* Subject — email only */}
            {viaEmail && (
              <div>
                <Label>Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  data-testid="input-contact-subject"
                />
              </div>
            )}

            {/* Message */}
            <div>
              <Label>Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={7}
                className="text-sm"
                data-testid="textarea-contact-message"
              />
              {viaSms && (
                <p className="text-xs text-muted-foreground mt-1">
                  SMS: {message.length} chars — keep it brief for best delivery
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={() => sendMut.mutate()}
                disabled={sendMut.isPending || (!viaEmail && !viaSms) || !message.trim()}
                data-testid="button-send-contact"
              >
                {sendMut.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Sending…</>
                  : <><Send className="w-4 h-4 mr-1" /> Send Message</>
                }
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function JobsPage() {
  const { t } = useTranslation("jobDetail");
  const { t: tJobs } = useTranslation("jobs");
  const [, navigate] = useLocation();
  const { effectiveRole } = useAuth();
  const isAdminOrManager = ["Admin", "Manager", "Master Admin"].includes(effectiveRole ?? "");

  const STATUS_TABS = [
    { value: "all",             label: tJobs("all") },
    { value: "pinned",          label: "📌 Pinned" },
    { value: "lead",            label: "Not Accepted" },
    { value: "scheduled",       label: tJobs("scheduled") },
    { value: "in_progress",     label: tJobs("inProgress") },
    { value: "completed",       label: tJobs("completed") },
    { value: "invoiced",        label: tJobs("invoiced") },
    { value: "behind_schedule", label: "Behind Schedule" },
  ];

  const [activeTab, setActiveTab] = useState(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("behind_schedule") === "true") return "behind_schedule";
    const s = sp.get("status");
    if (s && s !== "all") return s;
    return "all";
  });
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [contactJob, setContactJob] = useState<JobRow | null>(null);
  const { isFavorited, toggleFavorite, favoritedIds } = useFavorites("job");

  // Build query params
  const params = new URLSearchParams();
  if (activeTab === "behind_schedule") {
    params.set("behind_schedule", "true");
  } else if (activeTab !== "all" && activeTab !== "pinned") {
    params.set("status", activeTab);
  }
  if (search.trim()) params.set("search", search.trim());
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);

  const { data: jobs = [], isLoading } = useQuery<JobRow[]>({
    queryKey: ["/api/jobs", activeTab, search, dateFrom, dateTo],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs?${params.toString()}`);
      return res.json();
    },
  });

  const pinnedIds = favoritedIds("job");
  const displayedJobs = activeTab === "pinned"
    ? jobs.filter((j) => pinnedIds.has(String(j.id)))
    : jobs;

  function handleExportCsv() {
    const headers = [
      "Job Title", "Customer", "Property", "Type", "Scheduled Date", "Status",
      ...(isAdminOrManager ? ["Price"] : []),
    ];
    const rows = jobs.map((job) => [
      job.title || job.client || t("untitledJob"),
      custName(job),
      propAddr(job),
      job.job_type || job.type || "—",
      fmtDate(job.scheduled_date),
      job.status || "lead",
      ...(isAdminOrManager ? [fmtMoney(job.price ?? job.value)] : []),
    ]);
    const dateStamp = format(new Date(), "yyyy-MM-dd");
    downloadCsv(`jobs-export-${dateStamp}.csv`, headers, rows);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {jobs.length} {jobs.length !== 1 ? t("title").toLowerCase() : t("jobTitle").toLowerCase()}
            {activeTab !== "all" ? ` · ${activeTab === "lead" ? "Not Accepted" : tJobs(STATUS_MAP[activeTab]?.labelKey ?? activeTab)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick filter shortcut */}
          {activeTab !== "lead" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("lead")}
              className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
              data-testid="button-filter-not-accepted"
            >
              <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
              Not Accepted
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={jobs.length === 0}
            data-testid="button-export-jobs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export
          </Button>
          {isAdminOrManager && (
            <Button onClick={() => setShowModal(true)} className="bg-primary" data-testid="button-new-job">
              <Plus className="h-4 w-4 mr-1.5" /> {t("newJob")}
            </Button>
          )}
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? tab.value === "lead"
                  ? "bg-amber-500 text-white"
                  : tab.value === "behind_schedule"
                  ? "bg-red-600 text-white"
                  : "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            data-testid={`tab-${tab.value}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Date Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchJobsPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="w-36" data-testid="input-date-from" />
          <span className="text-muted-foreground text-sm">{t("dateTo")}</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="w-36" data-testid="input-date-to" />
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" className="text-xs h-8"
              onClick={() => { setDateFrom(""); setDateTo(""); }}>
              {t("clear")}
            </Button>
          )}
        </div>
      </div>

      {/* Not-accepted banner */}
      {activeTab === "lead" && jobs.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>{jobs.length} job{jobs.length !== 1 ? "s" : ""}</strong> waiting for customer acceptance — use the{" "}
            <strong>Contact</strong> button on each row to follow up.
          </span>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground text-sm">{t("loadingJobs")}</div>
          ) : jobs.length === 0 ? (
            <div className="py-16 text-center">
              <Briefcase className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm font-semibold text-muted-foreground">{t("noJobs")}</p>
              {activeTab === "all" && !search && (
                <>
                  <p className="text-xs text-muted-foreground mt-1">{t("getStarted")}</p>
                  {isAdminOrManager && (
                    <Button onClick={() => setShowModal(true)} className="mt-4 bg-primary" size="sm"
                      data-testid="button-first-job">
                      <Plus className="h-4 w-4 mr-1.5" /> {t("createFirstJob")}
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("jobTitle")}</TableHead>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("property")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("colType")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("colScheduled")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  {isAdminOrManager && <TableHead className="hidden sm:table-cell text-right">{t("colPrice")}</TableHead>}
                  {isAdminOrManager && <TableHead className="w-24 text-center">Contact</TableHead>}
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedJobs.map((job) => (
                  <TableRow
                    key={job.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    data-testid={`row-job-${job.id}`}
                  >
                    <TableCell className="font-medium">
                      {job.title || job.client || t("untitledJob")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {custName(job)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {propAddr(job)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {job.job_type || job.type || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {fmtDate(job.scheduled_date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center flex-wrap gap-y-1">
                        <StatusBadge status={job.status || "lead"} />
                        {job.is_behind_schedule && <BehindScheduleBadge />}
                        {!job.has_work_order && ["scheduled", "in_progress"].includes(job.status) && <NoWorkOrderBadge />}
                      </div>
                    </TableCell>
                    {isAdminOrManager && (
                      <TableCell className="hidden sm:table-cell text-sm font-medium text-right">
                        {fmtMoney(job.price ?? job.value)}
                      </TableCell>
                    )}
                    {isAdminOrManager && (
                      <TableCell
                        className="text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={(e) => { e.stopPropagation(); setContactJob(job); }}
                          data-testid={`button-contact-${job.id}`}
                        >
                          <Send className="w-3 h-3" /> Contact
                        </Button>
                      </TableCell>
                    )}
                    <TableCell className="w-16 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite("job", String(job.id)); }}
                          className={cn("p-1.5 rounded transition-colors", isFavorited("job", String(job.id)) ? "text-primary" : "text-muted-foreground hover:text-primary")}
                          data-testid={`button-pin-job-${job.id}`}
                          title={isFavorited("job", String(job.id)) ? "Unpin job" : "Pin job"}
                        >
                          <Pin className={cn("h-3.5 w-3.5", isFavorited("job", String(job.id)) && "fill-current")} />
                        </button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <JobFormModal open={showModal} onOpenChange={setShowModal} initialData={EMPTY_JOB} />

      {/* Contact Dialog */}
      {contactJob && (
        <ContactDialog job={contactJob} onClose={() => setContactJob(null)} />
      )}
    </div>
  );
}
