import React from "react";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, DollarSign, MousePointerClick } from "lucide-react";

export default function Marketing() {
  const { campaigns } = useApp();

  const data = campaigns.map(c => ({
    name: c.name,
    spend: c.spend,
    leads: c.leads
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Marketing Command Center</h1>
        <p className="text-muted-foreground">Track campaign performance and ROI</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
           <CardContent className="pt-6">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm font-medium text-muted-foreground">Total Spend</p>
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
                 <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
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
                 <p className="text-sm font-medium text-muted-foreground">Avg CPL</p>
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
                 <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
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
            <CardTitle>Campaign Performance</CardTitle>
            <CardDescription>Spend vs Leads generated per campaign</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="spend" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Spend" />
                  <Bar dataKey="leads" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} name="Leads" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Campaigns</CardTitle>
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
                    <div className="font-bold text-sm">{c.leads} Leads</div>
                    <div className="text-xs text-muted-foreground">${c.cpl.toFixed(2)} / lead</div>
                  </div>
                </div>
              ))}
              <Button className="w-full" variant="outline">Create Campaign</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
