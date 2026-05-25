import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Camera, RefreshCw, ExternalLink, Check, X, Search, MapPin, Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CustomerOption {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  billing_address: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  primary_phone?: string | null;
}

interface CCProject {
  companycam_project_id: string;
  name: string;
  address_street_1: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
  cc_created_at: string | null;
  synced_from_api_at: string | null;
  suggested_customers: CustomerOption[];
}

interface ReconStats {
  queued: string;
  linked: string;
  dismissed: string;
  last_synced_at: string | null;
}

// ── Customer combobox ─────────────────────────────────────────────────────────

function CustomerCombobox({
  suggestions,
  value,
  onChange,
}: {
  suggestions: CustomerOption[];
  value: CustomerOption | null;
  onChange: (c: CustomerOption | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: searchResults = [], isFetching } = useQuery<CustomerOption[]>({
    queryKey: ["/api/customers", "cc-search", search],
    queryFn: async () => {
      if (!search.trim()) return [];
      const res = await fetch(
        `/api/customers?search=${encodeURIComponent(search)}&limit=10`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && search.trim().length > 0,
  });

  const displayList: CustomerOption[] =
    search.trim().length > 0 ? searchResults : suggestions;

  const label = (c: CustomerOption) =>
    c.company_name?.trim() || `${c.first_name} ${c.last_name}`;
  const sublabel = (c: CustomerOption) =>
    [c.billing_city, c.billing_state, c.billing_zip].filter(Boolean).join(", ");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between text-left h-auto py-2 font-normal"
          data-testid="button-customer-combobox"
        >
          {value ? (
            <span className="truncate text-sm">
              {label(value)}
              {value.billing_city && (
                <span className="text-muted-foreground ml-1">— {value.billing_city}</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">Select customer…</span>
          )}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name or city…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isFetching && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Searching…
              </div>
            )}
            {!isFetching && displayList.length === 0 && (
              <CommandEmpty>
                {search.trim() ? "No customers found" : "No address suggestions"}
              </CommandEmpty>
            )}
            {displayList.length > 0 && (
              <CommandGroup
                heading={search.trim() ? "Search results" : "Address-matched suggestions"}
              >
                {displayList.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      onChange(value?.id === c.id ? null : c);
                      setOpen(false);
                      setSearch("");
                    }}
                    data-testid={`customer-option-${c.id}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value?.id === c.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{label(c)}</div>
                      {sublabel(c) && (
                        <div className="text-xs text-muted-foreground truncate">{sublabel(c)}</div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onMatch,
  onDismiss,
  isMatching,
  isDismissing,
}: {
  project: CCProject;
  onMatch: (ccProjectId: string, customerId: string) => void;
  onDismiss: (ccProjectId: string) => void;
  isMatching: boolean;
  isDismissing: boolean;
}) {
  const [selected, setSelected] = useState<CustomerOption | null>(null);

  const address = [
    project.address_street_1,
    project.address_city,
    project.address_state,
    project.address_postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  const createdAgo = project.cc_created_at
    ? formatDistanceToNow(new Date(project.cc_created_at), { addSuffix: true })
    : null;

  return (
    <Card
      className="border"
      data-testid={`project-card-${project.companycam_project_id}`}
    >
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* ── CC project info ── */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-semibold text-sm"
                data-testid={`project-name-${project.companycam_project_id}`}
              >
                {project.name}
              </span>
              <a
                href={`https://app.companycam.com/projects/${project.companycam_project_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
                data-testid={`project-link-${project.companycam_project_id}`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {address && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span>{address}</span>
              </div>
            )}

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground font-mono">
                ID: {project.companycam_project_id}
              </span>
              {createdAgo && (
                <span className="text-xs text-muted-foreground">· Created {createdAgo}</span>
              )}
            </div>

            {/* Suggested-match chips */}
            {project.suggested_customers.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Address matches:</p>
                <div className="flex flex-wrap gap-1">
                  {project.suggested_customers.slice(0, 5).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setSelected(selected?.id === c.id ? null : c)
                      }
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full border transition-colors",
                        selected?.id === c.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-border"
                      )}
                      data-testid={`suggest-chip-${c.id}`}
                    >
                      {c.company_name?.trim() || `${c.first_name} ${c.last_name}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Match controls ── */}
          <div className="flex flex-col gap-2 sm:w-64 shrink-0">
            <CustomerCombobox
              suggestions={project.suggested_customers}
              value={selected}
              onChange={setSelected}
            />
            <div className="flex gap-2">
              <Button
                className="flex-1"
                size="sm"
                disabled={!selected || isMatching}
                onClick={() =>
                  selected && onMatch(project.companycam_project_id, selected.id)
                }
                data-testid={`button-confirm-match-${project.companycam_project_id}`}
              >
                {isMatching ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Confirm Match
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isDismissing}
                onClick={() => onDismiss(project.companycam_project_id)}
                title="Dismiss from queue"
                data-testid={`button-dismiss-${project.companycam_project_id}`}
              >
                {isDismissing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompanyCamReconciliation() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: projects = [], isLoading } = useQuery<CCProject[]>({
    queryKey: ["/api/admin/companycam/recon-queue"],
    queryFn: async () => {
      const res = await fetch("/api/admin/companycam/recon-queue", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load queue");
      return res.json();
    },
  });

  const { data: stats } = useQuery<ReconStats>({
    queryKey: ["/api/admin/companycam/recon-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/companycam/recon-stats", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const matchMutation = useMutation({
    mutationFn: async ({
      ccProjectId,
      customerId,
    }: {
      ccProjectId: string;
      customerId: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/companycam/recon-queue/${ccProjectId}/match`,
        { customer_id: customerId }
      );
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message ?? "Match failed");
      }
    },
    onMutate: ({ ccProjectId }) => setMatchingId(ccProjectId),
    onSuccess: () => {
      toast({ title: "Customer linked to CompanyCam project" });
      qc.invalidateQueries({ queryKey: ["/api/admin/companycam/recon-queue"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/companycam/recon-stats"] });
    },
    onError: (e: Error) =>
      toast({ title: e.message, variant: "destructive" }),
    onSettled: () => setMatchingId(null),
  });

  const dismissMutation = useMutation({
    mutationFn: async (ccProjectId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/companycam/recon-queue/${ccProjectId}/dismiss`,
        {}
      );
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message ?? "Dismiss failed");
      }
    },
    onMutate: (id) => setDismissingId(id),
    onSuccess: () => {
      toast({ title: "Project dismissed from queue" });
      qc.invalidateQueries({ queryKey: ["/api/admin/companycam/recon-queue"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/companycam/recon-stats"] });
    },
    onError: (e: Error) =>
      toast({ title: e.message, variant: "destructive" }),
    onSettled: () => setDismissingId(null),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/companycam/sync", {});
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message ?? "Sync failed");
      }
      return res.json();
    },
    onSuccess: (data: { upserted: number; autoLinked: number }) => {
      toast({
        title: `Sync complete — ${data.upserted} projects fetched, ${data.autoLinked} auto-linked`,
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/companycam/recon-queue"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/companycam/recon-stats"] });
    },
    onError: (e: Error) =>
      toast({ title: `Sync failed: ${e.message}`, variant: "destructive" }),
  });

  const lastSynced = stats?.last_synced_at
    ? formatDistanceToNow(new Date(stats.last_synced_at), { addSuffix: true })
    : "never";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">CompanyCam Reconciliation Queue</h1>
            {projects.length > 0 && (
              <Badge
                variant="destructive"
                className="rounded-full tabular-nums"
                data-testid="badge-queue-count"
              >
                {projects.length}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Match field-created CompanyCam projects to CompanyHQ customers
          </p>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          variant="outline"
          data-testid="button-sync-now"
        >
          {syncMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sync from CompanyCam
        </Button>
      </div>

      {/* Stats bar */}
      <div className="px-6 py-2 border-b bg-muted/30 flex items-center gap-6 text-xs text-muted-foreground flex-wrap">
        <span data-testid="stat-queued">
          <span className="font-medium text-foreground">{stats?.queued ?? "–"}</span>{" "}
          awaiting match
        </span>
        <span data-testid="stat-linked">
          <span className="font-medium text-foreground">{stats?.linked ?? "–"}</span>{" "}
          linked
        </span>
        <span data-testid="stat-dismissed">
          <span className="font-medium text-foreground">{stats?.dismissed ?? "–"}</span>{" "}
          dismissed
        </span>
        <span>
          Last synced:{" "}
          <span className="font-medium text-foreground">{lastSynced}</span>
        </span>
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading queue…
          </div>
        ) : projects.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3"
            data-testid="empty-queue-state"
          >
            <Check className="h-10 w-10 text-green-500 opacity-60" />
            <div className="text-center">
              <p className="font-medium">Queue is empty</p>
              <p className="text-sm">
                All CompanyCam projects are matched to customers.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync to check for new projects
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl">
            {projects.map((project) => (
              <ProjectCard
                key={project.companycam_project_id}
                project={project}
                onMatch={(id, customerId) =>
                  matchMutation.mutate({ ccProjectId: id, customerId })
                }
                onDismiss={(id) => dismissMutation.mutate(id)}
                isMatching={
                  matchingId === project.companycam_project_id &&
                  matchMutation.isPending
                }
                isDismissing={
                  dismissingId === project.companycam_project_id &&
                  dismissMutation.isPending
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
