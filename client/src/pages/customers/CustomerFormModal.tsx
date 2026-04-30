import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/RichTextEditor";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, X, Star } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface PhoneEntry { phone: string; phone_type: string; is_primary: boolean; }
export interface EmailEntry { email: string; email_type: string; is_primary: boolean; }

export interface CustomerFormData {
  first_name: string;
  last_name: string;
  company_name: string;
  source: string;
  billing_address: string;
  billing_city: string;
  billing_state: string;
  billing_zip: string;
  notes: string;
  phones: PhoneEntry[];
  emails: EmailEntry[];
}

export const EMPTY_FORM: CustomerFormData = {
  first_name: "", last_name: "", company_name: "", source: "",
  billing_address: "", billing_city: "", billing_state: "", billing_zip: "",
  notes: "",
  phones: [{ phone: "", phone_type: "Mobile", is_primary: true }],
  emails: [{ email: "", email_type: "Work", is_primary: true }],
};

export const PHONE_TYPES = ["Mobile", "Home", "Work", "Other"];
export const EMAIL_TYPES = ["Work", "Personal", "Other"];
export const SOURCE_OPTIONS = [
  "Referral", "Google", "Website", "Facebook", "Instagram",
  "Door Hanger", "Yard Sign", "Repeat", "Other",
];

function setPrimary<T extends { is_primary: boolean }>(list: T[], index: number): T[] {
  return list.map((item, i) => ({ ...item, is_primary: i === index }));
}

interface Props {
  open: boolean;
  onClose: () => void;
  editing: { id: string } | null;
  initialData?: CustomerFormData;
  onAfterSave?: () => void;
}

export function CustomerFormModal({ open, onClose, editing, initialData, onAfterSave }: Props) {
  const { t } = useTranslation("customers");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<CustomerFormData>(initialData ?? EMPTY_FORM);

  React.useEffect(() => {
    if (open) setForm(initialData ?? EMPTY_FORM);
  }, [open, initialData]);

  const setField = (field: keyof CustomerFormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      const res = await apiRequest("POST", "/api/customers", data);
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: t("customerAdded") });
      onAfterSave?.();
      onClose();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      const res = await apiRequest("PUT", `/api/customers/${editing!.id}`, data);
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: t("customerUpdated") });
      onAfterSave?.();
      onClose();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast({ title: t("nameRequired"), variant: "destructive" });
      return;
    }
    editing ? updateMutation.mutate(form) : createMutation.mutate(form);
  };

  const addPhone = () =>
    setForm((f) => ({ ...f, phones: [...f.phones, { phone: "", phone_type: "Mobile", is_primary: false }] }));
  const removePhone = (i: number) =>
    setForm((f) => ({ ...f, phones: f.phones.filter((_, idx) => idx !== i) }));
  const updatePhone = (i: number, field: keyof PhoneEntry, value: string | boolean) =>
    setForm((f) => ({ ...f, phones: f.phones.map((p, idx) => idx === i ? { ...p, [field]: value } : p) }));

  const addEmail = () =>
    setForm((f) => ({ ...f, emails: [...f.emails, { email: "", email_type: "Work", is_primary: false }] }));
  const removeEmail = (i: number) =>
    setForm((f) => ({ ...f, emails: f.emails.filter((_, idx) => idx !== i) }));
  const updateEmail = (i: number, field: keyof EmailEntry, value: string | boolean) =>
    setForm((f) => ({ ...f, emails: f.emails.map((e, idx) => idx === i ? { ...e, [field]: value } : e) }));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t("editCustomer") : t("addCustomer")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("basicInfo")}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("firstName")} <span className="text-red-500">*</span></Label>
                <Input value={form.first_name} onChange={(e) => setField("first_name", e.target.value)}
                  placeholder="Jane" data-testid="input-first-name" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("lastName")} <span className="text-red-500">*</span></Label>
                <Input value={form.last_name} onChange={(e) => setField("last_name", e.target.value)}
                  placeholder="Smith" data-testid="input-last-name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("company")}</Label>
                <Input value={form.company_name} onChange={(e) => setField("company_name", e.target.value)}
                  placeholder="Smith Properties LLC" data-testid="input-company-name" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("sourceColumn")}</Label>
                <select value={form.source} onChange={(e) => setField("source", e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="select-source">
                  <option value="">{t("selectSource")}</option>
                  {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Phone Numbers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("phoneNumbers")}</h3>
              <Button type="button" variant="outline" size="sm" onClick={addPhone}>
                <Plus className="h-3.5 w-3.5 mr-1" /> {t("addPhone")}
              </Button>
            </div>
            {form.phones.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input className="flex-1" placeholder="(555) 000-0000" value={p.phone}
                  onChange={(e) => updatePhone(i, "phone", e.target.value)} data-testid={`input-phone-${i}`} />
                <select value={p.phone_type} onChange={(e) => updatePhone(i, "phone_type", e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {PHONE_TYPES.map((pt) => <option key={pt}>{pt}</option>)}
                </select>
                <button type="button" title={t("setAsPrimary")}
                  onClick={() => setForm((f) => ({ ...f, phones: setPrimary(f.phones, i) }))}
                  className={`p-2 rounded-md transition-colors ${p.is_primary ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-400"}`}>
                  <Star className={`h-4 w-4 ${p.is_primary ? "fill-yellow-400" : ""}`} />
                </button>
                {form.phones.length > 1 && (
                  <button type="button" onClick={() => removePhone(i)} className="p-2 text-muted-foreground hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{t("phonePrimaryHint")}</p>
          </div>

          {/* Email Addresses */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("emailAddresses")}</h3>
              <Button type="button" variant="outline" size="sm" onClick={addEmail}>
                <Plus className="h-3.5 w-3.5 mr-1" /> {t("addEmail")}
              </Button>
            </div>
            {form.emails.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input className="flex-1" type="email" placeholder="jane@example.com" value={e.email}
                  onChange={(ev) => updateEmail(i, "email", ev.target.value)} data-testid={`input-email-${i}`} />
                <select value={e.email_type} onChange={(ev) => updateEmail(i, "email_type", ev.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {EMAIL_TYPES.map((et) => <option key={et}>{et}</option>)}
                </select>
                <button type="button" title={t("setAsPrimary")}
                  onClick={() => setForm((f) => ({ ...f, emails: setPrimary(f.emails, i) }))}
                  className={`p-2 rounded-md transition-colors ${e.is_primary ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-400"}`}>
                  <Star className={`h-4 w-4 ${e.is_primary ? "fill-yellow-400" : ""}`} />
                </button>
                {form.emails.length > 1 && (
                  <button type="button" onClick={() => removeEmail(i)} className="p-2 text-muted-foreground hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{t("emailPrimaryHint")}</p>
          </div>

          {/* Billing Address */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("billingAddress")}</h3>
            <Input placeholder={t("streetAddressPlaceholder")} value={form.billing_address}
              onChange={(e) => setField("billing_address", e.target.value)} data-testid="input-billing-address" />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1 space-y-1.5">
                <Label>{t("city")}</Label>
                <Input placeholder="Springfield" value={form.billing_city}
                  onChange={(e) => setField("billing_city", e.target.value)} data-testid="input-billing-city" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("state")}</Label>
                <Input placeholder="MA" value={form.billing_state}
                  onChange={(e) => setField("billing_state", e.target.value)} data-testid="input-billing-state" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("zip")}</Label>
                <Input placeholder="01001" value={form.billing_zip}
                  onChange={(e) => setField("billing_zip", e.target.value)} data-testid="input-billing-zip" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>{t("notes")}</Label>
            <RichTextEditor
              value={form.notes}
              onChange={(html) => setField("notes", html)}
              placeholder={t("customerNotesPlaceholder")}
              minHeight="120px"
              data-testid="textarea-notes"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>{t("cancel")}</Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white"
              disabled={isSaving} data-testid="button-save-customer">
              {isSaving ? t("saving") : editing ? t("saveChanges") : t("addCustomer")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
