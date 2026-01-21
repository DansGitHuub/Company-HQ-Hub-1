import React, { useState } from "react";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Home, 
  CreditCard, 
  Stethoscope, 
  Plane, 
  FileCheck,
  Save,
  Shield
} from "lucide-react";

export default function EmployeePortal() {
  const { currentUser } = useApp();

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Employee Portal</h1>
          <p className="text-muted-foreground">Manage your personal information and benefits.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <Card className="lg:col-span-1 h-fit">
          <nav className="p-2 space-y-1">
            <Button variant="ghost" className="w-full justify-start gap-3 bg-secondary">
              <User className="w-4 h-4" /> Personal Profile
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3">
              <Home className="w-4 h-4" /> Address & Contact
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3">
              <CreditCard className="w-4 h-4" /> Payroll & Taxes
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3">
              <Stethoscope className="w-4 h-4" /> Health Insurance
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3">
              <Plane className="w-4 h-4" /> Vacation & Time Off
            </Button>
          </nav>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="border-b">
             <CardTitle>Personal Information</CardTitle>
             <CardDescription>Update your contact details and tax settings.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" defaultValue={currentUser?.name.split(" ")[0]} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" defaultValue={currentUser?.name.split(" ")[1]} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">Work Email</Label>
                  <Input id="email" defaultValue={`${currentUser?.name.toLowerCase().replace(" ", ".")}@companyhq.com`} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Home Address</Label>
                  <Input id="address" placeholder="123 Landscape Way, Garden City, ST 12345" />
                </div>
             </div>

             <div className="pt-6 border-t space-y-4">
                <h3 className="font-heading font-bold text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" /> Tax Withholding (W-4)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label>Filing Status</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option>Single or Married filing separately</option>
                        <option>Married filing jointly</option>
                        <option>Head of household</option>
                      </select>
                   </div>
                   <div className="space-y-2">
                      <Label>Extra Withholding</Label>
                      <Input type="number" placeholder="$0.00" />
                   </div>
                </div>
             </div>

             <div className="pt-6 border-t flex justify-end gap-3">
                <Button variant="outline">Discard Changes</Button>
                <Button className="gap-2"><Save className="w-4 h-4" /> Save Information</Button>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
