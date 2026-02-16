import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Upload,
  Download,
  Trash2,
  File,
  Image,
  FileText,
  FileSpreadsheet,
  FileArchive,
  Loader2,
  FolderOpen,
  Maximize2,
  Minimize2,
  X,
  Grid3X3,
  List,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileCode,
  Table2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { HqFile } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".pdf", ".docx", ".xlsx", ".csv", ".zip", ".svg"];

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType === "application/pdf") return FileText;
  if (mimeType.includes("spreadsheet")) return FileSpreadsheet;
  if (mimeType === "text/csv") return Table2;
  if (mimeType.includes("zip")) return FileArchive;
  if (mimeType.includes("word") || mimeType.includes("document")) return FileCode;
  return File;
}

function getFileColor(mimeType: string) {
  if (mimeType.startsWith("image/")) return "text-blue-500 bg-blue-500/10";
  if (mimeType === "application/pdf") return "text-red-500 bg-red-500/10";
  if (mimeType.includes("spreadsheet")) return "text-green-600 bg-green-500/10";
  if (mimeType === "text/csv") return "text-emerald-500 bg-emerald-500/10";
  if (mimeType.includes("zip")) return "text-amber-500 bg-amber-500/10";
  if (mimeType.includes("word") || mimeType.includes("document")) return "text-indigo-500 bg-indigo-500/10";
  return "text-muted-foreground bg-muted";
}

function getFileExtension(name: string) {
  return name.split(".").pop()?.toUpperCase() || "FILE";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewable(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

export default function FileLibrary() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewerFile, setViewerFile] = useState<HqFile | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<HqFile | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  const { data: hqFiles = [], isLoading: filesLoading } = useQuery<HqFile[]>({
    queryKey: ["/api/hq-files"],
  });

  const filteredFiles = hqFiles.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/hq-files/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hq-files"] });
      setDeleteConfirm(null);
      if (viewerFile && deleteConfirm && viewerFile.id === deleteConfirm.id) {
        setViewerFile(null);
        setIsFullscreen(false);
      }
      toast({ title: "File deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete file", variant: "destructive" });
    }
  });

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const valid = fileArray.filter(f => {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      return ALLOWED_EXTENSIONS.includes(ext);
    });

    if (valid.length === 0) {
      toast({ title: "No supported files", description: `Accepted: ${ALLOWED_EXTENSIONS.join(", ")}`, variant: "destructive" });
      return;
    }

    setUploading(true);
    let uploaded = 0;

    for (const file of valid) {
      try {
        const urlRes = await apiRequest("POST", "/api/uploads/request-url", {
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        });
        const { uploadURL, objectPath } = await urlRes.json();

        await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });

        await apiRequest("POST", "/api/hq-files", {
          name: file.name,
          objectPath,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        });

        uploaded++;
      } catch (err) {
        console.error("Upload failed for", file.name, err);
        toast({ title: `Failed to upload ${file.name}`, variant: "destructive" });
      }
    }

    setUploading(false);
    if (uploaded > 0) {
      queryClient.invalidateQueries({ queryKey: ["/api/hq-files"] });
      toast({ title: `${uploaded} file${uploaded > 1 ? "s" : ""} uploaded` });
    }
  }, [queryClient, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }, [uploadFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
      e.target.value = "";
    }
  }, [uploadFiles]);

  const handleDownload = useCallback((file: HqFile) => {
    const a = document.createElement("a");
    a.href = `/api/hq-files/${file.id}/download`;
    a.download = file.name;
    a.click();
  }, []);

  const navigateFile = useCallback((direction: "prev" | "next") => {
    if (!viewerFile) return;
    const currentIndex = filteredFiles.findIndex(f => f.id === viewerFile.id);
    if (currentIndex === -1) return;
    const newIndex = direction === "prev" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < filteredFiles.length) {
      setViewerFile(filteredFiles[newIndex]);
    }
  }, [viewerFile, filteredFiles]);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      viewerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    if (!viewerFile) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigateFile("prev");
      if (e.key === "ArrowRight") navigateFile("next");
      if (e.key === "Escape" && isFullscreen) {
        document.exitFullscreen?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewerFile, navigateFile, isFullscreen]);

  const currentIndex = viewerFile ? filteredFiles.findIndex(f => f.id === viewerFile.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < filteredFiles.length - 1;

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-3xl font-heading font-bold flex items-center gap-2">
          <FolderOpen className="w-8 h-8 text-primary" /> Company Files
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 w-48 h-9"
              data-testid="input-search-files"
            />
          </div>
          <ToggleGroup type="single" value={viewMode} onValueChange={v => v && setViewMode(v as "grid" | "list")}>
            <ToggleGroupItem value="grid" aria-label="Grid view" className="h-9 w-9 p-0" data-testid="button-grid-view">
              <Grid3X3 className="w-4 h-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" className="h-9 w-9 p-0" data-testid="button-list-view">
              <List className="w-4 h-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2 h-9"
            data-testid="button-upload-files"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Uploading..." : "Upload"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_EXTENSIONS.join(",")}
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-file-upload"
          />
        </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-xl transition-all duration-200 min-h-[200px] ${
          isDragging
            ? "border-2 border-dashed border-primary bg-primary/5 scale-[1.005]"
            : ""
        }`}
        data-testid="dropzone-files"
      >
        {uploading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading files...</p>
          </div>
        ) : filesLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 border-2 border-dashed border-muted-foreground/20 rounded-xl">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <FolderOpen className="w-8 h-8 text-muted-foreground/50" />
            </div>
            {hqFiles.length === 0 ? (
              <>
                <p className="text-sm font-medium text-muted-foreground">No files yet</p>
                <p className="text-xs text-muted-foreground/70 max-w-xs text-center">
                  Drag & drop files here or click Upload. Supports PNG, JPG, PDF, DOCX, XLSX, CSV, ZIP, SVG.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No files match "{searchQuery}"</p>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredFiles.map((file) => {
              const IconComponent = getFileIcon(file.mimeType);
              const colorClass = getFileColor(file.mimeType);
              const canPreview = isPreviewable(file.mimeType);
              const isImage = file.mimeType.startsWith("image/");
              return (
                <Card
                  key={file.id}
                  className="group cursor-pointer hover:shadow-md transition-all duration-200 overflow-hidden border"
                  onClick={() => setViewerFile(file)}
                  data-testid={`file-card-${file.id}`}
                >
                  <div className="aspect-square relative overflow-hidden bg-muted/30">
                    {isImage ? (
                      <img
                        src={`/api/hq-files/${file.id}/download`}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <div className={`p-4 rounded-2xl ${colorClass}`}>
                          <IconComponent className="w-10 h-10" />
                        </div>
                        <Badge variant="secondary" className="text-[10px] px-2 py-0">
                          {getFileExtension(file.name)}
                        </Badge>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 rounded-full shadow-md"
                          onClick={(e) => { e.stopPropagation(); setViewerFile(file); }}
                          data-testid={`button-view-${file.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 rounded-full shadow-md"
                          onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                          data-testid={`button-download-${file.id}`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8 rounded-full shadow-md"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(file); }}
                          data-testid={`button-delete-${file.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-2">
                    <p className="text-xs font-medium truncate" data-testid={`text-filename-${file.id}`}>{file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredFiles.map((file) => {
              const IconComponent = getFileIcon(file.mimeType);
              const colorClass = getFileColor(file.mimeType);
              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-card border rounded-lg hover:bg-accent/50 transition-colors group cursor-pointer"
                  onClick={() => setViewerFile(file)}
                  data-testid={`file-row-${file.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg ${colorClass}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate" data-testid={`text-filename-${file.id}`}>{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)} · {getFileExtension(file.name)} · {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); setViewerFile(file); }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(file); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {hqFiles.length > 0 && (
        <p className="text-xs text-muted-foreground/60 text-center">
          {hqFiles.length} file{hqFiles.length !== 1 ? "s" : ""} · Drag & drop to upload more
        </p>
      )}

      <AnimatePresence>
        {viewerFile && (
          <div
            ref={viewerRef}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col"
            data-testid="file-viewer-overlay"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col h-full"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b bg-background/80 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {(() => {
                    const IC = getFileIcon(viewerFile.mimeType);
                    return <IC className={`w-5 h-5 shrink-0 ${getFileColor(viewerFile.mimeType).split(" ")[0]}`} />;
                  })()}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate" data-testid="viewer-filename">{viewerFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(viewerFile.size)} · {getFileExtension(viewerFile.name)}
                      {currentIndex >= 0 && ` · ${currentIndex + 1} of ${filteredFiles.length}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => handleDownload(viewerFile)}
                    data-testid="viewer-download"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setDeleteConfirm(viewerFile)}
                    data-testid="viewer-delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <div className="w-px h-6 bg-border mx-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={toggleFullscreen}
                    data-testid="viewer-fullscreen"
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => { setViewerFile(null); if (isFullscreen) document.exitFullscreen?.(); }}
                    data-testid="viewer-close"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                {hasPrev && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full shadow-lg h-10 w-10"
                    onClick={() => navigateFile("prev")}
                    data-testid="viewer-prev"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                )}

                {hasNext && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full shadow-lg h-10 w-10"
                    onClick={() => navigateFile("next")}
                    data-testid="viewer-next"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                )}

                <div className="w-full h-full flex items-center justify-center p-8">
                  {viewerFile.mimeType.startsWith("image/") ? (
                    <img
                      src={`/api/hq-files/${viewerFile.id}/download`}
                      alt={viewerFile.name}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                      data-testid="viewer-image"
                    />
                  ) : viewerFile.mimeType === "application/pdf" ? (
                    <iframe
                      src={`/api/hq-files/${viewerFile.id}/download`}
                      className="w-full h-full rounded-lg border shadow-lg"
                      title={viewerFile.name}
                      data-testid="viewer-pdf"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-6 max-w-sm text-center">
                      <div className={`p-8 rounded-3xl ${getFileColor(viewerFile.mimeType)}`}>
                        {(() => {
                          const IC = getFileIcon(viewerFile.mimeType);
                          return <IC className="w-20 h-20" />;
                        })()}
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-bold">{viewerFile.name}</h3>
                        <div className="flex items-center justify-center gap-2">
                          <Badge variant="secondary">{getFileExtension(viewerFile.name)}</Badge>
                          <span className="text-sm text-muted-foreground">{formatFileSize(viewerFile.size)}</span>
                        </div>
                        {viewerFile.createdAt && (
                          <p className="text-xs text-muted-foreground">
                            Uploaded {new Date(viewerFile.createdAt).toLocaleDateString(undefined, {
                              year: "numeric", month: "long", day: "numeric"
                            })}
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        This file type can't be previewed in the browser. Download it to open with the right application.
                      </p>
                      <Button onClick={() => handleDownload(viewerFile)} className="gap-2" data-testid="viewer-download-btn">
                        <Download className="w-4 h-4" /> Download File
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
