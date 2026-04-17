import React, { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Inbox,
  Send,
  Pencil,
  Trash2,
  ArrowLeft,
  User,
  Clock,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

// ── Types ──────────────────────────────────────────────────────────────────────

interface StaffUser {
  id: string;
  name: string;
  role: string;
  profile_picture: string | null;
  email: string;
}

interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string | null;
  body: string;
  sent_at: string;
  read_at: string | null;
  deleted_by_sender: boolean;
  deleted_by_recipient: boolean;
  // inbox fields
  sender_name?: string;
  sender_role?: string;
  sender_picture?: string | null;
  // sent fields
  recipient_name?: string;
  recipient_role?: string;
  recipient_picture?: string | null;
}

interface FullMessage extends DirectMessage {
  sender_name: string;
  sender_role: string;
  sender_picture: string | null;
  recipient_name: string;
  recipient_role: string;
  recipient_picture: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

function formatFull(dateStr: string): string {
  return format(new Date(dateStr), "MMM d, yyyy 'at' h:mm a");
}

function avatar(name: string, picture: string | null | undefined, size = 36) {
  if (picture) {
    return (
      <img
        src={picture}
        alt={name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold flex-shrink-0 text-xs"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}

// ── Compose Dialog ─────────────────────────────────────────────────────────────

function ComposeDialog({
  open,
  onClose,
  initialRecipientId,
}: {
  open: boolean;
  onClose: () => void;
  initialRecipientId?: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [recipientId, setRecipientId] = useState(initialRecipientId ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");

  const { data: users = [] } = useQuery<StaffUser[]>({
    queryKey: ["/api/dm/users"],
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/dm", { recipientId, subject, body });
    },
    onSuccess: () => {
      toast({ title: "Message sent" });
      qc.invalidateQueries({ queryKey: ["/api/dm/sent"] });
      qc.invalidateQueries({ queryKey: ["/api/dm/unread-count"] });
      setRecipientId(initialRecipientId ?? "");
      setSubject("");
      setBody("");
      setSearch("");
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );
  const selected = users.find((u) => u.id === recipientId);

  function handleClose() {
    setRecipientId(initialRecipientId ?? "");
    setSubject("");
    setBody("");
    setSearch("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Recipient */}
          <div className="space-y-1">
            <Label>To</Label>
            {selected ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/30">
                {avatar(selected.name, selected.profile_picture, 28)}
                <span className="text-sm font-medium">{selected.name}</span>
                <span className="text-xs text-muted-foreground">({selected.role})</span>
                <button
                  className="ml-auto text-muted-foreground hover:text-foreground text-xs"
                  onClick={() => setRecipientId("")}
                  data-testid="button-clear-recipient"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="border rounded-md">
                <Input
                  placeholder="Search by name or role…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border-0 focus-visible:ring-0"
                  data-testid="input-recipient-search"
                />
                {search && (
                  <div className="border-t max-h-40 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No users found</p>
                    ) : (
                      filtered.map((u) => (
                        <button
                          key={u.id}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left"
                          onClick={() => {
                            setRecipientId(u.id);
                            setSearch("");
                          }}
                          data-testid={`button-select-user-${u.id}`}
                        >
                          {avatar(u.name, u.profile_picture, 28)}
                          <div>
                            <p className="text-sm font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.role}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-1">
            <Label>Subject</Label>
            <Input
              placeholder="Optional subject…"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="input-subject"
            />
          </div>

          {/* Body */}
          <div className="space-y-1">
            <Label>Message</Label>
            <Textarea
              placeholder="Write your message…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              data-testid="textarea-body"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-compose-cancel">
            Cancel
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!recipientId || !body.trim() || sendMutation.isPending}
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4 mr-1" />
            {sendMutation.isPending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Message Row ────────────────────────────────────────────────────────────────

function MessageRow({
  msg,
  folder,
  selected,
  onClick,
}: {
  msg: DirectMessage;
  folder: "inbox" | "sent";
  selected: boolean;
  onClick: () => void;
}) {
  const isUnread = folder === "inbox" && !msg.read_at;
  const name = folder === "inbox" ? msg.sender_name ?? "?" : msg.recipient_name ?? "?";
  const pic = folder === "inbox" ? msg.sender_picture : msg.recipient_picture;

  return (
    <button
      onClick={onClick}
      data-testid={`row-message-${msg.id}`}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors",
        selected && "bg-primary/8 border-l-2 border-primary",
        !selected && "border-l-2 border-transparent"
      )}
    >
      <div className="pt-0.5 flex-shrink-0">{avatar(name, pic, 36)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn("text-sm truncate", isUnread ? "font-semibold" : "font-medium text-muted-foreground")}
            data-testid={`text-sender-${msg.id}`}
          >
            {name}
          </span>
          <span className="text-xs text-muted-foreground flex-shrink-0" data-testid={`text-time-${msg.id}`}>
            {formatTimestamp(msg.sent_at)}
          </span>
        </div>
        <p className={cn("text-sm truncate", isUnread ? "font-medium" : "text-muted-foreground")} data-testid={`text-subject-${msg.id}`}>
          {msg.subject || "(no subject)"}
        </p>
        <p className="text-xs text-muted-foreground truncate">{msg.body}</p>
      </div>
      {isUnread && (
        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" data-testid={`dot-unread-${msg.id}`} />
      )}
    </button>
  );
}

// ── Message Detail ─────────────────────────────────────────────────────────────

function MessageDetail({
  msgId,
  folder,
  onBack,
  onDelete,
  onReply,
}: {
  msgId: string;
  folder: "inbox" | "sent";
  onBack: () => void;
  onDelete: (id: string) => void;
  onReply: (recipientId: string) => void;
}) {
  const { user } = useAuth();
  const { data: msg, isLoading } = useQuery<FullMessage>({
    queryKey: ["/api/dm", msgId],
    queryFn: async () => {
      const res = await fetch(`/api/dm/${msgId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load message");
      return res.json();
    },
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (!msg) return null;

  const isSender = msg.sender_id === user?.id;
  const replyTo = isSender ? msg.recipient_id : msg.sender_id;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate" data-testid="text-detail-subject">
            {msg.subject || "(no subject)"}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(msg.id)}
          className="text-muted-foreground hover:text-destructive"
          data-testid="button-delete-message"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Meta */}
      <div className="px-4 py-3 border-b space-y-1.5">
        <div className="flex items-center gap-2">
          {avatar(msg.sender_name, msg.sender_picture, 40)}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" data-testid="text-detail-sender">{msg.sender_name}</span>
              <span className="text-xs text-muted-foreground">{msg.sender_role}</span>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <span>To:</span>
              <span data-testid="text-detail-recipient">{msg.recipient_name}</span>
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="text-detail-time">
              <Clock className="h-3 w-3" />
              {formatFull(msg.sent_at)}
            </div>
            {folder === "inbox" && (
              <div className="text-xs text-muted-foreground mt-0.5" data-testid="text-read-status">
                {msg.read_at ? `Read ${formatFull(msg.read_at)}` : "Unread"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1 px-4 py-4">
        <p className="text-sm whitespace-pre-wrap leading-relaxed" data-testid="text-detail-body">
          {msg.body}
        </p>
      </ScrollArea>

      {/* Actions */}
      <div className="px-4 py-3 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onReply(replyTo)}
          data-testid="button-reply"
        >
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Reply
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const [folder, setFolder] = useState<"inbox" | "sent">("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeRecipientId, setComposeRecipientId] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: inbox = [], isLoading: inboxLoading } = useQuery<DirectMessage[]>({
    queryKey: ["/api/dm/inbox"],
    refetchInterval: 15000,
  });

  const { data: sent = [], isLoading: sentLoading } = useQuery<DirectMessage[]>({
    queryKey: ["/api/dm/sent"],
    refetchInterval: 30000,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/dm/unread-count"],
    refetchInterval: 15000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/dm/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Message deleted" });
      qc.invalidateQueries({ queryKey: ["/api/dm/inbox"] });
      qc.invalidateQueries({ queryKey: ["/api/dm/sent"] });
      qc.invalidateQueries({ queryKey: ["/api/dm/unread-count"] });
      if (selectedId === deleteTarget) setSelectedId(null);
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
      setDeleteTarget(null);
    },
  });

  const messages = folder === "inbox" ? inbox : sent;
  const isLoading = folder === "inbox" ? inboxLoading : sentLoading;
  const unread = unreadData?.count ?? 0;

  function handleReply(recipientId: string) {
    setComposeRecipientId(recipientId);
    setComposeOpen(true);
  }

  function handleCompose() {
    setComposeRecipientId(undefined);
    setComposeOpen(true);
  }

  const showDetail = !!selectedId;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Left sidebar: folder nav ── */}
      <div
        className={cn(
          "w-full md:w-64 flex-shrink-0 border-r flex flex-col bg-background",
          showDetail && "hidden md:flex"
        )}
      >
        {/* Compose button */}
        <div className="p-3 border-b">
          <Button className="w-full" onClick={handleCompose} data-testid="button-compose">
            <Pencil className="h-4 w-4 mr-2" />
            Compose
          </Button>
        </div>

        {/* Folder buttons */}
        <div className="p-2 space-y-1">
          <button
            onClick={() => { setFolder("inbox"); setSelectedId(null); }}
            data-testid="button-folder-inbox"
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              folder === "inbox"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            <Inbox className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 text-left">Inbox</span>
            {unread > 0 && (
              <Badge className="bg-blue-500 text-white text-xs h-5 px-1.5" data-testid="badge-unread-count">
                {unread > 99 ? "99+" : unread}
              </Badge>
            )}
          </button>
          <button
            onClick={() => { setFolder("sent"); setSelectedId(null); }}
            data-testid="button-folder-sent"
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              folder === "sent"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            <Send className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 text-left">Sent</span>
          </button>
        </div>
      </div>

      {/* ── Message list ── */}
      <div
        className={cn(
          "flex-1 md:w-80 md:flex-none border-r flex flex-col bg-background",
          showDetail && "hidden md:flex"
        )}
        style={{ minWidth: 0, maxWidth: "100%", width: "100%" }}
      >
        <div className="px-4 py-3 border-b">
          <h1 className="font-semibold text-sm capitalize" data-testid="text-folder-name">
            {folder === "inbox" ? "Inbox" : "Sent"}
          </h1>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Loading…
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              {folder === "inbox" ? (
                <Inbox className="h-8 w-8 opacity-30" />
              ) : (
                <Send className="h-8 w-8 opacity-30" />
              )}
              <p className="text-sm" data-testid="text-empty-state">
                {folder === "inbox" ? "No messages in your inbox" : "No sent messages"}
              </p>
            </div>
          ) : (
            <div>
              {messages.map((msg, i) => (
                <React.Fragment key={msg.id}>
                  <MessageRow
                    msg={msg}
                    folder={folder}
                    selected={selectedId === msg.id}
                    onClick={() => setSelectedId(msg.id)}
                  />
                  {i < messages.length - 1 && <Separator />}
                </React.Fragment>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Detail pane ── */}
      <div
        className={cn(
          "flex-1 flex-col bg-background",
          showDetail ? "flex w-full" : "hidden md:flex"
        )}
        style={{ minWidth: 0 }}
      >
        {selectedId ? (
          <MessageDetail
            msgId={selectedId}
            folder={folder}
            onBack={() => setSelectedId(null)}
            onDelete={(id) => setDeleteTarget(id)}
            onReply={handleReply}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 select-none">
            <Inbox className="h-10 w-10 opacity-20" />
            <p className="text-sm" data-testid="text-select-prompt">Select a message to read</p>
          </div>
        )}
      </div>

      {/* ── Compose dialog ── */}
      <ComposeDialog
        open={composeOpen}
        onClose={() => { setComposeOpen(false); setComposeRecipientId(undefined); }}
        initialRecipientId={composeRecipientId}
      />

      {/* ── Delete confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the message from your view. The recipient will still have their copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-delete-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
