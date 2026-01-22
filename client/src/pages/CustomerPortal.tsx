import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Plus, 
  Send,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Camera,
  Calendar,
  MapPin,
  UserPlus,
  Shield,
  ClipboardCheck,
  ArrowRight
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

type Message = {
  id: string;
  subject: string;
  message: string;
  status: string;
  adminReply?: string;
  repliedAt?: string;
  createdAt: string;
};

type WorkRequest = {
  id: string;
  title: string;
  description: string;
  serviceType: string;
  propertyAddress?: string;
  preferredDate?: string;
  urgency: string;
  photos?: string[];
  status: string;
  createdAt: string;
};

type AccessRequest = {
  id: string;
  requestedRole: string;
  reason?: string;
  status: string;
  createdAt: string;
};

export default function CustomerPortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messageOpen, setMessageOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
  });

  const { data: workRequests = [], isLoading: requestsLoading } = useQuery<WorkRequest[]>({
    queryKey: ["/api/work-requests"],
  });

  const { data: accessRequests = [] } = useQuery<AccessRequest[]>({
    queryKey: ["/api/access-requests"],
  });

  const pendingAccessRequest = accessRequests.find(r => r.status === "pending");

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Welcome, {user?.name?.split(" ")[0]}</h1>
        <p className="text-muted-foreground">Manage your requests and communicate with our team</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{messages.length}</div>
                <p className="text-sm text-muted-foreground">Messages</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{workRequests.filter(r => r.status === "pending").length}</div>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{workRequests.filter(r => r.status === "completed").length}</div>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {user?.isApplicant && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <ClipboardCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Job Application</h3>
                  <p className="text-sm text-muted-foreground">Track your hiring progress and submit required documents</p>
                </div>
              </div>
              <Link href="/applicant">
                <Button className="gap-2" data-testid="button-view-application">
                  View Application <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="messages" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="h-4 w-4" /> Messages
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <FileText className="h-4 w-4" /> Work Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Messages</CardTitle>
                <CardDescription>Send and receive messages from our team</CardDescription>
              </div>
              <NewMessageDialog open={messageOpen} onOpenChange={setMessageOpen} />
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
                  <Button className="mt-4" onClick={() => setMessageOpen(true)}>
                    Send Your First Message
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{msg.subject}</h4>
                        <StatusBadge status={msg.status} />
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{msg.message}</p>
                      {msg.adminReply && (
                        <div className="bg-secondary/50 rounded-lg p-3 mt-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Reply from team:</p>
                          <p className="text-sm">{msg.adminReply}</p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Sent {new Date(msg.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Work Requests</CardTitle>
                <CardDescription>Request landscaping services</CardDescription>
              </div>
              <NewWorkRequestDialog open={requestOpen} onOpenChange={setRequestOpen} />
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
                  <Button className="mt-4" onClick={() => setRequestOpen(true)}>
                    Request Work
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {workRequests.map((req) => (
                    <div key={req.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium">{req.title}</h4>
                          <Badge variant="outline" className="mt-1">{req.serviceType}</Badge>
                        </div>
                        <StatusBadge status={req.status} />
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
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {req.urgency}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Submitted {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Account Access
          </CardTitle>
          <CardDescription>Need team member access? Request an account upgrade</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingAccessRequest ? (
            <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg">
              <Clock className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium">Upgrade Request Pending</p>
                <p className="text-sm text-muted-foreground">
                  Your request for <Badge variant="outline">{pendingAccessRequest.requestedRole}</Badge> access is being reviewed
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                If you're a team member, you can request upgraded access to view operational features.
              </p>
              <RequestUpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; icon: React.ReactNode }> = {
    unread: { className: "bg-blue-100 text-blue-800", icon: <AlertCircle className="h-3 w-3" /> },
    read: { className: "bg-gray-100 text-gray-800", icon: <CheckCircle className="h-3 w-3" /> },
    replied: { className: "bg-green-100 text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
    pending: { className: "bg-amber-100 text-amber-800", icon: <Clock className="h-3 w-3" /> },
    in_progress: { className: "bg-blue-100 text-blue-800", icon: <Loader2 className="h-3 w-3" /> },
    scheduled: { className: "bg-purple-100 text-purple-800", icon: <Calendar className="h-3 w-3" /> },
    completed: { className: "bg-green-100 text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
  };
  const { className, icon } = config[status] || config.pending;
  return (
    <Badge className={`${className} gap-1 capitalize`}>
      {icon} {status.replace("_", " ")}
    </Badge>
  );
}

function NewMessageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (data: { subject: string; message: string }) => {
      const res = await apiRequest("POST", "/api/messages", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      toast({ title: "Message sent", description: "We'll get back to you soon!" });
      onOpenChange(false);
      setSubject("");
      setMessage("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ subject, message });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New Message
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send a Message</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What's this about?"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us how we can help..."
              rows={5}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="gap-2">
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewWorkRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    serviceType: "",
    propertyAddress: "",
    preferredDate: "",
    urgency: "normal",
  });
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/work-requests", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-requests"] });
      toast({ title: "Request submitted", description: "We'll review your request and get back to you!" });
      onOpenChange(false);
      setFormData({ title: "", description: "", serviceType: "", propertyAddress: "", preferredDate: "", urgency: "normal" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit request", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Request Work
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Landscaping Work</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief description of work needed"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="serviceType">Service Type</Label>
            <Select value={formData.serviceType} onValueChange={(v) => setFormData({ ...formData, serviceType: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select service type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Lawn Maintenance">Lawn Maintenance</SelectItem>
                <SelectItem value="Landscape Design">Landscape Design</SelectItem>
                <SelectItem value="Hardscape">Hardscape Installation</SelectItem>
                <SelectItem value="Irrigation">Irrigation</SelectItem>
                <SelectItem value="Tree Service">Tree Service</SelectItem>
                <SelectItem value="Seasonal Cleanup">Seasonal Cleanup</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Tell us more about the work you need..."
              rows={4}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address">Property Address</Label>
              <Input
                id="address"
                value={formData.propertyAddress}
                onChange={(e) => setFormData({ ...formData, propertyAddress: e.target.value })}
                placeholder="123 Main St"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Preferred Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.preferredDate}
                onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="urgency">Urgency</Label>
            <Select value={formData.urgency} onValueChange={(v) => setFormData({ ...formData, urgency: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low - No rush</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High - Soon as possible</SelectItem>
                <SelectItem value="urgent">Urgent - Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RequestUpgradeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [requestedRole, setRequestedRole] = useState("");
  const [reason, setReason] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (data: { requestedRole: string; reason: string }) => {
      const res = await apiRequest("POST", "/api/access-requests", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access-requests"] });
      toast({ title: "Request submitted", description: "An admin will review your request" });
      onOpenChange(false);
      setRequestedRole("");
      setReason("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit request", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ requestedRole, reason });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <UserPlus className="h-4 w-4" /> Request Upgrade
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Account Upgrade</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Requested Access Level</Label>
            <Select value={requestedRole} onValueChange={setRequestedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select access level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Crew">Crew Member</SelectItem>
                <SelectItem value="Manager">Manager</SelectItem>
                <SelectItem value="Admin">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Request</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please explain why you need this access level..."
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || !requestedRole}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
