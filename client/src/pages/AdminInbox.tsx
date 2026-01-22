import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  MessageSquare, 
  FileText, 
  Send,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  MapPin,
  Reply
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Message = {
  id: string;
  customerId: string;
  targetEmployeeId?: string;
  subject: string;
  message: string;
  status: string;
  adminReply?: string;
  repliedAt?: string;
  repliedBy?: string;
  createdAt: string;
};

type User = {
  id: string;
  username: string;
  name?: string;
  role: string;
};

type WorkRequest = {
  id: string;
  customerId: string;
  title: string;
  description: string;
  serviceType: string;
  propertyAddress?: string;
  preferredDate?: string;
  urgency: string;
  photos?: string[];
  status: string;
  estimatedValue?: number;
  notes?: string;
  createdAt: string;
};

export default function AdminInbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<WorkRequest | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
  });

  const { data: workRequests = [], isLoading: requestsLoading } = useQuery<WorkRequest[]>({
    queryKey: ["/api/work-requests"],
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: user?.role === "Admin" || user?.role === "Manager",
  });

  const getUserName = (userId?: string) => {
    if (!userId) return null;
    const found = allUsers.find(u => u.id === userId);
    return found?.name || found?.username || null;
  };

  const replyMutation = useMutation({
    mutationFn: async ({ id, adminReply }: { id: string; adminReply: string }) => {
      const res = await apiRequest("PATCH", `/api/messages/${id}`, { adminReply, status: "replied" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      toast({ title: "Reply sent" });
      setSelectedMessage(null);
      setReplyText("");
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/work-requests/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-requests"] });
      toast({ title: "Request updated" });
    },
  });

  if (user?.role !== "Admin" && user?.role !== "Manager") {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md text-center p-8">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You need Admin or Manager privileges to view this page.</p>
        </Card>
      </div>
    );
  }

  const unreadMessages = messages.filter(m => m.status === "unread").length;
  const pendingRequests = workRequests.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-primary" /> Inbox
        </h1>
        <p className="text-muted-foreground">Manage customer messages and work requests</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-primary">{messages.length}</div>
            <p className="text-sm text-muted-foreground">Total Messages</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-amber-600">{unreadMessages}</div>
            <p className="text-sm text-muted-foreground">Unread</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-blue-600">{workRequests.length}</div>
            <p className="text-sm text-muted-foreground">Work Requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-orange-600">{pendingRequests}</div>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="messages" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="h-4 w-4" /> Messages ({unreadMessages})
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <FileText className="h-4 w-4" /> Work Requests ({pendingRequests})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Messages</CardTitle>
              <CardDescription>Review and respond to customer inquiries</CardDescription>
            </CardHeader>
            <CardContent>
              {messagesLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No messages yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => {
                    const targetName = getUserName(msg.targetEmployeeId);
                    const customerName = getUserName(msg.customerId);
                    return (
                    <div
                      key={msg.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors hover:bg-secondary/50 ${msg.status === "unread" ? "border-primary/50 bg-primary/5" : ""}`}
                      onClick={() => setSelectedMessage(msg)}
                      data-testid={`message-card-${msg.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium">{msg.subject}</h4>
                            <StatusBadge status={msg.status} />
                            {targetName && (
                              <Badge variant="outline" className="text-xs bg-blue-50">
                                To: {targetName}
                              </Badge>
                            )}
                            {customerName && (
                              <span className="text-xs text-muted-foreground">
                                From: {customerName}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{msg.message}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          {new Date(msg.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );})}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Work Requests</CardTitle>
              <CardDescription>Review customer work requests and update status</CardDescription>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : workRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No work requests yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {workRequests.map((req) => (
                    <div
                      key={req.id}
                      className="border rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium">{req.title}</h4>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline">{req.serviceType}</Badge>
                            <Badge className={req.urgency === "urgent" ? "bg-red-100 text-red-800" : req.urgency === "high" ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-800"}>
                              {req.urgency}
                            </Badge>
                          </div>
                        </div>
                        <Select
                          value={req.status}
                          onValueChange={(val) => updateRequestMutation.mutate({ id: req.id, status: val })}
                        >
                          <SelectTrigger className="w-36 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="reviewing">Reviewing</SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="declined">Declined</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{req.description}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        {req.propertyAddress && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {req.propertyAddress}
                          </span>
                        )}
                        {req.preferredDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {new Date(req.preferredDate).toLocaleDateString()}
                          </span>
                        )}
                        <span>Submitted {new Date(req.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedMessage?.subject}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-sm">{selectedMessage?.message}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Received {selectedMessage?.createdAt && new Date(selectedMessage.createdAt).toLocaleString()}
              </p>
            </div>
            {selectedMessage?.adminReply && (
              <div className="bg-primary/10 rounded-lg p-4">
                <p className="text-xs font-medium mb-1">Your reply:</p>
                <p className="text-sm">{selectedMessage.adminReply}</p>
              </div>
            )}
            {!selectedMessage?.adminReply && (
              <div className="space-y-2">
                <Textarea
                  placeholder="Write your reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                />
                <Button
                  className="w-full gap-2"
                  onClick={() => selectedMessage && replyMutation.mutate({ id: selectedMessage.id, adminReply: replyText })}
                  disabled={!replyText || replyMutation.isPending}
                >
                  {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Reply className="h-4 w-4" />}
                  Send Reply
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; icon: React.ReactNode }> = {
    unread: { className: "bg-blue-100 text-blue-800", icon: <AlertCircle className="h-3 w-3" /> },
    read: { className: "bg-gray-100 text-gray-800", icon: <CheckCircle className="h-3 w-3" /> },
    replied: { className: "bg-green-100 text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
  };
  const { className, icon } = config[status] || config.unread;
  return (
    <Badge className={`${className} gap-1 capitalize`}>
      {icon} {status}
    </Badge>
  );
}
