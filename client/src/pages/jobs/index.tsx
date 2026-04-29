import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Search, Briefcase, ChevronRight, Calendar,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { JobFormModal, EMPTY_JOB } from "./JobFormModal";
import { useAuth } from "@/hooks/use-auth";

// ── Types ─────────────────────────────────────────────────────────────────────
interface JobRow {
  id: string; title: string; client: string; status: string;
  job_type: string | null; type: string | null;
  scheduled_date: string | null;
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function JobsPage() {
  const { t } = useTranslation("jobDetail");
  const { t: tJobs } = useTranslation("jobs");
  const [, navigate] = useLocation();
  const { effectiveRole } = useAuth();
  const isAdminOrManager = ["Admin", "Manager", "Master Admin"].includes(effectiveRole ?? "");

  const STATUS_TABS = [
    { value: "all",         label: tJobs("all") },
    { value: "lead",        label: tJobs("lead") },
    { value: "scheduled",   label: tJobs("scheduled") },
    { value: "in_progress", label: tJobs("inProgress") },
    { value: "completed",   label: tJobs("completed") },
    { value: "invoiced",    label: tJobs("invoiced") },
  ];

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Build query params
  const params = new URLSearchParams();
  if (activeTab !== "all") params.set("status", activeTab);
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {jobs.length} {jobs.length !== 1 ? t("title").toLowerCase() : t("jobTitle").toLowerCase()}
            {activeTab !== "all" ? ` · ${tJobs(STATUS_MAP[activeTab]?.labelKey ?? activeTab)}` : ""}
          </p>
        </div>
        {isAdminOrManager && (
          <Button onClick={() => setShowModal(true)} className="bg-primary" data-testid="button-new-job">
            <Plus className="h-4 w-4 mr-1.5" /> {t("newJob")}
          </Button>
        )}
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "bg-primary text-primary-foreground"
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
                  <TableHead className="hidden sm:table-cell text-right">{t("colPrice")}</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
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
                      <StatusBadge status={job.status || "lead"} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm font-medium text-right">
                      {fmtMoney(job.price ?? job.value)}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
    </div>
  );
}
