import React, { useState, useCallback, useRef } from "react";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Target, 
  Eye, 
  Users, 
  Rocket, 
  CheckCircle2,
  Calendar,
  MessageSquare,
  ArrowRight,
  Archive,
  FileText,
  Upload,
  Download,
  Trash2,
  File,
  Image,
  FileSpreadsheet,
  FileArchive,
  Loader2,
  FolderOpen,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { HqFile } from "@shared/schema";

const ALLOWED_TYPES = [
  "image/png", "image/jpeg", "image/svg+xml",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/zip", "application/x-zip-compressed",
];

const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".pdf", ".docx", ".xlsx", ".csv", ".zip", ".svg"];

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType === "application/pdf") return FileText;
  if (mimeType.includes("spreadsheet") || mimeType === "text/csv") return FileSpreadsheet;
  if (mimeType.includes("zip")) return FileArchive;
  return File;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isViewable(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

export default function HQOverview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<typeof notes[0] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewFile, setViewFile] = useState<HqFile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<HqFile | null>(null);

  const { data: hqFiles = [], isLoading: filesLoading } = useQuery<HqFile[]>({
    queryKey: ["/api/hq-files"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/hq-files/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hq-files"] });
      setDeleteConfirm(null);
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
      return ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_TYPES.includes(f.type);
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

  const goals = [
    { text: "95% Customer Satisfaction Rating", target: "Q4 2025", status: "On Track" },
    { text: "Zero Workplace Safety Incidents", target: "Ongoing", status: "Met" },
    { text: "Launch 2 New Maintenance Packages", target: "Q3 2025", status: "In Progress" }
  ];

  const notes = [
    { date: "Oct 24, 2025", title: "Quarterly Strategy Alignment", attendees: "All Management", content: "Reviewed Q4 goals and realigned priorities. Focus areas: customer retention, crew training, and equipment maintenance." },
    { date: "Oct 17, 2025", title: "Safety Protocol Update", attendees: "All Hands", content: "Updated heat safety protocols for summer months. New hydration stations at all job sites. PPE compliance reminders." },
    { date: "Oct 10, 2025", title: "New Material Supplier Review", attendees: "Ops & Purchasing", content: "Evaluated three new mulch suppliers. Selected GreenGrow Materials for better pricing and quality. Implementation starts Nov 1." }
  ];

  const archivedNotes = [
    { date: "Oct 3, 2025", title: "Fleet Maintenance Schedule", attendees: "Operations" },
    { date: "Sep 26, 2025", title: "Fall Season Preparation", attendees: "All Crews" },
    { date: "Sep 19, 2025", title: "Customer Feedback Review", attendees: "Management" },
    { date: "Sep 12, 2025", title: "New Employee Orientation", attendees: "HR & Training" },
    { date: "Sep 5, 2025", title: "Monthly Budget Review", attendees: "Finance & Ops" },
    { date: "Aug 29, 2025", title: "Equipment Upgrade Discussion", attendees: "Operations" },
  ];

  const handleViewArchives = () => {
    setArchiveDialogOpen(true);
  };

  const handleNoteClick = (note: typeof notes[0]) => {
    setSelectedNote(note);
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-20">
      <section className="text-center space-y-4">
        <h1 className="text-2xl font-heading font-bold text-foreground">Company HQ</h1>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          One team, one vision. Building the most respected landscape company in the region.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-primary text-primary-foreground border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-6 h-6" /> Our Vision
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg leading-relaxed">
            To transform every outdoor space into a sustainable, living masterpiece that enhances the lives of our clients and the health of our environment.
          </CardContent>
        </Card>

        <Card className="bg-secondary text-secondary-foreground border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Rocket className="w-6 h-6" /> Our Mission
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg leading-relaxed">
            Delivering elite landscape installation and maintenance through professional craftsmanship, innovative design, and unwavering commitment to client success.
          </CardContent>
        </Card>
      </div>

      <section className="space-y-6">
        <h2 className="text-3xl font-heading font-bold flex items-center gap-2">
          <Target className="w-8 h-8 text-primary" /> Strategic Goals 2025
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {goals.map((goal, i) => (
            <Card key={i} className="hover-elevate">
              <CardContent className="pt-6 space-y-4">
                <Badge variant={goal.status === "Met" ? "default" : "secondary"}>{goal.status}</Badge>
                <p className="font-bold text-lg">{goal.text}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" /> {goal.target}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-heading font-bold flex items-center gap-2">
            <FolderOpen className="w-8 h-8 text-primary" /> Company Files
          </h2>
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={uploading}
            className="gap-2"
            data-testid="button-upload-files"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Uploading..." : "Upload Files"}
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

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 ${
            isDragging 
              ? "border-primary bg-primary/5 scale-[1.01]" 
              : "border-muted-foreground/25 hover:border-muted-foreground/40"
          }`}
          data-testid="dropzone-files"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Uploading files...</p>
            </div>
          ) : hqFiles.length === 0 && !filesLoading ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Upload className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Drag & drop files here, or click "Upload Files"
              </p>
              <p className="text-xs text-muted-foreground/70">
                PNG, JPG, PDF, DOCX, XLSX, CSV, ZIP, SVG
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filesLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {hqFiles.map((file) => {
                    const IconComponent = getFileIcon(file.mimeType);
                    const canView = isViewable(file.mimeType);
                    return (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 bg-card border rounded-lg hover:bg-accent/50 transition-colors group"
                        data-testid={`file-row-${file.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="p-2 rounded-lg bg-muted">
                            <IconComponent className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate" data-testid={`text-filename-${file.id}`}>{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)} · {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canView && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setViewFile(file)}
                              data-testid={`button-view-${file.id}`}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDownload(file)}
                            data-testid={`button-download-${file.id}`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm(file)}
                            data-testid={`button-delete-${file.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground/60 pt-2">
                    Drag & drop more files here · PNG, JPG, PDF, DOCX, XLSX, CSV, ZIP, SVG
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-heading font-bold flex items-center gap-2">
            <MessageSquare className="w-8 h-8 text-primary" /> Leadership Notes
          </h2>
          <Button variant="outline" onClick={handleViewArchives} className="gap-2">
            <Archive className="w-4 h-4" />
            View All Archives
          </Button>
        </div>
        <div className="space-y-4">
          {notes.map((note, i) => (
            <div 
              key={i} 
              className="flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-accent transition-colors cursor-pointer"
              onClick={() => handleNoteClick(note)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary rounded-lg flex flex-col items-center justify-center text-[10px] font-bold">
                  <span>{note.date.split(" ")[0]}</span>
                  <span className="text-base leading-none">{note.date.split(" ")[1].replace(",", "")}</span>
                </div>
                <div>
                   <h4 className="font-bold text-lg">{note.title}</h4>
                   <div className="flex items-center gap-2 text-sm text-muted-foreground">
                     <Users className="w-3 h-3" /> {note.attendees}
                   </div>
                </div>
              </div>
              <ArrowRight className="text-muted-foreground" />
            </div>
          ))}
        </div>
      </section>

      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5" />
              Leadership Notes Archive
            </DialogTitle>
            <DialogDescription>Browse past meeting notes and company updates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {archivedNotes.map((note, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                onClick={() => {
                  toast({
                    title: note.title,
                    description: `Meeting notes from ${note.date} with ${note.attendees}.`,
                  });
                }}
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{note.title}</p>
                    <p className="text-xs text-muted-foreground">{note.date} · {note.attendees}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedNote} onOpenChange={() => setSelectedNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedNote?.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Calendar className="w-4 h-4" /> {selectedNote?.date} · {selectedNote?.attendees}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">{selectedNote?.content}</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewFile} onOpenChange={() => setViewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <File className="w-5 h-5" />
              {viewFile?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {viewFile?.mimeType.startsWith("image/") ? (
              <img 
                src={`/api/hq-files/${viewFile.id}/download`} 
                alt={viewFile.name} 
                className="max-w-full h-auto rounded-lg mx-auto"
                data-testid="preview-image"
              />
            ) : viewFile?.mimeType === "application/pdf" ? (
              <iframe 
                src={`/api/hq-files/${viewFile.id}/download`} 
                className="w-full h-[60vh] rounded-lg border"
                title={viewFile.name}
                data-testid="preview-pdf"
              />
            ) : null}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => viewFile && handleDownload(viewFile)} className="gap-2">
              <Download className="w-4 h-4" /> Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
