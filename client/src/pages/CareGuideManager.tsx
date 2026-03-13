import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Eye, EyeOff, BookOpen, Search, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CareGuide } from "@shared/schema";

const CATEGORIES = [
  "Hardscape & Patios", "Plants & Landscape Beds", "Lawn Care",
  "Irrigation Systems", "Outdoor Living Features", "Seasonal Guides",
  "Troubleshooting", "Snow & Winter"
];

export default function CareGuideManager() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editingGuide, setEditingGuide] = useState<CareGuide | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [tab, setTab] = useState<"guides" | "customers">("guides");

  const { data: guides = [], isLoading } = useQuery<CareGuide[]>({
    queryKey: ["/api/care-guides"],
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["/api/customer-accounts"],
    queryFn: async () => (await apiRequest("GET", "/api/customer-accounts")).json(),
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/care-guides", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-guides"] });
      setShowEditor(false);
      setEditingGuide(null);
      toast({ title: "Guide created" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/care-guides/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-guides"] });
      setShowEditor(false);
      setEditingGuide(null);
      toast({ title: "Guide updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/care-guides/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-guides"] });
      toast({ title: "Guide deleted" });
    },
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      const res = await apiRequest("PATCH", `/api/care-guides/${id}`, { isPublished });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-guides"] });
    },
  });

  const filtered = guides.filter(g => {
    if (filterCategory !== "all" && g.category !== filterCategory) return false;
    if (search && !g.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const publishedCount = guides.filter(g => g.isPublished).length;

  return (
    <div className="space-y-4" data-testid="care-guide-manager">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold" data-testid="text-page-title">{t("careGuides.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("careGuides.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={tab === "guides" ? "default" : "outline"}
            onClick={() => setTab("guides")}
            data-testid="button-tab-guides"
          >
            <BookOpen className="h-4 w-4 mr-2" /> {t("careGuides.careGuides")}
          </Button>
          <Button
            variant={tab === "customers" ? "default" : "outline"}
            onClick={() => setTab("customers")}
            data-testid="button-tab-customers"
          >
            <Users className="h-4 w-4 mr-2" /> {t("nav.employees")}
          </Button>
        </div>
      </div>

      {tab === "guides" ? (
        <>
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search guides..."
                className="pl-9"
                data-testid="input-search-guides"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Badge variant="outline">{publishedCount} Published / {guides.length} Total</Badge>
            <Button onClick={() => { setEditingGuide(null); setShowEditor(true); }} className="ml-auto" data-testid="button-new-guide">
              <Plus className="h-4 w-4 mr-2" /> New Guide
            </Button>
          </div>

          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No guides found</CardContent></Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(guide => (
                <Card key={guide.id} className="flex flex-col" data-testid={`guide-card-${guide.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">{guide.category}</Badge>
                      <div className="flex items-center gap-2">
                        {guide.isPublished ? (
                          <Eye className="h-4 w-4 text-green-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        )}
                        <Switch
                          checked={guide.isPublished}
                          onCheckedChange={v => togglePublish.mutate({ id: guide.id, isPublished: v })}
                        />
                      </div>
                    </div>
                    <CardTitle className="text-sm mt-2">{guide.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    {guide.summary && <p className="text-xs text-muted-foreground line-clamp-2">{guide.summary}</p>}
                    {guide.tags && (guide.tags as string[]).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(guide.tags as string[]).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                  <div className="p-3 pt-0 flex gap-1">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditingGuide(guide); setShowEditor(true); }}>
                      <Edit className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => {
                      if (confirm("Delete this guide?")) deleteMutation.mutate(guide.id);
                    }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <CustomerAccountsTab customers={customers} />
      )}

      <GuideEditorDialog
        open={showEditor}
        guide={editingGuide}
        onClose={() => { setShowEditor(false); setEditingGuide(null); }}
        onSave={(data) => {
          if (editingGuide) {
            updateMutation.mutate({ id: editingGuide.id, ...data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

function GuideEditorDialog({ open, guide, onClose, onSave, isPending }: {
  open: boolean;
  guide: CareGuide | null;
  onClose: () => void;
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    title: guide?.title || "",
    category: guide?.category || "",
    content: guide?.content || "",
    summary: guide?.summary || "",
    pdfUrl: guide?.pdfUrl || "",
    tags: (guide?.tags as string[] || []).join(", "),
    isPublished: guide?.isPublished || false,
  });

  React.useEffect(() => {
    if (open) {
      setForm({
        title: guide?.title || "",
        category: guide?.category || "",
        content: guide?.content || "",
        summary: guide?.summary || "",
        pdfUrl: guide?.pdfUrl || "",
        tags: (guide?.tags as string[] || []).join(", "),
        isPublished: guide?.isPublished || false,
      });
    }
  }, [open, guide]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{guide ? "Edit Guide" : "New Care Guide"}</DialogTitle>
          <DialogDescription>Create helpful care guides for your customers.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="input-guide-title" />
          </div>
          <div>
            <Label>Category *</Label>
            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
              <SelectTrigger data-testid="select-guide-category"><SelectValue placeholder="Select category..." /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Summary</Label>
            <Input value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="Brief description..." />
          </div>
          <div>
            <Label>Content *</Label>
            <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={12} data-testid="input-guide-content" />
          </div>
          <div>
            <Label>Tags (comma separated)</Label>
            <Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="e.g. patio, cleaning, maintenance" />
          </div>
          <div>
            <Label>PDF URL (optional)</Label>
            <Input value={form.pdfUrl} onChange={e => setForm({ ...form, pdfUrl: e.target.value })} placeholder="https://..." />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.isPublished} onCheckedChange={v => setForm({ ...form, isPublished: v })} />
            <Label>Published (visible to customers)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave({
              ...form,
              tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
            })}
            disabled={!form.title || !form.category || !form.content || isPending}
            data-testid="button-save-guide"
          >
            {isPending ? "Saving..." : guide ? "Update Guide" : "Create Guide"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerAccountsTab({ customers }: { customers: any[] }) {
  const [search, setSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const inviteMutation = useMutation({
    mutationFn: async (data: { name: string; email: string }) => {
      const res = await apiRequest("POST", "/api/customer-accounts/invite", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-accounts"] });
      setShowInvite(false);
      toast({ title: "Customer invited" });
    },
  });

  const filtered = customers.filter((c: any) =>
    !search || `${c.name} ${c.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search customers..."
          className="max-w-sm"
          data-testid="input-search-customers"
        />
        <Button onClick={() => setShowInvite(true)} className="ml-auto" data-testid="button-invite-customer">
          <Plus className="h-4 w-4 mr-2" /> Invite Customer
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No customers found</CardContent></Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 text-sm font-medium">Name</th>
                <th className="text-left p-3 text-sm font-medium">Email</th>
                <th className="text-left p-3 text-sm font-medium">Jobs</th>
                <th className="text-left p-3 text-sm font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => (
                <tr key={c.id} className="border-t" data-testid={`row-customer-${c.id}`}>
                  <td className="p-3 text-sm font-medium">{c.name}</td>
                  <td className="p-3 text-sm text-muted-foreground">{c.email}</td>
                  <td className="p-3 text-sm">{c.jobCount}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={c.isActive ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"}>
                      {c.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Customer</DialogTitle>
            <DialogDescription>Create a customer portal account. They'll receive a welcome email with login instructions.</DialogDescription>
          </DialogHeader>
          <InviteCustomerForm onSubmit={(data) => inviteMutation.mutate(data)} isPending={inviteMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InviteCustomerForm({ onSubmit, isPending }: { onSubmit: (data: { name: string; email: string }) => void; isPending: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  return (
    <div className="space-y-3">
      <div>
        <Label>Full Name *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} data-testid="input-customer-name" />
      </div>
      <div>
        <Label>Email *</Label>
        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} data-testid="input-customer-email" />
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit({ name, email })} disabled={!name || !email || isPending} data-testid="button-send-invite">
          {isPending ? "Sending..." : "Send Invite"}
        </Button>
      </DialogFooter>
    </div>
  );
}
