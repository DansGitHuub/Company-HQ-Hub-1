import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Search,
  Send,
  Loader2,
  User,
  Clock,
  AlertCircle,
  CheckCircle2,
  Circle,
  Filter,
  RefreshCw,
  Lock,
  StickyNote,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

type Thread = {
  id: string;
  customerId: string;
  assignedEmployeeId: string | null;
  subject: string;
  status: string;
  priority: string;
  lastMessageAt: string;
  unreadByEmployee: boolean;
  createdAt: string;
};

type ThreadMessage = {
  id: string;
  threadId: string;
  senderId: string;
  senderRole: string;
  content: string;
  isInternalNote: boolean;
  createdAt: string;
};

type UserRecord = {
  id: string;
  name: string;
  username: string;
  role: string;
  email: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low:    { label: "Low",    className: "bg-slate-100 text-slate-700 border-slate-200" },
  normal: { label: "Normal", className: "bg-blue-50 text-blue-700 border-blue-200" },
  high:   { label: "High",   className: "bg-amber-50 text-amber-700 border-amber-200" },
  urgent: { label: "Urgent", className: "bg-red-50 text-red-700 border-red-200" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.FC<any>; className: string }> = {
  open:        { label: "Open",        icon: Circle,       className: "bg-green-50 text-green-700 border-green-200" },
  in_progress: { label: "In Progress", icon: Clock,        className: "bg-blue-50 text-blue-700 border-blue-200" },
  resolved:    { label: "Resolved",    icon: CheckCircle2, className: "bg-slate-50 text-slate-600 border-slate-200" },
  closed:      { label: "Closed",      icon: Lock,         className: "bg-slate-100 text-slate-500 border-slate-200" },
};

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", cfg.className)}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border", cfg.className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function timeAgo(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

function fmtTime(iso: string) {
  try {
    return format(new Date(iso), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return "";
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: "all",        label: "All" },
  { value: "open",       label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved",   label: "Resolved" },
  { value: "closed",     label: "Closed" },
];

export default function CustomerMessagesInbox() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch]           = useState("");
  const [replyText, setReplyText]     = useState("");
  const [asInternal, setAsInternal]   = useState(false);

  const [taskDialogMessage, setTaskDialogMessage] = useState<ThreadMessage | null>(null);
  const [taskTitle, setTaskTitle]             = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignee, setTaskAssignee]       = useState("__none__");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isManager =
    user?.role === "Admin" || user?.role === "Manager" || (user as any)?.isMasterAdmin;

  // ── Data fetching ───────────────────────────────────────────────────────────

  const { data: threads = [], isLoading: threadsLoading, refetch: refetchThreads } = useQuery<Thread[]>({
    queryKey: ["/api/messaging-threads"],
    refetchInterval: 30_000,
  });

  const { data: allUsers = [] } = useQuery<UserRecord[]>({
    queryKey: ["/api/admin/users"],
    enabled: isManager,
  });

  const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));
  const staffUsers = allUsers.filter((u) => u.role !== "Customer");

  const { data: messages = [], isLoading: msgsLoading } = useQuery<ThreadMessage[]>({
    queryKey: [`/api/messaging-threads/${selectedId}/messages`],
    enabled: !!selectedId,
    refetchInterval: 15_000,
  });

  const selectedThread = threads.find((t) => t.id === selectedId);

  // Scroll to bottom when messages load / change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Invalidate unread after opening a thread
  useEffect(() => {
    if (selectedId) {
      queryClient.invalidateQueries({ queryKey: ["/api/messaging-threads"] });
    }
  }, [selectedId]);

  // ── Mutations ───────────────────────────────────────────────────────────────

  const replyMutation = useMutation({
    mutationFn: (body: { content: string; isInternalNote: boolean }) =>
      apiRequest("POST", `/api/messaging-threads/${selectedId}/messages`, body),
    onSuccess: () => {
      setReplyText("");
      setAsInternal(false);
      queryClient.invalidateQueries({ queryKey: [`/api/messaging-threads/${selectedId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ["/api/messaging-threads"] });
    },
    onError: () => toast({ title: "Failed to send reply", variant: "destructive" }),
  });

  const updateThreadMutation = useMutation({
    mutationFn: (updates: Partial<{ status: string; priority: string; assignedEmployeeId: string | null }>) =>
      apiRequest("PATCH", `/api/messaging-threads/${selectedId}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messaging-threads"] });
      toast({ title: "Thread updated" });
    },
    onError: () => toast({ title: "Failed to update thread", variant: "destructive" }),
  });

  const createTaskMutation = useMutation({
    mutationFn: (body: { title: string; description: string; assignedToUserId: string | null }) =>
      apiRequest("POST", "/api/tasks", {
        title: body.title,
        description: body.description,
        priority: "medium",
        assignedToUserId: body.assignedToUserId,
        linkedRecordType: "messaging_thread",
        linkedRecordId: selectedId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task created", description: "Follow-up task created from this message." });
      setTaskDialogMessage(null);
      setTaskTitle("");
      setTaskDescription("");
      setTaskAssignee("__none__");
    },
    onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
  });

  function openTaskDialog(msg: ThreadMessage) {
    const customer = selectedThread ? userMap[selectedThread.customerId] : undefined;
    const customerName = customer ? (customer.name || customer.username) : "customer";
    setTaskDialogMessage(msg);
    setTaskTitle(selectedThread ? `Follow up: ${selectedThread.subject}` : "Follow up on customer message");
    setTaskDescription(`Re: message from ${customerName}\n\n"${msg.content}"`);
    setTaskAssignee(selectedThread?.assignedEmployeeId || "__none__");
  }

  // ── Filtered thread list ────────────────────────────────────────────────────

  const filteredThreads = threads
    .filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const customer = userMap[t.customerId];
        return (
          t.subject.toLowerCase().includes(q) ||
          customer?.name?.toLowerCase().includes(q) ||
          customer?.username?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  // ── Access guard ────────────────────────────────────────────────────────────
  if (!isManager) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <AlertCircle className="h-10 w-10" />
        <p className="text-lg font-medium">Admin or Manager access required</p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">

      {/* ── Left panel: Thread list ──────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 border-r flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h1 className="font-semibold text-sm">Customer Messages</h1>
              {threads.filter((t) => t.unreadByEmployee).length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold px-1">
                  {threads.filter((t) => t.unreadByEmployee).length}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => refetchThreads()}
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search threads…"
              className="pl-8 h-8 text-sm"
              data-testid="input-search-threads"
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                  statusFilter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
                data-testid={`filter-status-${f.value}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {threadsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground px-4 text-center">
              <MessageSquare className="h-8 w-8 opacity-40" />
              <p className="text-sm">
                {search ? "No threads match your search" : "No customer threads yet"}
              </p>
            </div>
          ) : (
            filteredThreads.map((thread) => {
              const customer = userMap[thread.customerId];
              const assignee = thread.assignedEmployeeId ? userMap[thread.assignedEmployeeId] : null;
              const isSelected = thread.id === selectedId;
              return (
                <button
                  key={thread.id}
                  onClick={() => setSelectedId(thread.id)}
                  data-testid={`thread-row-${thread.id}`}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b transition-colors hover:bg-muted/50",
                    isSelected && "bg-primary/5 border-l-2 border-l-primary"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {/* Unread dot */}
                    <div className="mt-1.5 flex-shrink-0">
                      {thread.unreadByEmployee ? (
                        <span className="block h-2 w-2 rounded-full bg-primary" title="Unread" />
                      ) : (
                        <span className="block h-2 w-2 rounded-full bg-transparent" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm truncate",
                        thread.unreadByEmployee ? "font-semibold" : "font-medium"
                      )}>
                        {thread.subject}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {customer ? (customer.name || customer.username) : "Unknown customer"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <PriorityBadge priority={thread.priority || "normal"} />
                        <StatusBadge status={thread.status} />
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs text-muted-foreground">
                          {assignee ? `→ ${assignee.name || assignee.username}` : "Unassigned"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(thread.lastMessageAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right panel: Thread detail ───────────────────────────────────── */}
      {selectedThread ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Thread header */}
          <div className="px-6 py-3 border-b bg-card flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-base truncate">{selectedThread.subject}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <PriorityBadge priority={selectedThread.priority || "normal"} />
                <StatusBadge status={selectedThread.status} />
                <span className="text-xs text-muted-foreground">
                  From: {userMap[selectedThread.customerId]?.name || userMap[selectedThread.customerId]?.username || selectedThread.customerId}
                </span>
                <span className="text-xs text-muted-foreground">
                  Opened {timeAgo(selectedThread.createdAt)}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Priority */}
              <Select
                value={selectedThread.priority || "normal"}
                onValueChange={(v) => updateThreadMutation.mutate({ priority: v })}
              >
                <SelectTrigger className="h-8 text-xs w-28" data-testid="select-priority">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>

              {/* Status */}
              <Select
                value={selectedThread.status}
                onValueChange={(v) => updateThreadMutation.mutate({ status: v })}
              >
                <SelectTrigger className="h-8 text-xs w-32" data-testid="select-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              {/* Assign */}
              <Select
                value={selectedThread.assignedEmployeeId || "__none__"}
                onValueChange={(v) =>
                  updateThreadMutation.mutate({ assignedEmployeeId: v === "__none__" ? null : v })
                }
              >
                <SelectTrigger className="h-8 text-xs w-36" data-testid="select-assignee">
                  <SelectValue placeholder="Assign to…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {staffUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {msgsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <MessageSquare className="h-8 w-8 opacity-40" />
                <p className="text-sm">No messages yet</p>
              </div>
            ) : (
              messages.map((msg) => {
                const sender = userMap[msg.senderId];
                const isFromCustomer = msg.senderRole === "customer";
                const isInternal = msg.isInternalNote;
                return (
                  <div
                    key={msg.id}
                    data-testid={`message-${msg.id}`}
                    className={cn(
                      "group flex gap-3",
                      !isFromCustomer && "flex-row-reverse"
                    )}
                  >
                    {/* Avatar */}
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
                      isFromCustomer
                        ? "bg-emerald-100 text-emerald-700"
                        : isInternal
                        ? "bg-amber-100 text-amber-700"
                        : "bg-primary/10 text-primary"
                    )}>
                      {isFromCustomer
                        ? (sender?.name || sender?.username || "C")[0].toUpperCase()
                        : (sender?.name || sender?.username || "S")[0].toUpperCase()}
                    </div>

                    <div className={cn("max-w-[70%]", !isFromCustomer && "items-end flex flex-col")}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {sender ? (sender.name || sender.username) : msg.senderRole}
                        </span>
                        {isInternal && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                            <StickyNote className="h-3 w-3" />
                            Internal note
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {fmtTime(msg.createdAt)}
                        </span>
                        <button
                          onClick={() => openTaskDialog(msg)}
                          title="Create task from this message"
                          data-testid={`button-create-task-${msg.id}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                        >
                          <ListTodo className="h-3 w-3" />
                        </button>
                      </div>
                      <div className={cn(
                        "rounded-lg px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                        isFromCustomer
                          ? "bg-muted text-foreground rounded-tl-none"
                          : isInternal
                          ? "bg-amber-50 border border-amber-200 text-amber-900 rounded-tr-none"
                          : "bg-primary text-primary-foreground rounded-tr-none"
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply box */}
          <div className="px-6 py-4 border-t bg-card">
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={asInternal}
                  onChange={(e) => setAsInternal(e.target.checked)}
                  className="rounded"
                  data-testid="checkbox-internal-note"
                />
                <StickyNote className="h-3.5 w-3.5" />
                Internal note (not visible to customer)
              </label>
            </div>
            <div className="flex gap-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={asInternal ? "Add an internal note…" : "Type your reply to the customer…"}
                className={cn(
                  "flex-1 min-h-[80px] text-sm resize-none",
                  asInternal && "border-amber-300 focus-visible:ring-amber-400"
                )}
                data-testid="textarea-reply"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && replyText.trim()) {
                    replyMutation.mutate({ content: replyText.trim(), isInternalNote: asInternal });
                  }
                }}
              />
              <Button
                onClick={() => {
                  if (replyText.trim()) {
                    replyMutation.mutate({ content: replyText.trim(), isInternalNote: asInternal });
                  }
                }}
                disabled={!replyText.trim() || replyMutation.isPending}
                className="self-end"
                data-testid="button-send-reply"
              >
                {replyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="ml-1.5">{asInternal ? "Add Note" : "Reply"}</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Ctrl+Enter to send · Changes to status/priority/assignment save immediately
            </p>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <MessageSquare className="h-12 w-12 opacity-30" />
          <p className="text-lg font-medium">Select a thread to read and reply</p>
          <p className="text-sm">
            {threads.length === 0
              ? "No customer messages yet"
              : `${threads.filter((t) => t.unreadByEmployee).length} unread thread${threads.filter((t) => t.unreadByEmployee).length !== 1 ? "s" : ""}`}
          </p>
        </div>
      )}

      {/* Create Task from Message dialog */}
      <Dialog open={!!taskDialogMessage} onOpenChange={(open) => !open && setTaskDialogMessage(null)}>
        <DialogContent data-testid="dialog-create-task">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              Create Task from Message
            </DialogTitle>
            <DialogDescription>
              Creates a follow-up task linked back to this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="task-title" className="text-xs">Title</Label>
              <Input
                id="task-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                data-testid="input-task-title"
              />
            </div>
            <div>
              <Label htmlFor="task-description" className="text-xs">Description</Label>
              <Textarea
                id="task-description"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                className="min-h-[100px] text-sm"
                data-testid="textarea-task-description"
              />
            </div>
            <div>
              <Label className="text-xs">Assign to</Label>
              <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                <SelectTrigger className="h-9" data-testid="select-task-assignee">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {staffUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogMessage(null)} data-testid="button-cancel-task">
              Cancel
            </Button>
            <Button
              onClick={() =>
                createTaskMutation.mutate({
                  title: taskTitle.trim(),
                  description: taskDescription.trim(),
                  assignedToUserId: taskAssignee === "__none__" ? null : taskAssignee,
                })
              }
              disabled={!taskTitle.trim() || createTaskMutation.isPending}
              data-testid="button-submit-task"
            >
              {createTaskMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <ListTodo className="h-4 w-4 mr-1.5" />
              )}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
