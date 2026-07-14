import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ShieldAlert, LogIn, LogOut, Settings, UserCog, Download } from "lucide-react";

type AuditLogRow = {
  id: string;
  event_type: "login_success" | "login_failure" | "permission_change" | "settings_change" | "data_export";
  actor_user_id: string | null;
  actor_name: string | null;
  actor_user_name: string | null;
  target_user_id: string | null;
  target_label: string | null;
  target_user_name: string | null;
  description: string;
  old_value: any;
  new_value: any;
  ip_address: string | null;
  created_at: string;
};

const EVENT_TYPE_META: Record<string, { label: string; icon: any; className: string }> = {
  login_success:    { label: "Login Success",    icon: LogIn,    className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  login_failure:    { label: "Login Failure",    icon: LogOut,   className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  permission_change:{ label: "Permission Change",icon: UserCog,  className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  settings_change:  { label: "Settings Change",  icon: Settings, className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  data_export:      { label: "Data Export",      icon: Download, className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
};

function formatValue(value: any): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function SecurityAuditLogPanel() {
  const [eventType, setEventType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const params = new URLSearchParams();
  if (eventType !== "all") params.set("eventType", eventType);
  if (search.trim()) params.set("search", search.trim());
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);

  const { data, isLoading } = useQuery<{ rows: AuditLogRow[]; total: number }>({
    queryKey: ["/api/admin/security-audit-log", eventType, search, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/admin/security-audit-log?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load audit log");
      return res.json();
    },
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4" data-testid="panel-security-audit-log">
      <div>
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-muted-foreground" />
          Security Audit Log
        </h3>
        <p className="text-sm text-muted-foreground">
          Read-only record of logins, failed logins, permission changes, settings changes, and data exports.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div>
              <Label className="text-xs text-muted-foreground">Event Type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger data-testid="select-audit-event-type">
                  <SelectValue placeholder="All events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  <SelectItem value="login_success">Login Success</SelectItem>
                  <SelectItem value="login_failure">Login Failure</SelectItem>
                  <SelectItem value="permission_change">Permission Change</SelectItem>
                  <SelectItem value="settings_change">Settings Change</SelectItem>
                  <SelectItem value="data_export">Data Export</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Search</Label>
              <Input
                placeholder="Search description, user…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-audit-search"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-audit-start-date"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-audit-end-date"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading audit log…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm" data-testid="text-audit-empty">
              No audit log entries match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Old Value</TableHead>
                    <TableHead>New Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const meta = EVENT_TYPE_META[row.event_type] ?? {
                      label: row.event_type,
                      icon: ShieldAlert,
                      className: "bg-muted text-muted-foreground",
                    };
                    const Icon = meta.icon;
                    return (
                      <TableRow key={row.id} data-testid={`row-audit-log-${row.id}`}>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(row.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={`gap-1 ${meta.className}`} variant="secondary">
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.actor_user_name || row.actor_name || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.target_user_name || row.target_label || "—"}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs">{row.description}</TableCell>
                        <TableCell className="text-xs font-mono max-w-[160px] truncate" title={formatValue(row.old_value)}>
                          {formatValue(row.old_value)}
                        </TableCell>
                        <TableCell className="text-xs font-mono max-w-[160px] truncate" title={formatValue(row.new_value)}>
                          {formatValue(row.new_value)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
