import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, Trash2, Edit2, Calendar, Clock, User, AlertCircle, CheckCircle2, Circle, ChevronDown, ChevronUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import type { Todo, User as UserType } from "@shared/schema";

type TodoWithReadStatus = Todo & { isRead?: boolean };

export default function TodoList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin" || user?.isMasterAdmin;
  
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [expandedTodo, setExpandedTodo] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const [newTodo, setNewTodo] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "pending",
    dueDate: "",
    assignedUserIds: [] as string[],
  });

  const { data: allTodos = [], isLoading: todosLoading } = useQuery<Todo[]>({
    queryKey: ["/api/todos"],
  });

  const { data: myTodos = [] } = useQuery<TodoWithReadStatus[]>({
    queryKey: ["/api/my-todos"],
  });

  const { data: todoActiveStatus } = useQuery<{ isActive: boolean; unreadCount: number }>({
    queryKey: ["/api/todo-active-status"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const { data: activeUsers = [] } = useQuery<{ userId: string }[]>({
    queryKey: ["/api/todo-active-users"],
  });

  // Get list of users who can be assigned to todos (only active todo users)
  const activeUserIds = new Set(activeUsers.map(au => au.userId));
  const assignableUsers = users.filter(u => activeUserIds.has(u.id));

  const displayTodos = isAdmin ? allTodos : myTodos;

  const filteredTodos = displayTodos.filter(todo => {
    if (filterStatus !== "all" && todo.status !== filterStatus) return false;
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
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create todo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-todos"] });
      setAddDialogOpen(false);
      setNewTodo({ title: "", description: "", priority: "medium", status: "pending", dueDate: "", assignedUserIds: [] });
      toast({ title: "Task created successfully" });
    },
    onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
  });

  const updateTodo = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Todo> }) => {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update todo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-todos"] });
      setEditingTodo(null);
      toast({ title: "Task updated" });
    },
    onError: () => toast({ title: "Failed to update task", variant: "destructive" }),
  });

  const deleteTodo = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/todos/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete todo");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-todos"] });
      toast({ title: "Task deleted" });
    },
    onError: () => toast({ title: "Failed to delete task", variant: "destructive" }),
  });

  const markAsRead = useMutation({
    mutationFn: async (todoId: string) => {
      const res = await fetch(`/api/todos/${todoId}/mark-read`, {
        method: "POST",
        credentials: "include",
      });
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
      if (!res.ok) throw new Error("Failed to assign user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      toast({ title: "User assigned to task" });
    },
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
      case "in_progress": return <Clock className="w-5 h-5 text-blue-500" />;
      default: return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const handleTodoClick = (todo: TodoWithReadStatus) => {
    if (!todo.isRead && !isAdmin) {
      markAsRead.mutate(todo.id);
    }
    setExpandedTodo(expandedTodo === todo.id ? null : todo.id);
  };

  const handleToggleStatus = (todo: Todo) => {
    const nextStatus = todo.status === "completed" ? "pending" : "completed";
    updateTodo.mutate({ id: todo.id, data: { status: nextStatus } });
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
          <h1 className="text-3xl font-bold">To-Do List</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? "Manage all tasks and assignments" : "View and complete your assigned tasks"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddDialogOpen(true)} data-testid="button-add-todo">
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
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
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
          {filteredTodos.map((todo) => (
            <Card
              key={todo.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                (todo as TodoWithReadStatus).isRead === false ? "border-primary border-2" : ""
              }`}
              data-testid={`card-todo-${todo.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3" onClick={() => handleTodoClick(todo as TodoWithReadStatus)}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(todo);
                      }}
                      className="hover:scale-110 transition-transform"
                      data-testid={`button-toggle-status-${todo.id}`}
                    >
                      {getStatusIcon(todo.status || "pending")}
                    </button>
                    <div>
                      <CardTitle className={`text-lg ${todo.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                        {todo.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`${getPriorityColor(todo.priority || "medium")} text-white text-xs`}>
                          {todo.priority || "medium"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {todo.status || "pending"}
                        </Badge>
                        {todo.dueDate && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(todo.dueDate), "MMM d, yyyy")}
                          </span>
                        )}
                        {(todo as TodoWithReadStatus).isRead === false && (
                          <Badge variant="default" className="text-xs bg-primary">New</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTodoId(todo.id);
                            setAssignDialogOpen(true);
                          }}
                          data-testid={`button-assign-${todo.id}`}
                        >
                          <Users className="w-4 h-4" />
                        </Button>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this task?")) {
                              deleteTodo.mutate(todo.id);
                            }
                          }}
                          data-testid={`button-delete-${todo.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </>
                    )}
                    <button onClick={() => handleTodoClick(todo as TodoWithReadStatus)}>
                      {expandedTodo === todo.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </CardHeader>
              {expandedTodo === todo.id && (
                <CardContent className="pt-0">
                  <div className="border-t pt-4 mt-2">
                    {todo.description ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{todo.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No description provided</p>
                    )}
                    <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                      {todo.createdAt && (
                        <span>Created: {format(new Date(todo.createdAt), "MMM d, yyyy h:mm a")}</span>
                      )}
                    </div>
                    {!isAdmin && todo.status !== "completed" && (
                      <div className="mt-4">
                        <Button
                          onClick={() => updateTodo.mutate({ id: todo.id, data: { status: "in_progress" } })}
                          variant="outline"
                          size="sm"
                          disabled={todo.status === "in_progress"}
                          data-testid={`button-start-${todo.id}`}
                        >
                          <Clock className="w-4 h-4 mr-2" />
                          Start Working
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newTodo.description}
                onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
                rows={3}
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
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                {assignableUsers.length > 0 ? assignableUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={newTodo.assignedUserIds.includes(u.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setNewTodo({ ...newTodo, assignedUserIds: [...newTodo.assignedUserIds, u.id] });
                        } else {
                          setNewTodo({ ...newTodo, assignedUserIds: newTodo.assignedUserIds.filter(id => id !== u.id) });
                        }
                      }}
                    />
                    <span className="text-sm">{u.name} ({u.role})</span>
                  </label>
                )) : (
                  <p className="text-sm text-muted-foreground py-2">No active todo users. Enable users in Admin Panel first.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                updateTodo.mutate({
                  id: editingTodo.id,
                  data: {
                    title: formData.get("title") as string,
                    description: formData.get("description") as string,
                    priority: formData.get("priority") as string,
                    status: formData.get("status") as string,
                    dueDate: formData.get("dueDate") ? new Date(formData.get("dueDate") as string) : null,
                  },
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  name="title"
                  defaultValue={editingTodo.title}
                  required
                  data-testid="input-edit-todo-title"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  name="description"
                  defaultValue={editingTodo.description || ""}
                  rows={3}
                  data-testid="input-edit-todo-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Select name="priority" defaultValue={editingTodo.priority || "medium"}>
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
                  <Select name="status" defaultValue={editingTodo.status || "pending"}>
                    <SelectTrigger data-testid="select-edit-todo-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
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
                  name="dueDate"
                  defaultValue={editingTodo.dueDate ? format(new Date(editingTodo.dueDate), "yyyy-MM-dd") : ""}
                  data-testid="input-edit-todo-due-date"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingTodo(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateTodo.isPending} data-testid="button-update-todo">
                  {updateTodo.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Users to Task</DialogTitle>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {assignableUsers.length > 0 ? assignableUsers.map((u) => (
              <button
                key={u.id}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                onClick={() => {
                  if (selectedTodoId) {
                    assignUser.mutate({ todoId: selectedTodoId, userId: u.id });
                  }
                }}
                data-testid={`button-assign-user-${u.id}`}
              >
                <User className="w-8 h-8 p-1.5 bg-primary/10 rounded-full" />
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-sm text-muted-foreground">{u.role}</p>
                </div>
              </button>
            )) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No active todo users. Enable users in Admin Panel first.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
