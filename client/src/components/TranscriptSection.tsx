import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Mic, ChevronDown, ChevronUp, Pencil, Trash2, Loader2, Plus,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface Transcript {
  id: string;
  external_id: string;
  transcript_text: string;
  summary_text: string | null;
  source: string | null;
  recorded_at: string | null;
  recorded_by_email: string | null;
  audio_duration_seconds: number | null;
  transcript_format: string;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function fmtDuration(seconds: number | null) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

// ── Attach / Edit dialog ──────────────────────────────────────────────────────

interface TranscriptDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Transcript | null;
  estimateId: string;
  onSaved: () => void;
}

function TranscriptDialog({ open, onOpenChange, initial, estimateId, onSaved }: TranscriptDialogProps) {
  const { toast } = useToast();
  const [text, setText]     = useState(initial?.transcript_text ?? "");
  const [source, setSource] = useState(initial?.source ?? "Plaud");
  const [email, setEmail]   = useState(initial?.recorded_by_email ?? "");
  const [date, setDate]     = useState(
    initial?.recorded_at ? initial.recorded_at.slice(0, 10) : ""
  );
  const [summary, setSummary] = useState(initial?.summary_text ?? "");

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setText(initial?.transcript_text ?? "");
      setSource(initial?.source ?? "Plaud");
      setEmail(initial?.recorded_by_email ?? "");
      setDate(initial?.recorded_at ? initial.recorded_at.slice(0, 10) : "");
      setSummary(initial?.summary_text ?? "");
    }
  }, [open, initial]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/estimates/${estimateId}/transcript`, {
        transcript_text:  text,
        source:           source || "Plaud",
        recorded_at:      date || null,
        recorded_by_email: email || null,
        summary_text:     summary || null,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message ?? "Save failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Transcript saved" });
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const isEditing = !!initial;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            {isEditing ? "Replace Transcript" : "Attach Voice Transcript"}
          </DialogTitle>
          <DialogDescription>
            Paste the transcript text from your Plaud recorder (or any other voice recorder).
            {isEditing && " This will replace the current transcript."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Source + Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ts-source">Source</Label>
              <Input
                id="ts-source"
                value={source}
                onChange={e => setSource(e.target.value)}
                placeholder="Plaud"
                data-testid="input-transcript-source"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ts-date">Recording Date</Label>
              <Input
                id="ts-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                data-testid="input-transcript-date"
              />
            </div>
          </div>

          {/* Recorded-by email */}
          <div className="space-y-1.5">
            <Label htmlFor="ts-email">Recorded by (email, optional)</Label>
            <Input
              id="ts-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="salesperson@example.com"
              data-testid="input-transcript-email"
            />
          </div>

          {/* Transcript text */}
          <div className="space-y-1.5">
            <Label htmlFor="ts-text">
              Transcript Text <span className="text-destructive">*</span>
              {text.trim() && (
                <span className="ml-2 font-normal text-muted-foreground text-xs">
                  ({wordCount(text).toLocaleString()} words)
                </span>
              )}
            </Label>
            <Textarea
              id="ts-text"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste the full transcript here…"
              className="min-h-[200px] font-mono text-xs leading-relaxed"
              data-testid="textarea-transcript-text"
            />
          </div>

          {/* Optional summary */}
          <div className="space-y-1.5">
            <Label htmlFor="ts-summary">Summary / Notes (optional)</Label>
            <Textarea
              id="ts-summary"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Brief summary of key site notes…"
              className="min-h-[80px] text-sm"
              data-testid="textarea-transcript-summary"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!text.trim() || saveMutation.isPending}
            data-testid="btn-save-transcript"
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEditing ? "Replace Transcript" : "Attach Transcript"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TranscriptSection({ estimateId }: { estimateId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const queryKey = [`/api/estimates/${estimateId}/transcript`];

  const { data: transcript, isLoading } = useQuery<Transcript | null>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/estimates/${estimateId}/transcript`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load transcript");
      return res.json();
    },
  });

  const [dialogOpen, setDialogOpen]   = useState(false);
  const [expanded, setExpanded]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!transcript) return;
      const res = await apiRequest(
        "DELETE",
        `/api/estimates/${estimateId}/transcript/${transcript.id}`,
        {}
      );
      if (!res.ok) { const e = await res.json(); throw new Error(e.message ?? "Delete failed"); }
    },
    onSuccess: () => {
      toast({ title: "Transcript removed" });
      qc.invalidateQueries({ queryKey });
      setExpanded(false);
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey });

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) return null;

  // ── No transcript: show attach button ────────────────────────────────────
  if (!transcript) {
    return (
      <>
        <Card className="mt-6 border border-dashed" data-testid="card-no-transcript">
          <CardContent className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Mic className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Voice Transcript</p>
                <p className="text-xs">No transcript attached to this estimate</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
              data-testid="btn-attach-transcript"
            >
              <Plus className="h-4 w-4 mr-1" />
              Attach Transcript
            </Button>
          </CardContent>
        </Card>

        <TranscriptDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initial={null}
          estimateId={estimateId}
          onSaved={invalidate}
        />
      </>
    );
  }

  // ── Has transcript: show it ──────────────────────────────────────────────
  const lines = transcript.transcript_text.split("\n");
  const previewLines = lines.slice(0, 6);
  const hasMore = lines.length > 6;
  const wc = wordCount(transcript.transcript_text);

  return (
    <>
      <Card className="mt-6" data-testid="card-transcript">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Mic className="h-4 w-4 text-muted-foreground" />
              Voice Transcript
              <Badge variant="secondary" className="text-xs font-normal">
                {transcript.source ?? "Plaud"}
              </Badge>
            </CardTitle>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDialogOpen(true)}
                data-testid="btn-edit-transcript"
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Replace
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="text-destructive hover:text-destructive"
                data-testid="btn-remove-transcript"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Remove
              </Button>
            </div>
          </div>

          {/* Metadata row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
            {transcript.recorded_at && (
              <span>Recorded {fmtDate(transcript.recorded_at)}</span>
            )}
            {transcript.recorded_by_email && (
              <span>by {transcript.recorded_by_email}</span>
            )}
            {transcript.audio_duration_seconds && (
              <span>Duration: {fmtDuration(transcript.audio_duration_seconds)}</span>
            )}
            <span className="ml-auto">{wc.toLocaleString()} words</span>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-4 space-y-3">
          {/* Summary if present */}
          {transcript.summary_text && (
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
              <p className="text-sm">{transcript.summary_text}</p>
            </div>
          )}

          {/* Transcript text */}
          <div
            className="rounded-md border bg-muted/30 px-3 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap overflow-hidden"
            style={{ maxHeight: expanded ? "none" : undefined }}
            data-testid="transcript-text-block"
          >
            {expanded
              ? transcript.transcript_text
              : previewLines.join("\n") + (hasMore ? "\n…" : "")}
          </div>

          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setExpanded(v => !v)}
              data-testid="btn-toggle-transcript"
            >
              {expanded ? (
                <><ChevronUp className="h-3.5 w-3.5 mr-1" />Show less</>
              ) : (
                <><ChevronDown className="h-3.5 w-3.5 mr-1" />Show full transcript ({lines.length} lines)</>
              )}
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            Attached {fmtDate(transcript.created_at)}
          </p>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <TranscriptDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={transcript}
        estimateId={estimateId}
        onSaved={invalidate}
      />

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Transcript?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the voice transcript from this estimate. The text cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmDelete(false); deleteMutation.mutate(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="btn-confirm-remove-transcript"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
