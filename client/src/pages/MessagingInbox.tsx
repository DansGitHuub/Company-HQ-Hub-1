import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showErrorToast } from "@/lib/errorToast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Mail,
  Plus,
  Send,
  Clock,
  User,
  Users,
  Filter,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronLeft,
  Eye,
  Lock,
  Search,
} from "lucide-react";
import { format } from "date-fns";

type MessagingThread = {
  id: string;
  customerId: string;
  assignedEmployeeId: string | null;
  subject: string;
  status: string;
  priority: string;
  lastMessageAt: string;
  lastMessageBy: string | null;
  unreadByCustomer: boolean;
  unreadByEmployee: boolean;
  createdAt: string;
  closedAt: string | null;
  closedBy: string | null;
};

type ThreadMessage = {
  id: string;
  threadId: string;
  senderId: string;
  senderRole: string;
  content: string;
  isInternalNote: boolean;
  attachments: string[] | null;
  readAt: string | null;
  createdAt: string;
};

type UserInfo = {
  id: string;
  name: string | null;
  username: string;
  role: string;
};

export default function MessagingInbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedThread, setSelectedThread] = useState<MessagingThread | null>(null);
  const [newMessageContent, setNewMessageContent] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [showNewThreadDialog, setShowNewThreadDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Admin/Manager filters
  const [employeeFilter, setEmployeeFilter] = useState<string>("mine");
  const [customerFilter, setCustomerFilter] = useState<string>("all");

  const isStaff = user?.role === "Admin" || user?.role === "Manager" || user?.role === "Crew";
  const isAdmin = user?.role === "Admin";
  const isManager = user?.role === "Manager";

  // Build query params for threads
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.append("status", statusFilter);
    if (isAdmin || isManager) {
      if (employeeFilter !== "all" && employeeFilter !== "mine") {
        params.append("employeeId", employeeFilter);
      }
      if (customerFilter !== "all") {
        params.append("customerId", customerFilter);
      }
    }
    return params.toString();
  };

  const { data: threads = [], isLoading: threadsLoading } = useQuery<MessagingThread[]>({
    queryKey: ["/api/messaging-threads", statusFilter, employeeFilter, customerFilter],
    queryFn: async () => {
      const params = buildQueryParams();
      const res = await fetch(`/api/messaging-threads${params ? `?${params}` : ""}`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<ThreadMessage[]>({
    queryKey: ["/api/messaging-threads", selectedThread?.id, "messages"],
    queryFn: async () => {
      if (!selectedThread) return [];
      const res = await fetch(`/api/messaging-threads/${selectedThread.id}/messages`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedThread,
  });

  const { data: allUsers = [] } = useQuery<UserInfo[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdmin || isManager,
  });

  const employees = allUsers.filter(u => u.role !== "Customer");
  const customers = allUsers.filter(u => u.role === "Customer");

  const getUserName = (userId: string | null) => {
    if (!userId) return "Unassigned";
    const found = allUsers.find(u => u.id === userId);
    return found?.name || found?.username || "Unknown";
  };

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedThread) return;
      const res = await apiRequest("POST", `/api/messaging-threads/${selectedThread.id}/messages`, {
        content: newMessageContent,
        isInternalNote,
      });
      return res.json();
    },
    onSuccess: () => {
      setNewMessageContent("");
      setIsInternalNote(false);
      queryClient.invalidateQueries({ queryKey: ["/api/messaging-threads", selectedThread?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messaging-threads"] });
    },
    onError: (error) => {
      showErrorToast(error, "Failed to send message");
    },
  });

  const updateThreadMutation = useMutation({
    mutationFn: async (updates: Partial<MessagingThread>) => {
      if (!selectedThread) return;
      const res = await apiRequest("PATCH", `/api/messaging-threads/${selectedThread.id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messaging-threads"] });
      toast({ title: "Conversation updated" });
    },
  });

  const filteredThreads = threads.filter(thread => {
    if (searchQuery) {
      return thread.subject.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Open</Badge>;
      case "in_progress":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">In Progress</Badge>;
      case "resolved":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Resolved</Badge>;
      case "closed":
        return <Badge variant="outline">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive">Urgent</Badge>;
      case "high":
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">High</Badge>;
      case "normal":
        return null;
      case "low":
        return <Badge variant="outline" className="text-muted-foreground">Low</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="h-8 w-8" />
            {isAdmin ? "Communications Center" : "Messages"}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Monitor and manage all customer conversations" : "View and manage your conversations"}
          </p>
        </div>
        <NewThreadDialog 
          open={showNewThreadDialog} 
          onOpenChange={setShowNewThreadDialog}
          employees={employees}
          customers={customers}
          isCustomer={user?.role === "Customer"}
          userId={user?.id || ""}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Thread List Panel */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Conversations</CardTitle>
              <Badge variant="secondary">{filteredThreads.length}</Badge>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-threads"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="flex-1" data-testid="select-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(isAdmin || isManager) && (
                <div className="flex gap-2">
                  <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                    <SelectTrigger className="flex-1" data-testid="select-employee-filter">
                      <SelectValue placeholder="Employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mine">My Conversations</SelectItem>
                      <SelectItem value="all">All Employees</SelectItem>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name || emp.username}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {threadsLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No conversations found</p>
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const isUnread = user?.role === "Customer" ? thread.unreadByCustomer : thread.unreadByEmployee;
                  return (
                    <div
                      key={thread.id}
                      className={`p-4 cursor-pointer border-b transition-colors hover:bg-muted/50 ${
                        selectedThread?.id === thread.id ? "bg-muted" : ""
                      } ${isUnread ? "bg-blue-50/50" : ""}`}
                      onClick={() => setSelectedThread(thread)}
                      data-testid={`thread-item-${thread.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {isUnread && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                            <span className={`font-medium truncate ${isUnread ? "font-semibold" : ""}`}>
                              {thread.subject}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span className="truncate">{getUserName(thread.customerId)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {getStatusBadge(thread.status)}
                          {getPriorityBadge(thread.priority)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(thread.lastMessageAt), "MMM d, h:mm a")}
                        </span>
                        {thread.assignedEmployeeId && isStaff && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {getUserName(thread.assignedEmployeeId)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Conversation View Panel */}
        <Card className="lg:col-span-2">
          {selectedThread ? (
            <>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedThread(null)}
                      className="lg:hidden"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <CardTitle className="text-lg">{selectedThread.subject}</CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <User className="h-4 w-4" />
                        <span>{getUserName(selectedThread.customerId)}</span>
                        <span>•</span>
                        <span>Started {format(new Date(selectedThread.createdAt), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedThread.status)}
                    {isStaff && (
                      <Select 
                        value={selectedThread.status} 
                        onValueChange={(val) => updateThreadMutation.mutate({ status: val })}
                      >
                        <SelectTrigger className="w-32" data-testid="select-update-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                {isStaff && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t text-sm">
                    <div className="flex items-center gap-2">
                      <Label>Assigned to:</Label>
                      <Select 
                        value={selectedThread.assignedEmployeeId || "unassigned"}
                        onValueChange={(val) => updateThreadMutation.mutate({ 
                          assignedEmployeeId: val === "unassigned" ? null : val 
                        })}
                      >
                        <SelectTrigger className="w-40" data-testid="select-assign-employee">
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {employees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.name || emp.username}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label>Priority:</Label>
                      <Select 
                        value={selectedThread.priority || "normal"}
                        onValueChange={(val) => updateThreadMutation.mutate({ priority: val })}
                      >
                        <SelectTrigger className="w-28" data-testid="select-priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[350px] p-4">
                  {messagesLoading ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">
                      <Mail className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>No messages yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.senderRole === "customer" ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                              msg.isInternalNote
                                ? "bg-yellow-100 border border-yellow-300"
                                : msg.senderRole === "customer"
                                ? "bg-muted"
                                : "bg-primary text-primary-foreground"
                            }`}
                          >
                            {msg.isInternalNote && (
                              <div className="flex items-center gap-1 text-xs text-yellow-700 mb-1">
                                <Lock className="h-3 w-3" />
                                Internal Note
                              </div>
                            )}
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <div className={`text-xs mt-2 flex items-center gap-2 ${
                              msg.isInternalNote 
                                ? "text-yellow-700" 
                                : msg.senderRole === "customer" 
                                ? "text-muted-foreground" 
                                : "text-primary-foreground/70"
                            }`}>
                              <span>{getUserName(msg.senderId)}</span>
                              <span>•</span>
                              <span>{format(new Date(msg.createdAt), "MMM d, h:mm a")}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                <Separator />
                <div className="p-4">
                  {selectedThread.status !== "closed" ? (
                    <div className="space-y-3">
                      {isStaff && (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isInternalNote}
                            onCheckedChange={setIsInternalNote}
                            id="internal-note"
                          />
                          <Label htmlFor="internal-note" className="text-sm flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Internal note (not visible to customer)
                          </Label>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Textarea
                          placeholder={isInternalNote ? "Add an internal note..." : "Type your message..."}
                          value={newMessageContent}
                          onChange={(e) => setNewMessageContent(e.target.value)}
                          className="min-h-[80px]"
                          data-testid="textarea-new-message"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          onClick={() => sendMessageMutation.mutate()}
                          disabled={!newMessageContent.trim() || sendMessageMutation.isPending}
                          data-testid="button-send-message"
                        >
                          {sendMessageMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          {isInternalNote ? "Add Note" : "Send Message"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p>This conversation is closed</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
              <Mail className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg">Select a conversation to view</p>
              <p className="text-sm">Or start a new conversation</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function NewThreadDialog({ 
  open, 
  onOpenChange, 
  employees, 
  customers,
  isCustomer,
  userId 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  employees: UserInfo[];
  customers: UserInfo[];
  isCustomer: boolean;
  userId: string;
}) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [assignedEmployeeId, setAssignedEmployeeId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [priority, setPriority] = useState("normal");

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/messaging-threads", {
        subject,
        initialMessage: message,
        assignedEmployeeId: assignedEmployeeId || null,
        customerId: isCustomer ? userId : customerId,
        priority,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messaging-threads"] });
      toast({ title: "Conversation started" });
      onOpenChange(false);
      setSubject("");
      setMessage("");
      setAssignedEmployeeId("");
      setCustomerId("");
      setPriority("normal");
    },
    onError: (error) => {
      showErrorToast(error, "Failed to create conversation");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-new-thread">
          <Plus className="h-4 w-4" />
          New Conversation
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start New Conversation</DialogTitle>
          <DialogDescription>
            Create a new conversation to communicate with customers or team members.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="grid gap-2">
            <Label>Subject</Label>
            <Input
              placeholder="What is this about?"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="input-thread-subject"
            />
          </div>
          {!isCustomer && (
            <>
              <div className="grid gap-2">
                <Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger data-testid="select-customer">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(cust => (
                      <SelectItem key={cust.id} value={cust.id}>{cust.name || cust.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Assign To (optional)</Label>
                <Select value={assignedEmployeeId || "unassigned"} onValueChange={(v) => setAssignedEmployeeId(v === "unassigned" ? "" : v)}>
                  <SelectTrigger data-testid="select-assign-to">
                    <SelectValue placeholder="Leave unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name || emp.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger data-testid="select-new-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {isCustomer && (
            <div className="grid gap-2">
              <Label>Send To (optional)</Label>
              <Select value={assignedEmployeeId || "general_inbox"} onValueChange={(v) => setAssignedEmployeeId(v === "general_inbox" ? "" : v)}>
                <SelectTrigger data-testid="select-send-to">
                  <SelectValue placeholder="General Inbox" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general_inbox">General Inbox</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name || emp.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label>Message</Label>
            <Textarea
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px]"
              data-testid="textarea-initial-message"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createThreadMutation.mutate()}
              disabled={!subject.trim() || !message.trim() || createThreadMutation.isPending || (!isCustomer && !customerId)}
              data-testid="button-create-thread"
            >
              {createThreadMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Start Conversation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
