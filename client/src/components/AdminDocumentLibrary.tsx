import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Upload, Download, Trash2, File, Image, FileText, FileSpreadsheet,
  Loader2, Search, FolderOpen, Eye, ExternalLink, Link2
} from "lucide-react";
import DocumentDropZone from "@/components/DocumentDropZone";
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

const ENTITY_LABELS: Record<string, string> = {
  employee: "Employee", equipment: "Equipment", job: "Job",
  customer: "Customer", company: "Company",
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

export default function AdminDocumentLibrary() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Library</CardTitle>
        <CardDescription>Manage all documents across the entire system</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="company" className="w-full">
          <TabsList>
            <TabsTrigger value="company" data-testid="subtab-company-library">Company Library</TabsTrigger>
            <TabsTrigger value="all" data-testid="subtab-all-documents">All Documents</TabsTrigger>
          </TabsList>
          <TabsContent value="company" className="mt-4">
            <CompanyLibrary />
          </TabsContent>
          <TabsContent value="all" className="mt-4">
            <AllDocuments />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function CompanyLibrary() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { uploadFile, isUploading } = useUpload();
  const [uploadCategory, setUploadCategory] = useState("policy");
  const [isTemplate, setIsTemplate] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [shareDoc, setShareDoc] = useState<DocType | null>(null);

  const { data: docs = [], isLoading } = useQuery<DocType[]>({
    queryKey: ["/api/documents", "company", "company-library"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents?entityType=company&entityId=company-library");
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
        homeEntityType: "company",
        homeEntityId: "company-library",
        isTemplate,
      });
      return doc.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", "company", "company-library"] });
      toast({ title: "Document uploaded to Company Library" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const handleDropZoneUpload = useCallback(async (files: File[]) => {
    for (const file of files) {
      await uploadMutation.mutateAsync(file);
    }
  }, [uploadMutation]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", "company", "company-library"] });
      toast({ title: "Document deleted" });
    },
  });

  const filteredDocs = categoryFilter === "all"
    ? docs
    : docs.filter(d => d.category === categoryFilter);

  return (
    <div className="space-y-4">
      <DocumentDropZone
        onFilesSelected={handleDropZoneUpload}
        disabled={isUploading}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={uploadCategory} onValueChange={setUploadCategory}>
          <SelectTrigger className="w-[140px] h-9" data-testid="select-company-upload-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isTemplate}
            onChange={(e) => setIsTemplate(e.target.checked)}
            className="rounded"
          />
          Template
        </label>
        <div className="ml-auto">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px] h-9" data-testid="select-company-filter">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No company documents yet</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDocs.map(doc => {
              const Icon = getFileIcon(doc.fileType);
              return (
                <TableRow key={doc.id} data-testid={`company-doc-row-${doc.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate max-w-[250px]">{doc.fileName}</span>
                      {doc.isTemplate && <Badge variant="outline" className="text-[10px]">Template</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.other}`}>
                      {CATEGORY_LABELS[doc.category] || doc.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatFileSize(doc.fileSizeKb)}</TableCell>
                  <TableCell className="text-sm">v{doc.version}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(doc.fileUrl, "_blank")} data-testid={`view-company-doc-${doc.id}`}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShareDoc(doc)} data-testid={`share-company-doc-${doc.id}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(doc.id)} data-testid={`delete-company-doc-${doc.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

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
    </div>
  );
}

function AllDocuments() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [shareDoc, setShareDoc] = useState<DocType | null>(null);

  const { data: docs = [], isLoading } = useQuery<DocType[]>({
    queryKey: ["/api/documents", "search", searchQuery, categoryFilter, entityTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (entityTypeFilter !== "all") params.set("entityType", entityTypeFilter);
      const res = await apiRequest("GET", `/api/documents?${params.toString()}`);
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search all documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-search-all-docs"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(ENTITY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Search className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No documents found</p>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Record Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map(doc => {
              const Icon = getFileIcon(doc.fileType);
              return (
                <TableRow key={doc.id} data-testid={`all-doc-row-${doc.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate max-w-[250px]">{doc.fileName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.other}`}>
                      {CATEGORY_LABELS[doc.category] || doc.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {ENTITY_LABELS[doc.homeEntityType] || doc.homeEntityType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatFileSize(doc.fileSizeKb)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(doc.fileUrl, "_blank")} data-testid={`view-all-doc-${doc.id}`}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShareDoc(doc)} data-testid={`share-all-doc-${doc.id}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

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
    </div>
  );
}
