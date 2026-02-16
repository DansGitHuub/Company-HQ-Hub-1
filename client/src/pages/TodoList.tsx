import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit2, Calendar, Clock, User, AlertCircle, CheckCircle2, Circle, ChevronDown, ChevronUp, Users, Archive, History, Timer, PauseCircle, X, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { showErrorToast } from "@/lib/errorToast";
import { useAuth } from "@/hooks/use-auth";
import { format, differenceInDays, differenceInHours, isPast, isToday } from "date-fns";
import type { Todo, User as UserType } from "@shared/schema";

type AssignedUser = { userId: string; name: string };
type TodoWithDetails = Todo & {
  isRead?: boolean;
  assignedUsers?: AssignedUser[];
  creatorName?: string | null;
};

type HistoryEntry = {
  id: string;
  todoId: string;
  changedBy: string | null;
  changedByName: string | null;
  changeType: string;
  fieldChanged: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
};

function getDueCountdown(dueDate: string | Date | null | undefined): { text: string; color: string } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();

  if (isToday(due)) {
    return { text: "Due today", color: "text-orange-600 font-semibold" };
  }

  if (isPast(due)) {
    const daysOverdue = differenceInDays(now, due);
    if (daysOverdue === 0) {
      const hoursOverdue = differenceInHours(now, due);
      return { text: `${hoursOverdue}h overdue`, color: "text-red-600 font-semibold" };
    }
    return { text: `${daysOverdue}d overdue`, color: "text-red-600 font-semibold" };
  }

  const daysLeft = differenceInDays(due, now);
  if (daysLeft === 0) {
    const hoursLeft = differenceInHours(due, now);
    return { text: `${hoursLeft}h left`, color: "text-orange-500" };
  }
  if (daysLeft <= 3) {
    return { text: `${daysLeft}d left`, color: "text-orange-500" };
  }
  return { text: `${daysLeft}d left`, color: "text-muted-foreground" };
}

export default function TodoList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin" || user?.isMasterAdmin;

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [editingTodo, setEditingTodo] = useState<TodoWithDetails | null>(null);
  const [toggledTodos, setToggledTodos] = useState<Set<string>>(new Set());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [archiveConfirmTodo, setArchiveConfirmTodo] = useState<TodoWithDetails | null>(null);
  const [historyTodoId, setHistoryTodoId] = useState<string | null>(null);

  const [newTodo, setNewTodo] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "on_hold",
    dueDate: "",
    assignedUserIds: [] as string[],
  });

  const { data: allTodos = [], isLoading: todosLoading } = useQuery<TodoWithDetails[]>({
    queryKey: ["/api/todos"],
    refetchInterval: 30000,
  });

  const { data: myTodos = [] } = useQuery<TodoWithDetails[]>({
    queryKey: ["/api/my-todos"],
    refetchInterval: 30000,
  });

  const { data: todoActiveStatus } = useQuery<{ isActive: boolean; unreadCount: number }>({
    queryKey: ["/api/todo-active-status"],
    refetchInterval: 30000,
  });

  const { data: users = [], refetch: refetchUsers } = useQuery<UserType[]>({
    queryKey: ["/api/admin/users"],
    staleTime: 0,
  });

  const { data: activeUsers = [], refetch: refetchActiveUsers } = useQuery<{ userId: string }[]>({
    queryKey: ["/api/todo-active-users"],
    staleTime: 0,
  });

  const { data: todoHistoryData = [] } = useQuery<HistoryEntry[]>({
    queryKey: ["/api/todos", historyTodoId, "history"],
    queryFn: async () => {
      if (!historyTodoId) return [];
      const res = await fetch(`/api/todos/${historyTodoId}/history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    enabled: !!historyTodoId,
  });

  const activeUserIds = new Set(activeUsers.map(au => au.userId));
  const assignableUsers = users.filter(u => activeUserIds.has(u.id));

  const displayTodos = isAdmin ? allTodos : myTodos;

  const filteredTodos = displayTodos.filter(todo => {
    if (filterStatus === "everything") {
      // show everything including archived
    } else if (filterStatus === "archived") {
      if (todo.status !== "archived") return false;
    } else if (filterStatus === "all") {
      if (todo.status === "archived") return false;
    } else if (filterStatus === "on_hold") {
      if (todo.status !== "pending" && todo.status !== "on_hold") return false;
    } else if (filterStatus !== "all" && todo.status !== filterStatus) {
      return false;
    }
    if (filterPriority !== "all" && todo.priority !== filterPriority) return false;
    return true;
  });

  const createTodo = useMutation({
    mutationFn: async (data: typeof newTodo) => {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create todo");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-todos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/todos/unread-count"] });
      setAddDialogOpen(false);
      setNewTodo({ title: "", description: "", priority: "medium", status: "on_hold", dueDate: "", assignedUserIds: [] });
      toast({ title: "Task created successfully" });
    },
    onError: (error: Error) => {
      showErrorToast(error, "Failed to create task");
    },
  });

  const updateTodo = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Todo> }) => {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update todo");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-todos"] });
      setEditingTodo(null);
      toast({ title: "Task updated" });
    },
    onError: (error: Error) => {
      showErrorToast(error, "Failed to update task");
    },
  });

  const deleteTodo = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/todos/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete todo");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-todos"] });
      toast({ title: "Task deleted" });
    },
    onError: (error: Error) => showErrorToast(error, "Failed to delete task"),
  });

  const archiveTodo = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/todos/${id}/archive`, { method: "PATCH", credentials: "include" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to archive todo");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-todos"] });
      setArchiveConfirmTodo(null);
      toast({ title: "Task archived" });
    },
    onError: (error: Error) => {
      setArchiveConfirmTodo(null);
      showErrorToast(error, "Failed to archive task");
    },
  });

  const restoreTodo = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/todos/${id}/restore`, { method: "PATCH", credentials: "include" });
      if (!res.ok) throw new Error("Failed to restore task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-todos"] });
      toast({ title: "Task restored", description: "The task has been moved back to On Hold." });
    },
    onError: (error: Error) => showErrorToast(error, "Failed to restore task"),
  });

  const markAsRead = useMutation({
    mutationFn: async (todoId: string) => {
      const res = await fetch(`/api/todos/${todoId}/mark-read`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to mark as read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-todos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/todo-active-status"] });
    },
  });

  const assignUser = useMutation({
    mutationFn: async ({ todoId, userId }: { todoId: string; userId: string }) => {
      const res = await fetch(`/api/todos/${todoId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to assign user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-todos"] });
      toast({ title: "User assigned to task" });
    },
    onError: (error: Error) => showErrorToast(error, "Assignment failed"),
  });

  const unassignUser = useMutation({
    mutationFn: async ({ todoId, userId }: { todoId: string; userId: string }) => {
      const res = await fetch(`/api/todos/${todoId}/assignments/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-todos"] });
      toast({ title: "User removed from task" });
    },
    onError: (error: Error) => showErrorToast(error, "Failed to remove user"),
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "archived": return <Archive className="w-5 h-5 text-gray-400" />;
      case "in_progress": return <Clock className="w-5 h-5 text-blue-500" />;
      case "on_hold": return <PauseCircle className="w-5 h-5 text-amber-500" />;
      case "pending": return <PauseCircle className="w-5 h-5 text-amber-500" />;
      default: return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const handleTodoClick = useCallback((todo: TodoWithDetails) => {
    if (!todo.isRead && !isAdmin) {
      markAsRead.mutate(todo.id);
    }
    setToggledTodos(prev => {
      const next = new Set(prev);
      if (next.has(todo.id)) {
        next.delete(todo.id);
      } else {
        next.add(todo.id);
      }
      return next;
    });
  }, [isAdmin, markAsRead]);

  const isTodoExpanded = useCallback((todo: TodoWithDetails) => {
    const isUnread = todo.isRead === false;
    const wasToggled = toggledTodos.has(todo.id);
    if (isUnread) return !wasToggled;
    return wasToggled;
  }, [toggledTodos]);

  const handleToggleStatus = (todo: Todo) => {
    const nextStatus = todo.status === "completed" ? "on_hold" : "completed";
    updateTodo.mutate({ id: todo.id, data: { status: nextStatus } });
  };

  const isCreator = (todo: TodoWithDetails) => todo.createdBy === user?.id;
  const canDelete = (todo: TodoWithDetails) => isCreator(todo) || user?.isMasterAdmin;
  const isAssignedUser = (todo: TodoWithDetails) => todo.assignedUsers?.some(a => a.userId === user?.id);
  const canEdit = (todo: TodoWithDetails) => isCreator(todo) || isAdmin || isAssignedUser(todo);

  const formatHistoryChange = (entry: HistoryEntry) => {
    if (entry.changeType === "created") return "Created this task";
    if (entry.changeType === "archived") return "Archived this task";
    if (entry.changeType === "status_changed") {
      return `Changed status from "${entry.oldValue}" to "${entry.newValue}"`;
    }
    if (entry.fieldChanged === "title") return `Changed title from "${entry.oldValue}" to "${entry.newValue}"`;
    if (entry.fieldChanged === "priority") return `Changed priority from "${entry.oldValue}" to "${entry.newValue}"`;
    if (entry.fieldChanged === "description") return "Updated description";
    if (entry.fieldChanged === "dueDate") return `Changed due date`;
    return `Updated ${entry.fieldChanged}`;
  };

  if (!todoActiveStatus?.isActive && !isAdmin) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">To-Do Access Not Enabled</h3>
            <p className="text-muted-foreground">
              Your account has not been activated for the To-Do system. Please contact an administrator to enable access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="todo-list-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">To-Do List</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? "Manage all tasks and assignments" : "View and complete your assigned tasks"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={async () => { await Promise.all([refetchUsers(), refetchActiveUsers()]); setAddDialogOpen(true); }} data-testid="button-add-todo">
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        )}
      </div>

      <div className="flex gap-4 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-status">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="everything">All</SelectItem>
            <SelectItem value="all">All Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-priority">
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {todosLoading ? (
        <div className="text-center py-8">Loading tasks...</div>
      ) : filteredTodos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Tasks Found</h3>
            <p className="text-muted-foreground">
              {isAdmin ? "Click 'Add Task' to create a new task." : "You don't have any assigned tasks."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTodos.map((todo) => {
            const expanded = isTodoExpanded(todo);
            const isUnread = todo.isRead === false;
            const countdown = getDueCountdown(todo.dueDate);

            return (
              <Card
                key={todo.id}
                className={`cursor-pointer transition-all hover:shadow-md ${isUnread ? "border-primary border-2" : ""}`}
                data-testid={`card-todo-${todo.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => handleTodoClick(todo)}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (todo.status !== "archived") handleToggleStatus(todo);
                        }}
                        className="hover:scale-110 transition-transform shrink-0"
                        data-testid={`button-toggle-status-${todo.id}`}
                        disabled={todo.status === "archived"}
                      >
                        {getStatusIcon(todo.status || "pending")}
                      </button>
                      <div className="flex-1 min-w-0">
                        <CardTitle className={`text-lg ${todo.status === "completed" || todo.status === "archived" ? "line-through text-muted-foreground" : ""}`}>
                          {todo.title}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge className={`${getPriorityColor(todo.priority || "medium")} text-white text-xs`}>
                            {todo.priority || "medium"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {todo.status === "archived" ? "archived" : todo.status === "pending" || todo.status === "on_hold" ? "on hold" : todo.status || "on hold"}
                          </Badge>
                          {todo.dueDate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Due: {format(new Date(todo.dueDate), "MMM d, yyyy")}
                            </span>
                          )}
                          {countdown && todo.status !== "completed" && todo.status !== "archived" && (
                            <span className={`text-xs flex items-center gap-1 ${countdown.color}`} data-testid={`text-countdown-${todo.id}`}>
                              <Timer className="w-3 h-3" />
                              {countdown.text}
                            </span>
                          )}
                          {isUnread && (
                            <Badge variant="default" className="text-xs bg-primary">New</Badge>
                          )}
                          {todo.assignedUsers && todo.assignedUsers.length > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-assigned-${todo.id}`}>
                              <User className="w-3 h-3" />
                              {todo.assignedUsers.map(u => u.name).join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            refetchUsers();
                            refetchActiveUsers();
                            setSelectedTodoId(todo.id);
                            setAssignDialogOpen(true);
                          }}
                          data-testid={`button-assign-${todo.id}`}
                        >
                          <Users className="w-4 h-4" />
                        </Button>
                      )}
                      {canEdit(todo) && todo.status !== "archived" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTodo(todo);
                          }}
                          data-testid={`button-edit-${todo.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                      {canDelete(todo) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this task permanently?")) {
                              deleteTodo.mutate(todo.id);
                            }
                          }}
                          data-testid={`button-delete-${todo.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                      {!canDelete(todo) && todo.status === "completed" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setArchiveConfirmTodo(todo);
                          }}
                          data-testid={`button-archive-${todo.id}`}
                          title="Archive completed task"
                        >
                          <Archive className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      )}
                      {todo.status === "archived" && (canDelete(todo) || isAdmin) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            restoreTodo.mutate(todo.id);
                          }}
                          data-testid={`button-restore-${todo.id}`}
                          title="Restore task"
                        >
                          <RotateCcw className="w-4 h-4 text-blue-500" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewTodo({
                            title: `${todo.title} (Copy)`,
                            description: todo.description || "",
                            priority: todo.priority || "medium",
                            status: "on_hold",
                            dueDate: "",
                            assignedUserIds: [],
                          });
                          setAddDialogOpen(true);
                        }}
                        data-testid={`button-copy-${todo.id}`}
                        title="Copy task"
                      >
                        <Copy className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <button onClick={() => handleTodoClick(todo)} data-testid={`button-expand-${todo.id}`}>
                        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </CardHeader>
                {expanded && (
                  <CardContent className="pt-0">
                    <div className="border-t pt-4 mt-2">
                      {todo.description ? (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{todo.description}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No description provided</p>
                      )}
                      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
                        {todo.createdAt && (
                          <span>Created: {format(new Date(todo.createdAt), "MMM d, yyyy h:mm a")}</span>
                        )}
                        {todo.creatorName && (
                          <span>By: {todo.creatorName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        {!isAdmin && todo.status !== "completed" && todo.status !== "archived" && (
                          <Button
                            onClick={() => updateTodo.mutate({ id: todo.id, data: { status: "in_progress" } })}
                            variant="outline"
                            size="sm"
                            disabled={todo.status === "in_progress"}
                            data-testid={`button-start-${todo.id}`}
                          >
                            <Clock className="w-4 h-4 mr-2" />
                            {todo.status === "in_progress" ? "In Progress" : "Start Working"}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistoryTodoId(todo.id);
                          }}
                          data-testid={`button-history-${todo.id}`}
                        >
                          <History className="w-4 h-4 mr-1" />
                          History
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!archiveConfirmTodo} onOpenChange={(open) => !open && setArchiveConfirmTodo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this task?</AlertDialogTitle>
            <AlertDialogDescription>
              Please confirm that "{archiveConfirmTodo?.title}" has been completed before archiving. Archived tasks will be moved out of your active list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-archive-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archiveConfirmTodo && archiveTodo.mutate(archiveConfirmTodo.id)}
              data-testid="btn-archive-confirm"
            >
              Yes, task is complete — Archive it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!historyTodoId} onOpenChange={(open) => !open && setHistoryTodoId(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Task History</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {todoHistoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No history recorded yet</p>
            ) : (
              todoHistoryData.map((entry) => (
                <div key={entry.id} className="flex gap-3 text-sm border-b pb-3 last:border-0" data-testid={`history-entry-${entry.id}`}>
                  <div className="mt-0.5">
                    <History className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground">{formatHistoryChange(entry)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {entry.changedByName || "Unknown"} — {format(new Date(entry.changedAt), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) { setAssignDropdownOpen(false); setAssignSearch(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createTodo.mutate(newTodo);
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={newTodo.title}
                onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
                required
                data-testid="input-todo-title"
              />
            </div>
            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={newTodo.description}
                onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
                rows={3}
                required
                data-testid="input-todo-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select value={newTodo.priority} onValueChange={(v) => setNewTodo({ ...newTodo, priority: v })}>
                  <SelectTrigger data-testid="select-todo-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={newTodo.dueDate}
                  onChange={(e) => setNewTodo({ ...newTodo, dueDate: e.target.value })}
                  data-testid="input-todo-due-date"
                />
              </div>
            </div>
            <div>
              <Label>Assign To</Label>
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between font-normal"
                  onClick={() => setAssignDropdownOpen(!assignDropdownOpen)}
                  data-testid="button-assign-dropdown"
                >
                  <span className="text-sm text-muted-foreground">
                    {newTodo.assignedUserIds.length === 0
                      ? "Select people..."
                      : `${newTodo.assignedUserIds.length} selected`}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${assignDropdownOpen ? "rotate-180" : ""}`} />
                </Button>
                {assignDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg">
                    {newTodo.assignedUserIds.length > 0 && (
                      <div className="p-2 border-b">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Selected ({newTodo.assignedUserIds.length})</p>
                        <div className="flex flex-wrap gap-1">
                          {newTodo.assignedUserIds.map(uid => {
                            const u = assignableUsers.find(x => x.id === uid);
                            return (
                              <Badge key={uid} variant="secondary" className="text-xs gap-1 pr-1">
                                {u?.name || "Unknown"}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNewTodo({ ...newTodo, assignedUserIds: newTodo.assignedUserIds.filter(id => id !== uid) });
                                  }}
                                  className="hover:bg-muted rounded-full p-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="p-2 border-b">
                      <Input
                        placeholder="Search names..."
                        value={assignSearch}
                        onChange={(e) => setAssignSearch(e.target.value)}
                        className="h-8 text-sm"
                        data-testid="input-assign-search"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto p-1">
                      {assignableUsers.length > 0 ? assignableUsers.filter(u => u.name.toLowerCase().includes(assignSearch.toLowerCase())).map((u) => {
                        const isSelected = newTodo.assignedUserIds.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            className={`flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-muted transition-colors ${isSelected ? "bg-muted/50" : ""}`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setNewTodo({ ...newTodo, assignedUserIds: [...newTodo.assignedUserIds, u.id] });
                                } else {
                                  setNewTodo({ ...newTodo, assignedUserIds: newTodo.assignedUserIds.filter(id => id !== u.id) });
                                }
                              }}
                            />
                            <span className="text-sm flex-1">{u.name}</span>
                            <span className="text-xs text-muted-foreground">{u.role}</span>
                          </label>
                        );
                      }) : (
                        <p className="text-sm text-muted-foreground py-2 px-2">No active todo users. Enable users in Admin Panel first.</p>
                      )}
                    </div>
                    <div className="p-1 border-t">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setAssignDropdownOpen(false)}
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createTodo.isPending} data-testid="button-submit-todo">
                {createTodo.isPending ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTodo} onOpenChange={(open) => !open && setEditingTodo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          {editingTodo && (
            <EditTodoForm
              todo={editingTodo}
              isCreatorOrAdmin={isCreator(editingTodo) || !!isAdmin}
              onSubmit={(data) => updateTodo.mutate({ id: editingTodo.id, data })}
              onCancel={() => setEditingTodo(null)}
              isPending={updateTodo.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Manage Assignments</DialogTitle>
          </DialogHeader>
          {(() => {
            const selectedTodo = displayTodos.find(t => t.id === selectedTodoId);
            const currentlyAssigned = selectedTodo?.assignedUsers || [];
            const alreadyAssigned = new Set(currentlyAssigned.map(a => a.userId));
            const availableUsers = assignableUsers.filter(u => !alreadyAssigned.has(u.id));
            return (
              <div className="space-y-4">
                {currentlyAssigned.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Currently Assigned</p>
                    <div className="space-y-1">
                      {currentlyAssigned.map((a) => (
                        <div key={a.userId} className="flex items-center justify-between px-3 py-2 rounded-md border bg-muted/30">
                          <span className="text-sm flex items-center gap-2">
                            <User className="w-4 h-4" />
                            {a.name}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (selectedTodoId) {
                                unassignUser.mutate({ todoId: selectedTodoId, userId: a.userId });
                              }
                            }}
                            data-testid={`button-unassign-${a.userId}`}
                          >
                            <X className="w-3 h-3 mr-1" /> Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {availableUsers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Add User</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {availableUsers.map((u) => (
                        <Button
                          key={u.id}
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => {
                            if (selectedTodoId) {
                              assignUser.mutate({ todoId: selectedTodoId, userId: u.id });
                            }
                          }}
                          data-testid={`button-assign-user-${u.id}`}
                        >
                          <User className="w-4 h-4 mr-2" />
                          {u.name} ({u.role})
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {currentlyAssigned.length === 0 && availableUsers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No users available to assign.</p>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditTodoForm({
  todo,
  isCreatorOrAdmin,
  onSubmit,
  onCancel,
  isPending,
}: {
  todo: TodoWithDetails;
  isCreatorOrAdmin: boolean;
  onSubmit: (data: Partial<Todo>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description || "");
  const [priority, setPriority] = useState(todo.priority || "medium");
  const [status, setStatus] = useState(todo.status === "pending" ? "on_hold" : (todo.status || "on_hold"));
  const [dueDate, setDueDate] = useState(todo.dueDate ? format(new Date(todo.dueDate), "yyyy-MM-dd") : "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Partial<Todo> = { status };
    if (isCreatorOrAdmin) {
      data.title = title;
      data.description = description;
      data.priority = priority;
      data.dueDate = dueDate ? new Date(dueDate) : null;
    }
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="edit-title">Title *</Label>
        <Input
          id="edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          disabled={!isCreatorOrAdmin}
          data-testid="input-edit-todo-title"
        />
      </div>
      <div>
        <Label htmlFor="edit-description">Description</Label>
        <Textarea
          id="edit-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          disabled={!isCreatorOrAdmin}
          data-testid="input-edit-todo-description"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Priority</Label>
          <Select value={priority} onValueChange={setPriority} disabled={!isCreatorOrAdmin}>
            <SelectTrigger data-testid="select-edit-todo-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid="select-edit-todo-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Due Date</Label>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          disabled={!isCreatorOrAdmin}
          data-testid="input-edit-todo-due-date"
        />
      </div>
      {!isCreatorOrAdmin && (
        <p className="text-xs text-muted-foreground italic">As an assigned user, you can update the status. Only the creator or admin can change other fields.</p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isPending} data-testid="button-save-edit-todo">
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
