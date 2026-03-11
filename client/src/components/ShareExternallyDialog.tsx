import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ExternalLink, Copy, Check, Loader2, Lock, MessageSquare } from "lucide-react";

interface ShareExternallyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: string;
  documentId: string;
  documentName: string;
  documentUrl?: string | null;
}

export default function ShareExternallyDialog({
  open,
  onOpenChange,
  documentType,
  documentId,
  documentName,
  documentUrl,
}: ShareExternallyDialogProps) {
  const { toast } = useToast();
  const [expiresIn, setExpiresIn] = useState("7d");
  const [customDate, setCustomDate] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/shared-links", {
        documentType,
        documentId,
        documentName,
        documentUrl,
        expiresIn,
        customDate: expiresIn === "custom" ? customDate : undefined,
        password: usePassword ? password : undefined,
        note: note.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setShareUrl(data.shareUrl);
      toast({ title: "Share link created" });
    },
    onError: () => {
      toast({ title: "Failed to create share link", variant: "destructive" });
    },
  });

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Link copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setShareUrl(null);
    setExpiresIn("7d");
    setCustomDate("");
    setUsePassword(false);
    setPassword("");
    setNote("");
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" /> Share Externally
          </DialogTitle>
          <DialogDescription>
            Create a secure, read-only link for external recipients.
          </DialogDescription>
        </DialogHeader>

        {shareUrl ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-800 mb-2">Link created successfully!</p>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="text-xs bg-white"
                  data-testid="input-share-url"
                />
                <Button size="sm" variant="outline" onClick={handleCopy} data-testid="button-copy-link">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {usePassword && password && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-medium text-amber-800">Password: <span className="font-mono">{password}</span></p>
                <p className="text-xs text-amber-600 mt-1">Share this password separately with the recipient.</p>
              </div>
            )}
            <DialogFooter>
              <Button onClick={handleClose} data-testid="button-done">Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Document</Label>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">{documentName}</p>
            </div>

            <div>
              <Label className="text-sm font-medium">Expiration</Label>
              <Select value={expiresIn} onValueChange={setExpiresIn}>
                <SelectTrigger className="mt-1" data-testid="select-expiration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="custom">Custom date</SelectItem>
                </SelectContent>
              </Select>
              {expiresIn === "custom" && (
                <Input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="mt-2"
                  min={new Date().toISOString().split("T")[0]}
                  data-testid="input-custom-date"
                />
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Password protect</Label>
              </div>
              <Switch checked={usePassword} onCheckedChange={setUsePassword} data-testid="switch-password" />
            </div>
            {usePassword && (
              <Input
                type="text"
                placeholder="Enter a password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-password"
              />
            )}

            <div>
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Note for recipient (optional)</Label>
              </div>
              <Textarea
                placeholder="e.g., Please review Section 12 and Section 24 for compliance."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                data-testid="input-note"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || (expiresIn === "custom" && !customDate) || (usePassword && !password)}
                data-testid="button-create-link"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                Create Link
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
