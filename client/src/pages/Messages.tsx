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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Send, Pencil, Trash2, ArrowLeft, MessageSquare, Search,
  Star, Archive, MailOpen, Check, CheckCheck, Inbox, Mail, Paperclip, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday, formatDistanceToNowStrict } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

// ── Types ──────────────────────────────────────────────────────────────────────

type Folder = "inbox" | "sent" | "starred" | "archive";

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface MessageableUser {
  id: string;
  name: string;
  role: string;
  profile_picture: string | null;
}

interface Conversation {
  other_user_id: string;
  other_user_name: string;
  other_user_role: string;
  other_user_picture: string | null;
  last_message: string;
  last_message_at: string;
  last_sender_id: string;
  last_read_at: string | null;
  is_starred: boolean;
  is_archived: boolean;
  unread_count: number;
}

interface ThreadMessage {
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
  attachments: Attachment[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function uploadAttachments(messageId: string, files: File[]): Promise<void> {
  for (const file of files) {
    const fd = new FormData();
    fd.append("file", file);
    await fetch(`/api/dm/${messageId}/attachments`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
  }
}

function Avatar({ name, picture, size = 36 }: { name: string; picture?: string | null; size?: number }) {
  if (picture) {
    return (
      <img src={picture} alt={name} className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }} />
    );
  }
  const colors = ["bg-blue-100 text-blue-700", "bg-green-100 text-green-700", "bg-purple-100 text-purple-700",
    "bg-amber-100 text-amber-700", "bg-pink-100 text-pink-700", "bg-teal-100 text-teal-700"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={cn("rounded-full flex items-center justify-center font-semibold flex-shrink-0", color)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.35) }}>
      {initials(name)}
    </div>
  );
}

// ── Compose Dialog ─────────────────────────────────────────────────────────────

function ComposeDialog({ open, onClose, initialRecipientId }: {
  open: boolean;
  onClose: (sentToId?: string) => void;
  initialRecipientId?: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [recipientId, setRecipientId] = useState(initialRecipientId ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setRecipientId(initialRecipientId ?? "");
      setSubject("");
      setBody("");
      setSearch("");
      setPendingFiles([]);
    }
  }, [open, initialRecipientId]);

  const { data: users = [] } = useQuery<MessageableUser[]>({
    queryKey: ["/api/dm/messageable-users"],
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/dm", { recipientId, subject, body });
      const msg = await res.json();
      if (pendingFiles.length > 0) await uploadAttachments(msg.id, pendingFiles);
      return msg;
    },
    onSuccess: (msg: any) => {
      toast({ title: "Message sent" });
      qc.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
      qc.invalidateQueries({ queryKey: ["/api/dm/unread-count"] });
      qc.invalidateQueries({ queryKey: ["/api/dm/conversation", recipientId] });
      onClose(recipientId);
    },
    onError: (err: any) => {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  const filtered = search
    ? users.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.role.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const selected = users.find((u) => u.id === recipientId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>To</Label>
            {selected ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/30">
                <Avatar name={selected.name} picture={selected.profile_picture} size={26} />
                <span className="text-sm font-medium">{selected.name}</span>
                <span className="text-xs text-muted-foreground">({selected.role})</span>
                <button className="ml-auto text-muted-foreground hover:text-foreground text-xs"
                  onClick={() => setRecipientId("")} data-testid="button-clear-recipient">✕</button>
              </div>
            ) : (
              <div className="border rounded-md">
                <div className="flex items-center px-3 gap-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <Input placeholder="Search by name or role…" value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border-0 px-0 focus-visible:ring-0 h-9 text-sm"
                    data-testid="input-recipient-search" />
                </div>
                <div className="border-t max-h-44 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      {users.length === 0 ? "No users available" : "No results"}
                    </p>
                  ) : filtered.map((u) => (
                    <button key={u.id}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 text-left"
                      onClick={() => { setRecipientId(u.id); setSearch(""); }}
                      data-testid={`button-select-user-${u.id}`}>
                      <Avatar name={u.name} picture={u.profile_picture} size={28} />
                      <div>
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Subject <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input placeholder="Subject…" value={subject}
              onChange={(e) => setSubject(e.target.value)} data-testid="input-subject" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Message</Label>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                data-testid="button-attach-compose">
                <Paperclip className="h-3.5 w-3.5" /> Attach file
              </button>
            </div>
            <Textarea placeholder="Write your message…" value={body}
              onChange={(e) => setBody(e.target.value)} rows={4} data-testid="textarea-body" />
            <input ref={fileInputRef} type="file" multiple className="hidden"
              data-testid="input-file-compose"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) setPendingFiles((prev) => [...prev, ...files]);
                e.target.value = "";
              }} />
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-xs max-w-full"
                    data-testid={`chip-file-compose-${i}`}>
                    <FileText className="h-3 w-3 text-gray-500 flex-shrink-0" />
                    <span className="truncate max-w-[140px] text-gray-700">{f.name}</span>
                    <span className="text-gray-400 flex-shrink-0">({formatFileSize(f.size)})</span>
                    <button onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500 ml-0.5 flex-shrink-0" type="button"
                      data-testid={`button-remove-file-compose-${i}`}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()} data-testid="button-compose-cancel">
            Cancel
          </Button>
          <Button onClick={() => sendMutation.mutate()}
            disabled={!recipientId || !body.trim() || sendMutation.isPending}
            data-testid="button-send-message">
            <Send className="h-4 w-4 mr-1.5" />
            {sendMutation.isPending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Conversation Row ───────────────────────────────────────────────────────────

function ConversationRow({ conv, selected, myId, onClick }: {
  conv: Conversation;
  selected: boolean;
  myId: string;
  onClick: () => void;
}) {
  const unread = Number(conv.unread_count);
  const isUnread = unread > 0;

  return (
    <button onClick={onClick} data-testid={`row-conv-${conv.other_user_id}`}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-2",
        selected ? "bg-blue-50 border-l-blue-500" : "hover:bg-gray-50 border-l-transparent"
      )}>
      <div className="relative flex-shrink-0">
        <Avatar name={conv.other_user_name} picture={conv.other_user_picture} size={42} />
        {isUnread && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white"
            data-testid={`dot-unread-${conv.other_user_id}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1">
          <span className={cn("text-sm truncate", isUnread ? "font-bold text-gray-900" : "font-medium text-gray-700")}
            data-testid={`text-conv-name-${conv.other_user_id}`}>
            {conv.other_user_name}
          </span>
          <span className="text-[11px] text-gray-400 flex-shrink-0">
            {relativeTime(conv.last_message_at)}
          </span>
        </div>
        <p className={cn("text-xs truncate mt-0.5",
          isUnread ? "text-gray-800 font-medium" : "text-gray-500")}>
          {conv.last_sender_id === myId ? `You: ${conv.last_message}` : conv.last_message}
        </p>
      </div>
      {isUnread && (
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center"
          data-testid={`badge-unread-${conv.other_user_id}`}>
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

// ── Conversation Thread ────────────────────────────────────────────────────────

function ConversationThread({ userId, myId, folder, onBack, onClose }: {
  userId: string;
  myId: string;
  folder: Folder;
  onBack: () => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [reply, setReply] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevCountRef = useRef(0);

  const { data: messages = [], isLoading } = useQuery<ThreadMessage[]>({
    queryKey: ["/api/dm/conversation", userId],
    queryFn: async () => {
      const res = await fetch(`/api/dm/conversation/${userId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    refetchInterval: 8000,
    staleTime: 0,
  });

  // Toast on new incoming messages when thread is open
  useEffect(() => {
    const incoming = messages.filter((m) => m.sender_id === userId);
    if (prevCountRef.current > 0 && incoming.length > prevCountRef.current) {
      toast({ title: "New message", description: incoming[incoming.length - 1].body.slice(0, 60) });
    }
    prevCountRef.current = incoming.length;
  }, [messages]);

  // Refresh sidebar after messages load (marks read)
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
    qc.invalidateQueries({ queryKey: ["/api/dm/unread-count"] });
  }, [messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Derive other user info from messages
  const other = messages.find((m) => m.sender_id === userId || m.recipient_id === userId);
  const otherName = other
    ? (other.sender_id === userId ? other.sender_name : other.recipient_name)
    : "Conversation";
  const otherRole = other
    ? (other.sender_id === userId ? other.sender_role : other.recipient_role)
    : "";
  const otherPicture = other
    ? (other.sender_id === userId ? other.sender_picture : other.recipient_picture)
    : null;

  // Current star/archive state from conversations cache
  const convs = qc.getQueryData<Conversation[]>(["/api/dm/conversations", folder]) ??
    qc.getQueryData<Conversation[]>(["/api/dm/conversations"]) ?? [];
  const conv = convs.find((c) => c.other_user_id === userId);
  const isStarred = conv?.is_starred ?? false;
  const isArchived = conv?.is_archived ?? false;

  const starMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/dm/conversation/${userId}/star`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
      toast({ title: isStarred ? "Unstarred" : "Starred" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/dm/conversation/${userId}/archive`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
      toast({ title: isArchived ? "Moved to Inbox" : "Archived" });
      onClose();
    },
  });

  const unreadMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/dm/conversation/${userId}/unread`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
      qc.invalidateQueries({ queryKey: ["/api/dm/unread-count"] });
      toast({ title: "Marked as unread" });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/dm/${id}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dm/conversation", userId] });
      qc.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
    },
  });

  async function sendReply() {
    if (!reply.trim() || isSending) return;
    setIsSending(true);
    const filesToSend = [...pendingFiles];
    try {
      const res = await apiRequest("POST", "/api/dm", { recipientId: userId, body: reply.trim() });
      const msg = await res.json();
      setReply("");
      setPendingFiles([]);
      if (filesToSend.length > 0) await uploadAttachments(msg.id, filesToSend);
      qc.invalidateQueries({ queryKey: ["/api/dm/conversation", userId] });
      qc.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  }

  // Find the last message sent by me for delivery status
  const lastSentByMe = [...messages].reverse().find((m) => m.sender_id === myId);

  let lastDate = "";

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden flex-shrink-0 -ml-1"
          data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar name={otherName} picture={otherPicture} size={36} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate" data-testid="text-thread-name">{otherName}</p>
          <p className="text-xs text-gray-500">{otherRole}</p>
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => starMutation.mutate()}
            disabled={starMutation.isPending}
            title={isStarred ? "Unstar" : "Star"}
            className={cn("h-8 w-8", isStarred ? "text-amber-500" : "text-gray-400 hover:text-amber-500")}
            data-testid="button-star">
            <Star className={cn("h-4 w-4", isStarred && "fill-amber-500")} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => archiveMutation.mutate()}
            disabled={archiveMutation.isPending}
            title={isArchived ? "Move to Inbox" : "Archive"}
            className="h-8 w-8 text-gray-400 hover:text-gray-600"
            data-testid="button-archive">
            <Archive className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => unreadMutation.mutate()}
            disabled={unreadMutation.isPending}
            title="Mark as unread"
            className="h-8 w-8 text-gray-400 hover:text-gray-600"
            data-testid="button-mark-unread">
            <MailOpen className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon"
            onClick={() => { if (lastSentByMe) deleteMutation.mutate(lastSentByMe.id); }}
            disabled={!lastSentByMe || deleteMutation.isPending}
            title="Delete last message"
            className="h-8 w-8 text-gray-400 hover:text-red-500"
            data-testid="button-delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        {isLoading ? (
          <p className="text-center text-sm text-gray-400 py-8">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">No messages yet. Send one below.</p>
        ) : (
          <div className="space-y-1 pb-2">
            {messages.map((msg, idx) => {
              const isMine = msg.sender_id === myId;
              const dateLabel = format(new Date(msg.sent_at), "MMMM d, yyyy");
              const showDate = dateLabel !== lastDate;
              lastDate = dateLabel;
              const isLast = idx === messages.length - 1;
              const isLastSentByMe = lastSentByMe?.id === msg.id;

              return (
                <React.Fragment key={msg.id}>
                  {showDate && (
                    <div className="flex items-center gap-2 py-3">
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className="text-xs text-gray-400 px-2 font-medium">{dateLabel}</span>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>
                  )}
                  <div className={cn("flex items-end gap-2 group", isMine ? "flex-row-reverse" : "flex-row")}
                    data-testid={`msg-${msg.id}`}>
                    {!isMine && (
                      <Avatar name={msg.sender_name} picture={msg.sender_picture} size={28} />
                    )}
                    <div className={cn("max-w-[72%] flex flex-col", isMine ? "items-end" : "items-start")}>
                      {!isMine && (
                        <span className="text-[11px] text-gray-400 px-1 mb-0.5">{msg.sender_name}</span>
                      )}
                      {msg.subject && (
                        <p className="text-xs font-semibold text-gray-600 px-1 mb-0.5">{msg.subject}</p>
                      )}
                      <div className={cn("rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                        isMine
                          ? "bg-blue-500 text-white rounded-br-sm"
                          : "bg-gray-100 text-gray-900 rounded-bl-sm"
                      )}>
                        <p className="whitespace-pre-wrap break-words" data-testid={`text-body-${msg.id}`}>
                          {msg.body}
                        </p>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-white/20">
                            {msg.attachments.map((att) => (
                              <button key={att.id}
                                onClick={() => window.open(`/api/dm/attachments/${att.id}/download`)}
                                className={cn(
                                  "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors",
                                  isMine
                                    ? "bg-white/20 hover:bg-white/30 text-white"
                                    : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
                                )}
                                data-testid={`chip-attachment-${att.id}`}>
                                <FileText className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate max-w-[120px]">{att.fileName}</span>
                                <span className="opacity-70 flex-shrink-0">({formatFileSize(att.fileSize)})</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className={cn("flex items-center gap-1 px-1 mt-0.5",
                        isMine ? "flex-row-reverse" : "flex-row")}>
                        <span className="text-[10px] text-gray-400">
                          {format(new Date(msg.sent_at), "h:mm a")}
                        </span>
                        {/* Delivery status on last sent message only */}
                        {isMine && isLastSentByMe && (
                          msg.read_at ? (
                            <span className="flex items-center gap-0.5 text-blue-400" title={`Read ${format(new Date(msg.read_at), "h:mm a")}`}>
                              <CheckCheck className="h-3 w-3" />
                              <span className="text-[10px]">{format(new Date(msg.read_at), "h:mm a")}</span>
                            </span>
                          ) : (
                            <span className="text-gray-300" title="Sent">
                              <Check className="h-3 w-3" />
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Reply box */}
      <div className="border-t px-4 py-3 bg-white">
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pendingFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-xs"
                data-testid={`chip-file-reply-${i}`}>
                <FileText className="h-3 w-3 text-gray-500 flex-shrink-0" />
                <span className="truncate max-w-[120px] text-gray-700">{f.name}</span>
                <span className="text-gray-400 flex-shrink-0">({formatFileSize(f.size)})</span>
                <button onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="text-gray-400 hover:text-red-500 ml-0.5" type="button"
                  data-testid={`button-remove-file-reply-${i}`}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <Textarea
            placeholder="Reply…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }
            }}
            rows={2}
            className="resize-none text-sm flex-1"
            data-testid="textarea-reply"
          />
          <input ref={fileInputRef} type="file" multiple className="hidden"
            data-testid="input-file-reply"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) setPendingFiles((prev) => [...prev, ...files]);
              e.target.value = "";
            }} />
          <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}
            className="h-9 w-9 flex-shrink-0 text-gray-400 hover:text-gray-600"
            title="Attach file" type="button" data-testid="button-attach-reply">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button onClick={sendReply} disabled={!reply.trim() || isSending}
            size="icon" className="h-9 w-9 flex-shrink-0" data-testid="button-reply-send">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

// ── Folder Tab ─────────────────────────────────────────────────────────────────

function FolderTab({ label, icon: Icon, active, badge, onClick }: {
  label: string;
  icon: React.ElementType;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} data-testid={`tab-${label.toLowerCase()}`}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors w-full",
        active ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
      )}>
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
          data-testid={`badge-folder-${label.toLowerCase()}`}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [folder, setFolder] = useState<Folder>("inbox");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const isSearchActive = debouncedSearch.length > 0;

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/dm/conversations", folder],
    queryFn: async () => {
      const res = await fetch(`/api/dm/conversations?folder=${folder}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 20000,
    staleTime: 0,
    enabled: !isSearchActive,
  });

  const { data: searchResults = [], isFetching: isSearching } = useQuery<Conversation[]>({
    queryKey: ["/api/dm/search", debouncedSearch],
    queryFn: async () => {
      const res = await fetch(`/api/dm/search?q=${encodeURIComponent(debouncedSearch)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isSearchActive,
    staleTime: 0,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/dm/unread-count"],
    refetchInterval: 20000,
  });
  const unreadCount = unreadData?.count ?? 0;

  const displayed = isSearchActive ? searchResults : conversations;
  const isLoading_ = isSearchActive ? isSearching : isLoading;

  function handleFolderChange(f: Folder) {
    setFolder(f);
    setSelectedUserId(null);
    setSearch("");
  }

  function handleComposeClosed(sentToId?: string) {
    setComposeOpen(false);
    if (sentToId) {
      setFolder("inbox");
      setSelectedUserId(sentToId);
    }
  }

  const showThread = !!selectedUserId;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-white">
      {/* ── Left panel ── */}
      <div className={cn(
        "flex-shrink-0 border-r flex flex-col bg-white",
        showThread ? "hidden md:flex" : "flex w-full md:w-80"
      )} style={{ width: 320 }}>

        {/* Header */}
        <div className="px-4 pt-4 pb-2 border-b">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-gray-900" data-testid="text-messages-heading">Messages</h1>
            <Button size="sm" onClick={() => setComposeOpen(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white h-8 px-3 text-xs"
              data-testid="button-compose">
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Compose
            </Button>
          </div>

          {/* Folder tabs */}
          <div className="space-y-0.5">
            <FolderTab label="Inbox" icon={Inbox} active={folder === "inbox"}
              badge={unreadCount} onClick={() => handleFolderChange("inbox")} />
            <FolderTab label="Sent" icon={Send} active={folder === "sent"}
              onClick={() => handleFolderChange("sent")} />
            <FolderTab label="Starred" icon={Star} active={folder === "starred"}
              onClick={() => handleFolderChange("starred")} />
            <FolderTab label="Archive" icon={Archive} active={folder === "archive"}
              onClick={() => handleFolderChange("archive")} />
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input placeholder="Search conversations…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm bg-gray-50 border-gray-200"
              data-testid="input-search" />
          </div>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1">
          {isLoading_ ? (
            <p className="text-sm text-gray-400 text-center py-10">
              {isSearchActive ? "Searching…" : "Loading…"}
            </p>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
              <MessageSquare className="h-9 w-9 opacity-25" />
              <p className="text-sm" data-testid="text-empty-conversations">
                {isSearchActive ? "No results found"
                  : folder === "starred" ? "No starred conversations"
                  : folder === "archive" ? "Nothing archived"
                  : folder === "sent" ? "No sent messages"
                  : "No conversations yet"}
              </p>
              {folder === "inbox" && !isSearchActive && (
                <Button size="sm" variant="outline" onClick={() => setComposeOpen(true)}
                  className="text-xs" data-testid="button-compose-empty">
                  Start a conversation
                </Button>
              )}
            </div>
          ) : displayed.map((conv) => (
            <ConversationRow
              key={conv.other_user_id}
              conv={conv}
              myId={user?.id ?? ""}
              selected={selectedUserId === conv.other_user_id}
              onClick={() => setSelectedUserId(conv.other_user_id)}
            />
          ))}
        </ScrollArea>
      </div>

      {/* ── Right panel ── */}
      <div className={cn(
        "flex-1 flex-col bg-white overflow-hidden",
        showThread ? "flex w-full" : "hidden md:flex"
      )}>
        {selectedUserId && user ? (
          <ConversationThread
            key={selectedUserId}
            userId={selectedUserId}
            myId={user.id}
            folder={folder}
            onBack={() => setSelectedUserId(null)}
            onClose={() => setSelectedUserId(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 select-none">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <Mail className="h-7 w-7 opacity-40" />
            </div>
            <p className="text-sm font-medium" data-testid="text-select-prompt">Select a conversation</p>
            <p className="text-xs text-gray-300">or compose a new message</p>
          </div>
        )}
      </div>

      {/* ── Compose dialog ── */}
      <ComposeDialog open={composeOpen} onClose={handleComposeClosed} />
    </div>
  );
}
