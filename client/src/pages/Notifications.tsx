import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, ChevronLeft, ChevronRight, CheckCheck, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface StaffNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

interface PagedResult {
  items: StaffNotification[];
  total: number;
  page: number;
  pageSize: number;
}

// Human-readable labels for known notification types
const TYPE_LABELS: Record<string, string> = {
  stale_lead:         "Stale Lead",
  new_lead:           "New Lead",
  estimate_approved:  "Estimate Approved",
  estimate_declined:  "Estimate Declined",
  job_update:         "Job Update",
  invoice_paid:       "Invoice Paid",
  system:             "System",
};

function typeLabel(t: string) {
  return TYPE_LABELS[t] ?? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PAGE_SIZE = 25;

export default function NotificationsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // ── Distinct types for filter chips ─────────────────────────────────────────
  const { data: allTypes = [] } = useQuery<string[]>({
    queryKey: ["/api/staff-notifications/types"],
  });

  // ── Unread count (shared with bell panel cache) ───────────────────────────
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/staff-notifications/unread-count"],
    refetchInterval: 30_000,
  });
  const unreadCount = Number(countData?.count ?? 0);

  // ── Paginated notification list ───────────────────────────────────────────
  const listKey = ["/api/staff-notifications", { page, pageSize: PAGE_SIZE, type: typeFilter }] as const;

  const { data, isLoading } = useQuery<PagedResult>({
    queryKey: listKey,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (typeFilter) params.set("type", typeFilter);
      const res = await apiRequest("GET", `/api/staff-notifications?${params}`);
      return res.json();
    },
  });

  const notifications = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications/unread-count"] });
  }

  // ── Mark individual read ─────────────────────────────────────────────────
  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/staff-notifications/${id}/read`),
    onSuccess: invalidate,
  });

  // ── Mark all read ────────────────────────────────────────────────────────
  const markAllRead = useMutation({
    mutationFn: () => apiRequest("POST", "/api/staff-notifications/read-all"),
    onSuccess: () => {
      invalidate();
      toast({ title: "All notifications marked as read" });
    },
  });

  function handleClick(n: StaffNotification) {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.link) setLocation(n.link);
  }

  function handleTypeChip(t: string | null) {
    setTypeFilter(t);
    setPage(1);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="-ml-2"
            onClick={() => setLocation("/hq")} data-testid="button-back-notifications">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-bold tracking-tight">Notifications</h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-[10px] font-bold text-white bg-red-500 rounded-full"
                data-testid="badge-unread-count">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* span wrapper lets the tooltip fire even when the button is disabled */}
            <span className="inline-block">
              <Button variant="outline" size="sm"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending || unreadCount === 0}
                data-testid="button-mark-all-read">
                <CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Mark all read
              </Button>
            </span>
          </TooltipTrigger>
          {unreadCount === 0 && (
            <TooltipContent>You are all caught up</TooltipContent>
          )}
        </Tooltip>
      </div>

      {/* Type filter chips */}
      {allTypes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap" data-testid="filter-type-chips">
          <button
            onClick={() => handleTypeChip(null)}
            data-testid="chip-type-all"
            className={cn(
              "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
              typeFilter === null
                ? "bg-gray-800 text-white border-gray-800 dark:bg-gray-200 dark:text-gray-900"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-500 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-600",
            )}
          >
            All
          </button>
          {allTypes.map((t) => (
            <button
              key={t}
              onClick={() => handleTypeChip(t)}
              data-testid={`chip-type-${t}`}
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
                typeFilter === t
                  ? "bg-gray-800 text-white border-gray-800 dark:bg-gray-200 dark:text-gray-900"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-500 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-600",
              )}
            >
              {typeLabel(t)}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">
              {typeFilter ? `No ${typeLabel(typeFilter)} notifications.` : "You're all caught up!"}
            </p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              data-testid={`row-notification-${n.id}`}
              className={cn(
                "px-5 py-4 border-b border-gray-50 dark:border-gray-800 last:border-0 transition-colors",
                n.link ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" : "cursor-default",
                !n.isRead && "bg-blue-50/50 dark:bg-blue-900/20",
              )}
            >
              <div className="flex items-start gap-3">
                {/* unread dot */}
                <span className={cn(
                  "mt-1.5 w-2 h-2 rounded-full flex-shrink-0",
                  !n.isRead ? "bg-blue-500" : "bg-transparent",
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">
                      {n?.title}
                    </p>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      {typeLabel(n?.type ?? "")}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n?.message}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                    {formatDistanceToNow(new Date(n?.createdAt ?? Date.now()), { addSuffix: true })}
                  </p>
                </div>
                {/* Mark as read — right edge, only for unread rows */}
                {!n.isRead && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => { e.stopPropagation(); markRead.mutate(n.id); }}
                        className="flex-shrink-0 p-1.5 rounded-md text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                        data-testid={`button-mark-read-${n.id}`}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Mark as read</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span data-testid="text-pagination-info">
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              data-testid="button-prev-page">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              data-testid="button-next-page">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
