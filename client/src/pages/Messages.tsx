import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useToast } from "@/hooks/use-toast";
import {
  Send,
  Pencil,
  Trash2,
  ArrowLeft,
  MessageSquare,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

// ── Types ──────────────────────────────────────────────────────────────────────

interface MessageableUser {
  id: string;
  name: string;
  role: string;
  profile_picture: string | null;
}

interface InboxMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string | null;
  body: string;
  sent_at: string;
  read_at: string | null;
  sender_name: string;
  sender_role: string;
  sender_picture: string | null;
}

interface ConversationMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string | null;
  body: string;
  sent_at: string;
  read_at: string | null;
  sender_name: string;
  sender_role: string;
  sender_picture: string | null;
  recipient_name: string;
  recipient_role: string;
  recipient_picture: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

function formatFull(dateStr: string): string {
  return format(new Date(dateStr), "MMM d, yyyy 'at' h:mm a");
}

function Avatar({
  name,
  picture,
  size = 36,
}: {
  name: string;
  picture?: string | null;
  size?: number;
}) {
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
      className="rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.33 }}
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
  initialSubject,
}: {
  open: boolean;
  onClose: () => void;
  initialRecipientId?: string;
  initialSubject?: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [recipientId, setRecipientId] = useState(initialRecipientId ?? "");
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setRecipientId(initialRecipientId ?? "");
      setSubject(initialSubject ?? "");
      setBody("");
      setSearch("");
    }
  }, [open, initialRecipientId, initialSubject]);

  const { data: users = [] } = useQuery<MessageableUser[]>({
    queryKey: ["/api/users/messageable"],
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/direct-messages", { recipientId, subject, body });
    },
    onSuccess: () => {
      toast({ title: "Message sent" });
      qc.invalidateQueries({ queryKey: ["/api/direct-messages/inbox"] });
      qc.invalidateQueries({ queryKey: ["/api/direct-messages/unread-count"] });
      qc.invalidateQueries({ queryKey: ["/api/direct-messages/conversation", recipientId] });
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
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
                <Avatar name={selected.name} picture={selected.profile_picture} size={28} />
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
                <div className="flex items-center px-3 gap-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <Input
                    placeholder="Search by name or role…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border-0 px-0 focus-visible:ring-0"
                    data-testid="input-recipient-search"
                  />
                </div>
                {(search || !selected) && users.length > 0 && (
                  <div className="border-t max-h-40 overflow-y-auto">
                    {(search ? filtered : users).length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No users found</p>
                    ) : (
                      (search ? filtered : users).map((u) => (
                        <button
                          key={u.id}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left"
                          onClick={() => {
                            setRecipientId(u.id);
                            setSearch("");
                          }}
                          data-testid={`button-select-user-${u.id}`}
                        >
                          <Avatar name={u.name} picture={u.profile_picture} size={28} />
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
            <Label>Subject <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              placeholder="Subject…"
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
              rows={5}
              data-testid="textarea-body"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-compose-cancel">
            Cancel
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!recipientId || !body.trim() || sendMutation.isPending}
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4 mr-1.5" />
            {sendMutation.isPending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Contact row in left panel ──────────────────────────────────────────────────

interface ContactEntry {
  userId: string;
  name: string;
  role: string;
  picture: string | null;
  lastMessage: string;
  lastTime: string;
  unreadCount: number;
}

function buildContactList(inbox: InboxMessage[], myId: string): ContactEntry[] {
  const map = new Map<string, ContactEntry>();
  for (const msg of inbox) {
    const userId = msg.sender_id;
    const existing = map.get(userId);
    if (!existing) {
      map.set(userId, {
        userId,
        name: msg.sender_name,
        role: msg.sender_role,
        picture: msg.sender_picture,
        lastMessage: msg.body,
        lastTime: msg.sent_at,
        unreadCount: msg.read_at ? 0 : 1,
      });
    } else {
      if (msg.sent_at > existing.lastTime) {
        existing.lastMessage = msg.body;
        existing.lastTime = msg.sent_at;
      }
      if (!msg.read_at) existing.unreadCount++;
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()
  );
}

function ContactRow({
  contact,
  selected,
  onClick,
}: {
  contact: ContactEntry;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={`row-contact-${contact.userId}`}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
        selected && "bg-primary/8 border-l-2 border-l-primary",
        !selected && "border-l-2 border-l-transparent"
      )}
    >
      <div className="relative flex-shrink-0">
        <Avatar name={contact.name} picture={contact.picture} size={40} />
        {contact.unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center" data-testid={`badge-unread-${contact.userId}`}>
            {contact.unreadCount > 9 ? "9+" : contact.unreadCount}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1">
          <span className={cn("text-sm truncate", contact.unreadCount > 0 ? "font-semibold" : "font-medium text-muted-foreground")} data-testid={`text-contact-name-${contact.userId}`}>
            {contact.name}
          </span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatTime(contact.lastTime)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{contact.role}</p>
        <p className={cn("text-xs truncate mt-0.5", contact.unreadCount > 0 ? "text-foreground" : "text-muted-foreground")}>
          {contact.lastMessage}
        </p>
      </div>
    </button>
  );
}

// ── Conversation thread ────────────────────────────────────────────────────────

function ConversationThread({
  userId,
  myId,
  onBack,
  onCompose,
}: {
  userId: string;
  myId: string;
  onBack: () => void;
  onCompose: (recipientId: string) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: messages = [], isLoading } = useQuery<ConversationMessage[]>({
    queryKey: ["/api/direct-messages/conversation", userId],
    queryFn: async () => {
      const res = await fetch(`/api/direct-messages/conversation/${userId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    refetchInterval: 8000,
    staleTime: 0,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Invalidate inbox unread after loading conversation (marks read)
  useEffect(() => {
    if (messages.length > 0) {
      qc.invalidateQueries({ queryKey: ["/api/direct-messages/inbox"] });
      qc.invalidateQueries({ queryKey: ["/api/direct-messages/unread-count"] });
    }
  }, [messages.length]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/direct-messages/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Message deleted" });
      qc.invalidateQueries({ queryKey: ["/api/direct-messages/conversation", userId] });
      qc.invalidateQueries({ queryKey: ["/api/direct-messages/inbox"] });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      setDeleteTarget(null);
    },
  });

  const other = messages.find(
    (m) => m.sender_id === userId || m.recipient_id === userId
  );
  const otherName =
    other
      ? other.sender_id === userId
        ? other.sender_name
        : other.recipient_name
      : "Conversation";
  const otherRole =
    other
      ? other.sender_id === userId
        ? other.sender_role
        : other.recipient_role
      : "";
  const otherPicture =
    other
      ? other.sender_id === userId
        ? other.sender_picture
        : other.recipient_picture
      : null;

  // Group messages by date
  let lastDate = "";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="md:hidden flex-shrink-0"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar name={otherName} picture={otherPicture} size={36} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" data-testid="text-thread-name">{otherName}</p>
          <p className="text-xs text-muted-foreground">{otherRole}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onCompose(userId)}
          data-testid="button-reply"
        >
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          New message
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No messages yet</p>
        ) : (
          <div className="space-y-1">
            {messages.map((msg) => {
              const isMine = msg.sender_id === myId;
              const dateLabel = format(new Date(msg.sent_at), "MMMM d, yyyy");
              const showDate = dateLabel !== lastDate;
              lastDate = dateLabel;

              return (
                <React.Fragment key={msg.id}>
                  {showDate && (
                    <div className="flex items-center gap-2 py-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground px-2">{dateLabel}</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div
                    className={cn("flex items-end gap-2 group", isMine ? "flex-row-reverse" : "flex-row")}
                    data-testid={`msg-${msg.id}`}
                  >
                    {!isMine && (
                      <Avatar name={msg.sender_name} picture={msg.sender_picture} size={28} />
                    )}
                    <div className={cn("max-w-[70%] space-y-0.5", isMine ? "items-end" : "items-start", "flex flex-col")}>
                      {msg.subject && (
                        <p className={cn("text-xs font-medium px-1", isMine ? "text-right" : "")}>
                          {msg.subject}
                        </p>
                      )}
                      <div
                        className={cn(
                          "rounded-2xl px-3 py-2 text-sm",
                          isMine
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words leading-relaxed" data-testid={`text-body-${msg.id}`}>
                          {msg.body}
                        </p>
                      </div>
                      <div className={cn("flex items-center gap-1 px-1", isMine ? "flex-row-reverse" : "")}>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(msg.sent_at), "h:mm a")}
                        </span>
                        {isMine && msg.read_at && (
                          <span className="text-[10px] text-muted-foreground">· Read</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteTarget(msg.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 flex-shrink-0"
                      data-testid={`button-delete-${msg.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the message from your view only.
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

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeRecipientId, setComposeRecipientId] = useState<string | undefined>();
  const [composeSubject, setComposeSubject] = useState<string | undefined>();
  const [search, setSearch] = useState("");

  const { data: inbox = [], isLoading } = useQuery<InboxMessage[]>({
    queryKey: ["/api/direct-messages/inbox"],
    refetchInterval: 10000,
  });

  const contacts = buildContactList(inbox, user?.id ?? "");
  const filtered = search
    ? contacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : contacts;

  function openCompose(recipientId?: string, subject?: string) {
    setComposeRecipientId(recipientId);
    setComposeSubject(subject);
    setComposeOpen(true);
  }

  const showThread = !!selectedUserId;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Left panel: contact list ── */}
      <div
        className={cn(
          "w-full md:w-72 flex-shrink-0 border-r flex flex-col bg-background",
          showThread && "hidden md:flex"
        )}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="font-semibold text-sm">Messages</h1>
            <Button size="sm" onClick={() => openCompose()} data-testid="button-compose">
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Compose
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
              data-testid="input-search"
            />
          </div>
        </div>

        {/* Contact list */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <MessageSquare className="h-8 w-8 opacity-25" />
              <p className="text-sm" data-testid="text-empty-state">
                {search ? "No results" : "No messages yet"}
              </p>
              {!search && (
                <Button variant="outline" size="sm" onClick={() => openCompose()} data-testid="button-compose-empty">
                  Send your first message
                </Button>
              )}
            </div>
          ) : (
            filtered.map((contact) => (
              <ContactRow
                key={contact.userId}
                contact={contact}
                selected={selectedUserId === contact.userId}
                onClick={() => setSelectedUserId(contact.userId)}
              />
            ))
          )}
        </ScrollArea>
      </div>

      {/* ── Right panel: conversation thread ── */}
      <div
        className={cn(
          "flex-1 flex-col bg-background",
          showThread ? "flex w-full" : "hidden md:flex"
        )}
        style={{ minWidth: 0 }}
      >
        {selectedUserId && user ? (
          <ConversationThread
            userId={selectedUserId}
            myId={user.id}
            onBack={() => setSelectedUserId(null)}
            onCompose={(recipientId) => openCompose(recipientId)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 select-none">
            <MessageSquare className="h-12 w-12 opacity-15" />
            <p className="text-sm" data-testid="text-select-prompt">
              Select a conversation or compose a new message
            </p>
            <Button variant="outline" size="sm" onClick={() => openCompose()} data-testid="button-compose-placeholder">
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Compose
            </Button>
          </div>
        )}
      </div>

      {/* ── Compose dialog ── */}
      <ComposeDialog
        open={composeOpen}
        onClose={() => { setComposeOpen(false); setComposeRecipientId(undefined); setComposeSubject(undefined); }}
        initialRecipientId={composeRecipientId}
        initialSubject={composeSubject}
      />
    </div>
  );
}
