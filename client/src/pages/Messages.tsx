import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Search, Send, Plus, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DmUser {
  id: string;
  name: string;
  role: string;
  profile_picture: string | null;
  email: string;
}

interface Conversation {
  id: number;
  last_message_at: string | null;
  other_user_id: string;
  other_user_name: string;
  other_user_role: string;
  other_user_picture: string | null;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  has_unread: boolean;
}

interface Message {
  id: number;
  body: string;
  created_at: string;
  sender_id: string;
  sender_name: string;
  sender_picture: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .map(p => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

function Avatar({ name, picture, size = 9 }: { name: string; picture: string | null; size?: number }) {
  if (picture) {
    return (
      <img
        src={picture}
        alt={name}
        className={`w-${size} h-${size} rounded-full object-cover shrink-0`}
      />
    );
  }
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-purple-500",
    "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-indigo-500",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div
      className={cn(
        `w-${size} h-${size} rounded-full shrink-0 flex items-center justify-center text-white font-semibold`,
        color,
        size <= 8 ? "text-xs" : "text-sm"
      )}
    >
      {initials(name)}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NewConversationDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (userId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const { data: users = [] } = useQuery<DmUser[]>({
    queryKey: ["/api/dm/users"],
    queryFn: () => fetch("/api/dm/users", { credentials: "include" }).then(r => r.json()),
    enabled: open,
  });
  const filtered = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search team members…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
          data-testid="input-user-search"
        />
        <ScrollArea className="max-h-72">
          <div className="space-y-1 pt-1">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No team members found.</p>
            )}
            {filtered.map(u => (
              <button
                key={u.id}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted text-left transition-colors"
                onClick={() => { onSelect(u.id); onClose(); setSearch(""); }}
                data-testid={`btn-select-user-${u.id}`}
              >
                <Avatar name={u.name} picture={u.profile_picture} size={8} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.role}</p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ConversationList({
  conversations,
  activeId,
  currentUserId,
  onSelect,
  search,
  onSearchChange,
}: {
  conversations: Conversation[];
  activeId: number | null;
  currentUserId: string;
  onSelect: (c: Conversation) => void;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const filtered = conversations.filter(c =>
    !search || c.other_user_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full border-r">
      <div className="p-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search conversations…"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            data-testid="input-conversation-search"
          />
        </div>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground px-4">
            {conversations.length === 0
              ? "No conversations yet. Start one with the + button."
              : "No matches."}
          </div>
        )}
        <div className="py-1">
          {filtered.map(c => {
            const isActive = c.id === activeId;
            const preview = c.last_message_body
              ? (c.last_message_sender_id === currentUserId ? "You: " : "") +
                c.last_message_body.slice(0, 60) + (c.last_message_body.length > 60 ? "…" : "")
              : "No messages yet";
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className={cn(
                  "w-full flex items-start gap-3 px-3 py-3 hover:bg-muted/60 transition-colors text-left",
                  isActive && "bg-muted"
                )}
                data-testid={`btn-conversation-${c.id}`}
              >
                <div className="relative mt-0.5">
                  <Avatar name={c.other_user_name} picture={c.other_user_picture} size={9} />
                  {c.has_unread && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-background" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className={cn("text-sm truncate", c.has_unread ? "font-semibold" : "font-medium")}>
                      {c.other_user_name}
                    </span>
                    {c.last_message_at && (
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {fmtTime(c.last_message_at)}
                      </span>
                    )}
                  </div>
                  <p className={cn("text-xs mt-0.5 truncate", c.has_unread ? "text-foreground" : "text-muted-foreground")}>
                    {preview}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function ChatThread({
  conversation,
  currentUserId,
  onBack,
}: {
  conversation: Conversation;
  currentUserId: string;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: messages = [], refetch } = useQuery<Message[]>({
    queryKey: ["/api/dm/conversations", conversation.id, "messages"],
    queryFn: () =>
      fetch(`/api/dm/conversations/${conversation.id}/messages`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: 5000,
  });

  // Mark as read when opening
  useEffect(() => {
    fetch(`/api/dm/conversations/${conversation.id}/read`, {
      method: "POST",
      credentials: "include",
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dm/unread-count"] });
    });
  }, [conversation.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when conversation changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [conversation.id]);

  const sendMut = useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch(`/api/dm/conversations/${conversation.id}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error("Send failed");
      return res.json();
    },
    onSuccess: () => {
      setDraft("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
    },
    onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
  });

  function handleSend() {
    const body = draft.trim();
    if (!body || sendMut.isPending) return;
    sendMut.mutate(body);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Group messages by date
  const groups: { date: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const d = new Date(msg.created_at);
    let label: string;
    if (isToday(d)) label = "Today";
    else if (isYesterday(d)) label = "Yesterday";
    else label = format(d, "MMMM d, yyyy");
    const last = groups[groups.length - 1];
    if (last && last.date === label) last.msgs.push(msg);
    else groups.push({ date: label, msgs: [msg] });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8"
          onClick={onBack}
          data-testid="btn-back-to-conversations"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Avatar name={conversation.other_user_name} picture={conversation.other_user_picture} size={8} />
        <div>
          <p className="font-semibold text-sm leading-tight">{conversation.other_user_name}</p>
          <p className="text-xs text-muted-foreground">{conversation.other_user_role}</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div className="py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <MessageSquare className="h-10 w-10 opacity-20" />
              <p className="text-sm">No messages yet. Say hi!</p>
            </div>
          )}
          {groups.map(group => (
            <div key={group.date} className="space-y-2">
              <div className="flex items-center gap-2">
                <Separator className="flex-1" />
                <span className="text-[11px] text-muted-foreground shrink-0">{group.date}</span>
                <Separator className="flex-1" />
              </div>
              {group.msgs.map((msg, idx) => {
                const isMe = msg.sender_id === currentUserId;
                const prevMsg = group.msgs[idx - 1];
                const sameSenderAsPrev = prevMsg?.sender_id === msg.sender_id;
                return (
                  <div
                    key={msg.id}
                    className={cn("flex items-end gap-2", isMe ? "flex-row-reverse" : "flex-row")}
                  >
                    {!isMe && (
                      <div className="w-7 shrink-0">
                        {!sameSenderAsPrev && (
                          <Avatar name={msg.sender_name} picture={msg.sender_picture} size={7} />
                        )}
                      </div>
                    )}
                    <div className={cn("flex flex-col gap-0.5 max-w-[70%]", isMe ? "items-end" : "items-start")}>
                      {!sameSenderAsPrev && !isMe && (
                        <span className="text-[11px] text-muted-foreground ml-1">{msg.sender_name}</span>
                      )}
                      <div
                        className={cn(
                          "px-3 py-2 rounded-2xl text-sm leading-snug",
                          isMe
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        )}
                        data-testid={`msg-bubble-${msg.id}`}
                      >
                        {msg.body}
                      </div>
                      <span className="text-[10px] text-muted-foreground px-1">
                        {format(new Date(msg.created_at), "h:mm a")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="border-t px-3 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${conversation.other_user_name}…`}
            className="flex-1"
            disabled={sendMut.isPending}
            data-testid="input-message-draft"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!draft.trim() || sendMut.isPending}
            data-testid="btn-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [showNewDlg, setShowNewDlg] = useState(false);
  const [search, setSearch] = useState("");
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const { data: conversations = [], refetch: refetchConvs } = useQuery<Conversation[]>({
    queryKey: ["/api/dm/conversations"],
    queryFn: () =>
      fetch("/api/dm/conversations", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 10000,
  });

  // Start/open a conversation with a user
  const startConvMut = useMutation({
    mutationFn: async (recipientId: string) => {
      const res = await fetch("/api/dm/conversations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ id: number }>;
    },
    onSuccess: async ({ id }) => {
      await refetchConvs();
      queryClient.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
      // Find and activate the conversation
      const updated = await fetch("/api/dm/conversations", { credentials: "include" }).then(r => r.json()) as Conversation[];
      const conv = updated.find(c => c.id === id);
      if (conv) {
        setActiveConv(conv);
        setMobileShowThread(true);
      }
    },
  });

  function handleSelectConversation(c: Conversation) {
    setActiveConv(c);
    setMobileShowThread(true);
  }

  if (!user) return null;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left panel — conversation list */}
      <div
        className={cn(
          "w-full md:w-80 flex-shrink-0 flex flex-col",
          mobileShowThread ? "hidden md:flex" : "flex"
        )}
      >
        <div className="flex items-center justify-between px-3 pt-4 pb-2">
          <h1 className="text-lg font-bold">Messages</h1>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setShowNewDlg(true)}
            data-testid="btn-new-conversation"
            title="New message"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ConversationList
          conversations={conversations}
          activeId={activeConv?.id ?? null}
          currentUserId={user.id}
          onSelect={handleSelectConversation}
          search={search}
          onSearchChange={setSearch}
        />
      </div>

      {/* Right panel — thread or empty state */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0",
          mobileShowThread ? "flex" : "hidden md:flex"
        )}
      >
        {activeConv ? (
          <ChatThread
            key={activeConv.id}
            conversation={activeConv}
            currentUserId={user.id}
            onBack={() => setMobileShowThread(false)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageSquare className="h-14 w-14 opacity-15" />
            <p className="text-sm font-medium">Select a conversation</p>
            <p className="text-xs">or start a new one with the + button</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => setShowNewDlg(true)}
              data-testid="btn-start-first-message"
            >
              <Plus className="h-4 w-4 mr-1.5" /> New Message
            </Button>
          </div>
        )}
      </div>

      <NewConversationDialog
        open={showNewDlg}
        onClose={() => setShowNewDlg(false)}
        onSelect={id => startConvMut.mutate(id)}
      />
    </div>
  );
}
