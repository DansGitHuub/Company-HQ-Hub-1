import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Megaphone, Plus, Trash2, CheckCircle2, XCircle, Clock, FileEdit } from "lucide-react";

interface MessageBlastRow {
  id: string;
  name: string | null;
  subject: string | null;
  template_key: string | null;
  sent_at: string | null;
  created_at: string;
  created_by_name: string | null;
  recipient_count: number | null;
  sent_count: string;
  failed_count: string;
  pending_count: string;
}

function statusBadge(blast: MessageBlastRow) {
  if (!blast.sent_at) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground" data-testid={`status-draft-${blast.id}`}>
        <FileEdit className="h-3 w-3" /> Draft
      </Badge>
    );
  }
  const failed = Number(blast.failed_count) || 0;
  if (failed > 0) {
    return (
      <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300" data-testid={`status-partial-${blast.id}`}>
        <XCircle className="h-3 w-3" /> {failed} failed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-green-600 border-green-300" data-testid={`status-sent-${blast.id}`}>
      <CheckCircle2 className="h-3 w-3" /> Sent
    </Badge>
  );
}

export default function MessageBlasts() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<MessageBlastRow | null>(null);

  const { data: blasts = [], isLoading } = useQuery<MessageBlastRow[]>({
    queryKey: ["/api/message-blasts"],
    queryFn: async () => (await apiRequest("GET", "/api/message-blasts")).json(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/message-blasts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-blasts"] });
      toast({ title: "Draft deleted" });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "Could not delete", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-message-blasts-title">
            <Megaphone className="h-6 w-6" /> Message Blasts
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Send group emails to customers and review send history.
          </p>
        </div>
        <Button onClick={() => navigate("/admin/message-blasts/compose")} data-testid="button-new-blast">
          <Plus className="h-4 w-4 mr-1.5" /> New Blast
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <span className="text-sm font-medium text-muted-foreground">
            {blasts.length} {blasts.length === 1 ? "blast" : "blasts"}
          </span>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
            </div>
          ) : blasts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-blasts">
              No message blasts yet. Click "New Blast" to send your first one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blasts.map((blast) => (
                  <TableRow
                    key={blast.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/admin/message-blasts/${blast.id}`)}
                    data-testid={`row-blast-${blast.id}`}
                  >
                    <TableCell>
                      <div className="font-medium" data-testid={`text-name-${blast.id}`}>
                        {blast.name || blast.subject || "Untitled Blast"}
                      </div>
                      {blast.template_key && (
                        <div className="text-xs text-muted-foreground">{blast.template_key.replace(/_/g, " ")}</div>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(blast)}</TableCell>
                    <TableCell data-testid={`text-recipients-${blast.id}`}>
                      {blast.sent_at ? (blast.recipient_count ?? 0) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{blast.created_by_name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {blast.sent_at ? new Date(blast.sent_at).toLocaleString() : (
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Not sent</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {!blast.sent_at && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(blast); }}
                          data-testid={`button-delete-${blast.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name || deleteTarget?.subject || "this draft"}". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
