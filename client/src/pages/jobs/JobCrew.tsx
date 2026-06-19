import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Loader2, Users, Trash2, Star, StarOff, UserCheck, Mail,
} from "lucide-react";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  status: string;
  profile_photo: string | null;
}

interface CrewAssignment {
  id: string;
  job_id: string;
  employee_id: string;
  scheduled_date: string | null;
  sort_order: number;
  first_name: string;
  last_name: string;
  job_title: string | null;
  profile_photo: string | null;
  work_email: string | null;
  personal_email: string | null;
  is_lead: boolean;
}

function Avatar({ name, photo, size = 8 }: { name: string; photo?: string | null; size?: number }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const sizeClass = `h-${size} w-${size}`;
  if (photo) {
    return <img src={photo} alt={name} className={`${sizeClass} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${sizeClass} rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

export default function JobCrew({ jobId, isAdminOrManager }: { jobId: string; isAdminOrManager: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [setAsLead, setSetAsLead] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  const { data: crew = [], isLoading } = useQuery<CrewAssignment[]>({
    queryKey: ["/api/jobs", jobId, "crew"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}/crew`);
      return res.json();
    },
  });

  const { data: allEmployees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees-list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/employees-list");
      return res.json();
    },
    enabled: showAdd,
  });

  // Filter out already-assigned employees
  const assignedIds = new Set(crew.map(c => c.employee_id));
  const available = allEmployees.filter(e =>
    !assignedIds.has(e.id) &&
    (`${e.first_name} ${e.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (e.job_title ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  function resetForm() {
    setSelectedEmployeeId("");
    setSearch("");
    setSelectedDate("");
    setSetAsLead(false);
  }

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/crew`, {
        employee_id: selectedEmployeeId,
        scheduled_date: selectedDate || null,
        set_as_lead: setAsLead,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/jobs", jobId, "crew"] });
      qc.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({ title: "Crew member assigned", description: "A notification email was sent to them." });
      setShowAdd(false);
      resetForm();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await apiRequest("DELETE", `/api/jobs/${jobId}/crew/${assignmentId}`);
      if (!res.ok) throw new Error("Failed to remove");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/jobs", jobId, "crew"] });
      qc.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({ title: "Crew member removed" });
    },
  });

  const leadMutation = useMutation({
    mutationFn: async ({ employeeId, clear }: { employeeId: string | null; clear?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/jobs/${jobId}/crew/lead`, {
        employee_id: clear ? null : employeeId,
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/jobs", jobId, "crew"] });
      qc.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
    },
  });

  if (isLoading) {
    return (
      <Card><CardContent className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </CardContent></Card>
    );
  }

  const lead = crew.find(c => c.is_lead);
  const others = crew.filter(c => !c.is_lead);

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Assigned Crew</h3>
            <p className="text-xs text-muted-foreground">
              {crew.length === 0
                ? "No crew assigned"
                : `${crew.length} member${crew.length !== 1 ? "s" : ""}${lead ? ` · Lead: ${lead.first_name} ${lead.last_name}` : ""}`}
            </p>
          </div>
          {isAdminOrManager && (
            <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }} data-testid="button-assign-crew">
              <Plus className="h-4 w-4 mr-1.5" /> Assign Crew
            </Button>
          )}
        </div>

        {crew.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No crew assigned to this job yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {/* Lead first */}
            {lead && <CrewCard a={lead} isAdminOrManager={isAdminOrManager} onRemove={id => removeMutation.mutate(id)} onToggleLead={emp => leadMutation.mutate({ employeeId: emp, clear: true })} />}
            {others.map(a => (
              <CrewCard key={a.id} a={a} isAdminOrManager={isAdminOrManager}
                onRemove={id => removeMutation.mutate(id)}
                onToggleLead={emp => leadMutation.mutate({ employeeId: emp })} />
            ))}
          </div>
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={open => { if (!open) { setShowAdd(false); resetForm(); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Assign Crew Member</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Search Employees</Label>
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Name or title…" className="mt-1" autoFocus data-testid="input-crew-search" />
            </div>

            {/* Employee list */}
            <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
              {available.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {search ? "No matches" : "All active employees are already assigned"}
                </p>
              ) : available.map(e => (
                <button
                  key={e.id}
                  onClick={() => setSelectedEmployeeId(e.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted transition-colors ${selectedEmployeeId === e.id ? "bg-primary/10" : ""}`}
                  data-testid={`option-crew-${e.id}`}
                >
                  <Avatar name={`${e.first_name} ${e.last_name}`} photo={e.profile_photo} size={7} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{e.first_name} {e.last_name}</p>
                    {e.job_title && <p className="text-xs text-muted-foreground">{e.job_title}</p>}
                  </div>
                  {selectedEmployeeId === e.id && <UserCheck className="h-4 w-4 text-primary flex-shrink-0" />}
                </button>
              ))}
            </div>

            <div>
              <Label>Scheduled Date (optional)</Label>
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="mt-1" data-testid="input-crew-date" />
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={setAsLead} onChange={e => setSetAsLead(e.target.checked)}
                className="h-4 w-4 rounded" data-testid="check-set-as-lead" />
              <span className="text-sm flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-amber-500" /> Set as Crew Lead
              </span>
            </label>

            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" /> An email notification will be sent to this crew member.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); resetForm(); }}>Cancel</Button>
            <Button disabled={!selectedEmployeeId || addMutation.isPending} onClick={() => addMutation.mutate()}
              data-testid="button-confirm-crew">
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CrewCard({
  a, isAdminOrManager, onRemove, onToggleLead,
}: {
  a: CrewAssignment;
  isAdminOrManager: boolean;
  onRemove: (id: string) => void;
  onToggleLead: (employeeId: string) => void;
}) {
  const fullName = `${a.first_name} ${a.last_name}`;
  const email = a.work_email || a.personal_email;
  return (
    <Card data-testid={`card-crew-${a.id}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <Avatar name={fullName} photo={a.profile_photo} size={9} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium">{fullName}</p>
            {a.is_lead && (
              <span className="inline-flex items-center gap-0.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                <Star className="h-2.5 w-2.5" /> Lead
              </span>
            )}
          </div>
          {a.job_title && <p className="text-xs text-muted-foreground">{a.job_title}</p>}
          {email && <p className="text-xs text-muted-foreground">{email}</p>}
        </div>
        {isAdminOrManager && (
          <div className="flex gap-1">
            <button
              onClick={() => onToggleLead(a.employee_id)}
              title={a.is_lead ? "Remove as lead" : "Set as lead"}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-amber-500 transition-colors"
              data-testid={`button-toggle-lead-${a.id}`}
            >
              {a.is_lead ? <StarOff className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => onRemove(a.id)}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-500 transition-colors"
              data-testid={`button-remove-crew-${a.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
