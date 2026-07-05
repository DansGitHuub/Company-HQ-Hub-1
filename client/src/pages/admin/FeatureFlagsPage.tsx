import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, FlagTriangleRight } from "lucide-react";
import { Redirect } from "wouter";

interface FeatureFlag {
  id: string;
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  updated_at: string;
  updated_by: string | null;
}

function FlagRow({ flag, onSaved }: { flag: FeatureFlag; onSaved: () => void }) {
  const { toast } = useToast();

  const toggleMut = useMutation({
    mutationFn: (enabled: boolean) => apiRequest("PATCH", `/api/feature-flags/${flag.key}`, { enabled }),
    onSuccess: (_data, enabled) => {
      toast({ title: `${flag.label} ${enabled ? "enabled" : "disabled"}` });
      onSaved();
    },
    onError: (e: any) => toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 border-b last:border-b-0" data-testid={`row-flag-${flag.key}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground" data-testid={`text-label-${flag.key}`}>{flag.label}</div>
        <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-description-${flag.key}`}>{flag.description}</p>
        {flag.updated_at && (
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            Last updated {new Date(flag.updated_at).toLocaleDateString()}
            {flag.updated_by ? ` by ${flag.updated_by}` : ""}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={flag.enabled ? "default" : "secondary"} data-testid={`badge-status-${flag.key}`}>
          {flag.enabled ? "ON" : "OFF"}
        </Badge>
        <Switch
          checked={flag.enabled}
          disabled={toggleMut.isPending}
          onCheckedChange={(checked) => toggleMut.mutate(checked)}
          data-testid={`switch-enabled-${flag.key}`}
        />
      </div>
    </div>
  );
}

export default function FeatureFlagsPage() {
  const { effectiveRole } = useAuth();
  const qc = useQueryClient();

  if (!["Admin", "Master Admin"].includes(effectiveRole ?? "")) {
    return <Redirect to="/" />;
  }

  const { data: flags = [], isLoading } = useQuery<FeatureFlag[]>({
    queryKey: ["/api/feature-flags"],
    queryFn: () => fetch("/api/feature-flags", { credentials: "include" }).then(r => r.json()),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/feature-flags"] });
    qc.invalidateQueries({ queryKey: ["/api/feature-flags/public"] });
  };

  return (
    <div className="flex flex-col h-full" data-testid="feature-flags-page">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FlagTriangleRight className="h-5 w-5 text-primary" /> Feature Flags
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hide unfinished modules from regular users during alpha. Admins can always see gated features to check progress.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card data-testid="card-feature-flags">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FlagTriangleRight className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">In-Progress Features</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Turn a flag on once the feature is ready for everyone.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              {flags.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No feature flags yet.</p>
              ) : (
                flags.map(flag => (
                  <FlagRow key={flag.key} flag={flag} onSaved={invalidate} />
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
