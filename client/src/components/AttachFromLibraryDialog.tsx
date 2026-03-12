import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, File, Image, FileText, FileSpreadsheet, Paperclip, FolderOpen } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

interface AttachFromLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: string;
  recordId: string;
  entityType: string;
  entityId: string;
  existingDocIds?: string[];
}

export default function AttachFromLibraryDialog({
  open, onOpenChange, module, recordId, entityType, entityId, existingDocIds = [],
}: AttachFromLibraryDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: sharedDocs = [], isLoading } = useQuery<DocType[]>({
    queryKey: ["/api/document-shares/documents", module, recordId],
    queryFn: async () => {
      const params = new URLSearchParams({ module });
      if (recordId) params.set("recordId", recordId);
      const res = await apiRequest("GET", `/api/document-shares/documents?${params.toString()}`);
      return res.json();
    },
    enabled: open,
  });

  const existingSet = new Set(existingDocIds);
  const availableDocs = sharedDocs.filter(d => !existingSet.has(d.id));

  const filteredDocs = searchQuery
    ? availableDocs.filter(d => d.fileName.toLowerCase().includes(searchQuery.toLowerCase()))
    : availableDocs;

  const attachMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      for (const docId of ids) {
        await apiRequest("POST", `/api/documents/${docId}/link`, {
          linkedEntityType: entityType,
          linkedEntityId: entityId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", entityType, entityId] });
      toast({ title: `${selectedIds.size} document${selectedIds.size > 1 ? "s" : ""} attached` });
      setSelectedIds(new Set());
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to attach documents", description: err.message, variant: "destructive" });
    },
  });

  const toggleDoc = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[80vh]" data-testid="attach-from-library-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Attach Document from Library
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search shared documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
              data-testid="input-search-shared-docs"
            />
          </div>

          <div className="border rounded-md max-h-[350px] overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center px-4">
                <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {availableDocs.length === 0
                    ? "No documents have been shared to this module yet"
                    : "No matching documents found"}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredDocs.map(doc => {
                  const Icon = getFileIcon(doc.fileType);
                  const isSelected = selectedIds.has(doc.id);
                  return (
                    <div
                      key={doc.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                      onClick={() => toggleDoc(doc.id)}
                      data-testid={`shared-doc-row-${doc.id}`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleDoc(doc.id)}
                        data-testid={`checkbox-doc-${doc.id}`}
                      />
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ""}
                        </p>
                      </div>
                      <Badge className={`text-[10px] shrink-0 ${CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.other}`}>
                        {CATEGORY_LABELS[doc.category] || doc.category}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedIds.size > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedIds.size} document{selectedIds.size > 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="btn-cancel-attach">
            Cancel
          </Button>
          <Button
            onClick={() => attachMutation.mutate()}
            disabled={selectedIds.size === 0 || attachMutation.isPending}
            data-testid="btn-attach-docs"
          >
            {attachMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Attach{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
