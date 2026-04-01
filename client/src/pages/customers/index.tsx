import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Users, X, Star, Pencil } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  source: string | null;
  created_at: string;
  primary_phone: string | null;
  primary_email: string | null;
}

interface PhoneEntry { phone: string; phone_type: string; is_primary: boolean; }
interface EmailEntry { email: string; email_type: string; is_primary: boolean; }

interface CustomerFormData {
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

const EMPTY_FORM: CustomerFormData = {
  first_name: "", last_name: "", company_name: "", source: "",
  billing_address: "", billing_city: "", billing_state: "", billing_zip: "",
  notes: "",
  phones: [{ phone: "", phone_type: "Mobile", is_primary: true }],
  emails: [{ email: "", email_type: "Work", is_primary: true }],
};

const PHONE_TYPES = ["Mobile", "Home", "Work", "Other"];
const EMAIL_TYPES = ["Work", "Personal", "Other"];
const SOURCE_OPTIONS = ["Referral", "Google", "Website", "Facebook", "Instagram", "Door Hanger", "Yard Sign", "Repeat", "Other"];

function setPrimary<T extends { is_primary: boolean }>(list: T[], index: number): T[] {
  return list.map((item, i) => ({ ...item, is_primary: i === index }));
}

interface CustomerFormModalProps {
  open: boolean;
  onClose: () => void;
  editing: Customer | null;
  initialData?: CustomerFormData;
}

function CustomerFormModal({ open, onClose, editing, initialData }: CustomerFormModalProps) {
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
      toast({ title: "Customer added successfully" });
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
      toast({ title: "Customer updated successfully" });
      onClose();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast({ title: "First name and last name are required", variant: "destructive" });
      return;
    }
    editing ? updateMutation.mutate(form) : createMutation.mutate(form);
  };

  const addPhone = () =>
    setForm((f) => ({ ...f, phones: [...f.phones, { phone: "", phone_type: "Mobile", is_primary: false }] }));

  const removePhone = (i: number) =>
    setForm((f) => ({ ...f, phones: f.phones.filter((_, idx) => idx !== i) }));

  const updatePhone = (i: number, field: keyof PhoneEntry, value: string | boolean) =>
    setForm((f) => {
      const phones = f.phones.map((p, idx) => idx === i ? { ...p, [field]: value } : p);
      return { ...f, phones };
    });

  const addEmail = () =>
    setForm((f) => ({ ...f, emails: [...f.emails, { email: "", email_type: "Work", is_primary: false }] }));

  const removeEmail = (i: number) =>
    setForm((f) => ({ ...f, emails: f.emails.filter((_, idx) => idx !== i) }));

  const updateEmail = (i: number, field: keyof EmailEntry, value: string | boolean) =>
    setForm((f) => {
      const emails = f.emails.map((e, idx) => idx === i ? { ...e, [field]: value } : e);
      return { ...f, emails };
    });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>First Name <span className="text-red-500">*</span></Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setField("first_name", e.target.value)}
                  placeholder="Jane"
                  data-testid="input-first-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name <span className="text-red-500">*</span></Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setField("last_name", e.target.value)}
                  placeholder="Smith"
                  data-testid="input-last-name"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Input
                  value={form.company_name}
                  onChange={(e) => setField("company_name", e.target.value)}
                  placeholder="Smith Properties LLC"
                  data-testid="input-company-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <select
                  value={form.source}
                  onChange={(e) => setField("source", e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="select-source"
                >
                  <option value="">Select source…</option>
                  {SOURCE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Phone Numbers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Phone Numbers
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={addPhone}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Phone
              </Button>
            </div>
            {form.phones.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="(555) 000-0000"
                  value={p.phone}
                  onChange={(e) => updatePhone(i, "phone", e.target.value)}
                  data-testid={`input-phone-${i}`}
                />
                <select
                  value={p.phone_type}
                  onChange={(e) => updatePhone(i, "phone_type", e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {PHONE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                <button
                  type="button"
                  title="Set as primary"
                  onClick={() => setForm((f) => ({ ...f, phones: setPrimary(f.phones, i) }))}
                  className={`p-2 rounded-md transition-colors ${p.is_primary ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-400"}`}
                >
                  <Star className={`h-4 w-4 ${p.is_primary ? "fill-yellow-400" : ""}`} />
                </button>
                {form.phones.length > 1 && (
                  <button type="button" onClick={() => removePhone(i)} className="p-2 text-muted-foreground hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Click ★ to mark a number as primary.</p>
          </div>

          {/* Email Addresses */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Email Addresses
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={addEmail}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Email
              </Button>
            </div>
            {form.emails.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  type="email"
                  placeholder="jane@example.com"
                  value={e.email}
                  onChange={(ev) => updateEmail(i, "email", ev.target.value)}
                  data-testid={`input-email-${i}`}
                />
                <select
                  value={e.email_type}
                  onChange={(ev) => updateEmail(i, "email_type", ev.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {EMAIL_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                <button
                  type="button"
                  title="Set as primary"
                  onClick={() => setForm((f) => ({ ...f, emails: setPrimary(f.emails, i) }))}
                  className={`p-2 rounded-md transition-colors ${e.is_primary ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-400"}`}
                >
                  <Star className={`h-4 w-4 ${e.is_primary ? "fill-yellow-400" : ""}`} />
                </button>
                {form.emails.length > 1 && (
                  <button type="button" onClick={() => removeEmail(i)} className="p-2 text-muted-foreground hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Click ★ to mark an address as primary.</p>
          </div>

          {/* Billing Address */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Billing Address
            </h3>
            <Input
              placeholder="Street address"
              value={form.billing_address}
              onChange={(e) => setField("billing_address", e.target.value)}
              data-testid="input-billing-address"
            />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1 space-y-1.5">
                <Label>City</Label>
                <Input
                  placeholder="Springfield"
                  value={form.billing_city}
                  onChange={(e) => setField("billing_city", e.target.value)}
                  data-testid="input-billing-city"
                />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input
                  placeholder="MA"
                  value={form.billing_state}
                  onChange={(e) => setField("billing_state", e.target.value)}
                  data-testid="input-billing-state"
                />
              </div>
              <div className="space-y-1.5">
                <Label>ZIP</Label>
                <Input
                  placeholder="01001"
                  value={form.billing_zip}
                  onChange={(e) => setField("billing_zip", e.target.value)}
                  data-testid="input-billing-zip"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              placeholder="Any additional notes about this customer…"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={3}
              data-testid="textarea-notes"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={isSaving}
              data-testid="button-save-customer"
            >
              {isSaving ? "Saving…" : editing ? "Save Changes" : "Add Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CustomerList() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [, setLocation] = useLocation();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/customers");
      return res.json();
    },
  });

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.company_name?.toLowerCase().includes(q) ?? false) ||
      (c.primary_phone?.includes(q) ?? false) ||
      (c.primary_email?.toLowerCase().includes(q) ?? false) ||
      (c.source?.toLowerCase().includes(q) ?? false)
    );
  });

  const openAdd = () => { setEditingCustomer(null); setShowForm(true); };
  const openEdit = (e: React.MouseEvent, c: Customer) => {
    e.stopPropagation();
    setEditingCustomer(c);
    setShowForm(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {customers.length} customer{customers.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={openAdd}
          data-testid="button-add-customer"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-customers"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Loading customers...
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Users className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                No customers yet. Add your first customer.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              No customers match your search.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer hover:bg-muted/50"
                    data-testid={`row-customer-${customer.id}`}
                    onClick={() => setLocation(`/customers/${customer.id}`)}
                  >
                    <TableCell className="font-medium">
                      {customer.first_name} {customer.last_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.company_name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.primary_phone || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.primary_email || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.source || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(customer.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={(e) => openEdit(e, customer)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        data-testid={`button-edit-customer-${customer.id}`}
                        title="Edit customer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CustomerFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        editing={editingCustomer}
      />
    </div>
  );
}
