import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Loader2, CheckCircle2, XCircle, Clock3, RefreshCcw, Mail } from "lucide-react";

interface MessageBlastRecipient {
  id: string;
  customer_id: string;
  customer_name: string;
  channel: string;
  status: "pending" | "sent" | "failed";
  error: string | null;
  sent_at: string | null;
}

interface MessageBlastDetailData {
  id: string;
  name: string | null;
  subject: string | null;
  template_key: string | null;
  body: string;
  filters: Record<string, any> | null;
  sent_at: string | null;
  created_at: string;
  created_by_name: string | null;
  recipient_count: number | null;
  recipients: MessageBlastRecipient[];
}

function recipientStatusBadge(status: MessageBlastRecipient["status"]) {
  if (status === "sent") {
    return <Badge variant="outline" className="gap-1 text-green-600 border-green-300"><CheckCircle2 className="h-3 w-3" /> Sent</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="outline" className="gap-1 text-red-600 border-red-300"><XCircle className="h-3 w-3" /> Failed</Badge>;
  }
  return <Badge variant="outline" className="gap-1 text-muted-foreground"><Clock3 className="h-3 w-3" /> Pending</Badge>;
}

export default function MessageBlastDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: blast, isLoading } = useQuery<MessageBlastDetailData>({
    queryKey: ["/api/message-blasts", params.id],
    queryFn: async () => (await apiRequest("GET", `/api/message-blasts/${params.id}`)).json(),
  });

  const resendMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/message-blasts/${params.id}/resend-failed`)).json(),
    onSuccess: (result: { sent: number; failed: number; total: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-blasts", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/message-blasts"] });
      if (result.total === 0) {
        toast({ title: "Nothing to resend", description: "There were no failed recipients." });
      } else {
        toast({ title: "Resend complete", description: `${result.sent} sent, ${result.failed} still failed.` });
      }
    },
    onError: (e: any) => toast({ title: "Resend failed", description: e.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/message-blasts/${params.id}/send`)).json(),
    onSuccess: (result: { sent: number; failed: number; total: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-blasts", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/message-blasts"] });
      toast({ title: "Blast sent", description: `${result.sent} sent, ${result.failed} failed out of ${result.total}.` });
    },
    onError: (e: any) => toast({ title: "Could not send", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
      </div>
    );
  }

  if (!blast) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-24 text-muted-foreground" data-testid="text-blast-not-found">
        Blast not found.
      </div>
    );
  }

  const failedCount = blast.recipients.filter((r) => r.status === "failed").length;
  const sentCount = blast.recipients.filter((r) => r.status === "sent").length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/message-blasts")} data-testid="button-back" className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Message Blasts
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-blast-name">
            {blast.name || blast.subject || "Untitled Blast"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Created by {blast.created_by_name || "—"} on {new Date(blast.created_at).toLocaleString()}
          </p>
        </div>
        {!blast.sent_at ? (
          <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending} data-testid="button-send-now">
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Mail className="h-4 w-4 mr-1.5" />}
            Send Now
          </Button>
        ) : failedCount > 0 ? (
          <Button
            variant="outline"
            onClick={() => resendMutation.mutate()}
            disabled={resendMutation.isPending}
            data-testid="button-resend-failed"
          >
            {resendMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-1.5" />}
            Resend Failed ({failedCount})
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <span className="text-sm font-medium">Message Preview</span>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Subject: </span>
            <span className="font-medium" data-testid="text-blast-subject">{blast.subject || "—"}</span>
          </div>
          <div
            className="prose prose-sm max-w-none border rounded-md p-4 bg-muted/30"
            data-testid="text-blast-body"
            dangerouslySetInnerHTML={{ __html: blast.body }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <span className="text-sm font-medium">
            Recipients {blast.sent_at ? `(${sentCount} sent, ${failedCount} failed of ${blast.recipients.length})` : ""}
          </span>
        </CardHeader>
        <CardContent className="pt-0">
          {blast.recipients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-recipients">
              {blast.sent_at ? "No recipients were recorded for this blast." : "This draft has not been sent yet."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blast.recipients.map((r) => (
                  <TableRow key={r.id} data-testid={`row-recipient-${r.id}`}>
                    <TableCell className="font-medium" data-testid={`text-recipient-name-${r.id}`}>{r.customer_name}</TableCell>
                    <TableCell className="capitalize text-sm text-muted-foreground">{r.channel}</TableCell>
                    <TableCell>{recipientStatusBadge(r.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.sent_at ? new Date(r.sent_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-red-500">{r.error || ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
