import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, FileText, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { InvoiceFormModal } from "./InvoiceFormModal";

// ── Types ──────────────────────────────────────────────────────────────────────
interface InvoiceRow {
  id: string; invoice_number: string; status: string;
  issued_date: string; due_date: string | null;
  total: string; amount_paid: string; balance_due: string;
  customer_id: string | null;
  cust_first: string | null; cust_last: string | null; cust_company: string | null;
  job_title: string | null; job_client: string | null;
}

// ── Status ────────────────────────────────────────────────────────────────────
export const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:             { label: "Draft",             cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  sent:              { label: "Sent",              cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  viewed:            { label: "Viewed",            cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300" },
  accepted:          { label: "Accepted",          cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  declined:          { label: "Declined",          cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  changes_requested: { label: "Changes Requested", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  paid:              { label: "Paid",              cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  void:              { label: "Void",              cls: "bg-muted text-muted-foreground" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

function custName(row: InvoiceRow) {
  if (row.cust_first) return `${row.cust_first} ${row.cust_last}`;
  if (row.cust_company) return row.cust_company;
  return "—";
}

function fmtMoney(v: any) {
  const n = parseFloat(v ?? "0");
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

const TABS = [
  { value: "all",               label: "All" },
  { value: "draft",             label: "Draft" },
  { value: "sent",              label: "Sent" },
  { value: "accepted",          label: "Accepted" },
  { value: "changes_requested", label: "Changes Requested" },
  { value: "declined",          label: "Declined" },
  { value: "paid",              label: "Paid" },
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const [, navigate] = useLocation();
  const { effectiveRole } = useAuth();
  const isAdminOrManager = ["Admin", "Manager", "Master Admin"].includes(effectiveRole ?? "");

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const params = new URLSearchParams();
  if (activeTab !== "all") params.set("status", activeTab);
  if (search.trim()) params.set("search", search.trim());

  const { data: invoices = [], isLoading } = useQuery<InvoiceRow[]>({
    queryKey: ["/api/invoices", activeTab, search],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/invoices?${params}`);
      return res.json();
    },
  });

  const totalOutstanding = invoices
    .filter((i) => !["paid", "void", "draft"].includes(i.status))
    .reduce((s, i) => s + parseFloat(i.balance_due ?? "0"), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
            {totalOutstanding > 0 && ` · ${fmtMoney(totalOutstanding)} outstanding`}
          </p>
        </div>
        {isAdminOrManager && (
          <Button onClick={() => setShowModal(true)} className="bg-primary" data-testid="button-new-invoice">
            <Plus className="h-4 w-4 mr-1.5" /> New Invoice
          </Button>
        )}
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map((tab) => (
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search invoices, customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Loading invoices…</div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm font-semibold text-muted-foreground">No invoices found</p>
              {activeTab === "all" && !search && isAdminOrManager && (
                <Button onClick={() => setShowModal(true)} className="mt-4 bg-primary" size="sm">
                  <Plus className="h-4 w-4 mr-1.5" /> Create your first invoice
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden lg:table-cell">Job</TableHead>
                  <TableHead className="hidden md:table-cell">Issued</TableHead>
                  <TableHead className="hidden md:table-cell">Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow
                    key={inv.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    data-testid={`row-invoice-${inv.id}`}
                  >
                    <TableCell className="font-mono font-semibold text-sm">
                      {inv.invoice_number}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{custName(inv)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {inv.job_title || inv.job_client || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {fmtDate(inv.issued_date)}
                    </TableCell>
                    <TableCell className={`hidden md:table-cell text-sm ${
                      inv.status === "overdue" ? "text-red-600 font-medium" : "text-muted-foreground"
                    }`}>
                      {fmtDate(inv.due_date)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {fmtMoney(inv.total)}
                    </TableCell>
                    <TableCell className="text-right text-sm hidden sm:table-cell">
                      <span className={parseFloat(inv.balance_due ?? "0") > 0 ? "text-red-600 font-medium" : "text-green-600"}>
                        {fmtMoney(inv.balance_due)}
                      </span>
                    </TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                    <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InvoiceFormModal open={showModal} onOpenChange={setShowModal} />
    </div>
  );
}
