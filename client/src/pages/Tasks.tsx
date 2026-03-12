import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, Filter, ChevronDown, ChevronRight,
  Clock, AlertTriangle, CheckCircle2, Circle, Pause,
  X, User, Calendar, Paperclip, MessageSquare,
  GripVertical, ArrowUpDown, List, LayoutGrid, UserCheck, Users,
  Loader2, Send, Trash2, Upload, Link2, Tag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { apiRequest } from "@/lib/queryClient";

type TaskUser = { id: string; name: string; role: string; username: string; profilePictureUrl?: string };

type Task = {
  id: string; taskId: string; title: string; description: string | null;
  priority: string; status: string; createdByUserId: string; assignedToUserId: string | null;
  dueDate: string | null; startDate: string | null; estimatedMinutes: number | null;
  linkedRecordType: string | null; linkedRecordId: string | null;
  reminderDate: string | null; reminderSent: boolean | null;
  category: string | null; location: string | null;
  completedAt: string | null; cancelledAt: string | null;
  createdAt: string; updatedAt: string;
  comments?: any[]; customFields?: any[]; attachments?: any[]; checklist?: any[];
};

const STATUS_CONFIG = {
  todo: { label: "To Do", icon: Circle, color: "bg-slate-500" },
  in_progress: { label: "In Progress", icon: Clock, color: "bg-blue-500" },
  waiting: { label: "Waiting on Someone", icon: Pause, color: "bg-yellow-500" },
  complete: { label: "Complete", icon: CheckCircle2, color: "bg-green-500" },
  cancelled: { label: "Cancelled", icon: X, color: "bg-red-500" },
};

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "bg-gray-400 text-white", sortOrder: 0 },
  medium: { label: "Medium", color: "bg-blue-500 text-white", sortOrder: 1 },
  high: { label: "High", color: "bg-orange-500 text-white", sortOrder: 2 },
  urgent: { label: "Urgent", color: "bg-red-600 text-white", sortOrder: 3 },
};

const STATUSES = ["todo", "in_progress", "waiting", "complete", "cancelled"] as const;

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function isOverdue(task: Task) {
  if (!task.dueDate || ["complete", "cancelled"].includes(task.status)) return false;
  return new Date(task.dueDate) < new Date(new Date().toDateString());
}

function isDueToday(task: Task) {
  if (!task.dueDate) return false;
  const today = new Date().toDateString();
  return new Date(task.dueDate).toDateString() === today;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Tasks() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"board" | "list" | "my">("board");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("due_date");
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [collapsedStatuses, setCollapsedStatuses] = useState<Record<string, boolean>>({ complete: true, cancelled: true });

  const { data: currentUser } = useQuery<any>({ queryKey: ["/api/user"] });
  const { data: allTasks = [], isLoading } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });
  const { data: users = [] } = useQuery<TaskUser[]>({ queryKey: ["/api/tasks/assignable-users"] });
  const { data: dashboardCounts } = useQuery<any>({ queryKey: ["/api/tasks/dashboard"] });

  const isManagerOrAdmin = currentUser && ["Admin", "Manager", "Master Admin"].includes(currentUser.role);

  const userMap = useMemo(() => {
    const map: Record<string, TaskUser> = {};
    users.forEach(u => { map[u.id] = u; });
    return map;
  }, [users]);

  const filteredTasks = useMemo(() => {
    let tasks = [...allTasks];

    if (view === "my") {
      tasks = tasks.filter(t => t.assignedToUserId === currentUser?.id);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      tasks = tasks.filter(t => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)));
    }
    if (priorityFilter !== "all") {
      tasks = tasks.filter(t => t.priority === priorityFilter);
    }
    if (assigneeFilter !== "all") {
      if (assigneeFilter === "unassigned") {
        tasks = tasks.filter(t => !t.assignedToUserId);
      } else {
        tasks = tasks.filter(t => t.assignedToUserId === assigneeFilter);
      }
    }
    if (dueDateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.toDateString());
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);

      tasks = tasks.filter(t => {
        if (dueDateFilter === "overdue") return isOverdue(t);
        if (dueDateFilter === "today") return isDueToday(t);
        if (dueDateFilter === "this_week") return t.dueDate && new Date(t.dueDate) >= today && new Date(t.dueDate) <= weekEnd;
        if (dueDateFilter === "no_date") return !t.dueDate;
        return true;
      });
    }

    tasks.sort((a, b) => {
      if (sortBy === "due_date") {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortBy === "priority") {
        return (PRIORITY_CONFIG[b.priority as keyof typeof PRIORITY_CONFIG]?.sortOrder || 0) -
               (PRIORITY_CONFIG[a.priority as keyof typeof PRIORITY_CONFIG]?.sortOrder || 0);
      }
      if (sortBy === "created") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "updated") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return 0;
    });

    return tasks;
  }, [allTasks, view, searchQuery, priorityFilter, assigneeFilter, dueDateFilter, sortBy, currentUser]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    STATUSES.forEach(s => { grouped[s] = []; });
    filteredTasks.forEach(t => {
      if (grouped[t.status]) grouped[t.status].push(t);
      else grouped.todo.push(t);
    });
    return grouped;
  }, [filteredTasks]);

  const openPoolTasks = useMemo(() => filteredTasks.filter(t => !t.assignedToUserId && !["complete", "cancelled"].includes(t.status)), [filteredTasks]);

  const quickAddMutation = useMutation({
    mutationFn: (title: string) => apiRequest("POST", "/api/tasks", {
      title, status: "todo", priority: "medium", assignedToUserId: currentUser?.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/dashboard"] });
      setQuickAddTitle("");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("PATCH", `/api/tasks/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/dashboard"] });
    },
  });

  const assignToMeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/tasks/${id}/assign-to-me`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const handleDragEnd = useCallback((result: any) => {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId;
    const taskId = result.draggableId;
    if (newStatus === result.source.droppableId) return;
    updateStatusMutation.mutate({ id: taskId, status: newStatus });
  }, [updateStatusMutation]);

  const handleQuickAdd = () => {
    if (!quickAddTitle.trim()) return;
    quickAddMutation.mutate(quickAddTitle.trim());
  };

  const toggleCollapse = (status: string) => {
    setCollapsedStatuses(prev => ({ ...prev, [status]: !prev[status] }));
  };

  const TaskCard = ({ task, index }: { task: Task; index: number }) => {
    const assignee = task.assignedToUserId ? userMap[task.assignedToUserId] : null;
    const overdue = isOverdue(task);
    const dueToday = isDueToday(task);
    const pConfig = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;

    return (
      <Draggable draggableId={task.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={`bg-card border rounded-lg p-3 mb-2 cursor-pointer hover:shadow-md transition-shadow ${snapshot.isDragging ? "shadow-lg ring-2 ring-primary" : ""}`}
            onClick={() => setEditingTask(task)}
            data-testid={`task-card-${task.id}`}
          >
            <div className="flex items-start gap-2">
              <div {...provided.dragHandleProps} className="mt-1 text-muted-foreground hover:text-foreground">
                <GripVertical className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`${pConfig.color} text-[10px] px-1.5 py-0`} data-testid={`priority-badge-${task.id}`}>{pConfig.label}</Badge>
                  {task.taskId && <span className="text-[10px] text-muted-foreground font-mono">{task.taskId}</span>}
                </div>
                <p className="text-sm font-medium truncate" data-testid={`task-title-${task.id}`}>{task.title}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {task.dueDate && (
                    <span className={`text-[11px] flex items-center gap-1 ${overdue ? "text-red-500 font-semibold" : dueToday ? "text-orange-500" : "text-muted-foreground"}`}
                          data-testid={`task-due-${task.id}`}>
                      <Calendar className="w-3 h-3" />{formatDate(task.dueDate)}
                    </span>
                  )}
                  {assignee ? (
                    <span className="text-[11px] flex items-center gap-1 text-muted-foreground">
                      <User className="w-3 h-3" />{assignee.name.split(" ")[0]}
                    </span>
                  ) : (
                    <span className="text-[11px] flex items-center gap-1 text-muted-foreground italic">
                      <User className="w-3 h-3" />Unassigned
                    </span>
                  )}
                  {task.linkedRecordType && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      <Link2 className="w-2.5 h-2.5 mr-0.5" />{task.linkedRecordType}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  const KanbanColumn = ({ status, tasks: columnTasks }: { status: string; tasks: Task[] }) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.todo;
    const Icon = config.icon;
    const isCollapsed = collapsedStatuses[status];
    const canCollapse = status === "complete" || status === "cancelled";

    return (
      <div className="flex-shrink-0 w-72" data-testid={`kanban-column-${status}`}>
        <div className="flex items-center gap-2 mb-3 px-1 cursor-pointer" onClick={() => canCollapse && toggleCollapse(status)}>
          <div className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
          <h3 className="text-sm font-semibold">{config.label}</h3>
          <Badge variant="secondary" className="text-xs">{columnTasks.length}</Badge>
          {canCollapse && (isCollapsed ? <ChevronRight className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />)}
        </div>
        {(!canCollapse || !isCollapsed) && (
          <Droppable droppableId={status}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-h-[100px] rounded-lg p-2 transition-colors ${snapshot.isDraggingOver ? "bg-primary/10" : "bg-muted/30"}`}
              >
                {columnTasks.map((task, index) => (
                  <TaskCard key={task.id} task={task} index={index} />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 pb-32 max-w-full" data-testid="tasks-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="tasks-heading">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {dashboardCounts && `${dashboardCounts.active} active · ${dashboardCounts.overdue} overdue · ${dashboardCounts.openPool} open pool`}
          </p>
        </div>
        <Button onClick={() => { setEditingTask(null); setIsCreateOpen(true); }} data-testid="button-create-task">
          <Plus className="w-4 h-4 mr-2" />New Task
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4" data-testid="quick-add-bar">
        <Input
          placeholder="Quick add task..."
          value={quickAddTitle}
          onChange={e => setQuickAddTitle(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleQuickAdd()}
          className="max-w-md"
          data-testid="input-quick-add"
        />
        <Button size="sm" onClick={handleQuickAdd} disabled={!quickAddTitle.trim() || quickAddMutation.isPending} data-testid="button-quick-add">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex border rounded-lg overflow-hidden">
          {([["board", LayoutGrid, "Board"], ["list", List, "List"], ["my", UserCheck, "My Tasks"]] as const).map(([v, Icon, label]) => (
            <Button
              key={v}
              size="sm"
              variant={view === v ? "default" : "ghost"}
              onClick={() => setView(v)}
              className="rounded-none"
              data-testid={`view-toggle-${v}`}
            >
              <Icon className="w-4 h-4 mr-1" />{label}
            </Button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 w-48" data-testid="input-search-tasks" />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-32" data-testid="filter-priority"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
          <SelectTrigger className="w-36" data-testid="filter-due-date"><SelectValue placeholder="Due Date" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="today">Due Today</SelectItem>
            <SelectItem value="this_week">Due This Week</SelectItem>
            <SelectItem value="no_date">No Due Date</SelectItem>
          </SelectContent>
        </Select>
        {isManagerOrAdmin && (
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-36" data-testid="filter-assignee"><SelectValue placeholder="Assigned To" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All People</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-36" data-testid="sort-by"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="due_date">Due Date</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="created">Created Date</SelectItem>
            <SelectItem value="updated">Last Updated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(view === "board" || view === "my") && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STATUSES.map(status => (
              <KanbanColumn key={status} status={status} tasks={tasksByStatus[status] || []} />
            ))}
          </div>
        </DragDropContext>
      )}

      {view === "board" && openPoolTasks.length > 0 && (
        <Card className="mt-6" data-testid="open-pool-section">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />Open Tasks — Available to Anyone
              <Badge variant="secondary">{openPoolTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {openPoolTasks.map(task => {
                const pConfig = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
                return (
                  <div key={task.id} className="border rounded-lg p-3 hover:shadow-md cursor-pointer transition-shadow"
                    onClick={() => setEditingTask(task)} data-testid={`open-pool-task-${task.id}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`${pConfig.color} text-[10px] px-1.5 py-0`}>{pConfig.label}</Badge>
                      {task.dueDate && (
                        <span className={`text-[11px] ${isOverdue(task) ? "text-red-500" : "text-muted-foreground"}`}>
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <Button size="sm" variant="outline" className="mt-2 w-full"
                      onClick={e => { e.stopPropagation(); assignToMeMutation.mutate(task.id); }}
                      data-testid={`assign-to-me-${task.id}`}>
                      <UserCheck className="w-3.5 h-3.5 mr-1" />Assign to Me
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {view === "list" && (
        <Card data-testid="list-view">
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="p-3">Title</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Assigned To</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Linked To</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => {
                  const assignee = task.assignedToUserId ? userMap[task.assignedToUserId] : null;
                  const pConfig = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
                  const sConfig = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.todo;
                  return (
                    <tr key={task.id} className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => setEditingTask(task)} data-testid={`list-row-${task.id}`}>
                      <td className="p-3">
                        <span className="text-sm font-medium">{task.title}</span>
                        {task.taskId && <span className="text-[10px] text-muted-foreground ml-2 font-mono">{task.taskId}</span>}
                      </td>
                      <td className="p-3"><Badge className={`${pConfig.color} text-xs`}>{pConfig.label}</Badge></td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${sConfig.color}`} />
                          <span className="text-sm">{sConfig.label}</span>
                        </div>
                      </td>
                      <td className="p-3 text-sm">{assignee?.name || <span className="text-muted-foreground italic">Unassigned</span>}</td>
                      <td className="p-3">
                        {task.dueDate && (
                          <span className={`text-sm ${isOverdue(task) ? "text-red-500 font-semibold" : isDueToday(task) ? "text-orange-500" : ""}`}>
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {task.linkedRecordType && <Badge variant="outline" className="text-xs">{task.linkedRecordType}</Badge>}
                      </td>
                    </tr>
                  );
                })}
                {filteredTasks.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No tasks found</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <TaskModal
        task={editingTask}
        isOpen={isCreateOpen || !!editingTask}
        onClose={() => { setIsCreateOpen(false); setEditingTask(null); }}
        users={users}
        currentUser={currentUser}
        isManagerOrAdmin={!!isManagerOrAdmin}
        userMap={userMap}
      />
    </div>
  );
}

function TaskModal({ task, isOpen, onClose, users, currentUser, isManagerOrAdmin, userMap }: {
  task: Task | null; isOpen: boolean; onClose: () => void;
  users: TaskUser[]; currentUser: any; isManagerOrAdmin: boolean;
  userMap: Record<string, TaskUser>;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!task;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [assignedToUserId, setAssignedToUserId] = useState("__none__");
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [estimateUnit, setEstimateUnit] = useState("minutes");
  const [reminderDate, setReminderDate] = useState("");
  const [linkedRecordType, setLinkedRecordType] = useState("__none__");
  const [linkedRecordId, setLinkedRecordId] = useState("");
  const [customFields, setCustomFields] = useState<{ fieldName: string; fieldValue: string }[]>([]);
  const [commentText, setCommentText] = useState("");

  const { data: taskDetail } = useQuery<any>({
    queryKey: ["/api/tasks", task?.id],
    queryFn: () => fetch(`/api/tasks/${task!.id}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!task?.id,
  });

  const resetForm = useCallback(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setStatus(task.status);
      setPriority(task.priority);
      setAssignedToUserId(task.assignedToUserId || "__none__");
      setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "");
      setStartDate(task.startDate ? new Date(task.startDate).toISOString().split("T")[0] : "");
      setEstimatedMinutes(task.estimatedMinutes ? String(task.estimatedMinutes) : "");
      setReminderDate(task.reminderDate ? new Date(task.reminderDate).toISOString().slice(0, 16) : "");
      setLinkedRecordType(task.linkedRecordType || "__none__");
      setLinkedRecordId(task.linkedRecordId || "");
    } else {
      setTitle(""); setDescription(""); setStatus("todo"); setPriority("medium");
      setAssignedToUserId("__none__"); setDueDate(""); setStartDate(""); setEstimatedMinutes("");
      setReminderDate(""); setLinkedRecordType("__none__"); setLinkedRecordId("");
      setCustomFields([]);
    }
    setCommentText("");
  }, [task]);

  useState(() => { resetForm(); });

  const saveMutation = useMutation({
    mutationFn: async () => {
      let mins = estimatedMinutes ? parseInt(estimatedMinutes) : null;
      if (mins && estimateUnit === "hours") mins *= 60;
      if (mins && estimateUnit === "days") mins *= 480;

      const body = {
        title, description: description || null, status, priority,
        assignedToUserId: assignedToUserId === "__none__" ? null : assignedToUserId,
        dueDate: dueDate || null, startDate: startDate || null,
        estimatedMinutes: mins,
        reminderDate: reminderDate || null,
        linkedRecordType: linkedRecordType === "__none__" ? null : linkedRecordType,
        linkedRecordId: linkedRecordId || null,
        customFields: isEdit ? undefined : customFields.filter(f => f.fieldName),
      };

      if (isEdit) {
        return apiRequest("PATCH", `/api/tasks/${task!.id}`, body);
      } else {
        return apiRequest("POST", "/api/tasks", body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/dashboard"] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/tasks/${task!.id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/dashboard"] });
      onClose();
    },
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) => apiRequest("POST", `/api/tasks/${task!.id}/comments`, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", task?.id] });
      setCommentText("");
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => apiRequest("DELETE", `/api/tasks/${task!.id}/comments/${commentId}`, undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tasks", task?.id] }); },
  });

  const addCustomFieldMutation = useMutation({
    mutationFn: (data: { fieldName: string; fieldValue: string }) =>
      apiRequest("POST", `/api/tasks/${task!.id}/custom-fields`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tasks", task?.id] }); },
  });

  const deleteCustomFieldMutation = useMutation({
    mutationFn: (fieldId: string) => apiRequest("DELETE", `/api/tasks/${task!.id}/custom-fields/${fieldId}`, undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tasks", task?.id] }); },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); else resetForm(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="task-modal">
        <DialogHeader>
          <DialogTitle data-testid="task-modal-title">{isEdit ? "Edit Task" : "Create Task"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title..." data-testid="input-task-title" />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description..." rows={3} data-testid="input-task-description" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-task-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                    <SelectItem key={val} value={val}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${cfg.color}`} />{cfg.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="select-task-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).map(([val, cfg]) => (
                    <SelectItem key={val} value={val}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${cfg.color.split(" ")[0]}`} />{cfg.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />
          <p className="text-sm font-medium text-muted-foreground">Scheduling</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} data-testid="input-start-date" />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} data-testid="input-due-date" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Time Estimate</Label>
              <div className="flex gap-2">
                <Input type="number" value={estimatedMinutes} onChange={e => setEstimatedMinutes(e.target.value)}
                  placeholder="0" className="w-24" data-testid="input-time-estimate" />
                <Select value={estimateUnit} onValueChange={setEstimateUnit}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Reminder</Label>
              <Input type="datetime-local" value={reminderDate} onChange={e => setReminderDate(e.target.value)} data-testid="input-reminder" />
            </div>
          </div>

          {(isManagerOrAdmin || !isEdit) && (
            <>
              <Separator />
              <p className="text-sm font-medium text-muted-foreground">Assignment</p>
              <div>
                <Label>Assign To {!isManagerOrAdmin && "(leave blank for open pool)"}</Label>
                <Select value={assignedToUserId} onValueChange={setAssignedToUserId}>
                  <SelectTrigger data-testid="select-assignee"><SelectValue placeholder="Open Pool (unassigned)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Open Pool (unassigned)</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <Separator />
          <p className="text-sm font-medium text-muted-foreground">Links</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Link Type</Label>
              <Select value={linkedRecordType} onValueChange={setLinkedRecordType}>
                <SelectTrigger data-testid="select-link-type"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  <SelectItem value="job">Job</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Record ID</Label>
              <Input value={linkedRecordId} onChange={e => setLinkedRecordId(e.target.value)}
                placeholder="Record ID" data-testid="input-link-id" />
            </div>
          </div>

          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Custom Fields</p>
            <Button size="sm" variant="outline" onClick={() => {
              if (isEdit && task) {
                addCustomFieldMutation.mutate({ fieldName: "New Field", fieldValue: "" });
              } else {
                setCustomFields([...customFields, { fieldName: "", fieldValue: "" }]);
              }
            }} data-testid="button-add-custom-field">
              <Plus className="w-3.5 h-3.5 mr-1" />Add Field
            </Button>
          </div>

          {isEdit && taskDetail?.customFields?.map((cf: any) => (
            <div key={cf.id} className="flex items-center gap-2">
              <Input value={cf.fieldName} readOnly className="w-40" />
              <Input value={cf.fieldValue || ""} readOnly className="flex-1" />
              <Button size="icon" variant="ghost" onClick={() => deleteCustomFieldMutation.mutate(cf.id)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}

          {!isEdit && customFields.map((cf, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={cf.fieldName} onChange={e => {
                const updated = [...customFields]; updated[i].fieldName = e.target.value; setCustomFields(updated);
              }} placeholder="Field Name" className="w-40" />
              <Input value={cf.fieldValue} onChange={e => {
                const updated = [...customFields]; updated[i].fieldValue = e.target.value; setCustomFields(updated);
              }} placeholder="Value" className="flex-1" />
              <Button size="icon" variant="ghost" onClick={() => setCustomFields(customFields.filter((_, idx) => idx !== i))}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}

          {isEdit && (
            <>
              <Separator />
              <p className="text-sm font-medium text-muted-foreground">Comments</p>
              <div className="flex gap-2">
                <Textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                  placeholder="Add a comment..." rows={2} className="flex-1" data-testid="input-comment" />
                <Button size="sm" onClick={() => commentText.trim() && commentMutation.mutate(commentText.trim())}
                  disabled={!commentText.trim() || commentMutation.isPending} data-testid="button-post-comment">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {taskDetail?.comments?.map((comment: any) => (
                  <div key={comment.id} className="flex gap-2 p-2 rounded bg-muted/50" data-testid={`comment-${comment.id}`}>
                    <Avatar className="w-7 h-7">
                      <AvatarFallback className="text-xs">{getInitials(comment.userName || "U")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{comment.userName}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(comment.createdAt)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
                    </div>
                    {(comment.userId === currentUser?.id || isManagerOrAdmin) && (
                      <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => deleteCommentMutation.mutate(comment.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {task?.completedAt && (
                <p className="text-xs text-green-600">Completed: {new Date(task.completedAt).toLocaleString()}</p>
              )}
              {task?.cancelledAt && (
                <p className="text-xs text-red-500">Cancelled: {new Date(task.cancelledAt).toLocaleString()}</p>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex items-center gap-2">
          {isEdit && isManagerOrAdmin && (
            <Button variant="destructive" onClick={() => {
              if (confirm("Are you sure you want to delete this task?")) deleteMutation.mutate();
            }} data-testid="button-delete-task">
              <Trash2 className="w-4 h-4 mr-1" />Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!title.trim() || saveMutation.isPending} data-testid="button-save-task">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {isEdit ? "Save Changes" : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
