import React, { useState, useRef, useCallback } from "react";
import { Upload, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".docx", ".xlsx"];

const MAX_FILE_SIZE = 25 * 1024 * 1024;

function isAllowedFile(file: File): boolean {
  if (ALLOWED_TYPES.includes(file.type)) return true;
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  return ALLOWED_EXTENSIONS.includes(ext);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadStatus {
  fileName: string;
  state: "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

interface DocumentDropZoneProps {
  onFilesSelected: (files: File[]) => Promise<void>;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

export default function DocumentDropZone({
  onFilesSelected,
  disabled = false,
  className,
  compact = false,
}: DocumentDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const validateAndProcess = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const validFiles: File[] = [];
    const newStatuses: UploadStatus[] = [];

    for (const file of files) {
      if (!isAllowedFile(file)) {
        const ext = file.name.slice(file.name.lastIndexOf("."));
        newStatuses.push({
          fileName: file.name,
          state: "error",
          progress: 0,
          error: `Unsupported file type (${ext}). Allowed: PDF, JPG, PNG, DOCX, XLSX`,
        });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        newStatuses.push({
          fileName: file.name,
          state: "error",
          progress: 0,
          error: `File too large (${formatBytes(file.size)}). Maximum size is 25 MB`,
        });
        continue;
      }
      validFiles.push(file);
      newStatuses.push({
        fileName: file.name,
        state: "uploading",
        progress: 30,
      });
    }

    setUploadStatuses(prev => [...prev, ...newStatuses]);

    for (const file of validFiles) {
      try {
        setUploadStatuses(prev =>
          prev.map(s =>
            s.fileName === file.name && s.state === "uploading"
              ? { ...s, progress: 60 }
              : s
          )
        );
        await onFilesSelected([file]);
        setUploadStatuses(prev =>
          prev.map(s =>
            s.fileName === file.name && s.state === "uploading"
              ? { ...s, state: "success", progress: 100 }
              : s
          )
        );
      } catch {
        setUploadStatuses(prev =>
          prev.map(s =>
            s.fileName === file.name && s.state === "uploading"
              ? { ...s, state: "error", progress: 0, error: "Upload failed" }
              : s
          )
        );
      }
    }

    setTimeout(() => {
      setUploadStatuses(prev => prev.filter(s => s.state === "uploading"));
    }, 4000);
  }, [onFilesSelected]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragOver(false);
    if (!disabled && e.dataTransfer.files.length > 0) {
      validateAndProcess(e.dataTransfer.files);
    }
  }, [disabled, validateAndProcess]);

  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcess(e.target.files);
      e.target.value = "";
    }
  }, [validateAndProcess]);

  const dismissStatus = useCallback((idx: number) => {
    setUploadStatuses(prev => prev.filter((_, i) => i !== idx));
  }, []);

  return (
    <div className={className}>
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200",
          compact ? "px-4 py-3" : "px-6 py-6",
          dragOver
            ? "border-green-500 bg-green-50 dark:bg-green-950/20"
            : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        data-testid="document-drop-zone"
      >
        <div className={cn(
          "flex items-center justify-center gap-2 text-muted-foreground",
          !compact && "flex-col"
        )}>
          <Upload className={cn(
            "transition-colors",
            compact ? "h-4 w-4" : "h-8 w-8",
            dragOver ? "text-green-600" : "text-muted-foreground/50"
          )} />
          <div className={cn("text-center", compact && "text-left")}>
            <p className={cn(
              "font-medium",
              compact ? "text-xs" : "text-sm",
              dragOver ? "text-green-700 dark:text-green-400" : ""
            )}>
              {dragOver ? "Drop files here" : "Drag files here or click to browse"}
            </p>
            {!compact && (
              <p className="text-xs text-muted-foreground/70 mt-1">
                PDF, JPG, PNG, DOCX, XLSX — Max 25 MB
              </p>
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
        className="hidden"
        onChange={handleFileInput}
        data-testid="input-file-upload"
      />

      {uploadStatuses.length > 0 && (
        <div className="mt-2 space-y-1.5" data-testid="upload-status-list">
          {uploadStatuses.map((status, idx) => (
            <div
              key={`${status.fileName}-${idx}`}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                status.state === "uploading" && "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300",
                status.state === "success" && "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300",
                status.state === "error" && "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300"
              )}
              data-testid={`upload-status-${status.state}`}
            >
              {status.state === "uploading" && (
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              )}
              {status.state === "success" && (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              )}
              {status.state === "error" && (
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium">{status.fileName}</p>
                {status.state === "uploading" && (
                  <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1 mt-1">
                    <div
                      className="bg-blue-600 h-1 rounded-full transition-all duration-500"
                      style={{ width: `${status.progress}%` }}
                    />
                  </div>
                )}
                {status.error && (
                  <p className="text-xs mt-0.5">{status.error}</p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); dismissStatus(idx); }}
                className="flex-shrink-0 hover:opacity-70"
                data-testid="button-dismiss-upload-status"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
