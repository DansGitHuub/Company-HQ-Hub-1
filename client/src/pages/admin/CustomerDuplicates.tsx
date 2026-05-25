import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { GitMerge, X, User, Mail, Phone, MapPin, Briefcase, Loader2, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface DupPair {
  id_a: string; first_name_a: string; last_name_a: string;
  company_name_a: string | null; billing_address_a: string | null;
  billing_city_a: string | null; billing_zip_a: string | null;
  created_at_a: string; email_a: string | null; phone_a: string | null;
  job_count_a: number; estimate_count_a: number;

  id_b: string; first_name_b: string; last_name_b: string;
  company_name_b: string | null; billing_address_b: string | null;
  billing_city_b: string | null; billing_zip_b: string | null;
  created_at_b: string; email_b: string | null; phone_b: string | null;
  job_count_b: number; estimate_count_b: number;

  reasons: string[];
}

// ── Small customer card ───────────────────────────────────────────────────────

function CustCard({
  id, firstName, lastName, companyName, billingAddress, billingCity, billingZip,
  createdAt, email, phone, jobCount, estimateCount, selected, onSelect, side,
}: {
  id: string; firstName: string; lastName: string; companyName: string | null;
  billingAddress: string | null; billingCity: string | null; billingZip: string | null;
  createdAt: string; email: string | null; phone: string | null;
  jobCount: number; estimateCount: number;
  selected: boolean; onSelect: () => void; side: "A" | "B";
}) {
  const name = companyName?.trim() || `${firstName} ${lastName}`;
  const addr = [billingAddress, billingCity, billingZip].filter(Boolean).join(", ");

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-lg border-2 p-3 transition-all",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/40"
      )}
      data-testid={`cust-card-${id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{name}</div>
          {companyName?.trim() && (
            <div className="text-xs text-muted-foreground truncate">{firstName} {lastName}</div>
          )}
        </div>
        <Badge variant={selected ? "default" : "outline"} className="shrink-0 text-xs">
          {selected ? "Keep this" : `Keep ${side}`}
        </Badge>
      </div>

      <div className="mt-2 space-y-1">
        {email && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="h-3 w-3 shrink-0" /><span className="truncate">{email}</span>
          </div>
        )}
        {phone && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" /><span>{phone}</span>
          </div>
        )}
        {addr && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{addr}</span>
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
          <span className="flex items-center gap-1">
            <Briefcase className="h-3 w-3" />
            {jobCount} job{jobCount !== 1 ? "s" : ""}
          </span>
          <span>{estimateCount} estimate{estimateCount !== 1 ? "s" : ""}</span>
          <span className="ml-auto">Created {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}</span>
        </div>
      </div>
    </button>
  );
}

// ── Pair row ──────────────────────────────────────────────────────────────────

function PairRow({
  pair,
  onMerge,
  onDismiss,
  isMerging,
  isDismissing,
}: {
  pair: DupPair;
  onMerge: (keepId: string, mergeId: string) => void;
  onDismiss: (idA: string, idB: string) => void;
  isMerging: boolean;
  isDismissing: boolean;
}) {
  const [selected, setSelected] = useState<"a" | "b" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const keepId   = selected === "a" ? pair.id_a : pair.id_b;
  const mergeId  = selected === "a" ? pair.id_b : pair.id_a;
  const keepName = selected === "a"
    ? (pair.company_name_a?.trim() || `${pair.first_name_a} ${pair.last_name_a}`)
    : (pair.company_name_b?.trim() || `${pair.first_name_b} ${pair.last_name_b}`);
  const mergeName = selected === "a"
    ? (pair.company_name_b?.trim() || `${pair.first_name_b} ${pair.last_name_b}`)
    : (pair.company_name_a?.trim() || `${pair.first_name_a} ${pair.last_name_a}`);

  return (
    <Card className="border" data-testid={`dup-pair-${pair.id_a}-${pair.id_b}`}>
      <CardContent className="p-4 space-y-3">
        {/* Reasons */}
        <div className="flex items-center gap-2 flex-wrap">
          {pair.reasons.map((r) => (
            <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
          ))}
          <span className="text-xs text-muted-foreground ml-auto">
            Click a card to select which record to keep
          </span>
        </div>

        {/* Side-by-side cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CustCard
            id={pair.id_a} firstName={pair.first_name_a} lastName={pair.last_name_a}
            companyName={pair.company_name_a} billingAddress={pair.billing_address_a}
            billingCity={pair.billing_city_a} billingZip={pair.billing_zip_a}
            createdAt={pair.created_at_a} email={pair.email_a} phone={pair.phone_a}
            jobCount={pair.job_count_a} estimateCount={pair.estimate_count_a}
            selected={selected === "a"} onSelect={() => setSelected(selected === "a" ? null : "a")}
            side="A"
          />
          <CustCard
            id={pair.id_b} firstName={pair.first_name_b} lastName={pair.last_name_b}
            companyName={pair.company_name_b} billingAddress={pair.billing_address_b}
            billingCity={pair.billing_city_b} billingZip={pair.billing_zip_b}
            createdAt={pair.created_at_b} email={pair.email_b} phone={pair.phone_b}
            jobCount={pair.job_count_b} estimateCount={pair.estimate_count_b}
            selected={selected === "b"} onSelect={() => setSelected(selected === "b" ? null : "b")}
            side="B"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            disabled={isDismissing}
            onClick={() => onDismiss(pair.id_a, pair.id_b)}
            data-testid={`btn-dismiss-${pair.id_a}`}
          >
            {isDismissing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <X className="h-4 w-4 mr-1" />}
            Not a duplicate
          </Button>
          <Button
            size="sm"
            disabled={!selected || isMerging}
            onClick={() => setConfirmOpen(true)}
            data-testid={`btn-merge-${pair.id_a}`}
          >
            {isMerging ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <GitMerge className="h-4 w-4 mr-1" />}
            Merge
          </Button>
        </div>
      </CardContent>

      {/* Merge confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Customer Merge</DialogTitle>
            <DialogDescription>
              This will merge <strong>{mergeName}</strong> into <strong>{keepName}</strong>.
              All jobs, estimates, invoices, and other records linked to <strong>{mergeName}</strong> will
              be reassigned to <strong>{keepName}</strong>. The merged record will be deactivated.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={isMerging}
              onClick={() => { setConfirmOpen(false); onMerge(keepId, mergeId); }}
              data-testid="btn-confirm-merge"
            >
              {isMerging ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Yes, merge customers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CustomerDuplicates() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: pairs = [], isLoading } = useQuery<DupPair[]>({
    queryKey: ["/api/admin/customers/duplicate-pairs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/customers/duplicate-pairs", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load duplicate pairs");
      return res.json();
    },
  });

  const [mergingKey, setMergingKey]     = useState<string | null>(null);
  const [dismissingKey, setDismissingKey] = useState<string | null>(null);

  const mergeMutation = useMutation({
    mutationFn: async ({ keepId, mergeId }: { keepId: string; mergeId: string }) => {
      const res = await apiRequest("POST", "/api/admin/customers/merge", { keep_id: keepId, merge_id: mergeId });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message ?? "Merge failed"); }
    },
    onMutate: ({ keepId, mergeId }) => setMergingKey(`${keepId}-${mergeId}`),
    onSuccess: () => {
      toast({ title: "Customers merged successfully" });
      qc.invalidateQueries({ queryKey: ["/api/admin/customers/duplicate-pairs"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
    onSettled: () => setMergingKey(null),
  });

  const dismissMutation = useMutation({
    mutationFn: async ({ idA, idB }: { idA: string; idB: string }) => {
      const res = await apiRequest("POST", "/api/admin/customers/duplicate-pairs/dismiss", {
        customer_id_a: idA, customer_id_b: idB,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message ?? "Dismiss failed"); }
    },
    onMutate: ({ idA, idB }) => setDismissingKey(`${idA}-${idB}`),
    onSuccess: () => {
      toast({ title: "Pair dismissed" });
      qc.invalidateQueries({ queryKey: ["/api/admin/customers/duplicate-pairs"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
    onSettled: () => setDismissingKey(null),
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center gap-3">
        <GitMerge className="h-5 w-5 text-muted-foreground" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Customer Duplicates</h1>
            {pairs.length > 0 && (
              <Badge variant="destructive" className="rounded-full tabular-nums" data-testid="badge-pair-count">
                {pairs.length}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Likely-duplicate customer records matched by name, company, address, or email
          </p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Scanning for duplicates…
          </div>
        ) : pairs.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3"
            data-testid="empty-duplicates-state"
          >
            <CheckCircle2 className="h-10 w-10 text-green-500 opacity-60" />
            <div className="text-center">
              <p className="font-medium">No duplicate pairs found</p>
              <p className="text-sm">All customer records appear to be unique.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl">
            {pairs.map((pair) => {
              const key = `${pair.id_a}-${pair.id_b}`;
              return (
                <PairRow
                  key={key}
                  pair={pair}
                  onMerge={(keepId, mergeId) => mergeMutation.mutate({ keepId, mergeId })}
                  onDismiss={(idA, idB) => dismissMutation.mutate({ idA, idB })}
                  isMerging={mergeMutation.isPending && mergingKey !== null}
                  isDismissing={dismissMutation.isPending && dismissingKey === key}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
