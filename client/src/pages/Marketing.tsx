import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, DollarSign, MousePointerClick, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Marketing() {
  const { t } = useTranslation();
  const { campaigns } = useApp();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignPlatform, setCampaignPlatform] = useState("Google Ads");
  const [campaignBudget, setCampaignBudget] = useState("");

  const data = campaigns.map(c => ({
    name: c.name,
    spend: c.spend,
    leads: c.leads
  }));

  const handleCreateCampaign = () => {
    if (!campaignName.trim()) {
      toast({
        title: "Campaign Name Required",
        description: "Please enter a name for your campaign.",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Campaign Created",
      description: `"${campaignName}" has been created and is ready to launch.`,
    });
    
    setCampaignName("");
    setCampaignPlatform("Google Ads");
    setCampaignBudget("");
    setDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">{t("marketing.commandCenter")}</h1>
        <p className="text-muted-foreground">{t("marketing.trackPerformance")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
           <CardContent className="pt-6">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm font-medium text-muted-foreground">{t("marketing.totalSpend")}</p>
                 <h2 className="text-3xl font-bold mt-1">$1,750</h2>
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
                 <h2 className="text-3xl font-bold mt-1">62</h2>
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
                 <h2 className="text-3xl font-bold mt-1">$28.22</h2>
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
                 <p className="text-sm font-medium text-muted-foreground">{t("marketing.conversionRate")}</p>
                 <h2 className="text-3xl font-bold mt-1">12.5%</h2>
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
                <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-semibold text-sm">{c.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px] h-5">{c.platform}</Badge>
                      <span className="text-xs text-muted-foreground">{c.status}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm">{t("marketing.leadsCount", { count: c.leads })}</div>
                    <div className="text-xs text-muted-foreground">${c.cpl.toFixed(2)} / {t("marketing.perLead")}</div>
                  </div>
                </div>
              ))}
              
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full gap-2" variant="outline">
                    <Plus className="w-4 h-4" />
                    {t("marketing.createCampaign")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("marketing.createNewCampaign")}</DialogTitle>
                    <DialogDescription>{t("marketing.createCampaignDesc")}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="campaign-name">{t("marketing.campaignName")}</Label>
                      <Input 
                        id="campaign-name"
                        placeholder={t("marketing.campaignPlaceholder")}
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="platform">{t("marketing.platform")}</Label>
                      <select 
                        id="platform"
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
                      <Label htmlFor="budget">{t("marketing.monthlyBudget")}</Label>
                      <Input 
                        id="budget"
                        type="number"
                        placeholder="500"
                        value={campaignBudget}
                        onChange={(e) => setCampaignBudget(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
                    <Button onClick={handleCreateCampaign}>{t("marketing.createCampaign")}</Button>
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
