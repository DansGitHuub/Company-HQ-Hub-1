import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MessageSquareWarning, Loader2 } from "lucide-react";

interface FeedbackButtonProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function FeedbackButton({ open: controlledOpen, onOpenChange: controlledOnOpenChange }: FeedbackButtonProps = {}) {
  const isControlled = controlledOpen !== undefined;
  const { user } = useAuth();
  const [location] = useLocation();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [type, setType] = useState<"Bug" | "Feedback">("Bug");
  const [description, setDescription] = useState("");
  const [pageContext, setPageContext] = useState(location);

  const open = isControlled ? controlledOpen! : internalOpen;

  useEffect(() => {
    if (open) setPageContext(location);
  }, [open]);

  const submitMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/feedback-reports", {
      type,
      description: description.trim(),
      page_context: pageContext.trim() || location,
    }),
    onSuccess: () => {
      toast({ title: "Thanks! Your report was submitted." });
      setDescription("");
      setType("Bug");
      handleOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: "Could not submit report", description: e.message, variant: "destructive" });
    },
  });

  if (!user) return null;

  function handleOpenChange(next: boolean) {
    if (next) setPageContext(location);
    if (isControlled) {
      controlledOnOpenChange?.(next);
    } else {
      setInternalOpen(next);
    }
  }

  function handleSubmit() {
    if (!description.trim()) {
      toast({ title: "Description is required", variant: "destructive" });
      return;
    }
    submitMut.mutate();
  }

  return (
    <>
      {/* Floating trigger — only rendered in uncontrolled (legacy) mode */}
      {!isControlled && (
        <div className="fixed z-40" style={{ bottom: "1.25rem", left: "1.25rem" }}>
          <Button
            size="icon"
            className="h-11 w-11 rounded-full shadow-lg bg-slate-700 hover:bg-slate-800 text-white"
            title="Report a Bug / Feedback"
            onClick={() => handleOpenChange(true)}
            data-testid="button-open-feedback"
          >
            <MessageSquareWarning className="h-5 w-5" />
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent data-testid="dialog-feedback">
          <DialogHeader>
            <DialogTitle>Report a Bug / Feedback</DialogTitle>
            <DialogDescription>
              Let us know about anything broken or ideas for improvement. This goes straight to the admin team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "Bug" | "Feedback")}>
                <SelectTrigger data-testid="select-feedback-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bug">Bug</SelectItem>
                  <SelectItem value="Feedback">Feedback / Suggestion</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="feedback-description">Description<span className="text-destructive"> *</span></Label>
              <Textarea
                id="feedback-description"
                placeholder={type === "Bug" ? "What happened? What did you expect instead?" : "What would you like to see improved?"}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                data-testid="input-feedback-description"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="feedback-page">Page / Screen</Label>
              <Input
                id="feedback-page"
                value={pageContext}
                onChange={(e) => setPageContext(e.target.value)}
                data-testid="input-feedback-page"
              />
              <p className="text-xs text-muted-foreground">Auto-filled from your current page. Feel free to edit it.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-cancel-feedback">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitMut.isPending} data-testid="button-submit-feedback">
              {submitMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
