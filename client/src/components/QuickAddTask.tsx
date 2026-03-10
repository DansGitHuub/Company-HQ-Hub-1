import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Loader2, ChevronRight, Search, User } from "lucide-react";
import { useLocation } from "wouter";

const PRIORITIES = [
  { value: "p1_urgent", label: "Urgent", color: "#C0392B" },
  { value: "p2_high", label: "High", color: "#E67E22" },
  { value: "p3_normal", label: "Normal", color: "#F1C40F" },
  { value: "p4_low", label: "Low", color: "#27AE60" },
];

export default function QuickAddTask() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("p3_normal");
  const [search, setSearch] = useState("");
  const [showUsers, setShowUsers] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/user"],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/tasks/assignable-users"],
    enabled: open,
  });

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedUser = users.find((u: any) => u.id === assigneeId);

  useEffect(() => {
    if (open && titleRef.current) {
      setTimeout(() => titleRef.current?.focus(), 100);
    }
    if (open && currentUser && !assigneeId) {
      setAssigneeId(currentUser.id);
    }
  }, [open, currentUser]);

  const createTask = useMutation({
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
      setTitle("");
      setPriority("p3_normal");
      setAssigneeId(currentUser?.id || "");
      setOpen(false);
    },
  });

  const handleSubmit = () => {
    if (!title.trim()) return;
    createTask.mutate({
      title: title.trim(),
      assignedToUserId: assigneeId || currentUser?.id,
      priority,
    });
  };

  const handleMoreDetails = () => {
    setOpen(false);
    navigate("/todos?create=full&title=" + encodeURIComponent(title) + "&priority=" + priority + "&assignee=" + assigneeId);
  };

  if (!currentUser || ["Customer", "Sales"].includes(currentUser.role)) return null;

  return (
    <>
      <button
        data-testid="quick-add-task-button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ minWidth: 48, minHeight: 48 }}
      >
        <Plus className="w-7 h-7" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl p-5 pb-8 max-w-lg mx-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white" data-testid="quick-add-title">Quick Add Task</h3>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" data-testid="quick-add-close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <input
                  ref={titleRef}
                  data-testid="quick-add-input-title"
                  type="text"
                  placeholder="What needs to be done?"
                  value={title}
                  onChange={e => setTitle(e.target.value.substring(0, 120))}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-base focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  style={{ minHeight: 48 }}
                />
                <div className="text-xs text-gray-400 text-right mt-1">{title.length}/120</div>
              </div>

              <div className="relative">
                <button
                  data-testid="quick-add-assignee-button"
                  onClick={() => setShowUsers(!showUsers)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-left flex items-center gap-2"
                  style={{ minHeight: 48 }}
                >
                  <User className="w-4 h-4 text-gray-400" />
                  <span className={selectedUser ? "text-gray-900 dark:text-white" : "text-gray-400"}>
                    {selectedUser ? `${selectedUser.name} (${selectedUser.role})` : "Assign to..."}
                  </span>
                </button>
                {showUsers && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-48 overflow-y-auto z-10">
                    <div className="p-2 sticky top-0 bg-white dark:bg-gray-800">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                        <input
                          data-testid="quick-add-user-search"
                          type="text"
                          placeholder="Search..."
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          autoFocus
                        />
                      </div>
                    </div>
                    {filtered.map((u: any) => (
                      <button
                        key={u.id}
                        data-testid={`quick-add-user-${u.id}`}
                        onClick={() => { setAssigneeId(u.id); setShowUsers(false); setSearch(""); }}
                        className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between text-sm"
                      >
                        <span className="text-gray-900 dark:text-white">{u.name}</span>
                        <span className="text-gray-400 text-xs">{u.role}</span>
                      </button>
                    ))}
                    {filtered.length === 0 && <div className="px-4 py-3 text-sm text-gray-400">No users found</div>}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    data-testid={`quick-add-priority-${p.value}`}
                    onClick={() => setPriority(p.value)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                      priority === p.value
                        ? "text-white border-transparent shadow-md"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300"
                    }`}
                    style={priority === p.value ? { backgroundColor: p.color } : {}}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  data-testid="quick-add-submit"
                  onClick={handleSubmit}
                  disabled={!title.trim() || createTask.isPending}
                  className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  style={{ minHeight: 48 }}
                >
                  {createTask.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  Add Task
                </button>
                <button
                  data-testid="quick-add-more-details"
                  onClick={handleMoreDetails}
                  className="py-3 px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1 text-sm transition-colors"
                  style={{ minHeight: 48 }}
                >
                  More <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {createTask.isError && (
              <p className="text-red-500 text-sm mt-2" data-testid="quick-add-error">{(createTask.error as Error).message}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
