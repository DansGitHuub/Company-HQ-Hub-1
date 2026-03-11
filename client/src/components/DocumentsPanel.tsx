import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Upload, Download, Trash2, File, Image, FileText, FileSpreadsheet,
  Loader2, Search, Link2, ExternalLink, MoreHorizontal, Eye
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import ShareExternallyDialog from "@/components/ShareExternallyDialog";
import type { Document as DocType } from "@shared/schema";

const CATEGORY_LABELS: Record<string, string> = {
  form: "Form", policy: "Policy", manual: "Manual", registration: "Registration",
  insurance: "Insurance", certification: "Certification", photo: "Photo",
  contract: "Contract", proposal: "Proposal", invoice: "Invoice",
  warranty: "Warranty", report: "Report", other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  form: "bg-blue-100 text-blue-700", policy: "bg-purple-100 text-purple-700",
  manual: "bg-green-100 text-green-700", insurance: "bg-amber-100 text-amber-700",
  certification: "bg-emerald-100 text-emerald-700", contract: "bg-indigo-100 text-indigo-700",
  photo: "bg-pink-100 text-pink-700", proposal: "bg-cyan-100 text-cyan-700",
  invoice: "bg-orange-100 text-orange-700", warranty: "bg-teal-100 text-teal-700",
  report: "bg-red-100 text-red-700", registration: "bg-yellow-100 text-yellow-700",
  other: "bg-gray-100 text-gray-700",
};

function getFileIcon(fileType: string | null) {
  if (!fileType) return File;
  if (fileType.startsWith("image/")) return Image;
  if (fileType === "application/pdf") return FileText;
  if (fileType.includes("spreadsheet") || fileType.includes("csv")) return FileSpreadsheet;
  return File;
}

function formatFileSize(kb: number | null) {
  if (!kb) return "";
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

interface DocumentsPanelProps {
  entityType: string;
  entityId: string;
  canUpload?: boolean;
  canShare?: boolean;
  canLink?: boolean;
  canDelete?: boolean;
  title?: string;
  compact?: boolean;
}

export default function DocumentsPanel({
  entityType,
  entityId,
  canUpload = false,
  canShare = false,
  canLink = false,
  canDelete = false,
  title = "Documents",
  compact = false,
}: DocumentsPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [shareDoc, setShareDoc] = useState<DocType | null>(null);
  const [linkDialogDoc, setLinkDialogDoc] = useState<DocType | null>(null);
  const [uploadCategory, setUploadCategory] = useState("other");
  const [dragOver, setDragOver] = useState(false);

  const { data: docs = [], isLoading } = useQuery<DocType[]>({
    queryKey: ["/api/documents", entityType, entityId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/documents?entityType=${entityType}&entityId=${entityId}`);
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const result = await uploadFile(file);
      if (!result) throw new Error("Upload failed");
      const doc = await apiRequest("POST", "/api/documents", {
        fileName: file.name,
        fileUrl: result.objectPath,
        fileType: file.type || "application/octet-stream",
        fileSizeKb: Math.round(file.size / 1024),
        category: uploadCategory,
        homeEntityType: entityType,
        homeEntityId: entityId,
      });
      return doc.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", entityType, entityId] });
      toast({ title: "Document uploaded" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", entityType, entityId] });
      toast({ title: "Document deleted" });
    },
  });

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      await uploadMutation.mutateAsync(file);
    }
  }, [uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const filteredDocs = docs.filter(doc => {
    if (searchQuery && !doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (categoryFilter !== "all" && doc.category !== categoryFilter) return false;
    return true;
  });

  const isAdmin = user?.role === "Admin" || user?.role === "Manager";

  return (
    <Card data-testid="documents-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {canUpload && isAdmin && (
              <>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="select-upload-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  data-testid="button-upload-document"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                  Upload
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
              </>
            )}
          </div>
        </div>
        {!compact && docs.length > 0 && (
          <div className="flex gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
                data-testid="input-search-documents"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-category-filter">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div
          className={`min-h-[100px] ${dragOver ? "border-2 border-dashed border-primary bg-primary/5 rounded-lg" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="documents-empty-state">
              <File className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No documents yet</p>
              {canUpload && isAdmin && (
                <p className="text-xs text-muted-foreground mt-1">
                  Upload files or drag and drop here
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredDocs.map((doc) => {
                const Icon = getFileIcon(doc.fileType);
                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 group"
                    data-testid={`document-row-${doc.id}`}
                  >
                    <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{doc.fileName}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.other}`}>
                          {CATEGORY_LABELS[doc.category] || doc.category}
                        </Badge>
                        {doc.isTemplate && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Template</Badge>
                        )}
                        {doc.version > 1 && (
                          <span className="text-[10px] text-muted-foreground">v{doc.version}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {doc.fileSizeKb && <span>{formatFileSize(doc.fileSizeKb)}</span>}
                        {doc.createdAt && <span>{new Date(doc.createdAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => window.open(doc.fileUrl, "_blank")}
                        data-testid={`button-view-doc-${doc.id}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = doc.fileUrl;
                          a.download = doc.fileName;
                          a.click();
                        }}
                        data-testid={`button-download-doc-${doc.id}`}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {(canShare || canLink || canDelete) && isAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-doc-actions-${doc.id}`}>
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canShare && (
                              <DropdownMenuItem onClick={() => setShareDoc(doc)} data-testid={`action-share-doc-${doc.id}`}>
                                <ExternalLink className="h-4 w-4 mr-2" /> Share Externally
                              </DropdownMenuItem>
                            )}
                            {canLink && (
                              <DropdownMenuItem onClick={() => setLinkDialogDoc(doc)} data-testid={`action-link-doc-${doc.id}`}>
                                <Link2 className="h-4 w-4 mr-2" /> Link to Record
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(doc.id)}
                                data-testid={`action-delete-doc-${doc.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>

      {shareDoc && (
        <ShareExternallyDialog
          open={!!shareDoc}
          onOpenChange={(open) => !open && setShareDoc(null)}
          documentId={shareDoc.id}
          documentName={shareDoc.fileName}
          documentType="document"
          documentUrl={shareDoc.fileUrl}
        />
      )}

      {linkDialogDoc && (
        <LinkDocumentDialog
          open={!!linkDialogDoc}
          onOpenChange={(open) => !open && setLinkDialogDoc(null)}
          documentId={linkDialogDoc.id}
          documentName={linkDialogDoc.fileName}
        />
      )}
    </Card>
  );
}

function LinkDocumentDialog({
  open,
  onOpenChange,
  documentId,
  documentName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [linkedEntityType, setLinkedEntityType] = useState("employee");
  const [linkedEntityId, setLinkedEntityId] = useState("");

  const linkMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/documents/${documentId}/link`, {
        linkedEntityType,
        linkedEntityId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document linked" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to link", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link "{documentName}" to another record</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Record Type</Label>
            <Select value={linkedEntityType} onValueChange={setLinkedEntityType}>
              <SelectTrigger data-testid="select-link-entity-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="equipment">Equipment</SelectItem>
                <SelectItem value="job">Job</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="company">Company</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Record ID</Label>
            <Input
              placeholder="Enter record ID"
              value={linkedEntityId}
              onChange={(e) => setLinkedEntityId(e.target.value)}
              data-testid="input-link-entity-id"
            />
          </div>
          <Button
            onClick={() => linkMutation.mutate()}
            disabled={!linkedEntityId || linkMutation.isPending}
            className="w-full"
            data-testid="button-create-link"
          >
            {linkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
            Link Document
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
