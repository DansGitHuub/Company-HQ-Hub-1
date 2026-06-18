import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2, XCircle, AlertTriangle, ShieldCheck, ShieldX, Shield,
  ChevronDown, ChevronRight, Loader2, Unlock,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface GateItem {
  key: string;
  label: string;
  description: string;
  required: boolean;
  passed: boolean;
  bypassed: boolean;
  bypass_reason: string | null;
  bypass_by: string | null;
  bypass_at: string | null;
}

interface GateResult {
  gate_status: "ready" | "blocked" | "bypassed_all";
  items: GateItem[];
  blocked_count: number;
  bypassed_count: number;
}

interface Props {
  jobId: string;
  isAdminOrManager: boolean;
}

export default function JobPacketGate({ jobId, isAdminOrManager }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bypassItem, setBypassItem] = useState<GateItem | null>(null);
  const [bypassReason, setBypassReason] = useState("");
  const [showOptional, setShowOptional] = useState(false);

  const { data, isLoading } = useQuery<GateResult>({
    queryKey: ["/api/jobs", jobId, "packet-gate"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}/packet-gate`);
      if (!res.ok) throw new Error("Failed to load gate");
      return res.json();
    },
  });

  const bypassMutation = useMutation({
    mutationFn: async ({ key, reason }: { key: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/packet-gate/bypass`, {
        gate_item: key,
        reason,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "packet-gate"] });
      toast({ title: "Gate item bypassed", description: "Bypass reason recorded." });
      setBypassItem(null);
      setBypassReason("");
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("DELETE", `/api/jobs/${jobId}/packet-gate/bypass/${key}`);
      if (!res.ok) throw new Error("Failed to remove bypass");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "packet-gate"] });
      toast({ title: "Bypass removed" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { gate_status, items, blocked_count } = data;
  const requiredItems = items.filter(i => i.required);
  const optionalItems = items.filter(i => !i.required);

  const statusConfig = {
    ready: {
      icon: ShieldCheck,
      badge: "bg-green-100 text-green-800 border-green-200",
      label: "Ready to Start",
      headerClass: "border-green-200",
      iconClass: "text-green-500",
      desc: "All required items are complete. This job is cleared to begin.",
    },
    blocked: {
      icon: ShieldX,
      badge: "bg-red-100 text-red-800 border-red-200",
      label: `Blocked — ${blocked_count} item${blocked_count !== 1 ? "s" : ""} missing`,
      headerClass: "border-red-200",
      iconClass: "text-red-500",
      desc: "Complete or bypass the required items below before starting this job.",
    },
    bypassed_all: {
      icon: Shield,
      badge: "bg-amber-100 text-amber-800 border-amber-200",
      label: "Bypassed",
      headerClass: "border-amber-200",
      iconClass: "text-amber-500",
      desc: "Some required items were bypassed. Proceed with caution.",
    },
  };

  const cfg = statusConfig[gate_status];
  const StatusIcon = cfg.icon;

  return (
    <>
      <Card className={`border-2 ${cfg.headerClass}`} data-testid="card-packet-gate">
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-center gap-3">
            <StatusIcon className={`h-6 w-6 flex-shrink-0 ${cfg.iconClass}`} />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base">Job Packet Gate</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{cfg.desc}</p>
            </div>
            <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badge}`}
              data-testid="badge-gate-status">
              {cfg.label}
            </span>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="px-5 py-4 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Required Items
          </p>
          {requiredItems.map(item => (
            <GateRow
              key={item.key}
              item={item}
              isAdminOrManager={isAdminOrManager}
              onBypass={() => { setBypassItem(item); setBypassReason(""); }}
              onRemoveBypass={() => removeMutation.mutate(item.key)}
              removing={removeMutation.isPending}
            />
          ))}
        </CardContent>

        {optionalItems.length > 0 && (
          <>
            <Separator />
            <CardContent className="px-5 py-3">
              <button
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
                onClick={() => setShowOptional(v => !v)}
                data-testid="button-toggle-optional"
              >
                {showOptional ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Recommended Items ({optionalItems.filter(i => i.passed).length}/{optionalItems.length} complete)
              </button>
              {showOptional && (
                <div className="mt-2 space-y-1.5">
                  {optionalItems.map(item => (
                    <GateRow
                      key={item.key}
                      item={item}
                      isAdminOrManager={false}
                      onBypass={() => {}}
                      onRemoveBypass={() => {}}
                      removing={false}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </>
        )}
      </Card>

      {/* Bypass Dialog */}
      <Dialog open={!!bypassItem} onOpenChange={open => { if (!open) setBypassItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="h-4 w-4 text-amber-500" />
              Bypass Gate Item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{bypassItem?.label}</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{bypassItem?.description}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1.5">Reason for bypass <span className="text-red-500">*</span></p>
              <Textarea
                value={bypassReason}
                onChange={e => setBypassReason(e.target.value)}
                placeholder="Explain why this gate is being bypassed…"
                rows={3}
                className="resize-none"
                data-testid="textarea-bypass-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBypassItem(null)}>Cancel</Button>
            <Button
              variant="default"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!bypassReason.trim() || bypassMutation.isPending}
              onClick={() => bypassItem && bypassMutation.mutate({ key: bypassItem.key, reason: bypassReason })}
              data-testid="button-confirm-bypass"
            >
              {bypassMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Record Bypass
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GateRow({
  item, isAdminOrManager, onBypass, onRemoveBypass, removing,
}: {
  item: GateItem;
  isAdminOrManager: boolean;
  onBypass: () => void;
  onRemoveBypass: () => void;
  removing: boolean;
}) {
  const state = item.passed ? "passed" : item.bypassed ? "bypassed" : "blocked";

  const iconMap = {
    passed:  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />,
    bypassed: <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />,
    blocked: <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />,
  };
  const rowCls = {
    passed:   "bg-green-50/50 dark:bg-green-950/20 border-green-100 dark:border-green-900",
    bypassed: "bg-amber-50/50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900",
    blocked:  "bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900",
  };

  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${rowCls[state]}`}
      data-testid={`gate-row-${item.key}`}>
      <div className="mt-0.5">{iconMap[state]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{item.label}</p>
        {state === "bypassed" && item.bypass_reason && (
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            Bypassed by {item.bypass_by ?? "Admin"}: <em>{item.bypass_reason}</em>
            {item.bypass_at && (
              <span className="ml-1 text-muted-foreground">
                · {format(parseISO(item.bypass_at), "MMM d, yyyy")}
              </span>
            )}
          </p>
        )}
        {state === "blocked" && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
        )}
      </div>
      {isAdminOrManager && (
        <div className="flex-shrink-0 ml-1">
          {state === "blocked" && (
            <Button size="sm" variant="ghost"
              className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900"
              onClick={onBypass}
              data-testid={`button-bypass-${item.key}`}>
              Bypass
            </Button>
          )}
          {state === "bypassed" && (
            <Button size="sm" variant="ghost"
              className="h-7 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50"
              onClick={onRemoveBypass}
              disabled={removing}
              data-testid={`button-remove-bypass-${item.key}`}>
              Remove
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
