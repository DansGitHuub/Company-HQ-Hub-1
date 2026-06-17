import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useVoice } from "@/hooks/use-voice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Mic,
  ChevronLeft,
  ChevronRight,
  History,
  CheckCircle2,
  Circle,
  Loader2,
  ClipboardList,
  Plus,
  Calendar,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type TodoItem  = { id: string; text: string; completed: boolean; completedAt?: string };
type DelItem   = { id: string; task: string; completionDate: string; name: string; completed: boolean };
type EquipItem = { id: string; text: string };
type NeedItem  = { id: string; item: string; job: string; needBy: string };
type LeadEntry = { id: string; name: string; address: string; phone: string; email: string };
type MemoItem  = { id: string; memo: string; name: string };
type CallItem  = { id: string; personPlace: string; number: string; reason: string };
type OtherItem = { id: string; text: string };

type Agenda = {
  id: string;
  date: string;
  todoItems: TodoItem[];
  delegateItems: DelItem[];
  equipmentItems: EquipItem[];
  needOrderItems: NeedItem[];
  newLeads: LeadEntry[];
  memoItems: MemoItem[];
  callItems: CallItem[];
  otherItems: OtherItem[];
};

type HistEntry = { id: string; date: string; todoItems: TodoItem[]; updatedAt: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const mkTodo  = (): TodoItem  => ({ id: uid(), text: "", completed: false });
const mkDel   = (): DelItem   => ({ id: uid(), task: "", completionDate: "", name: "", completed: false });
const mkEquip = (): EquipItem => ({ id: uid(), text: "" });
const mkNeed  = (): NeedItem  => ({ id: uid(), item: "", job: "", needBy: "" });
const mkLead  = (): LeadEntry => ({ id: uid(), name: "", address: "", phone: "", email: "" });
const mkMemo  = (): MemoItem  => ({ id: uid(), memo: "", name: "" });
const mkCall  = (): CallItem  => ({ id: uid(), personPlace: "", number: "", reason: "" });
const mkOther = (): OtherItem => ({ id: uid(), text: "" });

function pad<T>(arr: T[], n: number, mk: () => T): T[] {
  const r = [...(arr || [])];
  while (r.length < n) r.push(mk());
  return r;
}

function hydrate(raw: Agenda): Agenda {
  return {
    ...raw,
    todoItems:      pad(raw.todoItems      || [], 10, mkTodo),
    delegateItems:  pad(raw.delegateItems  || [], 7,  mkDel),
    equipmentItems: pad(raw.equipmentItems || [], 10, mkEquip),
    needOrderItems: pad(raw.needOrderItems || [], 8,  mkNeed),
    newLeads:       pad(raw.newLeads       || [], 3,  mkLead),
    memoItems:      pad(raw.memoItems      || [], 6,  mkMemo),
    callItems:      pad(raw.callItems      || [], 7,  mkCall),
    otherItems:     pad(raw.otherItems     || [], 3,  mkOther),
  };
}

function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function fmtShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

// ─── Voice Mic Button ─────────────────────────────────────────────────────────
function VoiceMicBtn({ fid, onResult, active, setActive }: {
  fid: string;
  onResult: (t: string) => void;
  active: string | null;
  setActive: (id: string | null) => void;
}) {
  const { startListening, stopListening, isListening } = useVoice();
  const isMe = active === fid;

  function toggle() {
    if (isListening && isMe) {
      stopListening();
      setActive(null);
    } else if (!isListening) {
      setActive(fid);
      startListening((t) => {
        onResult(t);
        setActive(null);
      });
    }
  }

  return (
    <button
      onClick={toggle}
      title={isMe ? "Stop recording" : "Voice input"}
      data-testid={`mic-${fid}`}
      className={cn(
        "flex-shrink-0 rounded p-1 transition-all",
        isMe
          ? "bg-red-500 text-white shadow animate-pulse"
          : "text-muted-foreground hover:text-primary hover:bg-muted"
      )}
    >
      <Mic className="h-3.5 w-3.5" />
    </button>
  );
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────
function Section({ title, color, children }: {
  title: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border overflow-hidden shadow-sm">
      <div className={cn("px-3 py-2 text-xs font-bold tracking-widest uppercase text-white", color)}>
        {title}
      </div>
      <div className="p-3 bg-card">{children}</div>
    </div>
  );
}

// ─── Line Input ───────────────────────────────────────────────────────────────
function LineInput({ value, onChange, placeholder, testId, strike }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; testId?: string; strike?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid={testId}
      className={cn(
        "flex-1 min-w-0 text-sm bg-transparent border-0 border-b focus:outline-none focus:border-primary transition-colors px-0 py-0.5",
        strike
          ? "line-through text-muted-foreground border-muted"
          : "border-border placeholder:text-muted-foreground/50"
      )}
    />
  );
}

function RowNum({ n }: { n: number }) {
  return <span className="text-xs text-muted-foreground w-5 text-right flex-shrink-0">{n}.</span>;
}

// ─── Section: To Do ───────────────────────────────────────────────────────────
function TodoSection({ items, onChange, av, sav }: {
  items: TodoItem[]; onChange: (x: TodoItem[]) => void;
  av: string | null; sav: (id: string | null) => void;
}) {
  const upd = (i: number, p: Partial<TodoItem>) =>
    onChange(items.map((it, j) => j === i ? { ...it, ...p } : it));

  return (
    <div className="space-y-0.5">
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-1.5 py-0.5">
          <RowNum n={i + 1} />
          <button
            onClick={() => upd(i, {
              completed: !item.completed,
              completedAt: !item.completed ? new Date().toISOString() : undefined,
            })}
            data-testid={`todo-check-${item.id}`}
            className={cn(
              "flex-shrink-0 transition-colors",
              item.completed ? "text-green-600" : "text-muted-foreground hover:text-green-600"
            )}
          >
            {item.completed
              ? <CheckCircle2 className="h-4 w-4" />
              : <Circle className="h-4 w-4" />}
          </button>
          <LineInput
            value={item.text}
            onChange={(v) => upd(i, { text: v })}
            placeholder="To-do item..."
            testId={`todo-${item.id}`}
            strike={item.completed}
          />
          <VoiceMicBtn fid={`td-${item.id}`} onResult={(t) => upd(i, { text: t })} active={av} setActive={sav} />
        </div>
      ))}
      <button
        onClick={() => onChange([...items, mkTodo()])}
        className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        data-testid="todo-add"
      >
        <Plus className="h-3 w-3" /> Add item
      </button>
    </div>
  );
}

// ─── Section: Delegate ────────────────────────────────────────────────────────
function DelegateSection({ items, onChange, av, sav }: {
  items: DelItem[]; onChange: (x: DelItem[]) => void;
  av: string | null; sav: (id: string | null) => void;
}) {
  const upd = (i: number, p: Partial<DelItem>) =>
    onChange(items.map((it, j) => j === i ? { ...it, ...p } : it));

  return (
    <div className="space-y-1">
      <div className="flex gap-1 text-[10px] text-muted-foreground pl-6 pr-6">
        <span className="flex-1">Task</span>
        <span className="w-24 flex-shrink-0">Completion</span>
        <span className="w-20 flex-shrink-0">Name</span>
      </div>
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-1.5">
          <RowNum n={i + 1} />
          <button
            onClick={() => upd(i, { completed: !item.completed })}
            data-testid={`del-check-${item.id}`}
            className={cn("flex-shrink-0 transition-colors",
              item.completed ? "text-green-600" : "text-muted-foreground hover:text-green-600")}
          >
            {item.completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
          </button>
          <LineInput value={item.task} onChange={(v) => upd(i, { task: v })} placeholder="Task..." testId={`del-task-${item.id}`} strike={item.completed} />
          <input
            type="date"
            value={item.completionDate}
            onChange={(e) => upd(i, { completionDate: e.target.value })}
            data-testid={`del-date-${item.id}`}
            className="w-24 flex-shrink-0 text-xs bg-transparent border-b border-border focus:outline-none focus:border-primary px-0 py-0.5"
          />
          <LineInput value={item.name} onChange={(v) => upd(i, { name: v })} placeholder="Name" testId={`del-name-${item.id}`} />
          <VoiceMicBtn fid={`dl-${item.id}`} onResult={(t) => upd(i, { task: t })} active={av} setActive={sav} />
        </div>
      ))}
      <button onClick={() => onChange([...items, mkDel()])}
        className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        data-testid="del-add">
        <Plus className="h-3 w-3" /> Add
      </button>
    </div>
  );
}

// ─── Section: Equipment / Shop ────────────────────────────────────────────────
function EquipSection({ items, onChange, av, sav }: {
  items: EquipItem[]; onChange: (x: EquipItem[]) => void;
  av: string | null; sav: (id: string | null) => void;
}) {
  const upd = (i: number, text: string) =>
    onChange(items.map((it, j) => j === i ? { ...it, text } : it));

  return (
    <div className="space-y-0.5">
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-1.5 py-0.5">
          <RowNum n={i + 1} />
          <LineInput value={item.text} onChange={(v) => upd(i, v)} placeholder="Equipment / task..." testId={`eq-${item.id}`} />
          <VoiceMicBtn fid={`eq-${item.id}`} onResult={(t) => upd(i, t)} active={av} setActive={sav} />
        </div>
      ))}
      <button onClick={() => onChange([...items, mkEquip()])}
        className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        data-testid="eq-add">
        <Plus className="h-3 w-3" /> Add
      </button>
    </div>
  );
}

// ─── Section: Need / Order ────────────────────────────────────────────────────
function NeedOrderSection({ items, onChange, av, sav }: {
  items: NeedItem[]; onChange: (x: NeedItem[]) => void;
  av: string | null; sav: (id: string | null) => void;
}) {
  const upd = (i: number, p: Partial<NeedItem>) =>
    onChange(items.map((it, j) => j === i ? { ...it, ...p } : it));

  return (
    <div className="space-y-1">
      <div className="flex gap-1 text-[10px] text-muted-foreground pl-6 pr-6">
        <span className="flex-1">Items</span>
        <span className="w-20 flex-shrink-0">Job</span>
        <span className="w-24 flex-shrink-0">Need By</span>
      </div>
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-1.5">
          <RowNum n={i + 1} />
          <LineInput value={item.item} onChange={(v) => upd(i, { item: v })} placeholder="Item..." testId={`need-item-${item.id}`} />
          <LineInput value={item.job} onChange={(v) => upd(i, { job: v })} placeholder="Job" testId={`need-job-${item.id}`} />
          <input
            type="date"
            value={item.needBy}
            onChange={(e) => upd(i, { needBy: e.target.value })}
            data-testid={`need-date-${item.id}`}
            className="w-24 flex-shrink-0 text-xs bg-transparent border-b border-border focus:outline-none focus:border-primary px-0 py-0.5"
          />
          <VoiceMicBtn fid={`nd-${item.id}`} onResult={(t) => upd(i, { item: t })} active={av} setActive={sav} />
        </div>
      ))}
      <button onClick={() => onChange([...items, mkNeed()])}
        className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        data-testid="need-add">
        <Plus className="h-3 w-3" /> Add
      </button>
    </div>
  );
}

// ─── Section: New Leads ───────────────────────────────────────────────────────
function NewLeadsSection({ items, onChange, av, sav }: {
  items: LeadEntry[]; onChange: (x: LeadEntry[]) => void;
  av: string | null; sav: (id: string | null) => void;
}) {
  const upd = (i: number, p: Partial<LeadEntry>) =>
    onChange(items.map((it, j) => j === i ? { ...it, ...p } : it));

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={item.id} className="rounded border p-2 space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">{i + 1}.</span>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground w-9 flex-shrink-0">Name</span>
              <LineInput value={item.name} onChange={(v) => upd(i, { name: v })} placeholder="Full name" testId={`lead-name-${item.id}`} />
              <VoiceMicBtn fid={`ld-n-${item.id}`} onResult={(t) => upd(i, { name: t })} active={av} setActive={sav} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground w-9 flex-shrink-0">Phone</span>
              <LineInput value={item.phone} onChange={(v) => upd(i, { phone: v })} placeholder="000-000-0000" testId={`lead-phone-${item.id}`} />
              <VoiceMicBtn fid={`ld-p-${item.id}`} onResult={(t) => upd(i, { phone: t })} active={av} setActive={sav} />
            </div>
            <div className="col-span-2 flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground w-9 flex-shrink-0">Addr</span>
              <LineInput value={item.address} onChange={(v) => upd(i, { address: v })} placeholder="Address" testId={`lead-addr-${item.id}`} />
              <VoiceMicBtn fid={`ld-a-${item.id}`} onResult={(t) => upd(i, { address: t })} active={av} setActive={sav} />
            </div>
            <div className="col-span-2 flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground w-9 flex-shrink-0">Email</span>
              <LineInput value={item.email} onChange={(v) => upd(i, { email: v })} placeholder="email@example.com" testId={`lead-email-${item.id}`} />
              <VoiceMicBtn fid={`ld-e-${item.id}`} onResult={(t) => upd(i, { email: t })} active={av} setActive={sav} />
            </div>
          </div>
        </div>
      ))}
      <button onClick={() => onChange([...items, mkLead()])}
        className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        data-testid="lead-add">
        <Plus className="h-3 w-3" /> Add Lead
      </button>
    </div>
  );
}

// ─── Section: Memo for Others ─────────────────────────────────────────────────
function MemoSection({ items, onChange, av, sav }: {
  items: MemoItem[]; onChange: (x: MemoItem[]) => void;
  av: string | null; sav: (id: string | null) => void;
}) {
  const upd = (i: number, p: Partial<MemoItem>) =>
    onChange(items.map((it, j) => j === i ? { ...it, ...p } : it));

  return (
    <div className="space-y-1">
      <div className="flex gap-1 text-[10px] text-muted-foreground pl-6 pr-6">
        <span className="flex-1">Memo</span>
        <span className="w-24 flex-shrink-0">For (Name)</span>
      </div>
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-1.5 py-0.5">
          <RowNum n={i + 1} />
          <LineInput value={item.memo} onChange={(v) => upd(i, { memo: v })} placeholder="Memo..." testId={`memo-${item.id}`} />
          <input
            value={item.name}
            onChange={(e) => upd(i, { name: e.target.value })}
            placeholder="For..."
            data-testid={`memo-name-${item.id}`}
            className="w-24 flex-shrink-0 text-sm bg-transparent border-b border-border focus:outline-none focus:border-primary px-0 py-0.5 placeholder:text-muted-foreground/50"
          />
          <VoiceMicBtn fid={`mm-${item.id}`} onResult={(t) => upd(i, { memo: t })} active={av} setActive={sav} />
        </div>
      ))}
      <button onClick={() => onChange([...items, mkMemo()])}
        className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        data-testid="memo-add">
        <Plus className="h-3 w-3" /> Add
      </button>
    </div>
  );
}

// ─── Section: Calls to Make ───────────────────────────────────────────────────
function CallsSection({ items, onChange, av, sav }: {
  items: CallItem[]; onChange: (x: CallItem[]) => void;
  av: string | null; sav: (id: string | null) => void;
}) {
  const upd = (i: number, p: Partial<CallItem>) =>
    onChange(items.map((it, j) => j === i ? { ...it, ...p } : it));

  return (
    <div className="space-y-1">
      <div className="flex gap-1 text-[10px] text-muted-foreground pl-6">
        <span className="w-24 flex-shrink-0">Person / Place</span>
        <span className="w-28 flex-shrink-0">Number</span>
        <span className="flex-1">Reason</span>
      </div>
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-1.5 py-0.5">
          <RowNum n={i + 1} />
          <input
            value={item.personPlace}
            onChange={(e) => upd(i, { personPlace: e.target.value })}
            placeholder="Person..."
            data-testid={`call-who-${item.id}`}
            className="w-24 flex-shrink-0 text-sm bg-transparent border-b border-border focus:outline-none focus:border-primary px-0 py-0.5 placeholder:text-muted-foreground/50"
          />
          <input
            value={item.number}
            onChange={(e) => upd(i, { number: e.target.value })}
            placeholder="000.000.0000"
            data-testid={`call-num-${item.id}`}
            className="w-28 flex-shrink-0 text-sm bg-transparent border-b border-border focus:outline-none focus:border-primary px-0 py-0.5 placeholder:text-muted-foreground/50"
          />
          <LineInput value={item.reason} onChange={(v) => upd(i, { reason: v })} placeholder="Reason..." testId={`call-reason-${item.id}`} />
          <VoiceMicBtn fid={`cl-${item.id}`} onResult={(t) => upd(i, { reason: t })} active={av} setActive={sav} />
        </div>
      ))}
      <button onClick={() => onChange([...items, mkCall()])}
        className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        data-testid="calls-add">
        <Plus className="h-3 w-3" /> Add
      </button>
    </div>
  );
}

// ─── Section: Other ───────────────────────────────────────────────────────────
function OtherSection({ items, onChange, av, sav }: {
  items: OtherItem[]; onChange: (x: OtherItem[]) => void;
  av: string | null; sav: (id: string | null) => void;
}) {
  const upd = (i: number, text: string) =>
    onChange(items.map((it, j) => j === i ? { ...it, text } : it));

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={item.id} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{i + 1}.</span>
            <VoiceMicBtn fid={`ot-${item.id}`} onResult={(t) => upd(i, t)} active={av} setActive={sav} />
          </div>
          <textarea
            value={item.text}
            onChange={(e) => upd(i, e.target.value)}
            placeholder="Notes, reminders, anything else..."
            rows={3}
            data-testid={`other-${item.id}`}
            className="w-full text-sm bg-transparent border rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-muted-foreground/50"
          />
        </div>
      ))}
      <button onClick={() => onChange([...items, mkOther()])}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        data-testid="other-add">
        <Plus className="h-3 w-3" /> Add
      </button>
    </div>
  );
}

// ─── History Dialog ───────────────────────────────────────────────────────────
function HistoryDialog({ open, onClose, onSelect }: {
  open: boolean; onClose: () => void; onSelect: (date: string) => void;
}) {
  const { data: history = [], isLoading } = useQuery<HistEntry[]>({
    queryKey: ["/api/daily-agenda/history"],
    queryFn: async () => {
      const r = await fetch("/api/daily-agenda/history", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Agenda Archive
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-1 pr-1">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No past agendas yet.</p>
          ) : (
            history.map((entry) => {
              const todos: TodoItem[] = Array.isArray(entry.todoItems) ? entry.todoItems : [];
              const withText = todos.filter((t) => t.text);
              const done = withText.filter((t) => t.completed).length;
              const total = withText.length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <button
                  key={entry.id}
                  onClick={() => { onSelect(entry.date); onClose(); }}
                  data-testid={`hist-${entry.date}`}
                  className="w-full flex items-center justify-between rounded-lg border px-3 py-2.5 hover:bg-muted transition-colors text-left gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{fmtDate(entry.date)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {total > 0
                        ? <span className={cn(pct === 100 ? "text-green-600" : "")}>{done}/{total} to-dos · {pct}% complete</span>
                        : "No to-dos added"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DailyAgenda() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [date, setDate]             = useState(todayStr);
  const [agenda, setAgenda]         = useState<Agenda | null>(null);
  const [activeVoice, setActiveVoice] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showHistory, setShowHistory] = useState(false);
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  const { data: rawAgenda, isLoading } = useQuery<Agenda>({
    queryKey: ["/api/daily-agenda", date],
    queryFn: async () => {
      const r = await fetch(`/api/daily-agenda?date=${date}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch agenda");
      return r.json();
    },
  });

  useEffect(() => {
    if (rawAgenda) {
      setAgenda(hydrate(rawAgenda));
      isFirstLoad.current = true;
    }
  }, [rawAgenda]);

  const saveMutation = useMutation({
    mutationFn: async (data: Agenda) => {
      const r = await fetch(`/api/daily-agenda/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Save failed");
      return r.json();
    },
    onSuccess: () => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      queryClient.invalidateQueries({ queryKey: ["/api/daily-agenda/history"] });
    },
    onError: () => {
      toast({ title: "Save failed", description: "Could not save your agenda.", variant: "destructive" });
      setSaveStatus("idle");
    },
  });

  useEffect(() => {
    if (!agenda) return;
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMutation.mutate(agenda);
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [agenda]);

  const goDay = (delta: number) => setDate((d) => shiftDate(d, delta));
  const isToday = date === todayStr();

  const doneTodos  = agenda?.todoItems.filter((t) => t.completed).length ?? 0;
  const totalTodos = agenda?.todoItems.filter((t) => t.text).length ?? 0;

  const update = <K extends keyof Agenda>(key: K, val: Agenda[K]) =>
    setAgenda((a) => a ? { ...a, [key]: val } : a);

  if (isLoading || !agenda) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-2 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center gap-2 flex-wrap">
          <ClipboardList className="h-5 w-5 text-primary flex-shrink-0" />
          <span className="font-semibold text-sm hidden sm:block text-muted-foreground">Daily Agenda</span>
          <div className="flex items-center gap-0.5 mx-1">
            <Button variant="ghost" size="icon" onClick={() => goDay(-1)} className="h-7 w-7" data-testid="prev-day">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center px-2 min-w-[180px]">
              <p className="text-sm font-semibold leading-tight">{fmtShort(date)}</p>
              {isToday && <p className="text-[10px] text-primary font-semibold">TODAY</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => goDay(1)} className="h-7 w-7" data-testid="next-day">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {!isToday && (
            <Button variant="outline" size="sm" onClick={() => setDate(todayStr())}
              className="h-7 text-xs gap-1" data-testid="go-today">
              <Calendar className="h-3 w-3" /> Today
            </Button>
          )}
          <div className="flex-1" />
          {totalTodos > 0 && (
            <Badge variant="outline" className={cn("text-xs",
              doneTodos === totalTodos ? "border-green-500 text-green-600" : "")}>
              {doneTodos}/{totalTodos} done
            </Badge>
          )}
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 className="h-3 w-3" /> Saved
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowHistory(true)}
            className="h-7 text-xs gap-1" data-testid="history-btn">
            <History className="h-3 w-3" /> History
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-7xl mx-auto p-4 space-y-4 pb-16">
        {/* Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="To Do" color="bg-emerald-600">
            <TodoSection
              items={agenda.todoItems}
              onChange={(v) => update("todoItems", v)}
              av={activeVoice} sav={setActiveVoice}
            />
          </Section>
          <Section title="Delegate" color="bg-blue-600">
            <DelegateSection
              items={agenda.delegateItems}
              onChange={(v) => update("delegateItems", v)}
              av={activeVoice} sav={setActiveVoice}
            />
          </Section>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Equipment / Shop" color="bg-orange-600">
            <EquipSection
              items={agenda.equipmentItems}
              onChange={(v) => update("equipmentItems", v)}
              av={activeVoice} sav={setActiveVoice}
            />
          </Section>
          <Section title="Need / Order" color="bg-violet-600">
            <NeedOrderSection
              items={agenda.needOrderItems}
              onChange={(v) => update("needOrderItems", v)}
              av={activeVoice} sav={setActiveVoice}
            />
          </Section>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="New Leads" color="bg-rose-600">
            <NewLeadsSection
              items={agenda.newLeads}
              onChange={(v) => update("newLeads", v)}
              av={activeVoice} sav={setActiveVoice}
            />
          </Section>
          <Section title="Memo for Others" color="bg-amber-600">
            <MemoSection
              items={agenda.memoItems}
              onChange={(v) => update("memoItems", v)}
              av={activeVoice} sav={setActiveVoice}
            />
          </Section>
        </div>

        {/* Row 4 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Calls to Make" color="bg-teal-600">
            <CallsSection
              items={agenda.callItems}
              onChange={(v) => update("callItems", v)}
              av={activeVoice} sav={setActiveVoice}
            />
          </Section>
          <Section title="Other" color="bg-slate-600">
            <OtherSection
              items={agenda.otherItems}
              onChange={(v) => update("otherItems", v)}
              av={activeVoice} sav={setActiveVoice}
            />
          </Section>
        </div>
      </div>

      <HistoryDialog
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onSelect={setDate}
      />
    </div>
  );
}
