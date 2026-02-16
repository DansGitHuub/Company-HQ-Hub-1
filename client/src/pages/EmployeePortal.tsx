import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Home, 
  CreditCard, 
  Stethoscope, 
  Plane, 
  FileCheck,
  Save,
  Shield,
  Calendar,
  Clock,
  DollarSign,
  Heart,
  Umbrella,
  CheckCircle2,
  AlertCircle,
  FileText
} from "lucide-react";

type Section = "profile" | "address" | "payroll" | "health" | "vacation";

export default function EmployeePortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<Section>("profile");

  const handleSave = () => {
    toast({
      title: "Changes Saved",
      description: "Your information has been updated successfully.",
    });
  };

  const handleDiscard = () => {
    toast({
      title: "Changes Discarded",
      description: "Your changes have been reverted.",
    });
  };

  const handleViewBenefitsGuide = () => {
    toast({
      title: "Benefits Guide",
      description: "Opening the company benefits guide...",
    });
  };

  const handleSubmitPTO = () => {
    toast({
      title: "PTO Request Submitted",
      description: "Your time off request has been sent to your manager for approval.",
    });
  };

  const navItems = [
    { id: "profile" as Section, icon: User, label: "Personal Profile" },
    { id: "address" as Section, icon: Home, label: "Address & Contact" },
    { id: "payroll" as Section, icon: CreditCard, label: "Payroll & Taxes" },
    { id: "health" as Section, icon: Stethoscope, label: "Health Insurance" },
    { id: "vacation" as Section, icon: Plane, label: "Vacation & Time Off" },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case "profile":
        return (
          <>
            <CardHeader className="border-b">
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your basic profile information.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" defaultValue={user?.name?.split(" ")[0] || ""} data-testid="input-first-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" defaultValue={user?.name?.split(" ").slice(1).join(" ") || ""} data-testid="input-last-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Work Email</Label>
                  <Input id="email" defaultValue={user?.email || ""} data-testid="input-email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" placeholder="(555) 123-4567" data-testid="input-phone" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" defaultValue="2024-01-15" data-testid="input-start-date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="select-department">
                    <option>Field Operations</option>
                    <option>Design Team</option>
                    <option>Sales</option>
                    <option>Administration</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 border-t space-y-4">
                <h3 className="font-heading font-bold text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" /> Emergency Contact
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Name</Label>
                    <Input placeholder="Jane Doe" data-testid="input-emergency-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Relationship</Label>
                    <Input placeholder="Spouse" data-testid="input-emergency-relationship" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input placeholder="(555) 987-6543" data-testid="input-emergency-phone" />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t flex justify-end gap-3">
                <Button variant="outline" onClick={handleDiscard}>Discard Changes</Button>
                <Button className="gap-2" onClick={handleSave} data-testid="button-save-profile"><Save className="w-4 h-4" /> Save Information</Button>
              </div>
            </CardContent>
          </>
        );

      case "address":
        return (
          <>
            <CardHeader className="border-b">
              <CardTitle>Address & Contact</CardTitle>
              <CardDescription>Keep your mailing address up to date for tax documents.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="street">Street Address</Label>
                  <Input id="street" placeholder="123 Landscape Way" data-testid="input-street" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apt">Apt / Suite / Unit</Label>
                  <Input id="apt" placeholder="Apt 4B" data-testid="input-apt" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" placeholder="Garden City" data-testid="input-city" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="select-state">
                      <option>Select State</option>
                      <option>CA</option>
                      <option>TX</option>
                      <option>FL</option>
                      <option>NY</option>
                      <option>PA</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input id="zip" placeholder="12345" data-testid="input-zip" />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t flex justify-end gap-3">
                <Button variant="outline" onClick={handleDiscard}>Discard Changes</Button>
                <Button className="gap-2" onClick={handleSave} data-testid="button-save-address"><Save className="w-4 h-4" /> Save Address</Button>
              </div>
            </CardContent>
          </>
        );

      case "payroll":
        return (
          <>
            <CardHeader className="border-b">
              <CardTitle>Payroll & Tax Settings</CardTitle>
              <CardDescription>Manage direct deposit and tax withholdings.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <h3 className="font-heading font-bold text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" /> Direct Deposit
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input placeholder="First National Bank" data-testid="input-bank-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="select-account-type">
                      <option>Checking</option>
                      <option>Savings</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Routing Number</Label>
                    <Input type="password" placeholder="•••••••••" data-testid="input-routing" />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input type="password" placeholder="•••••••••••••" data-testid="input-account" />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t space-y-4">
                <h3 className="font-heading font-bold text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" /> Tax Withholding (W-4)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Filing Status</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="select-filing-status">
                      <option>Single or Married filing separately</option>
                      <option>Married filing jointly</option>
                      <option>Head of household</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Number of Dependents</Label>
                    <Input type="number" defaultValue="0" min="0" data-testid="input-dependents" />
                  </div>
                  <div className="space-y-2">
                    <Label>Extra Withholding per Paycheck</Label>
                    <Input type="number" placeholder="$0.00" data-testid="input-extra-withholding" />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t flex justify-end gap-3">
                <Button variant="outline" onClick={handleDiscard}>Discard Changes</Button>
                <Button className="gap-2" onClick={handleSave} data-testid="button-save-payroll"><Save className="w-4 h-4" /> Save Payroll Settings</Button>
              </div>
            </CardContent>
          </>
        );

      case "health":
        return (
          <>
            <CardHeader className="border-b">
              <CardTitle>Health Insurance & Benefits</CardTitle>
              <CardDescription>View and manage your health insurance elections.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Heart className="w-6 h-6 text-green-600" />
                      <div>
                        <h4 className="font-bold">Medical Insurance</h4>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">Enrolled</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">Premium Health Plan - PPO</p>
                    <p className="text-xs text-muted-foreground mt-1">Coverage: Employee + Family</p>
                    <p className="text-sm font-medium mt-2">$185.00/paycheck</p>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Stethoscope className="w-6 h-6 text-blue-600" />
                      <div>
                        <h4 className="font-bold">Dental Insurance</h4>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">Enrolled</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">Dental Plus Plan</p>
                    <p className="text-xs text-muted-foreground mt-1">Coverage: Employee + Family</p>
                    <p className="text-sm font-medium mt-2">$35.00/paycheck</p>
                  </CardContent>
                </Card>

                <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Umbrella className="w-6 h-6 text-purple-600" />
                      <div>
                        <h4 className="font-bold">Vision Insurance</h4>
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800">Enrolled</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">Vision Care Basic</p>
                    <p className="text-xs text-muted-foreground mt-1">Coverage: Employee Only</p>
                    <p className="text-sm font-medium mt-2">$12.00/paycheck</p>
                  </CardContent>
                </Card>

                <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Shield className="w-6 h-6 text-orange-600" />
                      <div>
                        <h4 className="font-bold">Life Insurance</h4>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">Enrolled</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">Basic Life - 2x Salary</p>
                    <p className="text-xs text-muted-foreground mt-1">Beneficiary: Jane Doe</p>
                    <p className="text-sm font-medium mt-2">Company Paid</p>
                  </CardContent>
                </Card>
              </div>

              <div className="pt-6 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Open Enrollment Period</p>
                    <p className="font-medium">November 1 - November 30</p>
                  </div>
                  <Button variant="outline" onClick={handleViewBenefitsGuide}>View Benefits Guide</Button>
                </div>
              </div>
            </CardContent>
          </>
        );

      case "vacation":
        return (
          <>
            <CardHeader className="border-b">
              <CardTitle>Vacation & Time Off</CardTitle>
              <CardDescription>Track your PTO balances and request time off.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4 text-center">
                    <Calendar className="w-8 h-8 mx-auto text-primary mb-2" />
                    <p className="text-3xl font-bold text-primary">12</p>
                    <p className="text-sm text-muted-foreground">Vacation Days</p>
                    <p className="text-xs text-muted-foreground">Available</p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-500/5 border-amber-500/20">
                  <CardContent className="p-4 text-center">
                    <Clock className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                    <p className="text-3xl font-bold text-amber-600">5</p>
                    <p className="text-sm text-muted-foreground">Sick Days</p>
                    <p className="text-xs text-muted-foreground">Available</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-500/5 border-green-500/20">
                  <CardContent className="p-4 text-center">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-green-500 mb-2" />
                    <p className="text-3xl font-bold text-green-600">3</p>
                    <p className="text-sm text-muted-foreground">Personal Days</p>
                    <p className="text-xs text-muted-foreground">Available</p>
                  </CardContent>
                </Card>
              </div>

              <div className="pt-6 border-t space-y-4">
                <h3 className="font-heading font-bold text-lg">Request Time Off</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="select-pto-type">
                      <option>Vacation</option>
                      <option>Sick Leave</option>
                      <option>Personal Day</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" data-testid="input-pto-start" />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" data-testid="input-pto-end" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Input placeholder="Family vacation" data-testid="input-pto-notes" />
                </div>
                <Button onClick={handleSubmitPTO} data-testid="button-submit-pto">Submit Request</Button>
              </div>

              <div className="pt-6 border-t space-y-4">
                <h3 className="font-heading font-bold text-lg">Recent Requests</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="font-medium text-sm">Vacation - Dec 23-27, 2024</p>
                        <p className="text-xs text-muted-foreground">3 days</p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Approved</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                      <div>
                        <p className="font-medium text-sm">Personal Day - Jan 15, 2025</p>
                        <p className="text-xs text-muted-foreground">1 day</p>
                      </div>
                    </div>
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">Pending</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        );
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Employee Portal</h1>
          <p className="text-muted-foreground">Manage your personal information and benefits.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <Card className="lg:col-span-1 h-fit">
          <nav className="p-2 space-y-1">
            {navItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                className={`w-full justify-start gap-3 ${activeSection === item.id ? 'bg-secondary' : ''}`}
                onClick={() => setActiveSection(item.id)}
                data-testid={`nav-${item.id}`}
              >
                <item.icon className="w-4 h-4" /> {item.label}
              </Button>
            ))}
          </nav>
        </Card>

        <Card className="lg:col-span-3">
          {renderSection()}
        </Card>
      </div>
    </div>
  );
}
