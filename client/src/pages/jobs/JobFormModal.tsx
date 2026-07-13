import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Layers, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Constants ─────────────────────────────────────────────────────────────────
export const JOB_TYPES = [
  "Lawn Care", "Landscaping", "Snow Removal", "Irrigation",
  "Cleanup", "Tree Service", "Mulching", "Hardscaping",
  "Spring Cleanup", "Fall Cleanup", "Seeding", "Aeration",
  "Fertilization", "Planting", "Pruning", "Other",
];

interface ServiceType { id: string; name: string; category: string; }

export const JOB_STATUSES = [
  { value: "lead",        label: "Lead" },
  { value: "scheduled",   label: "Scheduled" },
  { value: "sold",        label: "Sold" },
  { value: "ready",       label: "Ready" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed",   label: "Completed" },
  { value: "invoiced",    label: "Invoiced" },
  { value: "cancelled",   label: "Cancelled" },
];

export interface JobFormData {
  title: string;
  customer_id: string;
  property_id: string;
  job_type: string;
  status: string;
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  estimated_hours: string;
  price: string;
  description: string;
  crew_notes: string;
  safety_notes: string;
  restrictions_notes: string;
}

export const EMPTY_JOB: JobFormData = {
  title: "", customer_id: "", property_id: "", job_type: "",
  status: "lead", scheduled_date: "", scheduled_start_time: "",
  scheduled_end_time: "", estimated_hours: "", price: "",
  description: "", crew_notes: "", safety_notes: "", restrictions_notes: "",
};

interface Customer {
  id: string; first_name: string; last_name: string; company_name: string | null;
}
interface Property {
  id: string; address: string; city: string | null; state: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<JobFormData> & { id?: string };
  /** Pre-locked customer (e.g. when opening from customer detail) */
  lockedCustomerId?: string;
  onSuccess?: (job: any) => void;
}

export function JobFormModal({ open, onOpenChange, initialData, lockedCustomerId, onSuccess }: Props) {
  const { t } = useTranslation("jobDetail");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<JobFormData>({ ...EMPTY_JOB, ...initialData });
  const [custSearch, setCustSearch] = useState("");

  // ── Job Templates ────────────────────────────────────────────────────────────
  const { data: jobTemplates = [] } = useQuery<any[]>({
    queryKey: ["/api/job-templates"],
    queryFn: () => fetch("/api/job-templates", { credentials: "include" }).then(r => r.json()),
    enabled: open,
  });
  const activeTemplates = jobTemplates.filter((t: any) => t.is_active !== false);

  function applyTemplate(tpl: any) {
    setForm(f => ({
      ...f,
      job_type:        tpl.job_type        || f.job_type,
      estimated_hours: tpl.estimated_hours != null ? String(tpl.estimated_hours) : f.estimated_hours,
      price:           tpl.price           != null ? String(tpl.price)           : f.price,
      description:     tpl.scope_of_work   || f.description,
      crew_notes:      tpl.crew_notes      || f.crew_notes,
    }));
    toast({ title: `Template "${tpl.name}" loaded` });
  }

  useEffect(() => {
    if (open) setForm({ ...EMPTY_JOB, ...initialData });
  }, [open, initialData]);

  const isEdit = !!initialData?.id;

  // Customers list
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/customers");
      return res.json();
    },
    enabled: open,
  });

  // Service Types
  const { data: serviceTypes = [] } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types/active"],
    queryFn: () => fetch("/api/service-types/active").then(r => r.json()),
    enabled: open,
  });

  // Properties for selected customer
  const activeCustomerId = lockedCustomerId || form.customer_id;
  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/customers", activeCustomerId, "properties"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/customers/${activeCustomerId}/properties`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.properties ?? data ?? [];
    },
    enabled: !!activeCustomerId && open,
  });

  const set = (key: keyof JobFormData, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const filteredCustomers = customers.filter((c) => {
    const name = `${c.first_name} ${c.last_name} ${c.company_name ?? ""}`.toLowerCase();
    return name.includes(custSearch.toLowerCase());
  });

  const mutation = useMutation({
    mutationFn: async (data: JobFormData) => {
      const payload = {
        ...data,
        client: customers.find((c) => c.id === data.customer_id)
          ? `${customers.find((c) => c.id === data.customer_id)!.first_name} ${customers.find((c) => c.id === data.customer_id)!.last_name}`
          : data.title,
        customer_id: lockedCustomerId || data.customer_id || null,
        property_id: data.property_id || null,
        price: data.price ? parseFloat(data.price) : null,
        estimated_hours: data.estimated_hours ? parseFloat(data.estimated_hours) : null,
      };
      const url = isEdit ? `/api/jobs/${initialData!.id}` : "/api/jobs";
      const method = isEdit ? "PUT" : "POST";
      const res = await apiRequest(method, url, payload);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: isEdit ? t("jobUpdated") : t("jobCreated") });
      onOpenChange(false);
      onSuccess?.(job);
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast({ title: t("jobTitleRequired"), variant: "destructive" });
      return;
    }
    mutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{isEdit ? t("editJob") : t("newJob")}</DialogTitle>
            {!isEdit && activeTemplates.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" data-testid="button-load-template">
                    <Layers className="h-3.5 w-3.5" />
                    Load Template
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {activeTemplates.map((tpl: any) => (
                    <DropdownMenuItem
                      key={tpl.id}
                      onClick={() => applyTemplate(tpl)}
                      data-testid={`template-option-${tpl.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{tpl.name}</p>
                        {(tpl.job_type || tpl.division) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {[tpl.job_type, tpl.division].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-1">
            <Label>{t("jobTitle")} <span className="text-destructive">*</span></Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Spring Cleanup — Smith Property"
              data-testid="input-job-title"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Customer */}
            {!lockedCustomerId && (
              <div className="space-y-1 col-span-2">
                <Label>{t("customer")}</Label>
                <Input
                  placeholder={t("searchCustomersPlaceholder")}
                  value={custSearch}
                  onChange={(e) => setCustSearch(e.target.value)}
                  className="mb-1"
                  data-testid="input-customer-search"
                />
                <select
                  value={form.customer_id}
                  onChange={(e) => {
                    set("customer_id", e.target.value);
                    set("property_id", "");
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  data-testid="select-customer"
                >
                  <option value="">{t("noSpecificCustomer")}</option>
                  {filteredCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}{c.company_name ? ` — ${c.company_name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Property */}
            {(form.customer_id || lockedCustomerId) && (
              <div className="space-y-1 col-span-2">
                <Label>{t("property")}</Label>
                <select
                  value={form.property_id}
                  onChange={(e) => set("property_id", e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  data-testid="select-property"
                >
                  <option value="">{t("noSpecificProperty")}</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.address}{p.city ? `, ${p.city}` : ""}{p.state ? `, ${p.state}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Job Type */}
            <div className="space-y-1">
              <Label>{t("jobType")}</Label>
              <select
                value={form.job_type}
                onChange={(e) => set("job_type", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                data-testid="select-job-type"
              >
                <option value="">{t("selectType")}</option>
                {serviceTypes.length > 0
                  ? serviceTypes.map(st => <option key={st.id} value={st.name}>{st.name}</option>)
                  : JOB_TYPES.map(jt => <option key={jt} value={jt}>{jt}</option>)
                }
              </select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label>{t("status")}</Label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                data-testid="select-status"
              >
                {JOB_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Scheduled Date */}
            <div className="space-y-1">
              <Label>{t("scheduledDate")}</Label>
              <Input
                type="date"
                value={form.scheduled_date}
                onChange={(e) => set("scheduled_date", e.target.value)}
                data-testid="input-scheduled-date"
              />
            </div>

            {/* Price */}
            <div className="space-y-1">
              <Label>{t("priceField")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="0.00"
                data-testid="input-price"
              />
            </div>

            {/* Start Time */}
            <div className="space-y-1">
              <Label>{t("startTime")}</Label>
              <Input
                type="time"
                value={form.scheduled_start_time}
                onChange={(e) => set("scheduled_start_time", e.target.value)}
                data-testid="input-start-time"
              />
            </div>

            {/* End Time */}
            <div className="space-y-1">
              <Label>{t("endTime")}</Label>
              <Input
                type="time"
                value={form.scheduled_end_time}
                onChange={(e) => set("scheduled_end_time", e.target.value)}
                data-testid="input-end-time"
              />
            </div>

            {/* Estimated Hours */}
            <div className="space-y-1">
              <Label>{t("estimatedHours")}</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={form.estimated_hours}
                onChange={(e) => set("estimated_hours", e.target.value)}
                placeholder="0"
                data-testid="input-estimated-hours"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label>{t("descriptionScope")}</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              placeholder={t("descriptionPlaceholder")}
              data-testid="textarea-description"
            />
          </div>

          {/* Crew Notes */}
          <div className="space-y-1">
            <Label>{t("crewNotes")}</Label>
            <Textarea
              value={form.crew_notes}
              onChange={(e) => set("crew_notes", e.target.value)}
              rows={2}
              placeholder={t("crewNotesPlaceholder")}
              data-testid="textarea-crew-notes"
            />
          </div>

          {/* Safety Notes */}
          <div className="space-y-1">
            <Label className="text-red-700">⚠ Safety Notes (shown to crew on job card)</Label>
            <Textarea
              value={form.safety_notes}
              onChange={(e) => set("safety_notes", e.target.value)}
              rows={2}
              placeholder="E.g. wear gloves, bees near shed, steep slope..."
              data-testid="textarea-safety-notes"
            />
          </div>

          {/* Do Not Touch / Restrictions */}
          <div className="space-y-1">
            <Label className="text-purple-700">🚫 Do Not Touch / Restrictions (shown to crew on job card)</Label>
            <Textarea
              value={form.restrictions_notes}
              onChange={(e) => set("restrictions_notes", e.target.value)}
              rows={2}
              placeholder="E.g. do not enter back gate, stay off new sod, avoid left garden bed..."
              data-testid="textarea-restrictions-notes"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-primary" data-testid="button-save-job">
              {mutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("saving")}</>
                : isEdit ? t("saveChanges") : t("createJob")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
