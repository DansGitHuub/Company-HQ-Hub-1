import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, ClipboardList } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorksheetSummary {
  id: string;
  date: string;
  status: string;
  employee_name: string | null;
  employee_username: string;
  job_name: string | null;
  materials_total: string | number;
  expenses_total: string | number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft:     "secondary",
  submitted: "default",
  approved:  "outline",
};

function statusBadgeVariant(status: string) {
  return (STATUS_COLORS[status] ?? "secondary") as any;
}

function fmt(val: string | number) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n) || n === 0) return "—";
  return `$${n.toFixed(2)}`;
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function WorksheetReviewList() {
  const [, navigate] = useLocation();

  const { data: worksheets = [], isLoading, error } = useQuery<WorksheetSummary[]>({
    queryKey: ["/api/worksheets"],
    queryFn: () => apiRequest("GET", "/api/worksheets").then((r) => r.json()),
  });

  const submitted = worksheets.filter((w) => w.status === "submitted");
  const others    = worksheets.filter((w) => w.status !== "submitted");
  const sorted    = [...submitted, ...others];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Worksheet Review</h1>
          <p className="text-sm text-muted-foreground">
            Review and approve submitted daily worksheets from field staff.
          </p>
        </div>
      </div>

      {/* Summary counts */}
      <div className="flex gap-3 flex-wrap">
        {(["submitted", "approved", "draft"] as const).map((s) => {
          const count = worksheets.filter((w) => w.status === s).length;
          return (
            <Card key={s} className="flex-1 min-w-[120px]" data-testid={`stat-${s}`}>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{s}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Table */}
      <Card data-testid="card-worksheet-list">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Worksheets</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-center text-sm text-destructive py-10">
              Failed to load worksheets.
            </p>
          ) : sorted.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              No worksheets found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Job / Area</TableHead>
                  <TableHead className="text-right">Materials $</TableHead>
                  <TableHead className="text-right">Expenses $</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((w) => (
                  <TableRow
                    key={w.id}
                    data-testid={`row-worksheet-${w.id}`}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/worksheet-review/${w.id}`)}
                  >
                    <TableCell className="font-medium">
                      {w.employee_name ?? w.employee_username}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {fmtDate(w.date)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {w.job_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {fmt(w.materials_total)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {fmt(w.expenses_total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(w.status)} className="capitalize">
                        {w.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
