import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Zap, Bell, Repeat, ChevronDown } from "lucide-react";
import { Redirect } from "wouter";

interface Automation {
  id: string;
  key: string;
  label: string;
  description: string;
  category: "Status Triggers" | "Reminders & Escalations" | "Recurring Jobs";
  enabled: boolean;
  config: Record<string, any>;
  last_run_at: string | null;
  updated_at: string;
  updated_by: string | null;
}

interface CustomerOption {
  id: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
}

const CATEGORY_META: Record<string, { icon: any; blurb: string }> = {
  "Status Triggers": { icon: Zap, blurb: "Fire automatically when a job or estimate changes status." },
  "Reminders & Escalations": { icon: Bell, blurb: "Daily internal checks. Admin review only — never contacts customers directly." },
  "Recurring Jobs": { icon: Repeat, blurb: "Auto-generate upcoming jobs for customers flagged as recurring." },
};

function customerName(c: CustomerOption) {
  return c.company_name?.trim() || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unnamed Customer";
}

function RecurringJobConfig({ automation, onSaved }: { automation: Automation; onSaved: () => void }) {
  const { toast } = useToast();
  const [daysBefore, setDaysBefore] = useState(String(automation.config?.daysBefore ?? 7));
  const [customerIds, setCustomerIds] = useState<string[]>(automation.config?.customerIds ?? []);
  const [open, setOpen] = useState(false);

  const { data: customers = [] } = useQuery<CustomerOption[]>({
    queryKey: ["/api/customers", "all"],
    queryFn: () => fetch("/api/customers?status=all", { credentials: "include" }).then(r => r.json()),
  });

  const saveMut = useMutation({
    mutationFn: (config: Record<string, any>) => apiRequest("PATCH", `/api/automations/${automation.key}`, { config }),
    onSuccess: () => { toast({ title: "Recurring job settings updated" }); onSaved(); },
    onError: (e: any) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const dirty = daysBefore !== String(automation.config?.daysBefore ?? 7) ||
    JSON.stringify([...customerIds].sort()) !== JSON.stringify([...(automation.config?.customerIds ?? [])].sort());

  function handleSave() {
    const n = Number(daysBefore);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
      toast({ title: "Invalid value", description: "Days before must be a positive whole number.", variant: "destructive" });
      return;
    }
    saveMut.mutate({ daysBefore: n, customerIds });
  }

  function toggleCustomer(id: string) {
    setCustomerIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  }

  const selectedCustomers = customers.filter(c => customerIds.includes(c.id));

  return (
    <div className="mt-3 pl-4 border-l-2 border-muted space-y-3" data-testid={`config-${automation.key}`}>
      <div className="flex items-center gap-3">
        <Label htmlFor="days-before" className="text-xs text-muted-foreground w-32 shrink-0">
          Days before due date
        </Label>
        <Input
          id="days-before"
          type="number"
          min="1"
          className="w-24"
          value={daysBefore}
          onChange={e => setDaysBefore(e.target.value)}
          data-testid="input-days-before"
        />
      </div>

      <div className="flex items-start gap-3">
        <Label className="text-xs text-muted-foreground w-32 shrink-0 pt-2">Recurring customers</Label>
        <div className="flex-1 min-w-0">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="justify-between w-full sm:w-72" data-testid="button-select-customers">
                <span className="truncate">
                  {selectedCustomers.length > 0 ? `${selectedCustomers.length} customer(s) selected` : "Select customers…"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 ml-2 shrink-0 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <ScrollArea className="h-64">
                <div className="p-2 space-y-1">
                  {customers.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-3">No customers found.</p>
                  )}
                  {customers.map(c => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                      data-testid={`option-customer-${c.id}`}
                    >
                      <Checkbox checked={customerIds.includes(c.id)} onCheckedChange={() => toggleCustomer(c.id)} />
                      <span className="truncate">{customerName(c)}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          {selectedCustomers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedCustomers.map(c => (
                <Badge key={c.id} variant="secondary" className="text-xs" data-testid={`badge-customer-${c.id}`}>
                  {customerName(c)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pl-32">
        <Button size="sm" onClick={handleSave} disabled={!dirty || saveMut.isPending} data-testid="button-save-recurring-config">
          {saveMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}

function AutomationRow({ automation, onSaved }: { automation: Automation; onSaved: () => void }) {
  const { toast } = useToast();

  const toggleMut = useMutation({
    mutationFn: (enabled: boolean) => apiRequest("PATCH", `/api/automations/${automation.key}`, { enabled }),
    onSuccess: (_data, enabled) => {
      toast({ title: `${automation.label} ${enabled ? "enabled" : "disabled"}` });
      onSaved();
    },
    onError: (e: any) => toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="py-4 border-b last:border-b-0" data-testid={`row-automation-${automation.key}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground" data-testid={`text-label-${automation.key}`}>
            {automation.label}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-description-${automation.key}`}>
            {automation.description}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {automation.last_run_at ? (
              <p className="text-[11px] text-muted-foreground/70" data-testid={`text-last-run-${automation.key}`}>
                Last ran {new Date(automation.last_run_at).toLocaleString()}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground/70">Never run yet</p>
            )}
            {automation.updated_by && (
              <p className="text-[11px] text-muted-foreground/70">
                · Updated by {automation.updated_by}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={automation.enabled ? "default" : "secondary"} data-testid={`badge-status-${automation.key}`}>
            {automation.enabled ? "ON" : "OFF"}
          </Badge>
          <Switch
            checked={automation.enabled}
            disabled={toggleMut.isPending}
            onCheckedChange={(checked) => toggleMut.mutate(checked)}
            data-testid={`switch-enabled-${automation.key}`}
          />
        </div>
      </div>

      {automation.key === "recurring_job_generation" && automation.enabled && (
        <RecurringJobConfig automation={automation} onSaved={onSaved} />
      )}
    </div>
  );
}

export default function AutomationCenterPage() {
  const { effectiveRole } = useAuth();
  const qc = useQueryClient();

  if (!["Admin", "Master Admin"].includes(effectiveRole ?? "")) {
    return <Redirect to="/" />;
  }

  const { data: automations = [], isLoading } = useQuery<Automation[]>({
    queryKey: ["/api/automations"],
    queryFn: () => fetch("/api/automations", { credentials: "include" }).then(r => r.json()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/automations"] });

  const grouped = useMemo(() => {
    const g: Record<string, Automation[]> = {};
    for (const a of automations) {
      if (!g[a.category]) g[a.category] = [];
      g[a.category].push(a);
    }
    return g;
  }, [automations]);

  const categoryOrder = ["Status Triggers", "Reminders & Escalations", "Recurring Jobs"];

  return (
    <div className="flex flex-col h-full" data-testid="automation-center-page">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Automation Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every automation is off by default. Turn one on when you're ready for it to run.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          categoryOrder
            .filter(cat => grouped[cat]?.length)
            .map(cat => {
              const meta = CATEGORY_META[cat];
              const Icon = meta?.icon ?? Zap;
              return (
                <Card key={cat} data-testid={`card-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">{cat}</span>
                    </div>
                    {meta?.blurb && <p className="text-xs text-muted-foreground">{meta.blurb}</p>}
                  </CardHeader>
                  <CardContent className="pt-0">
                    {grouped[cat].map(automation => (
                      <AutomationRow key={automation.key} automation={automation} onSaved={invalidate} />
                    ))}
                  </CardContent>
                </Card>
              );
            })
        )}
      </div>
    </div>
  );
}
