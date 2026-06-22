import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Share2, Users, Briefcase, Truck, UserCheck, HardHat } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DocumentShare } from "@shared/schema";

const MODULES = [
  { key: "employee", label: "Employee Records", icon: Users, recordLabel: "Employee" },
  { key: "hiring", label: "Hiring / Onboarding", icon: UserCheck, recordLabel: "Applicant" },
  { key: "job", label: "Jobs / Work Orders", icon: Briefcase, recordLabel: "Job" },
  { key: "equipment", label: "Equipment Records", icon: Truck, recordLabel: "Equipment" },
  { key: "customer", label: "Customer Records", icon: HardHat, recordLabel: "Customer" },
] as const;

interface ShareToModulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
}

export default function ShareToModulesDialog({ open, onOpenChange, documentId, documentName }: ShareToModulesDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedModules, setSelectedModules] = useState<Record<string, boolean>>({});
  const [selectedRecords, setSelectedRecords] = useState<Record<string, string>>({});

  const { data: existingShares = [] } = useQuery<DocumentShare[]>({
    queryKey: ["/api/document-shares", documentId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/document-shares?documentId=${documentId}`);
      return res.json();
    },
    enabled: open,
  });

  const { data: employeeRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/employees"); return r.json(); },
    enabled: open && !!selectedModules.employee,
  });

  const { data: candidateRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/candidates"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/candidates"); return r.json(); },
    enabled: open && !!selectedModules.hiring,
  });

  const { data: jobRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/jobs"); return r.json(); },
    enabled: open && !!selectedModules.job,
  });

  const { data: equipmentRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/assets"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/fleet/assets"); return r.json(); },
    enabled: open && !!selectedModules.equipment,
  });

  const { data: customerRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/users", "customers"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/users?role=Customer"); return r.json(); },
    enabled: open && !!selectedModules.customer,
  });

  useEffect(() => {
    if (open && existingShares.length > 0) {
      const mods: Record<string, boolean> = {};
      const recs: Record<string, string> = {};
      existingShares.forEach(s => {
        mods[s.module] = true;
        if (s.recordId) recs[s.module] = s.recordId;
      });
      setSelectedModules(mods);
      setSelectedRecords(recs);
    }
  }, [open, existingShares]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const share of existingShares) {
        await apiRequest("DELETE", `/api/document-shares/${share.id}`);
      }
      const shares = Object.entries(selectedModules)
        .filter(([, checked]) => checked)
        .map(([module]) => ({
          module,
          recordId: selectedRecords[module] || null,
        }));
      if (shares.length > 0) {
        await apiRequest("POST", "/api/document-shares", { documentId, shares });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-shares"] });
      toast({ title: "Document sharing updated" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update sharing", description: err.message, variant: "destructive" });
    },
  });

  const getRecordOptions = (moduleKey: string) => {
    switch (moduleKey) {
      case "employee": return employeeRecords.map((e: any) => ({ id: e.id, label: `${e.firstName} ${e.lastName}` }));
      case "hiring": return candidateRecords.map((c: any) => ({ id: c.id, label: `${c.firstName} ${c.lastName}` }));
      case "job": return jobRecords.map((j: any) => ({ id: j.id, label: j.name || j.title || `Job #${j.id}` }));
      case "equipment": return equipmentRecords.map((e: any) => ({ id: e.id, label: e.name || e.assetName || `Asset #${e.id}` }));
      case "customer": return customerRecords.map((c: any) => ({ id: c.id, label: c.name || c.username }));
      default: return [];
    }
  };

  const existingModuleSet = new Set(existingShares.map(s => s.module));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" data-testid="share-to-modules-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share to Modules
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1 truncate">
            {documentName}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Select which modules this document should be available in. Optionally pick a specific record.
          </p>

          {MODULES.map(mod => {
            const isChecked = !!selectedModules[mod.key];
            const records = getRecordOptions(mod.key);
            const Icon = mod.icon;

            return (
              <div key={mod.key} className="space-y-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`module-${mod.key}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      setSelectedModules(prev => ({ ...prev, [mod.key]: !!checked }));
                      if (!checked) {
                        setSelectedRecords(prev => {
                          const next = { ...prev };
                          delete next[mod.key];
                          return next;
                        });
                      }
                    }}
                    data-testid={`checkbox-module-${mod.key}`}
                  />
                  <Label htmlFor={`module-${mod.key}`} className="flex items-center gap-2 cursor-pointer">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {mod.label}
                  </Label>
                  {existingModuleSet.has(mod.key) && (
                    <Badge variant="outline" className="text-[10px] ml-auto">Shared</Badge>
                  )}
                </div>

                {isChecked && (
                  <div className="ml-9">
                    <Select
                      value={selectedRecords[mod.key] || "__all__"}
                      onValueChange={(val) => {
                        setSelectedRecords(prev => {
                          if (val === "__all__") {
                            const next = { ...prev };
                            delete next[mod.key];
                            return next;
                          }
                          return { ...prev, [mod.key]: val };
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs" data-testid={`select-record-${mod.key}`}>
                        <SelectValue placeholder={`All ${mod.recordLabel}s`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All {mod.recordLabel}s (general pool)</SelectItem>
                        {records.map((r: any) => (
                          <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="btn-cancel-share">
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="btn-save-share">
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
