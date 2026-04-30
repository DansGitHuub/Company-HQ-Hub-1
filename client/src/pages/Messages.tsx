import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/RichTextEditor";
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
  Briefcase, Link2, X as XIcon, ChevronDown,
  FolderPlus, FolderOpen, MoreHorizontal, Plus, Printer, Download,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday, formatDistanceToNowStrict } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

// ── Types ──────────────────────────────────────────────────────────────────────

type Folder = "inbox" | "sent" | "starred" | "archive";

interface MessageFolder {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

const FOLDER_COLORS = ["#6366f1", "#ef4444", "#22c55e", "#f59e0b", "#3b82f6"];

// ── Export helpers ─────────────────────────────────────────────────────────────

function buildPrintHTML(messages: ThreadMessage[], myId: string, otherName: string): string {
  const myName =
    messages.find((m) => m.sender_id === myId)?.sender_name ??
    messages.find((m) => m.recipient_id === myId)?.recipient_name ??
    "Me";
  const dateStr = format(new Date(), "MMMM d, yyyy 'at' h:mm a");

  const msgRows = messages
    .map((m) => {
      const senderLabel = m.sender_id === myId ? myName : otherName;
      const ts = format(new Date(m.sent_at), "MMM d, yyyy · h:mm a");
      const atts =
        m.attachments?.length
          ? `<div class="atts">📎 Attachments: ${m.attachments.map((a) => a.fileName).join(", ")}</div>`
          : "";
      return `
        <div class="msg">
          <div class="msg-header">
            <span class="sender">${senderLabel}</span>
            <span class="ts">${ts}</span>
          </div>
          <div class="body">${m.body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>
          ${atts}
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Conversation – ${otherName}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Georgia, "Times New Roman", serif; max-width: 720px; margin: 40px auto; color: #111; line-height: 1.6; padding: 0 24px; }
    .hd { border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 28px; }
    .logo { font-size: 20px; font-weight: 700; letter-spacing: 0.5px; font-family: Arial, sans-serif; }
    .sub { font-size: 15px; margin-top: 4px; }
    .meta { font-size: 12px; color: #666; margin-top: 6px; }
    .msg { margin-bottom: 22px; padding-bottom: 18px; border-bottom: 1px solid #ddd; }
    .msg:last-child { border-bottom: none; }
    .msg-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
    .sender { font-weight: 700; font-size: 14px; font-family: Arial, sans-serif; }
    .ts { font-size: 11px; color: #888; }
    .body { font-size: 14px; white-space: pre-wrap; word-break: break-word; }
    .atts { margin-top: 8px; font-size: 12px; color: #555; font-family: Arial, sans-serif; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <div class="hd">
    <div class="logo">🌿 Chapin Landscapes</div>
    <div class="sub">Conversation between <strong>${myName}</strong> and <strong>${otherName}</strong></div>
    <div class="meta">Printed ${dateStr} · ${messages.length} message${messages.length !== 1 ? "s" : ""}</div>
  </div>
  ${msgRows}
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;
}

function buildTextExport(messages: ThreadMessage[], myId: string, otherName: string): string {
  const myName =
    messages.find((m) => m.sender_id === myId)?.sender_name ??
    messages.find((m) => m.recipient_id === myId)?.recipient_name ??
    "Me";
  const dateStr = format(new Date(), "yyyy-MM-dd HH:mm");
  const divider = "=".repeat(60);

  const lines = [
    `Conversation between ${myName} and ${otherName}`,
    `Exported: ${dateStr}`,
    divider,
    "",
    ...messages.map((m) => {
      const senderLabel = m.sender_id === myId ? myName : otherName;
      const ts = format(new Date(m.sent_at), "yyyy-MM-dd h:mm a");
      const parts = [`[${ts}] ${senderLabel}:`, m.body];
      if (m.attachments?.length) {
        parts.push(`Attachments: ${m.attachments.map((a) => a.fileName).join(", ")}`);
      }
      return parts.join("\n");
    }),
  ];
  return lines.join("\n\n");
}

function triggerTxtDownload(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.position = "fixed";
  a.style.opacity = "0";
  document.body.appendChild(a);
  a.click();
  requestAnimationFrame(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

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
  job_id: string | null;
  task_id: string | null;
  job_title: string | null;
  task_title: string | null;
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
  job_id: string | null;
  task_id: string | null;
  job_title: string | null;
  task_title: string | null;
}

interface JobItem { id: string; client: string; }
interface TaskItem { id: string; task_id: string; title: string; }

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
            <RichTextEditor
              value={body}
              onChange={(html) => setBody(html)}
              placeholder="Write your message…"
              minHeight="120px"
              data-testid="textarea-body"
            />
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
            disabled={!recipientId || !body.replace(/<[^>]*>/g, "").trim() || sendMutation.isPending}
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

// ── LinkDropdown ───────────────────────────────────────────────────────────────
function LinkDropdown({
  value, options, getLabel, placeholder, onChange, disabled,
}: {
  value: string | null;
  options: { id: string; [key: string]: any }[];
  getLabel: (item: any) => string;
  placeholder: string;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors max-w-[140px]",
            selected
              ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
              : "bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
          )}
          disabled={disabled}
          data-testid={`dropdown-link-${placeholder.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <span className="truncate">{selected ? getLabel(selected) : placeholder}</span>
          {selected ? (
            <XIcon className="h-3 w-3 flex-shrink-0 ml-auto" onClick={(e) => { e.stopPropagation(); onChange(null); }} />
          ) : (
            <ChevronDown className="h-3 w-3 flex-shrink-0" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} className="h-8 text-xs" />
          <CommandList className="max-h-48">
            <CommandEmpty className="text-xs py-3 text-center text-muted-foreground">No results</CommandEmpty>
            {value && (
              <CommandItem onSelect={() => { onChange(null); setOpen(false); }}
                className="text-xs text-red-500 cursor-pointer">
                ✕ Clear selection
              </CommandItem>
            )}
            {options.map((item) => (
              <CommandItem key={item.id} value={getLabel(item)}
                onSelect={() => { onChange(item.id); setOpen(false); }}
                className={cn("text-xs cursor-pointer", item.id === value && "font-semibold")}>
                {getLabel(item)}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── ConversationRow ────────────────────────────────────────────────────────────
function ConversationRow({ conv, selected, myId, onClick, folders, onAddToFolder, onExport }: {
  conv: Conversation;
  selected: boolean;
  myId: string;
  onClick: () => void;
  folders?: MessageFolder[];
  onAddToFolder?: (folderId: string, partnerId: string) => void;
  onExport?: (partnerId: string, partnerName: string) => void;
}) {
  const unread = Number(conv.unread_count);
  const isUnread = unread > 0;
  const [isHovered, setIsHovered] = useState(false);
  const hasMenu = !!(folders && onAddToFolder);

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 px-4 py-3 transition-colors border-l-2 cursor-pointer",
        selected ? "bg-blue-50 border-l-blue-500" : "hover:bg-gray-50 border-l-transparent"
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={`row-conv-${conv.other_user_id}`}
    >
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
          <span className={cn("text-[11px] text-gray-400 flex-shrink-0 transition-opacity",
            hasMenu && isHovered ? "opacity-0" : "")}>
            {relativeTime(conv.last_message_at)}
          </span>
          {/* ... menu — visible when row is hovered (React state, reliable for automation) */}
          {hasMenu && (
            <div
              className={cn("flex items-center ml-0.5 transition-opacity", isHovered ? "opacity-100" : "opacity-0 pointer-events-none")}
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                    data-testid={`button-conv-menu-${conv.other_user_id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {folders.length > 0 ? (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <FolderOpen className="h-3.5 w-3.5 mr-2 text-gray-500" />
                        Add to folder
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-40">
                        {folders.map((f) => (
                          <DropdownMenuItem key={f.id}
                            onClick={() => onAddToFolder(f.id, conv.other_user_id)}
                            data-testid={`menuitem-addfolder-${f.id}`}>
                            <span className="w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0"
                              style={{ backgroundColor: f.color }} />
                            <span className="truncate">{f.name}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ) : (
                    <DropdownMenuItem disabled>
                      <FolderOpen className="h-3.5 w-3.5 mr-2 text-gray-400" />
                      No folders yet
                    </DropdownMenuItem>
                  )}
                  {onExport && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onExport(conv.other_user_id, conv.other_user_name)}
                        data-testid={`menuitem-export-${conv.other_user_id}`}>
                        <Download className="h-3.5 w-3.5 mr-2 text-gray-500" />
                        Export (.txt)
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className={cn("text-xs truncate flex-1",
            isUnread ? "text-gray-800 font-medium" : "text-gray-500")}>
            {conv.last_sender_id === myId ? `You: ${conv.last_message}` : conv.last_message}
          </p>
          {conv.job_id && (
            <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded"
              data-testid={`badge-job-${conv.other_user_id}`}>
              <Briefcase className="h-2.5 w-2.5" />Job
            </span>
          )}
          {conv.task_id && !conv.job_id && (
            <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded"
              data-testid={`badge-task-${conv.other_user_id}`}>
              <Link2 className="h-2.5 w-2.5" />Task
            </span>
          )}
        </div>
      </div>
      {isUnread && (
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center"
          data-testid={`badge-unread-${conv.other_user_id}`}>
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </div>
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

  const { data: allJobs = [] } = useQuery<JobItem[]>({
    queryKey: ["/api/jobs"],
    queryFn: () => fetch("/api/jobs", { credentials: "include" }).then(r => r.json()),
  });

  const { data: allTasks = [] } = useQuery<TaskItem[]>({
    queryKey: ["/api/tasks"],
    queryFn: () => fetch("/api/tasks", { credentials: "include" }).then(r => r.json()),
  });

  // Derive link state from the most recent message
  const latestMsg = messages[messages.length - 1] ?? null;
  const linkedJobId = latestMsg?.job_id ?? null;
  const linkedTaskId = latestMsg?.task_id ?? null;

  const linkMutation = useMutation({
    mutationFn: (payload: { jobId?: string | null; taskId?: string | null }) =>
      apiRequest("PATCH", `/api/dm/${latestMsg!.id}/link`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dm/conversation", userId] });
      qc.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
      toast({ title: "Conversation linked" });
    },
    onError: (err: any) => toast({ title: "Failed to link", description: err.message, variant: "destructive" }),
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

  const { data: folders = [] } = useQuery<MessageFolder[]>({
    queryKey: ["/api/dm/folders"],
    queryFn: () => fetch("/api/dm/folders", { credentials: "include" }).then(r => r.json()),
  });

  const [folderPopoverOpen, setFolderPopoverOpen] = useState(false);

  const addToFolderFromThread = useMutation({
    mutationFn: (folderId: string) =>
      apiRequest("POST", `/api/dm/folders/${folderId}/conversations`, { conversationPartnerId: userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dm/folders"] });
      setFolderPopoverOpen(false);
      toast({ title: "Added to folder" });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  async function sendReply() {
    if (!reply.replace(/<[^>]*>/g, "").trim() || isSending) return;
    setIsSending(true);
    const filesToSend = [...pendingFiles];
    try {
      const res = await apiRequest("POST", "/api/dm", { recipientId: userId, body: reply });
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
          <Popover open={folderPopoverOpen} onOpenChange={setFolderPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" title="Add to folder"
                className="h-8 w-8 text-gray-400 hover:text-indigo-600"
                data-testid="button-add-to-folder">
                <FolderPlus className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="end">
              {folders.length === 0 ? (
                <p className="text-xs text-gray-400 px-2 py-1.5">No folders yet. Create one in the sidebar.</p>
              ) : (
                <div className="space-y-0.5">
                  {folders.map((f) => (
                    <button key={f.id}
                      onClick={() => addToFolderFromThread.mutate(f.id)}
                      disabled={addToFolderFromThread.isPending}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-gray-100 transition-colors"
                      data-testid={`menuitem-thread-folder-${f.id}`}>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: f.color }} />
                      <span className="truncate text-gray-700">{f.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon"
            title="Print conversation"
            className="h-8 w-8 text-gray-400 hover:text-gray-700"
            data-testid="button-print"
            disabled={messages.length === 0}
            onClick={() => {
              const html = buildPrintHTML(messages, myId, otherName);
              const win = window.open("", "_blank", "width=800,height=700");
              if (win) { win.document.write(html); win.document.close(); }
            }}>
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon"
            title="Download conversation (.txt)"
            className="h-8 w-8 text-gray-400 hover:text-gray-700"
            data-testid="button-download"
            disabled={messages.length === 0}
            onClick={() => {
              const text = buildTextExport(messages, myId, otherName);
              const safeName = otherName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
              const dateTag = format(new Date(), "yyyy-MM-dd");
              triggerTxtDownload(text, `conversation-${safeName}-${dateTag}.txt`);
            }}>
            <Download className="h-4 w-4" />
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

      {/* Link to Job / Task bar */}
      {latestMsg && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-b bg-gray-50/80" data-testid="link-bar">
          <Link2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-[11px] text-gray-400">Linked to:</span>
          <LinkDropdown
            value={linkedJobId}
            options={allJobs}
            getLabel={(j) => j.client || j.id}
            placeholder="Job…"
            onChange={(id) => linkMutation.mutate({ jobId: id })}
            disabled={linkMutation.isPending}
          />
          <LinkDropdown
            value={linkedTaskId}
            options={allTasks}
            getLabel={(t) => `${t.task_id}: ${t.title}`}
            placeholder="Task…"
            onChange={(id) => linkMutation.mutate({ taskId: id })}
            disabled={linkMutation.isPending}
          />
        </div>
      )}

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
                        <div
                          className={isMine ? "break-words" : "prose prose-sm max-w-none break-words"}
                          data-testid={`text-body-${msg.id}`}
                          dangerouslySetInnerHTML={{ __html: msg.body || '' }}
                        />
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
          <div className="flex-1">
            <RichTextEditor
              value={reply}
              onChange={(html) => setReply(html)}
              placeholder="Reply…"
              minHeight="72px"
              data-testid="textarea-reply"
            />
          </div>
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
          <Button onClick={sendReply} disabled={!reply.replace(/<[^>]*>/g, "").trim() || isSending}
            size="icon" className="h-9 w-9 flex-shrink-0" data-testid="button-reply-send">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Custom Folder Row ──────────────────────────────────────────────────────────
function FolderCustomRow({ folder, active, onClick, onRename, onDelete }: {
  folder: MessageFolder;
  active: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn(
      "group flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors",
      active ? "bg-blue-50" : "hover:bg-gray-100"
    )}>
      <button className="flex-1 flex items-center gap-1.5 text-sm min-w-0" onClick={onClick}
        data-testid={`tab-folder-${folder.id}`}>
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: folder.color }} />
        <span className={cn("flex-1 text-left truncate font-medium",
          active ? "text-blue-700" : "text-gray-600")}>
          {folder.name}
        </span>
      </button>
      <div onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-opacity"
              data-testid={`button-folder-menu-${folder.id}`}>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={onRename} data-testid={`menuitem-rename-${folder.id}`}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-500 focus:text-red-500"
              data-testid={`menuitem-delete-${folder.id}`}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
  const { toast } = useToast();

  // System folder state
  const [folder, setFolder] = useState<Folder>("inbox");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Custom folder state
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFolderName, setCreateFolderName] = useState("");
  const [createFolderColor, setCreateFolderColor] = useState(FOLDER_COLORS[0]);
  const [renamingFolder, setRenamingFolder] = useState<MessageFolder | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");
  const [renameFolderColor, setRenameFolderColor] = useState(FOLDER_COLORS[0]);

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
    enabled: !isSearchActive && !selectedFolderId,
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

  // Custom folders list
  const { data: folders = [] } = useQuery<MessageFolder[]>({
    queryKey: ["/api/dm/folders"],
    queryFn: () => fetch("/api/dm/folders", { credentials: "include" }).then(r => r.json()),
  });

  // Conversations in selected custom folder
  const { data: folderConvs = [], isLoading: isFolderLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/dm/folders", selectedFolderId, "conversations"],
    queryFn: () => fetch(`/api/dm/folders/${selectedFolderId}/conversations`, { credentials: "include" }).then(r => r.json()),
    enabled: !!selectedFolderId && !isSearchActive,
    refetchInterval: 20000,
    staleTime: 0,
  });

  // Folder mutations
  const createFolderMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) => apiRequest("POST", "/api/dm/folders", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dm/folders"] });
      setCreateFolderOpen(false);
      setCreateFolderName("");
      setCreateFolderColor(FOLDER_COLORS[0]);
    },
    onError: (err: any) => toast({ title: "Failed to create folder", description: err.message, variant: "destructive" }),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/dm/folders/${id}`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["/api/dm/folders"] });
      if (selectedFolderId === id) setSelectedFolderId(null);
    },
    onError: (err: any) => toast({ title: "Failed to delete folder", description: err.message, variant: "destructive" }),
  });

  const renameFolderMutation = useMutation({
    mutationFn: (data: { id: string; name: string; color: string }) =>
      apiRequest("PATCH", `/api/dm/folders/${data.id}`, { name: data.name, color: data.color }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dm/folders"] });
      setRenamingFolder(null);
    },
    onError: (err: any) => toast({ title: "Failed to rename folder", description: err.message, variant: "destructive" }),
  });

  const addToFolderMutation = useMutation({
    mutationFn: (data: { folderId: string; partnerId: string }) =>
      apiRequest("POST", `/api/dm/folders/${data.folderId}/conversations`, { conversationPartnerId: data.partnerId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/dm/folders"] });
      toast({ title: "Added to folder" });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  // Which conversations to display
  const displayed = isSearchActive
    ? searchResults
    : selectedFolderId ? folderConvs : conversations;
  const isLoading_ = isSearchActive ? isSearching : selectedFolderId ? isFolderLoading : isLoading;

  function handleFolderChange(f: Folder) {
    setFolder(f);
    setSelectedFolderId(null);
    setSelectedUserId(null);
    setSearch("");
  }

  function handleCustomFolderChange(id: string) {
    setSelectedFolderId(id);
    setSelectedUserId(null);
    setSearch("");
  }

  async function handleExportConversation(partnerId: string, partnerName: string) {
    try {
      const res = await fetch(`/api/dm/conversation/${partnerId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      const msgs: ThreadMessage[] = await res.json();
      if (!msgs.length) { toast({ title: "No messages to export" }); return; }
      const text = buildTextExport(msgs, user?.id ?? "", partnerName);
      const safeName = partnerName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      const dateTag = format(new Date(), "yyyy-MM-dd");
      triggerTxtDownload(text, `conversation-${safeName}-${dateTag}.txt`);
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
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

          {/* System folder tabs */}
          <div className="space-y-0.5">
            <FolderTab label="Inbox" icon={Inbox} active={!selectedFolderId && folder === "inbox"}
              badge={unreadCount} onClick={() => handleFolderChange("inbox")} />
            <FolderTab label="Sent" icon={Send} active={!selectedFolderId && folder === "sent"}
              onClick={() => handleFolderChange("sent")} />
            <FolderTab label="Starred" icon={Star} active={!selectedFolderId && folder === "starred"}
              onClick={() => handleFolderChange("starred")} />
            <FolderTab label="Archive" icon={Archive} active={!selectedFolderId && folder === "archive"}
              onClick={() => handleFolderChange("archive")} />
          </div>

          {/* My Folders section */}
          <div className="mt-3">
            <div className="flex items-center px-1 mb-1">
              <span className="flex-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2">
                My Folders
              </span>
              <button onClick={() => setCreateFolderOpen(true)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                title="Create folder" data-testid="button-create-folder">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {folders.map((f) => (
                <FolderCustomRow
                  key={f.id}
                  folder={f}
                  active={selectedFolderId === f.id}
                  onClick={() => handleCustomFolderChange(f.id)}
                  onRename={() => { setRenamingFolder(f); setRenameFolderName(f.name); setRenameFolderColor(f.color); }}
                  onDelete={() => deleteFolderMutation.mutate(f.id)}
                />
              ))}
              {folders.length === 0 && (
                <p className="text-xs text-gray-400 px-3 py-1">No folders yet</p>
              )}
            </div>
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
                  : selectedFolderId ? "No conversations in this folder"
                  : folder === "starred" ? "No starred conversations"
                  : folder === "archive" ? "Nothing archived"
                  : folder === "sent" ? "No sent messages"
                  : "No conversations yet"}
              </p>
              {folder === "inbox" && !isSearchActive && !selectedFolderId && (
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
              folders={folders}
              onAddToFolder={(folderId, partnerId) => addToFolderMutation.mutate({ folderId, partnerId })}
              onExport={handleExportConversation}
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

      {/* ── Create Folder dialog ── */}
      <Dialog open={createFolderOpen} onOpenChange={(o) => {
        if (!o) { setCreateFolderOpen(false); setCreateFolderName(""); setCreateFolderColor(FOLDER_COLORS[0]); }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Name</label>
              <Input
                value={createFolderName}
                onChange={(e) => setCreateFolderName(e.target.value)}
                placeholder="e.g. Clients, VIP, Project X…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && createFolderName.trim())
                    createFolderMutation.mutate({ name: createFolderName.trim(), color: createFolderColor });
                }}
                data-testid="input-folder-name"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Color</label>
              <div className="flex gap-2">
                {FOLDER_COLORS.map((c) => (
                  <button key={c} onClick={() => setCreateFolderColor(c)}
                    className={cn("w-7 h-7 rounded-full transition-all border-2",
                      createFolderColor === c ? "border-gray-800 scale-110" : "border-transparent")}
                    style={{ backgroundColor: c }}
                    data-testid={`color-option-${c}`} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createFolderMutation.mutate({ name: createFolderName.trim(), color: createFolderColor })}
              disabled={!createFolderName.trim() || createFolderMutation.isPending}
              data-testid="button-confirm-create-folder">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Rename Folder dialog ── */}
      <Dialog open={!!renamingFolder} onOpenChange={(o) => { if (!o) setRenamingFolder(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Name</label>
              <Input
                value={renameFolderName}
                onChange={(e) => setRenameFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renameFolderName.trim() && renamingFolder)
                    renameFolderMutation.mutate({ id: renamingFolder.id, name: renameFolderName.trim(), color: renameFolderColor });
                }}
                data-testid="input-rename-folder"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Color</label>
              <div className="flex gap-2">
                {FOLDER_COLORS.map((c) => (
                  <button key={c} onClick={() => setRenameFolderColor(c)}
                    className={cn("w-7 h-7 rounded-full transition-all border-2",
                      renameFolderColor === c ? "border-gray-800 scale-110" : "border-transparent")}
                    style={{ backgroundColor: c }}
                    data-testid={`rename-color-${c}`} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingFolder(null)}>Cancel</Button>
            <Button
              onClick={() => renamingFolder && renameFolderMutation.mutate({
                id: renamingFolder.id, name: renameFolderName.trim(), color: renameFolderColor
              })}
              disabled={!renameFolderName.trim() || renameFolderMutation.isPending}
              data-testid="button-confirm-rename-folder">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
