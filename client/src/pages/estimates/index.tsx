import React, { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, Calculator, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { EstimateFormModal } from "./EstimateFormModal";

interface EstimateRow {
  id: string;
  estimate_number: string;
  title: string;
  status: string;
  estimate_type: string;
  issued_date: string;
  valid_until: string | null;
  total: string;
  customer_name: string | null;
  property_address: string | null;
  salesperson_name: string | null;
}

const ESTIMATE_STATUS_CLS: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent:      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  viewed:    "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  approved:  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  declined:  "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  converted: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

export const ESTIMATE_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Draft",            cls: ESTIMATE_STATUS_CLS.draft },
  sent:      { label: "Sent",             cls: ESTIMATE_STATUS_CLS.sent },
  viewed:    { label: "Viewed",           cls: ESTIMATE_STATUS_CLS.viewed },
  approved:  { label: "Approved",         cls: ESTIMATE_STATUS_CLS.approved },
  declined:  { label: "Declined",         cls: ESTIMATE_STATUS_CLS.declined },
  converted: { label: "Converted to Job", cls: ESTIMATE_STATUS_CLS.converted },
};

export const ESTIMATE_TYPE_LABELS: Record<string, string> = {
  project:              "Landscape Project",
  maintenance_contract: "Maintenance Contract",
  snow_contract:        "Snow & Ice Contract",
  other:                "Other",
};

export function EstimateStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("estimates");
  const statusLabels: Record<string, string> = {
    draft:     t("statusDraft"),
    sent:      t("statusSent"),
    viewed:    t("statusViewed"),
    approved:  t("statusApproved"),
    declined:  t("statusDeclined"),
    converted: t("statusConverted"),
  };
  const cls = ESTIMATE_STATUS_CLS[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`} data-testid={`badge-status-${status}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}

function fmtMoney(v: any) {
  const n = parseFloat(v ?? "0");
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

const STATUS_TAB_VALUES = ["all", "draft", "sent", "viewed", "approved", "declined", "converted"];

export default function EstimateList() {
  const { t } = useTranslation("estimates");
  const [, nav] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const typeLabels: Record<string, string> = {
    project:              t("typeLandscapeProject"),
    maintenance_contract: t("typeMaintenanceContract"),
    snow_contract:        t("typeSnowContract"),
    other:                t("typeOther"),
  };

  const statusLabels: Record<string, string> = {
    draft:     t("statusDraft"),
    sent:      t("statusSent"),
    viewed:    t("statusViewed"),
    approved:  t("statusApproved"),
    declined:  t("statusDeclined"),
    converted: t("statusConverted"),
  };

  const { data: estimates = [], isLoading } = useQuery<EstimateRow[]>({
    queryKey: ["/api/estimates"],
  });

  const filtered = estimates.filter(e => {
    if (activeTab !== "all" && e.status !== activeTab) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (e.estimate_number ?? "").toLowerCase().includes(q) ||
        (e.title ?? "").toLowerCase().includes(q) ||
        (e.customer_name ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const canCreate = user?.role === "Admin" || user?.role === "Manager" || user?.role === "Master Admin";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <Badge variant="secondary" className="ml-1">{estimates.length}</Badge>
        </div>
        {canCreate && (
          <Button onClick={() => setShowModal(true)} data-testid="btn-new-estimate">
            <Plus className="h-4 w-4 mr-1.5" /> {t("newEstimate")}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 py-2 border-b overflow-x-auto">
        {STATUS_TAB_VALUES.map(tab => {
          const count = tab === "all" ? estimates.length : estimates.filter(e => e.status === tab).length;
          const label = tab === "all" ? t("customer") : statusLabels[tab] ?? tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              data-testid={`tab-${tab}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-8 h-8 text-sm"
            data-testid="input-search-estimates"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">{t("loading", { ns: "common" })}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <Calculator className="h-10 w-10 opacity-30" />
            <p className="text-sm">{search ? t("noEstimatesSearch") : t("noEstimates")}</p>
            {canCreate && !search && (
              <Button size="sm" variant="outline" onClick={() => setShowModal(true)} data-testid="btn-empty-new-estimate">
                <Plus className="h-4 w-4 mr-1" /> {t("newEstimate")}
              </Button>
            )}
          </div>
        ) : (
          <Card className="mt-4">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6 w-32">#</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("customer")}</TableHead>
                    <TableHead>{t("value")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead className="text-right pr-4">{t("value")}</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(est => (
                    <TableRow
                      key={est.id}
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => nav(`/estimates/${est.id}`)}
                      data-testid={`row-estimate-${est.id}`}
                    >
                      <TableCell className="pl-6 font-mono text-sm font-medium">
                        {est.estimate_number ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{est.title}</div>
                        {est.property_address && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{est.property_address}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{est.customer_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {typeLabels[est.estimate_type] ?? est.estimate_type}
                      </TableCell>
                      <TableCell><EstimateStatusBadge status={est.status} /></TableCell>
                      <TableCell className="text-sm">{fmtDate(est.issued_date)}</TableCell>
                      <TableCell className="text-sm">{est.valid_until ? fmtDate(est.valid_until) : "—"}</TableCell>
                      <TableCell className="text-right pr-4 font-semibold tabular-nums text-sm">
                        {fmtMoney(est.total)}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {showModal && <EstimateFormModal open={showModal} onClose={() => setShowModal(false)} />}
    </div>
  );
}
