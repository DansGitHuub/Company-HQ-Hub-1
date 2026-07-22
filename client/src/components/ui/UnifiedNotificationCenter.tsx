import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell, X, Check, CheckCheck, AlertCircle,
  Clock, TrendingUp, Briefcase, MessageSquare, Calendar,
  FileText, Package, Sparkles, Info, Plus, Zap,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

interface ActivityLogItem {
  id: string;
  userId: string | null;
  eventType: string;
  description: string;
  link: string | null;
  seenBy: string[];
  createdAt: string;
}

interface AppUpdate {
  id: string;
  version: string;
  title: string;
  description: string;
  detailedContent: string | null;
  minRole: string;
  category: string;
  isActive: boolean;
  publishedAt: string;
}

// ── Priority types ─────────────────────────────────────────────────────────────
// Unread notifications whose type is in this set are pinned to the
// "Needs Your Attention" section at the top of the For You tab.
const PRIORITY_TYPES = new Set([
  "job_over_budget",
  "weather_delay",
  "new_lead",
  "stale_lead",
  "offer_accepted",
  "corrective_action_required",
  "signature_required",
  "approval_required",
  "invoice_overdue",
  "task_overdue",
  "estimate_declined",
]);

// ── Activity helpers ───────────────────────────────────────────────────────────

function activityIcon(type: string) {
  switch (type) {
    case "job_stage_change":      return <TrendingUp    className="h-3.5 w-3.5" />;
    case "estimate_created":
    case "estimate_converted":    return <Briefcase     className="h-3.5 w-3.5" />;
    case "message_sent":          return <MessageSquare className="h-3.5 w-3.5" />;
    case "calendar_event":        return <Calendar      className="h-3.5 w-3.5" />;
    case "document_uploaded":
    case "job_document_uploaded": return <FileText      className="h-3.5 w-3.5" />;
    case "work_request":          return <Package       className="h-3.5 w-3.5" />;
    default:                      return <Bell          className="h-3.5 w-3.5" />;
  }
}

function activityColor(type: string) {
  switch (type) {
    case "job_stage_change":      return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    case "estimate_created":
    case "estimate_converted":    return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
    case "message_sent":          return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
    case "calendar_event":        return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    case "document_uploaded":
    case "job_document_uploaded": return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300";
    case "work_request":          return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
    default:                      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
}

function updateIcon(category: string) {
  switch (category) {
    case "feature":     return <Sparkles    className="h-3.5 w-3.5" />;
    case "improvement": return <Info        className="h-3.5 w-3.5" />;
    case "bugfix":      return <AlertCircle className="h-3.5 w-3.5" />;
    default:            return <Bell        className="h-3.5 w-3.5" />;
  }
}

function updateColor(category: string) {
  switch (category) {
    case "feature":     return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
    case "improvement": return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    case "bugfix":      return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
    default:            return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
}

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function UnifiedNotificationCenter() {
  const [open, setOpen]                   = useState(false);
  const [activeTab, setActiveTab]         = useState("for-you");
  const [expandedUpdateId, setExpandedUpdateId] = useState<string | null>(null);
  const [showPostForm, setShowPostForm]   = useState(false);

  const panelRef    = useRef<HTMLDivElement>(null);
  const { user }    = useAuth();
  const queryClient = useQueryClient();
  const { toast }   = useToast();
  const isAdmin     = user?.role === "Admin" || (user as any)?.isMasterAdmin;

  // ── Queries ──────────────────────────────────────────────────────────────────

  // Badge: staff_notifications unread count
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/staff-notifications/unread-count"],
    refetchInterval: 30_000,
  });

  // Messaging unread counts — included in badge so no message goes unnoticed
  const { data: threadUnreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/messaging-threads/unread-count"],
    refetchInterval: 60_000,
    enabled: !!user && user.role !== "Customer",
  });
  const { data: dmUnreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/dm/unread-count"],
    refetchInterval: 30_000,
    enabled: !!user && user.role !== "Customer",
  });

  const threadUnreadCount = Number(threadUnreadData?.unreadCount ?? 0);
  const dmUnreadCount     = Number(dmUnreadData?.count ?? 0);
  const unreadCount       = Number(countData?.count ?? 0) + threadUnreadCount + dmUnreadCount;

  // For You: full list, only when panel is open
  const { data: notifications = [], isLoading: notifsLoading } =
    useQuery<StaffNotification[]>({
      queryKey: ["/api/staff-notifications"],
      enabled: open,
    });

  // Activity: role-filtered server-side, only fetched when that tab is active
  const { data: activityItems = [], isLoading: activityLoading } =
    useQuery<ActivityLogItem[]>({
      queryKey: ["/api/activity-log"],
      enabled: open && activeTab === "activity",
    });

  // Activity unseen count — shown as ambient tab badge (blue), NOT part of main badge
  const { data: activityUnseenData } = useQuery<{ count: number }>({
    queryKey: ["/api/activity-log/unseen-count"],
    refetchInterval: 60_000,
    enabled: !!user && user.role !== "Customer",
  });
  const activityUnseen = Number(activityUnseenData?.count ?? 0);

  // Updates: only fetched when that tab is active
  const { data: updates = [] } = useQuery<AppUpdate[]>({
    queryKey: ["/api/updates/unseen"],
    enabled: open && activeTab === "updates",
    staleTime: 30_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const markOneRead = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/staff-notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications/unread-count"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => apiRequest("POST", "/api/staff-notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications/unread-count"] });
      toast({ title: "All notifications marked as read" });
    },
  });

  const markActivitySeen = useMutation({
    mutationFn: () => apiRequest("POST", "/api/activity-log/mark-seen"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activity-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity-log/unseen-count"] });
    },
  });

  const acknowledgeUpdate = useMutation({
    mutationFn: (updateId: string) =>
      apiRequest("POST", `/api/updates/${updateId}/acknowledge`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/updates/unseen"] }),
  });

  const acknowledgeAll = () => updates.forEach((u) => acknowledgeUpdate.mutate(u.id));

  // ── Outside-click close ───────────────────────────────────────────────────────

  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open, handleOutsideClick]);

  // ── Split For You into priority / regular ─────────────────────────────────────
  // Priority: unread AND type is in PRIORITY_TYPES → pinned at the top
  const priorityNotifs = notifications.filter(
    (n) => !n.isRead && PRIORITY_TYPES.has(n.type)
  );
  const regularNotifs  = notifications.filter(
    (n) => !((!n.isRead) && PRIORITY_TYPES.has(n.type))
  );

  const handleNotifClick = (n: StaffNotification) => {
    if (!n.isRead) markOneRead.mutate(n.id);
    if (n.link) { window.location.href = n.link; setOpen(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="relative" ref={panelRef}>

      {/* ── Single bell button ── */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "relative h-9 w-9 flex items-center justify-center rounded-xl transition-colors",
              open
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
            data-testid="button-unified-notifications"
            aria-label="Notifications"
          >
            <Bell className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full border-2 border-background px-0.5 leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>

      {/* ── Panel ── */}
      {open && (
        <div className="absolute right-0 mt-2 w-[400px] max-w-[calc(100vw-1rem)] bg-background border rounded-xl shadow-xl z-50 flex flex-col overflow-hidden max-h-[580px]">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20 shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Notifications</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <TabsList className="w-full grid grid-cols-3 rounded-none border-b h-9 shrink-0 bg-muted/10 p-0">
              <TabsTrigger
                value="for-you"
                className="text-xs h-full rounded-none data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 data-[state=active]:border-primary border-transparent"
              >
                For You
                {unreadCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="text-xs h-full rounded-none data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 data-[state=active]:border-primary border-transparent"
              >
                Activity
                {activityUnseen > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 bg-blue-500 text-white text-[9px] font-bold rounded-full leading-none">
                    {activityUnseen > 99 ? "99+" : activityUnseen}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="updates"
                className="text-xs h-full rounded-none data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 data-[state=active]:border-primary border-transparent"
              >
                Updates
                {updates.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 bg-muted-foreground/60 text-background text-[9px] font-bold rounded-full leading-none">
                    {updates.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ══════════════════════ FOR YOU ══════════════════════ */}
            <TabsContent value="for-you" className="flex-1 overflow-hidden flex flex-col m-0 data-[state=inactive]:hidden">

              {unreadCount > 0 && (
                <div className="flex justify-end px-3 pt-2 shrink-0">
                  <button
                    onClick={() => markAllRead.mutate()}
                    disabled={markAllRead.isPending}
                    className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                    data-testid="unified-mark-all-read"
                  >
                    <CheckCheck className="h-3 w-3" /> Mark all read
                  </button>
                </div>
              )}

              <ScrollArea className="flex-1">
                {notifsLoading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
                ) : notifications.length === 0 ? (
                  <div className="p-10 text-center">
                    <Bell className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">You're all caught up!</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">No notifications yet.</p>
                  </div>
                ) : (
                  <div>
                    {/* ── Needs Your Attention section ── */}
                    {priorityNotifs.length > 0 && (
                      <div className="mb-1">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/30 shrink-0">
                          <Zap className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                            Needs Your Attention
                          </span>
                        </div>
                        {priorityNotifs.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => handleNotifClick(n)}
                            className={cn(
                              "px-3 py-2.5 border-b border-amber-100/60 dark:border-amber-800/20 bg-amber-50/40 dark:bg-amber-900/10 last:border-b",
                              n.link && "cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/20"
                            )}
                            data-testid={`priority-notif-${n.id}`}
                          >
                            <div className="flex items-start gap-2">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold leading-tight">{n.title}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{timeAgo(n.createdAt)}</p>
                              </div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); markOneRead.mutate(n.id); }}
                                    className="shrink-0 p-1 rounded text-amber-500 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                                  >
                                    <Check className="h-3 w-3" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Mark as read</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Regular notifications ── */}
                    {regularNotifs.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={cn(
                          "px-3 py-2.5 border-b border-gray-50 dark:border-gray-800/50 last:border-0 transition-colors",
                          !n.isRead && "bg-blue-50/40 dark:bg-blue-900/10",
                          n.link && "cursor-pointer hover:bg-muted/40"
                        )}
                        data-testid={`notif-${n.id}`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.isRead && (
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                          )}
                          <div className={cn("flex-1 min-w-0", n.isRead && "pl-3.5")}>
                            <p className="text-xs font-medium leading-tight">{n.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{timeAgo(n.createdAt)}</p>
                          </div>
                          {!n.isRead && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => { e.stopPropagation(); markOneRead.mutate(n.id); }}
                                  className="shrink-0 p-1 rounded text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                  data-testid={`mark-read-${n.id}`}
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Mark as read</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {notifications.length > 0 && (
                <div className="px-3 py-2 border-t text-center shrink-0 bg-muted/10">
                  <a
                    href="/notifications"
                    onClick={() => setOpen(false)}
                    className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    View all notifications →
                  </a>
                </div>
              )}
            </TabsContent>

            {/* ══════════════════════ ACTIVITY ══════════════════════ */}
            <TabsContent value="activity" className="flex-1 overflow-hidden flex flex-col m-0 data-[state=inactive]:hidden">

              {activityUnseen > 0 && (
                <div className="flex justify-end px-3 pt-2 shrink-0">
                  <button
                    onClick={() => markActivitySeen.mutate()}
                    disabled={markActivitySeen.isPending}
                    className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                    data-testid="unified-mark-activity-seen"
                  >
                    <Check className="h-3 w-3" /> Mark all seen
                  </button>
                </div>
              )}

              <ScrollArea className="flex-1">
                {activityLoading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
                ) : activityItems.length === 0 ? (
                  <div className="p-10 text-center">
                    <Bell className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">No recent activity</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Events relevant to your role will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="p-2">
                    {activityItems.slice(0, 30).map((item) => {
                      const isSeen = (item.seenBy || []).includes(user?.id ?? "");
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "p-2.5 rounded-lg mb-0.5 transition-colors",
                            item.link && "cursor-pointer",
                            isSeen ? "opacity-50" : "bg-muted/30 hover:bg-muted/50"
                          )}
                          onClick={() => item.link && (window.location.href = item.link)}
                          data-testid={`activity-${item.id}`}
                        >
                          <div className="flex items-start gap-2">
                            <span className={cn("p-1.5 rounded-md shrink-0 mt-0.5", activityColor(item.eventType))}>
                              {activityIcon(item.eventType)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs leading-snug">{item.description}</p>
                              <span className="text-[10px] text-muted-foreground flex items-center mt-0.5 gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {timeAgo(item.createdAt)}
                              </span>
                            </div>
                            {!isSeen && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* ══════════════════════ UPDATES ══════════════════════ */}
            <TabsContent value="updates" className="flex-1 overflow-hidden flex flex-col m-0 data-[state=inactive]:hidden">

              {isAdmin && (
                <div className="px-3 pt-2 pb-1 shrink-0">
                  {!showPostForm ? (
                    <button
                      onClick={() => setShowPostForm(true)}
                      className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground border border-dashed rounded-lg py-1.5 hover:bg-muted/50 hover:text-foreground transition-colors"
                      data-testid="unified-post-update"
                    >
                      <Plus className="h-3 w-3" /> Post update
                    </button>
                  ) : (
                    <PostUpdateForm
                      onClose={() => setShowPostForm(false)}
                      onSuccess={() => {
                        setShowPostForm(false);
                        queryClient.invalidateQueries({ queryKey: ["/api/updates/unseen"] });
                      }}
                    />
                  )}
                </div>
              )}

              <ScrollArea className="flex-1">
                {updates.length === 0 ? (
                  <div className="p-10 text-center">
                    <Bell className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">All caught up!</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">No new updates.</p>
                  </div>
                ) : (
                  <div className="p-2">
                    {updates.length > 1 && (
                      <div className="flex justify-end mb-1 px-1">
                        <button
                          onClick={acknowledgeAll}
                          className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                          data-testid="unified-acknowledge-all"
                        >
                          <Check className="h-3 w-3" /> Mark all read
                        </button>
                      </div>
                    )}
                    {updates.map((u) => (
                      <div
                        key={u.id}
                        className="p-3 rounded-lg hover:bg-muted/50 mb-1.5 transition-colors cursor-pointer"
                        onClick={() =>
                          setExpandedUpdateId(expandedUpdateId === u.id ? null : u.id)
                        }
                        data-testid={`update-item-${u.id}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className={cn("p-1.5 rounded-md shrink-0 mt-0.5", updateColor(u.category))}>
                            {updateIcon(u.category)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium leading-tight">{u.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{u.description}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[10px] capitalize px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                {u.category}
                              </span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {new Date(u.publishedAt).toLocaleDateString("en-US", {
                                  month: "short", day: "numeric", year: "numeric",
                                })}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              acknowledgeUpdate.mutate(u.id);
                            }}
                            className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-0.5"
                            data-testid={`acknowledge-${u.id}`}
                            title="Dismiss"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        </div>
                        {expandedUpdateId === u.id && u.detailedContent && (
                          <div className="mt-2.5 pt-2.5 border-t text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                            {u.detailedContent}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* Messages shortcut bar — shows when there are unread threads/DMs */}
          {(threadUnreadCount > 0 || dmUnreadCount > 0) && (
            <div className="border-t px-4 py-2 bg-muted/20 shrink-0 flex items-center gap-2 text-xs flex-wrap">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              {threadUnreadCount > 0 && (
                <a
                  href="/customer-messages"
                  className="text-primary hover:underline"
                  onClick={() => setOpen(false)}
                  data-testid="link-thread-unread"
                >
                  {threadUnreadCount} unread customer thread{threadUnreadCount !== 1 ? "s" : ""}
                </a>
              )}
              {threadUnreadCount > 0 && dmUnreadCount > 0 && (
                <span className="text-muted-foreground">·</span>
              )}
              {dmUnreadCount > 0 && (
                <a
                  href="/messages"
                  className="text-primary hover:underline"
                  onClick={() => setOpen(false)}
                  data-testid="link-dm-unread"
                >
                  {dmUnreadCount} unread DM{dmUnreadCount !== 1 ? "s" : ""}
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Admin inline post-update form ─────────────────────────────────────────────

function PostUpdateForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle]       = useState("");
  const [description, setDesc]  = useState("");
  const [category, setCategory] = useState("feature");

  const post = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/updates", {
        title,
        description,
        category,
        version:  new Date().toISOString().slice(0, 10),
        minRole:  "Crew",
        isActive: true,
      }),
    onSuccess,
  });

  return (
    <div className="border rounded-lg p-2.5 space-y-1.5 bg-muted/20" data-testid="post-update-form">
      <Input
        placeholder="Update title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-xs h-7"
        data-testid="input-update-title"
      />
      <Textarea
        placeholder="Brief description"
        value={description}
        onChange={(e) => setDesc(e.target.value)}
        rows={2}
        className="text-xs resize-none"
        data-testid="input-update-description"
      />
      <div className="flex items-center gap-2">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-7 text-xs flex-1" data-testid="select-update-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="feature">Feature</SelectItem>
            <SelectItem value="improvement">Improvement</SelectItem>
            <SelectItem value="bugfix">Bug Fix</SelectItem>
            <SelectItem value="announcement">Announcement</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="text-xs h-7 px-3"
          onClick={() => post.mutate()}
          disabled={!title.trim() || !description.trim() || post.isPending}
          data-testid="button-submit-update"
        >
          Post
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 px-2"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
