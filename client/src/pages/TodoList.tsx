import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Plus, Search, Filter, ChevronDown, ChevronRight, ChevronLeft,
  Clock, AlertTriangle, CheckCircle2, Circle, Play, Pause,
  RotateCcw, X, User, Calendar, MapPin, Paperclip, History,
  Users, BarChart3, Loader2, Send, ArrowRight, Check, XCircle,
  ListChecks, Bell, Eye, RefreshCw, FileText, Timer,
} from "lucide-react";

type Task = {
  id: string;
  taskId: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  createdByUserId: string;
  assignedToUserId: string;
  dueDate: string | null;
  dueTime: string | null;
  category: string | null;
  estimatedMinutes: number | null;
  location: string | null;
  requiresConfirmation: boolean;
  completionNotes: string | null;
  isRecurring: boolean;
  recurringConfig: any;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  assigneeName?: string;
  creatorName?: string;
  isOverdue?: boolean;
  checklist?: any[];
  history?: any[];
  attachments?: any[];
  delegationChain?: any[];
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  p1_urgent: { label: "Urgent", color: "#C0392B", bg: "bg-red-50 dark:bg-red-950" },
  p2_high: { label: "High", color: "#E67E22", bg: "bg-orange-50 dark:bg-orange-950" },
  p3_normal: { label: "Normal", color: "#F1C40F", bg: "bg-yellow-50 dark:bg-yellow-950" },
  p4_low: { label: "Low", color: "#27AE60", bg: "bg-green-50 dark:bg-green-950" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  assigned: { label: "Assigned", icon: Bell, color: "text-blue-500" },
  acknowledged: { label: "Acknowledged", icon: Eye, color: "text-indigo-500" },
  in_progress: { label: "In Progress", icon: Play, color: "text-yellow-500" },
  on_hold: { label: "On Hold", icon: Pause, color: "text-gray-500" },
  reassigned: { label: "Reassigned", icon: ArrowRight, color: "text-purple-500" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-green-500" },
  confirmed: { label: "Confirmed", icon: Check, color: "text-green-700" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-red-400" },
  overdue: { label: "Overdue", icon: AlertTriangle, color: "text-red-600" },
};

const TABS = [
  { id: "my", label: "My Tasks", icon: ListChecks },
  { id: "assigned", label: "Assigned By Me", icon: Send },
  { id: "team", label: "Team View", icon: Users },
  { id: "reports", label: "Reports", icon: BarChart3 },
];

const CATEGORIES = ["Maintenance", "Installation", "Safety", "Admin", "Training", "Cleanup", "Client Follow-up", "Equipment", "Other"];

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 Weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
];

function formatDate(d: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < -1) return `${Math.abs(Math.floor(diff))} days ago`;
  if (diff <= 7) return `In ${Math.floor(diff)} days`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.p3_normal;
  return (
    <span
      data-testid={`priority-badge-${priority}`}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.assigned;
  const Icon = cfg.icon;
  return (
    <span data-testid={`status-badge-${status}`} className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

function TaskCard({ task, onClick, onAction, currentUserId }: {
  task: Task; onClick: () => void; onAction: (action: string) => void; currentUserId: string;
}) {
  const isAssignee = task.assignedToUserId === currentUserId;
  const p = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.p3_normal;

  return (
    <div
      data-testid={`task-card-${task.id}`}
      onClick={onClick}
      className={`group rounded-xl border cursor-pointer transition-all hover:shadow-md ${
        task.isOverdue ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      }`}
    >
      <div className="flex">
        <div className="w-1.5 rounded-l-xl flex-shrink-0" style={{ backgroundColor: p.color }} />
        <div className="flex-1 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate" data-testid={`task-title-${task.id}`}>{task.title}</h4>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge status={task.status} />
                <span className="text-xs text-gray-400">{task.taskId}</span>
                {task.category && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{task.category}</span>}
              </div>
            </div>
            <PriorityBadge priority={task.priority} />
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
            {task.dueDate && (
              <span className={`flex items-center gap-1 ${task.isOverdue ? "text-red-600 font-semibold" : ""}`}>
                <Clock className="w-3 h-3" />
                {formatDate(task.dueDate)}
                {task.dueTime && ` ${task.dueTime}`}
              </span>
            )}
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {task.assigneeName || "Unassigned"}
            </span>
            {task.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {task.location}
              </span>
            )}
          </div>

          {isAssignee && !["completed", "confirmed", "cancelled"].includes(task.status) && (
            <div className="flex gap-2 mt-2.5" onClick={e => e.stopPropagation()}>
              {task.status === "assigned" && (
                <button
                  data-testid={`task-ack-${task.id}`}
                  onClick={() => onAction("acknowledged")}
                  className="px-3 py-1.5 text-xs rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 font-medium transition-colors"
                >
                  Acknowledge
                </button>
              )}
              {task.status === "acknowledged" && (
                <button
                  data-testid={`task-start-${task.id}`}
                  onClick={() => onAction("in_progress")}
                  className="px-3 py-1.5 text-xs rounded-lg bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 font-medium transition-colors"
                >
                  Start
                </button>
              )}
              {(task.status === "in_progress" || task.status === "overdue") && (
                <button
                  data-testid={`task-complete-${task.id}`}
                  onClick={() => onAction("completed")}
                  className="px-3 py-1.5 text-xs rounded-lg bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 font-medium transition-colors"
                >
                  Complete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskSection({ title, tasks, color, defaultOpen = true, onClick, onAction, currentUserId }: {
  title: string; tasks: Task[]; color: string; defaultOpen?: boolean;
  onClick: (t: Task) => void; onAction: (t: Task, a: string) => void; currentUserId: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (tasks.length === 0) return null;

  return (
    <div className="mb-4" data-testid={`task-section-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 mb-2 text-sm font-semibold uppercase tracking-wider w-full text-left"
        style={{ color }}
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {title}
        <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          {tasks.length}
        </span>
      </button>
      {open && (
        <div className="space-y-2">
          {tasks.map(t => (
            <TaskCard key={t.id} task={t} onClick={() => onClick(t)} onAction={a => onAction(t, a)} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  );
}

function FullTaskForm({ users, currentUser, onClose, initialData }: {
  users: any[]; currentUser: any; onClose: () => void; initialData?: any;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [type, setType] = useState(initialData?.type || "standard");
  const [priority, setPriority] = useState(initialData?.priority || "p3_normal");
  const [assigneeId, setAssigneeId] = useState(initialData?.assignee || initialData?.assignedToUserId || currentUser?.id || "");
  const [dueDate, setDueDate] = useState(initialData?.dueDate ? initialData.dueDate.split("T")[0] : "");
  const [dueTime, setDueTime] = useState(initialData?.dueTime || "");
  const [category, setCategory] = useState(initialData?.category || "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(initialData?.estimatedMinutes?.toString() || "");
  const [location, setLocation] = useState(initialData?.location || "");
  const [requiresConfirmation, setRequiresConfirmation] = useState(initialData?.requiresConfirmation ?? false);
  const [isRecurring, setIsRecurring] = useState(initialData?.isRecurring ?? false);
  const [frequency, setFrequency] = useState("weekly");
  const [intervalDays, setIntervalDays] = useState("7");
  const [checklistItems, setChecklistItems] = useState<string[]>([""]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/assigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/calendar-events"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      description: description || null,
      type,
      priority,
      assignedToUserId: assigneeId,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      category: category || null,
      estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
      location: location || null,
      requiresConfirmation,
      isRecurring,
      recurringConfig: isRecurring ? { frequency, interval_days: parseInt(intervalDays) || 7 } : null,
      checklistItems: type === "checklist" ? checklistItems.filter(i => i.trim()).map(text => ({ text })) : [],
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white" data-testid="full-form-title">Create Task</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" data-testid="full-form-close"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
            <input
              data-testid="full-form-input-title"
              value={title} onChange={e => setTitle(e.target.value.substring(0, 120))}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
              placeholder="Task title" required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              data-testid="full-form-input-description"
              value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 min-h-[80px]"
              placeholder="Details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <select
                data-testid="full-form-select-type"
                value={type} onChange={e => setType(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="standard">Standard</option>
                <option value="checklist">Checklist</option>
                <option value="delegated">Delegated</option>
                <option value="recurring">Recurring</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
              <select
                data-testid="full-form-select-priority"
                value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign To</label>
            <select
              data-testid="full-form-select-assignee"
              value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">Select...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
              <input
                data-testid="full-form-input-duedate"
                type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Time</label>
              <input
                data-testid="full-form-input-duetime"
                type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <select
                data-testid="full-form-select-category"
                value={category} onChange={e => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">None</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Est. Minutes</label>
              <input
                data-testid="full-form-input-minutes"
                type="number" value={estimatedMinutes} onChange={e => setEstimatedMinutes(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="30"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
            <input
              data-testid="full-form-input-location"
              value={location} onChange={e => setLocation(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="Job site address or description"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                data-testid="full-form-checkbox-confirmation"
                type="checkbox" checked={requiresConfirmation} onChange={e => setRequiresConfirmation(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-green-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Requires confirmation</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                data-testid="full-form-checkbox-recurring"
                type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-green-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Recurring task</span>
            </label>
          </div>

          {isRecurring && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl space-y-3">
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-300">Frequency</label>
              <select
                data-testid="full-form-select-frequency"
                value={frequency} onChange={e => setFrequency(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800"
              >
                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              {frequency === "custom" && (
                <div>
                  <label className="block text-xs text-blue-700 dark:text-blue-400 mb-1">Every X days</label>
                  <input
                    data-testid="full-form-input-interval"
                    type="number" value={intervalDays} onChange={e => setIntervalDays(e.target.value)}
                    className="w-24 px-3 py-2 border rounded-lg bg-white dark:bg-gray-800"
                  />
                </div>
              )}
            </div>
          )}

          {type === "checklist" && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Checklist Items</label>
              {checklistItems.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    data-testid={`full-form-checklist-${i}`}
                    value={item}
                    onChange={e => {
                      const updated = [...checklistItems];
                      updated[i] = e.target.value;
                      setChecklistItems(updated);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    placeholder={`Item ${i + 1}`}
                  />
                  {checklistItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setChecklistItems(checklistItems.filter((_, j) => j !== i))}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                data-testid="full-form-add-checklist"
                onClick={() => setChecklistItems([...checklistItems, ""])}
                className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add item
              </button>
            </div>
          )}

          {createMutation.isError && (
            <p className="text-red-500 text-sm" data-testid="full-form-error">{(createMutation.error as Error).message}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              data-testid="full-form-submit"
              disabled={!title.trim() || !assigneeId || createMutation.isPending}
              className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              Create Task
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskDetail({ taskId, onClose, currentUser }: { taskId: string; onClose: () => void; currentUser: any }) {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/my"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/assigned"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/team"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/calendar-events"] });
  };

  const { data: task, isLoading } = useQuery<Task>({
    queryKey: ["/api/tasks", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load task");
      return res.json();
    },
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/tasks/assignable-users"],
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status, note, completionNotes }: any) => {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note, completionNotes }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: invalidateAll,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: invalidateAll,
  });

  const sendBackMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await fetch(`/api/tasks/${taskId}/send-back`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: invalidateAll,
  });

  const reassignMutation = useMutation({
    mutationFn: async ({ toUserId, reason }: any) => {
      const res = await fetch(`/api/tasks/${taskId}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId, reason }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: invalidateAll,
  });

  const checklistMutation = useMutation({
    mutationFn: async ({ itemId, isCompleted }: any) => {
      const res = await fetch(`/api/tasks/${taskId}/checklist/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId] }),
  });

  const [completionNotes, setCompletionNotes] = useState("");
  const [sendBackReason, setSendBackReason] = useState("");
  const [showSendBack, setShowSendBack] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [reassignTo, setReassignTo] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [activeTab, setActiveTab] = useState<"details" | "checklist" | "history" | "delegation">("details");

  if (isLoading || !task) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-900 rounded-2xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      </div>
    );
  }

  const isAssignee = task.assignedToUserId === currentUser?.id;
  const isCreator = task.createdByUserId === currentUser?.id;
  const isAdmin = currentUser?.role === "Admin" || currentUser?.isMasterAdmin;
  const isManager = currentUser?.role === "Manager";
  const checklistTotal = task.checklist?.length || 0;
  const checklistDone = task.checklist?.filter((c: any) => c.isCompleted).length || 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" data-testid="task-detail-back">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <span className="text-xs text-gray-400" data-testid="task-detail-id">{task.taskId}</span>
                <h2 className="font-semibold text-gray-900 dark:text-white" data-testid="task-detail-title">{task.title}</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={task.priority} />
              <StatusBadge status={task.status} />
            </div>
          </div>
        </div>

        <div className="border-b border-gray-200 dark:border-gray-700 px-6">
          <div className="flex gap-4">
            {(["details", "checklist", "history", "delegation"] as const).map(tab => (
              <button
                key={tab}
                data-testid={`task-tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                  activeTab === tab ? "border-green-600 text-green-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "checklist" && checklistTotal > 0 ? `Checklist (${checklistDone}/${checklistTotal})` : tab}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === "details" && (
            <div className="space-y-4">
              {task.description && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Description</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap" data-testid="task-detail-description">{task.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Created by</span>
                  <p className="font-medium text-gray-900 dark:text-white" data-testid="task-detail-creator">{task.creatorName}</p>
                </div>
                <div>
                  <span className="text-gray-500">Assigned to</span>
                  <p className="font-medium text-gray-900 dark:text-white" data-testid="task-detail-assignee">{task.assigneeName}</p>
                </div>
                {task.dueDate && (
                  <div>
                    <span className="text-gray-500">Due</span>
                    <p className={`font-medium ${task.isOverdue ? "text-red-600" : "text-gray-900 dark:text-white"}`} data-testid="task-detail-due">
                      {formatDate(task.dueDate)} {task.dueTime || ""}
                    </p>
                  </div>
                )}
                {task.category && (
                  <div>
                    <span className="text-gray-500">Category</span>
                    <p className="font-medium text-gray-900 dark:text-white">{task.category}</p>
                  </div>
                )}
                {task.estimatedMinutes && (
                  <div>
                    <span className="text-gray-500">Estimated</span>
                    <p className="font-medium text-gray-900 dark:text-white">{task.estimatedMinutes} min</p>
                  </div>
                )}
                {task.location && (
                  <div>
                    <span className="text-gray-500">Location</span>
                    <p className="font-medium text-gray-900 dark:text-white">{task.location}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Created</span>
                  <p className="font-medium text-gray-900 dark:text-white">{formatDateTime(task.createdAt)}</p>
                </div>
                {task.acknowledgedAt && (
                  <div>
                    <span className="text-gray-500">Acknowledged</span>
                    <p className="font-medium text-gray-900 dark:text-white">{formatDateTime(task.acknowledgedAt)}</p>
                  </div>
                )}
                {task.startedAt && (
                  <div>
                    <span className="text-gray-500">Started</span>
                    <p className="font-medium text-gray-900 dark:text-white">{formatDateTime(task.startedAt)}</p>
                  </div>
                )}
                {task.completedAt && (
                  <div>
                    <span className="text-gray-500">Completed</span>
                    <p className="font-medium text-gray-900 dark:text-white">{formatDateTime(task.completedAt)}</p>
                  </div>
                )}
              </div>
              {task.completionNotes && (
                <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <h4 className="text-xs font-medium text-green-700 dark:text-green-400 uppercase mb-1">Completion Notes</h4>
                  <p className="text-sm text-green-800 dark:text-green-300">{task.completionNotes}</p>
                </div>
              )}
              {task.isRecurring && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <h4 className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Recurring Task
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                    {task.recurringConfig?.frequency || "Custom"} schedule
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "checklist" && (
            <div className="space-y-2">
              {checklistTotal > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progress</span>
                    <span>{checklistDone}/{checklistTotal}</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(checklistDone / checklistTotal) * 100}%` }} />
                  </div>
                </div>
              )}
              {task.checklist?.map((item: any) => (
                <label key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer" data-testid={`checklist-item-${item.id}`}>
                  <input
                    type="checkbox"
                    checked={item.isCompleted}
                    onChange={() => checklistMutation.mutate({ itemId: item.id, isCompleted: !item.isCompleted })}
                    className="w-4 h-4 rounded border-gray-300 text-green-600"
                    disabled={!isAssignee && !isAdmin}
                  />
                  <span className={`text-sm ${item.isCompleted ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-300"}`}>{item.itemText}</span>
                </label>
              ))}
              {checklistTotal === 0 && <p className="text-sm text-gray-400 text-center py-4">No checklist items</p>}
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-3">
              {task.history?.map((h: any) => (
                <div key={h.id} className="flex gap-3 text-sm" data-testid={`history-entry-${h.id}`}>
                  <div className="w-2 h-2 rounded-full bg-gray-400 mt-2 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium">{h.changedByName || "System"}</span>
                      {" "}{h.eventType.replace("_", " ")}
                      {h.oldValue && h.newValue && <span className="text-gray-400"> ({h.oldValue} → {h.newValue})</span>}
                    </p>
                    {h.note && <p className="text-gray-400 text-xs mt-0.5">{h.note}</p>}
                    <p className="text-gray-400 text-xs">{formatDateTime(h.createdAt)}</p>
                  </div>
                </div>
              ))}
              {(!task.history || task.history.length === 0) && <p className="text-sm text-gray-400 text-center py-4">No history</p>}
            </div>
          )}

          {activeTab === "delegation" && (
            <div className="space-y-3">
              {task.delegationChain?.map((d: any) => (
                <div key={d.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm" data-testid={`delegation-${d.id}`}>
                  <ArrowRight className="w-4 h-4 text-purple-500 flex-shrink-0" />
                  <div>
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium">{d.fromName}</span> → <span className="font-medium">{d.toName}</span>
                    </p>
                    {d.reason && <p className="text-gray-400 text-xs">{d.reason}</p>}
                    <p className="text-gray-400 text-xs">{formatDateTime(d.delegatedAt)}</p>
                  </div>
                </div>
              ))}
              {(!task.delegationChain || task.delegationChain.length === 0) && <p className="text-sm text-gray-400 text-center py-4">No delegation history</p>}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 space-y-3">
          {isAssignee && task.status === "assigned" && (
            <button data-testid="action-acknowledge" onClick={() => statusMutation.mutate({ status: "acknowledged" })}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
              disabled={statusMutation.isPending}>Acknowledge Task</button>
          )}
          {isAssignee && task.status === "acknowledged" && (
            <button data-testid="action-start" onClick={() => statusMutation.mutate({ status: "in_progress" })}
              className="w-full py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white font-medium transition-colors"
              disabled={statusMutation.isPending}>Start Working</button>
          )}
          {isAssignee && (task.status === "in_progress" || task.status === "overdue") && (
            <div className="space-y-2">
              <textarea
                data-testid="completion-notes"
                value={completionNotes} onChange={e => setCompletionNotes(e.target.value)}
                placeholder="Completion notes (optional)"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-sm"
              />
              <button data-testid="action-complete" onClick={() => statusMutation.mutate({ status: "completed", completionNotes })}
                className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
                disabled={statusMutation.isPending}>Mark Complete</button>
            </div>
          )}
          {isAssignee && task.status === "in_progress" && (
            <button data-testid="action-hold" onClick={() => statusMutation.mutate({ status: "on_hold" })}
              className="w-full py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 text-sm transition-colors"
              disabled={statusMutation.isPending}>Put On Hold</button>
          )}
          {isAssignee && task.status === "on_hold" && (
            <button data-testid="action-resume" onClick={() => statusMutation.mutate({ status: "in_progress" })}
              className="w-full py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white font-medium transition-colors"
              disabled={statusMutation.isPending}>Resume</button>
          )}

          {(isCreator || isAdmin || isManager) && task.status === "completed" && task.requiresConfirmation && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button data-testid="action-confirm" onClick={() => confirmMutation.mutate()}
                  className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
                  disabled={confirmMutation.isPending}>
                  <Check className="w-4 h-4 inline mr-1" /> Confirm
                </button>
                <button data-testid="action-send-back-toggle" onClick={() => setShowSendBack(!showSendBack)}
                  className="flex-1 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 font-medium transition-colors">
                  Send Back
                </button>
              </div>
              {showSendBack && (
                <div className="space-y-2">
                  <textarea
                    data-testid="send-back-reason"
                    value={sendBackReason} onChange={e => setSendBackReason(e.target.value)}
                    placeholder="Why is this being sent back?"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-sm"
                    required
                  />
                  <button data-testid="action-send-back-submit" onClick={() => {
                    if (sendBackReason.trim()) sendBackMutation.mutate(sendBackReason);
                  }}
                    className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                    disabled={!sendBackReason.trim() || sendBackMutation.isPending}>Submit</button>
                </div>
              )}
            </div>
          )}

          {!["completed", "confirmed", "cancelled"].includes(task.status) && (isAssignee || isCreator || isAdmin || isManager) && (
            <div className="flex gap-2">
              <button data-testid="action-reassign-toggle" onClick={() => setShowReassign(!showReassign)}
                className="flex-1 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 text-sm transition-colors">
                Reassign
              </button>
              {(isCreator || isAdmin) && (
                <button data-testid="action-cancel" onClick={() => statusMutation.mutate({ status: "cancelled" })}
                  className="py-2 px-4 rounded-xl border border-red-300 dark:border-red-800 text-red-600 hover:bg-red-50 text-sm transition-colors"
                  disabled={statusMutation.isPending}>Cancel</button>
              )}
            </div>
          )}

          {showReassign && (
            <div className="space-y-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
              <select
                data-testid="reassign-user-select"
                value={reassignTo} onChange={e => setReassignTo(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm"
              >
                <option value="">Select user...</option>
                {users.filter(u => u.id !== task.assignedToUserId).map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
              <input
                data-testid="reassign-reason"
                value={reassignReason} onChange={e => setReassignReason(e.target.value)}
                placeholder="Reason (optional)"
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm"
              />
              <button
                data-testid="reassign-submit"
                onClick={() => { if (reassignTo) reassignMutation.mutate({ toUserId: reassignTo, reason: reassignReason }); }}
                disabled={!reassignTo || reassignMutation.isPending}
                className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                Reassign
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportsView({ currentUser }: { currentUser: any }) {
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [selectedUser, setSelectedUser] = useState("");

  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/tasks/assignable-users"] });

  const params = new URLSearchParams();
  if (selectedUser) params.set("userId", selectedUser);
  if (dateRange.start) params.set("start", dateRange.start);
  if (dateRange.end) params.set("end", dateRange.end);

  const { data: individual } = useQuery<any>({
    queryKey: ["/api/tasks/reports/individual", selectedUser, dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/reports/individual?${params}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedUser,
  });

  const teamParams = new URLSearchParams();
  if (dateRange.start) teamParams.set("start", dateRange.start);
  if (dateRange.end) teamParams.set("end", dateRange.end);

  const { data: team } = useQuery<any>({
    queryKey: ["/api/tasks/reports/team", dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/reports/team?${teamParams}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  return (
    <div className="space-y-6" data-testid="reports-view">
      <div className="flex gap-4 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Start Date</label>
          <input type="date" value={dateRange.start} onChange={e => setDateRange(d => ({ ...d, start: e.target.value }))}
            className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm" data-testid="reports-start-date" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">End Date</label>
          <input type="date" value={dateRange.end} onChange={e => setDateRange(d => ({ ...d, end: e.target.value }))}
            className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm" data-testid="reports-end-date" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Employee</label>
          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm" data-testid="reports-user-select">
            <option value="">All</option>
            {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      {team && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white" data-testid="reports-team-title">Team Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
              <div className="text-2xl font-bold text-blue-700" data-testid="reports-total">{team.totalTasks}</div>
              <div className="text-xs text-blue-600">Total Tasks</div>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
              <div className="text-2xl font-bold text-green-700" data-testid="reports-completed">{team.totalCompleted}</div>
              <div className="text-xs text-green-600">Completed</div>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-center">
              <div className="text-2xl font-bold text-yellow-700">{team.totalTasks - team.totalCompleted}</div>
              <div className="text-xs text-yellow-600">Active</div>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-center">
              <div className="text-2xl font-bold text-red-700">{team.overdueTasks?.length || 0}</div>
              <div className="text-xs text-red-600">Overdue</div>
            </div>
          </div>

          {team.byPerson && team.byPerson.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-500 font-medium">Employee</th>
                    <th className="px-4 py-3 text-center text-gray-500 font-medium">Total</th>
                    <th className="px-4 py-3 text-center text-gray-500 font-medium">Done</th>
                    <th className="px-4 py-3 text-center text-gray-500 font-medium">On Time</th>
                    <th className="px-4 py-3 text-center text-gray-500 font-medium">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {team.byPerson.map((p: any, i: number) => (
                    <tr key={i} className="border-t border-gray-100 dark:border-gray-700" data-testid={`reports-person-${i}`}>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.name}</td>
                      <td className="px-4 py-3 text-center">{p.total}</td>
                      <td className="px-4 py-3 text-center text-green-600">{p.completed}</td>
                      <td className="px-4 py-3 text-center text-blue-600">{p.onTime}</td>
                      <td className="px-4 py-3 text-center text-red-600">{p.overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {team.overdueTasks && team.overdueTasks.length > 0 && (
            <div>
              <h4 className="font-medium text-red-600 mb-2">Overdue Tasks</h4>
              <div className="space-y-2">
                {team.overdueTasks.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-sm" data-testid={`overdue-task-${t.id}`}>
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">{t.title}</span>
                      <span className="text-gray-400 ml-2">({t.assigneeName})</span>
                    </div>
                    <span className="text-red-600 font-semibold">{t.daysOverdue}d overdue</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {individual && selectedUser && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white" data-testid="reports-individual-title">Individual Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div className="text-xl font-bold text-gray-700 dark:text-gray-200">{individual.totalAssigned}</div>
              <div className="text-xs text-gray-500">Assigned</div>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
              <div className="text-xl font-bold text-green-700">{individual.completedOnTime} ({individual.completedOnTimePercent}%)</div>
              <div className="text-xs text-green-600">On Time</div>
            </div>
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
              <div className="text-xl font-bold text-orange-700">{individual.completedLate} ({individual.completedLatePercent}%)</div>
              <div className="text-xs text-orange-600">Late</div>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <div className="text-xl font-bold text-red-700">{individual.overdue}</div>
              <div className="text-xs text-red-600">Currently Overdue</div>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <div className="text-xl font-bold text-blue-700">{individual.avgAckTimeMinutes}m</div>
              <div className="text-xs text-blue-600">Avg Ack Time</div>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
              <div className="text-xl font-bold text-purple-700">{individual.avgCompletionTimeMinutes}m</div>
              <div className="text-xs text-purple-600">Avg Completion</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TodoList() {
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] || "");

  const [activeTab, setActiveTab] = useState("my");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showFullForm, setShowFullForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const { data: currentUser } = useQuery<any>({ queryKey: ["/api/user"] });

  const { data: myTasks = [], isLoading: loadingMy } = useQuery<Task[]>({
    queryKey: ["/api/tasks/my"],
    queryFn: async () => {
      const res = await fetch("/api/tasks/my", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: assignedTasks = [], isLoading: loadingAssigned } = useQuery<Task[]>({
    queryKey: ["/api/tasks/assigned"],
    queryFn: async () => {
      const res = await fetch("/api/tasks/assigned", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: teamTasks = [], isLoading: loadingTeam } = useQuery<Task[]>({
    queryKey: ["/api/tasks/team"],
    queryFn: async () => {
      const res = await fetch("/api/tasks/team", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: ["Admin", "Manager"].includes(currentUser?.role) || currentUser?.isMasterAdmin,
  });

  const { data: dashboard } = useQuery<any>({
    queryKey: ["/api/tasks/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/tasks/dashboard", { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
  });

  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/tasks/assignable-users"] });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/my"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/assigned"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/team"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/calendar-events"] });
  };

  const statusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: invalidateAll,
  });

  useEffect(() => {
    if (params.get("create") === "full") {
      setShowFullForm(true);
    }
  }, []);

  const canSeeTeam = ["Admin", "Manager"].includes(currentUser?.role) || currentUser?.isMasterAdmin;
  const canSeeReports = canSeeTeam;

  const filterTasks = (tasks: Task[]) => {
    return tasks.filter(t => {
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterCategory && t.category !== filterCategory) return false;
      return true;
    });
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const sortedMyTasks = filterTasks(myTasks);

  const urgentOverdue = sortedMyTasks.filter(t =>
    (t.isOverdue || t.priority === "p1_urgent") && !["completed", "confirmed", "cancelled"].includes(t.status)
  );
  const dueToday = sortedMyTasks.filter(t =>
    t.dueDate && !t.isOverdue && t.priority !== "p1_urgent" &&
    new Date(t.dueDate).toDateString() === today.toDateString() &&
    !["completed", "confirmed", "cancelled"].includes(t.status)
  );
  const dueThisWeek = sortedMyTasks.filter(t => {
    if (!t.dueDate || t.isOverdue || t.priority === "p1_urgent") return false;
    const d = new Date(t.dueDate);
    return d > today && d <= endOfWeek && d.toDateString() !== today.toDateString() && !["completed", "confirmed", "cancelled"].includes(t.status);
  });
  const upcoming = sortedMyTasks.filter(t => {
    if (!t.dueDate || t.isOverdue || t.priority === "p1_urgent") return false;
    return new Date(t.dueDate) > endOfWeek && !["completed", "confirmed", "cancelled"].includes(t.status);
  });
  const noDeadline = sortedMyTasks.filter(t =>
    !t.dueDate && !t.isOverdue && t.priority !== "p1_urgent" && !["completed", "confirmed", "cancelled"].includes(t.status)
  );
  const completed = sortedMyTasks.filter(t => ["completed", "confirmed"].includes(t.status));

  const filteredAssigned = filterTasks(assignedTasks);
  const awaitingConfirm = filteredAssigned.filter(t => t.status === "completed" && t.requiresConfirmation);
  const activeAssigned = filteredAssigned.filter(t => !["completed", "confirmed", "cancelled"].includes(t.status));
  const doneAssigned = filteredAssigned.filter(t => ["completed", "confirmed"].includes(t.status) && !(t.status === "completed" && t.requiresConfirmation));

  const filteredTeam = filterTasks(teamTasks);

  const handleAction = (task: Task, action: string) => {
    statusMutation.mutate({ taskId: task.id, status: action });
  };

  return (
    <div className="max-w-4xl mx-auto pb-20" data-testid="task-management-page">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="page-title">Task Management</h1>
            <p className="text-sm text-gray-500">Manage and track team tasks</p>
          </div>
          <button
            data-testid="create-task-button"
            onClick={() => setShowFullForm(true)}
            className="px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium flex items-center gap-2 text-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> New Task
          </button>
        </div>

        {dashboard && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
              <div className="text-lg font-bold text-blue-700" data-testid="dash-total">{dashboard.total || 0}</div>
              <div className="text-[10px] text-blue-600 uppercase">Active</div>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-center">
              <div className="text-lg font-bold text-red-700" data-testid="dash-overdue">{dashboard.overdue || 0}</div>
              <div className="text-[10px] text-red-600 uppercase">Overdue</div>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-center">
              <div className="text-lg font-bold text-orange-700" data-testid="dash-urgent">{dashboard.urgent || 0}</div>
              <div className="text-[10px] text-orange-600 uppercase">Urgent</div>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-center">
              <div className="text-lg font-bold text-indigo-700" data-testid="dash-ack">{dashboard.awaitingAck || 0}</div>
              <div className="text-[10px] text-indigo-600 uppercase">To Ack</div>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-center">
              <div className="text-lg font-bold text-purple-700" data-testid="dash-assigned">{dashboard.assignedByMe || 0}</div>
              <div className="text-[10px] text-purple-600 uppercase">Created</div>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
              <div className="text-lg font-bold text-green-700" data-testid="dash-confirm">{dashboard.awaitingConfirmation || 0}</div>
              <div className="text-[10px] text-green-600 uppercase">To Confirm</div>
            </div>
          </div>
        )}

        <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {TABS.map(tab => {
            if (tab.id === "team" && !canSeeTeam) return null;
            if (tab.id === "reports" && !canSeeReports) return null;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                data-testid={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-white dark:bg-gray-700 text-green-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab !== "reports" && (
          <div className="flex gap-2 flex-wrap mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                data-testid="task-search"
                type="text" placeholder="Search tasks..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              />
            </div>
            <select
              data-testid="filter-priority"
              value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">All Priorities</option>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select
              data-testid="filter-status"
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {activeTab === "my" && (
        <div data-testid="my-tasks-view">
          {loadingMy ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>
          ) : myTasks.length === 0 ? (
            <div className="text-center py-12">
              <ListChecks className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500" data-testid="empty-my-tasks">No tasks assigned to you</p>
              <button onClick={() => setShowFullForm(true)} className="mt-3 text-green-600 hover:text-green-700 text-sm font-medium">
                Create your first task
              </button>
            </div>
          ) : (
            <>
              <TaskSection title="Urgent & Overdue" tasks={urgentOverdue} color="#C0392B" onClick={t => setSelectedTaskId(t.id)} onAction={handleAction} currentUserId={currentUser?.id || ""} />
              <TaskSection title="Due Today" tasks={dueToday} color="#E67E22" onClick={t => setSelectedTaskId(t.id)} onAction={handleAction} currentUserId={currentUser?.id || ""} />
              <TaskSection title="Due This Week" tasks={dueThisWeek} color="#2980B9" onClick={t => setSelectedTaskId(t.id)} onAction={handleAction} currentUserId={currentUser?.id || ""} />
              <TaskSection title="Upcoming" tasks={upcoming} color="#7F8C8D" onClick={t => setSelectedTaskId(t.id)} onAction={handleAction} currentUserId={currentUser?.id || ""} />
              <TaskSection title="No Deadline" tasks={noDeadline} color="#95A5A6" onClick={t => setSelectedTaskId(t.id)} onAction={handleAction} currentUserId={currentUser?.id || ""} />
              <TaskSection title="Completed" tasks={completed} color="#27AE60" defaultOpen={false} onClick={t => setSelectedTaskId(t.id)} onAction={handleAction} currentUserId={currentUser?.id || ""} />
            </>
          )}
        </div>
      )}

      {activeTab === "assigned" && (
        <div data-testid="assigned-by-me-view">
          {loadingAssigned ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>
          ) : assignedTasks.length === 0 ? (
            <div className="text-center py-12">
              <Send className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500" data-testid="empty-assigned">No tasks created by you</p>
            </div>
          ) : (
            <>
              <TaskSection title="Awaiting Confirmation" tasks={awaitingConfirm} color="#E74C3C" onClick={t => setSelectedTaskId(t.id)} onAction={handleAction} currentUserId={currentUser?.id || ""} />
              <TaskSection title="Active" tasks={activeAssigned} color="#2980B9" onClick={t => setSelectedTaskId(t.id)} onAction={handleAction} currentUserId={currentUser?.id || ""} />
              <TaskSection title="Completed" tasks={doneAssigned} color="#27AE60" defaultOpen={false} onClick={t => setSelectedTaskId(t.id)} onAction={handleAction} currentUserId={currentUser?.id || ""} />
            </>
          )}
        </div>
      )}

      {activeTab === "team" && (
        <div data-testid="team-view">
          {loadingTeam ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>
          ) : teamTasks.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500" data-testid="empty-team">No team tasks</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTeam.map(t => (
                <TaskCard key={t.id} task={t} onClick={() => setSelectedTaskId(t.id)} onAction={a => handleAction(t, a)} currentUserId={currentUser?.id || ""} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "reports" && <ReportsView currentUser={currentUser} />}

      {selectedTaskId && (
        <TaskDetail taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} currentUser={currentUser} />
      )}

      {showFullForm && (
        <FullTaskForm
          users={users}
          currentUser={currentUser}
          onClose={() => setShowFullForm(false)}
          initialData={{
            title: params.get("title") || "",
            priority: params.get("priority") || "p3_normal",
            assignee: params.get("assignee") || "",
          }}
        />
      )}
    </div>
  );
}
