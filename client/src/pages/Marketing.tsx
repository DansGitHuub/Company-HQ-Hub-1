import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, DollarSign, MousePointerClick, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Campaign } from "@shared/schema";

async function fetchCampaigns(): Promise<Campaign[]> {
  const res = await fetch("/api/campaigns", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch campaigns");
  return res.json();
}

export default function Marketing() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [campaignPlatform, setCampaignPlatform] = useState("Google Ads");
  const [campaignBudget, setCampaignBudget] = useState("");
  const [campaignSpend, setCampaignSpend] = useState("");
  const [campaignLeads, setCampaignLeads] = useState("");
  const [campaignStatus, setCampaignStatus] = useState("Active");

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: fetchCampaigns,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create campaign");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: t("marketing.campaignCreated"), description: t("marketing.campaignCreatedDesc") });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update campaign");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: t("marketing.campaignUpdated") });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete campaign");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: t("marketing.campaignDeleted") });
    },
  });

  const resetForm = () => {
    setCampaignName("");
    setCampaignPlatform("Google Ads");
    setCampaignBudget("");
    setCampaignSpend("");
    setCampaignLeads("");
    setCampaignStatus("Active");
    setEditingCampaign(null);
    setDialogOpen(false);
  };

  const openEditDialog = (c: Campaign) => {
    setEditingCampaign(c);
    setCampaignName(c.name);
    setCampaignPlatform(c.platform);
    setCampaignBudget(String(c.budget || ""));
    setCampaignSpend(String(c.spend || ""));
    setCampaignLeads(String(c.leads || ""));
    setCampaignStatus(c.status);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!campaignName.trim()) {
      toast({ title: t("marketing.nameRequired"), variant: "destructive" });
      return;
    }
    const spend = parseInt(campaignSpend) || 0;
    const leads = parseInt(campaignLeads) || 0;
    const cpl = leads > 0 ? Math.round(spend / leads) : 0;
    const payload = {
      name: campaignName.trim(),
      platform: campaignPlatform,
      status: campaignStatus,
      spend,
      leads,
      cpl,
      budget: parseInt(campaignBudget) || 0,
    };

    if (editingCampaign) {
      updateMutation.mutate({ id: editingCampaign.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
  const totalLeads = campaigns.reduce((sum, c) => sum + (c.leads || 0), 0);
  const avgCpl = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : "0.00";
  const activeCampaigns = campaigns.filter(c => c.status === "Active");

  const data = campaigns.map(c => ({
    name: c.name,
    spend: c.spend || 0,
    leads: c.leads || 0,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-campaigns">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground" data-testid="text-marketing-title">{t("marketing.commandCenter")}</h1>
        <p className="text-muted-foreground">{t("marketing.trackPerformance")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("marketing.totalSpend")}</p>
                <h2 className="text-3xl font-bold mt-1" data-testid="text-total-spend">${totalSpend.toLocaleString()}</h2>
              </div>
              <div className="p-3 bg-red-100 rounded-full text-red-600">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("marketing.totalLeads")}</p>
                <h2 className="text-3xl font-bold mt-1" data-testid="text-total-leads">{totalLeads}</h2>
              </div>
              <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("marketing.avgCpl")}</p>
                <h2 className="text-3xl font-bold mt-1" data-testid="text-avg-cpl">${avgCpl}</h2>
              </div>
              <div className="p-3 bg-green-100 rounded-full text-green-600">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("marketing.activeCampaigns")}</p>
                <h2 className="text-3xl font-bold mt-1" data-testid="text-active-count">{activeCampaigns.length}</h2>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full text-yellow-600">
                <MousePointerClick className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("marketing.campaignPerformance")}</CardTitle>
            <CardDescription>{t("marketing.spendVsLeads")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                    <Tooltip cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="spend" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={t("marketing.spend")} />
                    <Bar dataKey="leads" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} name={t("marketing.leads")} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {t("marketing.noCampaigns")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("marketing.activeCampaigns")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {campaigns.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`card-campaign-${c.id}`}>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-sm truncate">{c.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px] h-5">{c.platform}</Badge>
                      <Badge variant={c.status === "Active" ? "default" : "outline"} className="text-[10px] h-5">{c.status}</Badge>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <div className="font-bold text-sm">{t("marketing.leadsCount", { count: c.leads || 0 })}</div>
                      <div className="text-xs text-muted-foreground">
                        ${(c.leads && c.leads > 0 ? ((c.spend || 0) / c.leads).toFixed(2) : "0.00")} / {t("marketing.perLead")}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditDialog(c)} data-testid={`button-edit-campaign-${c.id}`}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(c.id)} data-testid={`button-delete-campaign-${c.id}`}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              
              <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setDialogOpen(true); }}>
                <DialogTrigger asChild>
                  <Button className="w-full gap-2" variant="outline" data-testid="button-create-campaign">
                    <Plus className="w-4 h-4" />
                    {t("marketing.createCampaign")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingCampaign ? t("marketing.editCampaign") : t("marketing.createNewCampaign")}</DialogTitle>
                    <DialogDescription>{editingCampaign ? t("marketing.editCampaignDesc") : t("marketing.createCampaignDesc")}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="campaign-name">{t("marketing.campaignName")}</Label>
                      <Input 
                        id="campaign-name"
                        data-testid="input-campaign-name"
                        placeholder={t("marketing.campaignPlaceholder")}
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="platform">{t("marketing.platform")}</Label>
                      <select 
                        id="platform"
                        data-testid="select-platform"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={campaignPlatform}
                        onChange={(e) => setCampaignPlatform(e.target.value)}
                      >
                        <option>Google Ads</option>
                        <option>Facebook</option>
                        <option>Instagram</option>
                        <option>LinkedIn</option>
                        <option>Direct Mail</option>
                        <option>Email</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">{t("marketing.status")}</Label>
                      <select
                        id="status"
                        data-testid="select-status"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={campaignStatus}
                        onChange={(e) => setCampaignStatus(e.target.value)}
                      >
                        <option value="Active">{t("marketing.statusActive")}</option>
                        <option value="Paused">{t("marketing.statusPaused")}</option>
                        <option value="Completed">{t("marketing.statusCompleted")}</option>
                        <option value="Draft">{t("marketing.statusDraft")}</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="budget">{t("marketing.monthlyBudget")}</Label>
                        <Input 
                          id="budget"
                          data-testid="input-budget"
                          type="number"
                          placeholder="500"
                          value={campaignBudget}
                          onChange={(e) => setCampaignBudget(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="spend">{t("marketing.spend")}</Label>
                        <Input 
                          id="spend"
                          data-testid="input-spend"
                          type="number"
                          placeholder="0"
                          value={campaignSpend}
                          onChange={(e) => setCampaignSpend(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="leads">{t("marketing.leads")}</Label>
                      <Input 
                        id="leads"
                        data-testid="input-leads"
                        type="number"
                        placeholder="0"
                        value={campaignLeads}
                        onChange={(e) => setCampaignLeads(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={resetForm}>{t("common.cancel")}</Button>
                    <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-campaign">
                      {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      {editingCampaign ? t("common.save") : t("marketing.createCampaign")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
