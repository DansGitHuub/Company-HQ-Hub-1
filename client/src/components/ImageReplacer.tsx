import React, { useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, ImageIcon, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageReplacerProps {
  currentImageUrl?: string | null;
  onReplace: (newUrl: string) => Promise<void>;
  className?: string;
  placeholderClassName?: string;
  imgClassName?: string;
  alt?: string;
  children?: React.ReactNode;
}

export function ImageReplacer({
  currentImageUrl,
  onReplace,
  className,
  placeholderClassName,
  imgClassName,
  alt = "Image",
  children,
}: ImageReplacerProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin" || user?.role === "Manager" || (user as any)?.isMasterAdmin;

  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaced, setReplaced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await readFileAsDataUrl(file);
    setPendingUrl(dataUrl);
    setPendingFile(file.name);
    setConfirmOpen(true);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!isAdmin) return;
      e.preventDefault();
      setIsDragging(true);
    },
    [isAdmin]
  );

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!isAdmin) return;
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) await handleFile(file);
    },
    [isAdmin, handleFile]
  );

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await handleFile(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [handleFile]
  );

  const handleConfirm = async () => {
    if (!pendingUrl) return;
    setIsReplacing(true);
    try {
      await onReplace(pendingUrl);
      setReplaced(true);
      setTimeout(() => setReplaced(false), 2000);
      setConfirmOpen(false);
      setPendingUrl(null);
      setPendingFile(null);
    } finally {
      setIsReplacing(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className={className}>
        {currentImageUrl ? (
          <img src={currentImageUrl} alt={alt} className={imgClassName} />
        ) : (
          children ?? <div className={placeholderClassName} />
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className={cn("relative group", className)}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => { setIsHovering(false); setIsDragging(false); }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid="image-replacer"
      >
        {currentImageUrl ? (
          <img src={currentImageUrl} alt={alt} className={imgClassName} />
        ) : (
          children ?? <div className={placeholderClassName} />
        )}

        {(isHovering || isDragging) && (
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center rounded transition-all cursor-pointer z-10",
              isDragging
                ? "bg-primary/30 border-2 border-dashed border-primary"
                : "bg-black/50"
            )}
            onClick={() => fileInputRef.current?.click()}
            data-testid="image-replacer-overlay"
          >
            {isDragging ? (
              <>
                <Upload className="h-6 w-6 text-primary mb-1" />
                <span className="text-xs font-semibold text-primary">Drop to replace</span>
              </>
            ) : replaced ? (
              <>
                <Check className="h-6 w-6 text-green-400 mb-1" />
                <span className="text-xs font-semibold text-green-400">Updated!</span>
              </>
            ) : (
              <>
                <ImageIcon className="h-5 w-5 text-white mb-1" />
                <span className="text-xs font-semibold text-white">Replace Image</span>
                <span className="text-xs text-white/70 mt-0.5">Click or drag & drop</span>
              </>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleInputChange}
          data-testid="image-replacer-input"
        />
      </div>

      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!o && !isReplacing) { setConfirmOpen(false); setPendingUrl(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              Replace Image
            </DialogTitle>
            <DialogDescription>
              Review the change before confirming. This replaces the current image immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Badge variant="outline" className="text-xs">Current</Badge>
              <div className="w-full aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center border">
                {currentImageUrl ? (
                  <img src={currentImageUrl} alt="Current" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="h-10 w-10 text-muted-foreground opacity-30" />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Badge className="text-xs">New</Badge>
              <div className="w-full aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center border-2 border-primary">
                {pendingUrl && (
                  <img src={pendingUrl} alt="New" className="w-full h-full object-cover" />
                )}
              </div>
              {pendingFile && (
                <p className="text-xs text-muted-foreground truncate">{pendingFile}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setConfirmOpen(false); setPendingUrl(null); }}
              disabled={isReplacing}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isReplacing} data-testid="button-confirm-replace">
              {isReplacing ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Replacing...</>
              ) : (
                "Confirm Replace"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
