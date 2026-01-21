import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  HelpCircle, 
  Home, 
  FileText, 
  Package, 
  Users, 
  Briefcase, 
  Megaphone,
  ClipboardList,
  Settings,
  ChevronRight,
  ChevronLeft,
  Play,
  BookOpen,
  MessageSquare,
  Shield,
  ArrowRight
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type WalkthroughStep = {
  title: string;
  description: string;
  icon: React.ReactNode;
  tips: string[];
};

const adminWalkthrough: WalkthroughStep[] = [
  {
    title: "Dashboard Overview",
    description: "Your home base shows quick access tiles to all major features. Each tile takes you directly to that section. The dashboard gives you a bird's-eye view of your entire operation.",
    icon: <Home className="h-8 w-8" />,
    tips: [
      "Click any tile to navigate to that section",
      "The dashboard adapts based on your role",
      "Use the sidebar for quick navigation anytime"
    ]
  },
  {
    title: "SOP Library",
    description: "Store and organize your Standard Operating Procedures. Create step-by-step guides for any process - from equipment operation to customer service protocols.",
    icon: <FileText className="h-8 w-8" />,
    tips: [
      "Organize SOPs by category (Safety, Equipment, Customer Service)",
      "Add detailed steps with descriptions",
      "Team members can reference SOPs anytime"
    ]
  },
  {
    title: "Materials Catalog",
    description: "Track your inventory of materials, equipment, and supplies. Monitor stock levels, pricing, and supplier information all in one place.",
    icon: <Package className="h-8 w-8" />,
    tips: [
      "Set minimum stock levels for alerts",
      "Track costs and pricing for estimates",
      "Categorize materials for easy searching"
    ]
  },
  {
    title: "Hiring Pipeline",
    description: "Manage your recruitment process from application to hire. Drag candidates through stages as they progress.",
    icon: <Users className="h-8 w-8" />,
    tips: [
      "Drag and drop candidates between stages",
      "Add notes and track interview progress",
      "View candidate history and documents"
    ]
  },
  {
    title: "Job Tracking",
    description: "Monitor all your projects from lead to completion. Track status, assign crews, and manage timelines.",
    icon: <Briefcase className="h-8 w-8" />,
    tips: [
      "Create jobs from customer requests",
      "Assign team members to jobs",
      "Track progress through stages"
    ]
  },
  {
    title: "Admin Panel",
    description: "Manage users, review access requests, and configure system settings. Only admins can access this area.",
    icon: <Shield className="h-8 w-8" />,
    tips: [
      "Create and manage user accounts",
      "Review and approve access requests",
      "Only master admin can grant Admin role"
    ]
  }
];

const customerWalkthrough: WalkthroughStep[] = [
  {
    title: "Your Customer Portal",
    description: "Welcome to your dedicated customer area! Here you can communicate with our team and request services.",
    icon: <Home className="h-8 w-8" />,
    tips: [
      "View all your messages and requests in one place",
      "Track the status of your service requests",
      "Request account upgrades if you're a team member"
    ]
  },
  {
    title: "Send Messages",
    description: "Communicate directly with our team. Ask questions, provide feedback, or discuss your projects.",
    icon: <MessageSquare className="h-8 w-8" />,
    tips: [
      "Click 'New Message' to start a conversation",
      "Track message status (sent, read, replied)",
      "Get notified when we respond"
    ]
  },
  {
    title: "Work Requests",
    description: "Request landscaping services easily. Describe what you need and we'll get back to you.",
    icon: <ClipboardList className="h-8 w-8" />,
    tips: [
      "Choose from service types like Lawn Maintenance or Landscape Design",
      "Set urgency level for your request",
      "Add property address and preferred dates"
    ]
  },
  {
    title: "Account Access",
    description: "If you're a team member, request upgraded access to see operational features.",
    icon: <Shield className="h-8 w-8" />,
    tips: [
      "Request Crew, Manager, or Admin access",
      "Provide a reason for your request",
      "An admin will review and approve"
    ]
  }
];

function WalkthroughDialog({ steps, triggerText }: { steps: WalkthroughStep[]; triggerText: string }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [open, setOpen] = useState(false);
  
  const step = steps[currentStep];
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-start-walkthrough">
          <Play className="h-4 w-4" /> {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline">{currentStep + 1} / {steps.length}</Badge>
            {step.title}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-4 bg-primary/10 rounded-xl text-primary">
              {step.icon}
            </div>
            <div className="flex-1">
              <p className="text-muted-foreground mb-4">{step.description}</p>
              <div className="space-y-2">
                <p className="font-medium text-sm">Tips:</p>
                <ul className="space-y-1">
                  {step.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" /> Previous
            </Button>
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            {currentStep < steps.length - 1 ? (
              <Button onClick={() => setCurrentStep(currentStep + 1)}>
                Next <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={() => { setOpen(false); setCurrentStep(0); }}>
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Help() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin" || user?.role === "Manager";
  const isCustomer = user?.role === "Customer";
  
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground flex items-center gap-3">
          <HelpCircle className="h-8 w-8 text-primary" />
          Help Center
        </h1>
        <p className="text-muted-foreground mt-2">Learn how to use Company HQ effectively</p>
      </div>

      <Card className="bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1">
              <h2 className="text-2xl font-heading font-bold mb-2">New Here?</h2>
              <p className="text-muted-foreground mb-4">
                Take a quick walkthrough to learn the basics of Company HQ. We'll show you where everything is and how to get started.
              </p>
              <WalkthroughDialog 
                steps={isCustomer ? customerWalkthrough : adminWalkthrough} 
                triggerText="Start Walkthrough" 
              />
            </div>
            <div className="p-6 bg-background rounded-xl shadow-sm">
              <BookOpen className="h-16 w-16 text-primary/50" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="features" className="w-full">
        <TabsList>
          <TabsTrigger value="features">Features Guide</TabsTrigger>
          <TabsTrigger value="faq">Common Questions</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(isCustomer ? customerWalkthrough : adminWalkthrough).map((item, i) => (
              <Card key={i} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      {item.icon}
                    </div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-3">{item.description}</CardDescription>
                  <ul className="space-y-1">
                    {item.tips.slice(0, 2).map((tip, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <ChevronRight className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="faq" className="mt-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">How do I change my password?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Go to your Profile page by clicking your name in the sidebar. From there you can update your password and other account settings.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">How do I request different access?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  If you're a Customer, look for the "Account Access" card at the bottom of your portal. Click "Request Upgrade" and select the access level you need. An admin will review your request.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Who can create new SOPs?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Any team member (Crew, Manager, or Admin) can create and edit SOPs. This helps everyone contribute to building your company's knowledge base.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">How do work requests work?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Customers can submit work requests through their portal. These requests appear in the Admin Inbox where managers and admins can review them, update status, and convert them to jobs.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">What are the different user roles?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  <strong>Customer:</strong> Access to customer portal for messaging and work requests.<br/>
                  <strong>Crew:</strong> Access to SOPs, materials, hiring, and jobs.<br/>
                  <strong>Manager:</strong> All crew features plus customer inbox access.<br/>
                  <strong>Admin:</strong> Full access including user management and settings.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
