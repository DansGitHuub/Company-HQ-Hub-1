import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  HelpCircle, 
  Home, 
  FileText, 
  Package, 
  Users, 
  Briefcase, 
  ClipboardList,
  ChevronRight,
  ChevronLeft,
  Play,
  BookOpen,
  MessageSquare,
  Shield,
  ArrowRight,
  Eye,
  EyeOff,
  Leaf,
  Wrench,
  Phone,
  Calendar,
  Star,
  Settings,
  Search,
  ArrowLeft
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  minRole: string;
  isPublished: boolean;
}

type WalkthroughStep = {
  title: string;
  description: string;
  icon: React.ReactNode;
  tips: string[];
  path?: string;
};

const adminWalkthrough: WalkthroughStep[] = [
  {
    title: "Dashboard",
    description: "Your home base shows quick access tiles to all major features. Each tile takes you directly to that section. The dashboard gives you a bird's-eye view of your entire operation.",
    icon: <Home className="h-8 w-8" />,
    path: "/",
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
    path: "/sops",
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
    path: "/materials",
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
    path: "/hiring",
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
    path: "/jobs",
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
    path: "/admin",
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
    path: "/customer",
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
    path: "/customer",
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
    path: "/customer",
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
    path: "/customer",
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

const customerFAQs = [
  {
    question: "How do I contact the team?",
    answer: "Go to your Customer Portal and click 'New Message'. You can send us questions, feedback, or discuss your projects. We'll respond as quickly as possible."
  },
  {
    question: "How do I request a service?",
    answer: "In your Customer Portal, click 'New Work Request'. Describe what you need, select a service type (like Lawn Maintenance or Landscape Design), and set the urgency level. We'll review it and get back to you."
  },
  {
    question: "Where can I find care guides for my landscaping?",
    answer: "Visit the Customer Hub from the sidebar. You'll find care guides, instructions, and helpful documents about maintaining your lawn, plants, irrigation, and more."
  },
  {
    question: "How do I save helpful resources?",
    answer: "When viewing any resource in the Customer Hub, click the bookmark icon to save it to your personal 'Saved' tab for quick access later."
  },
  {
    question: "How do I check the status of my request?",
    answer: "In your Customer Portal, you can see all your work requests and their current status. We'll also send updates when there are changes."
  },
  {
    question: "How do I update my contact information?",
    answer: "Click on 'Profile' in the sidebar to update your name, email, phone number, and other details."
  }
];

const staffFAQs = [
  {
    question: "How do I change my password?",
    answer: "Go to your Profile page by clicking your name in the sidebar. From there you can update your password and other account settings."
  },
  {
    question: "How do I request different access?",
    answer: "If you're a Customer, look for the 'Account Access' card at the bottom of your portal. Click 'Request Upgrade' and select the access level you need. An admin will review your request."
  },
  {
    question: "Who can create new SOPs?",
    answer: "Any team member (Crew, Manager, or Admin) can create and edit SOPs. This helps everyone contribute to building your company's knowledge base."
  },
  {
    question: "How do work requests work?",
    answer: "Customers can submit work requests through their portal. These requests appear in the Admin Inbox where managers and admins can review them, update status, and convert them to jobs."
  },
  {
    question: "What are the different user roles?",
    answer: "Customer: Access to customer portal for messaging and work requests. Crew: Access to SOPs, materials, hiring, and jobs. Manager: All crew features plus customer inbox access. Admin: Full access including user management and settings."
  }
];

function RolePreviewPanel() {
  const { user, previewRole, setPreviewRole, effectiveRole } = useAuth();
  const [open, setOpen] = useState(false);
  const isAdmin = user?.role === "Admin";
  
  if (!isAdmin) return null;
  
  const roles = ["Admin", "Manager", "Crew", "Customer"] as const;
  
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button 
            variant={previewRole ? "default" : "outline"} 
            className="gap-2"
            data-testid="button-test-software"
          >
            {previewRole ? <Eye className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
            {previewRole ? `Viewing as ${previewRole}` : "Test My Software"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Test My Software
            </DialogTitle>
            <DialogDescription>
              Preview the app as different access levels to see what each role sees. This only changes your view, not your actual permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              {roles.map(role => (
                <Button
                  key={role}
                  variant={effectiveRole === role ? "default" : "outline"}
                  className="h-16 flex-col gap-1"
                  onClick={() => {
                    setPreviewRole(role === user?.role ? null : role);
                    if (role !== user?.role) setOpen(false);
                  }}
                >
                  {role === "Admin" && <Shield className="h-5 w-5" />}
                  {role === "Manager" && <Users className="h-5 w-5" />}
                  {role === "Crew" && <Wrench className="h-5 w-5" />}
                  {role === "Customer" && <Star className="h-5 w-5" />}
                  <span>{role}</span>
                  {role === user?.role && <Badge variant="secondary" className="text-xs">Your Role</Badge>}
                </Button>
              ))}
            </div>
            {previewRole && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <strong>Preview Mode Active:</strong> You're viewing the app as a {previewRole}. Click your actual role ({user?.role}) to return to normal view.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            {previewRole && (
              <Button variant="outline" onClick={() => { setPreviewRole(null); setOpen(false); }}>
                <EyeOff className="h-4 w-4 mr-2" /> Exit Preview Mode
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Help() {
  const { user, effectiveRole, previewRole } = useAuth();
  const isActualAdmin = user?.role === "Admin";
  const isCustomer = effectiveRole === "Customer";
  
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground flex items-center gap-3">
            <HelpCircle className="h-8 w-8 text-primary" />
            {isCustomer ? "Customer Help" : "Help Center"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isCustomer ? "Everything you need to know as a valued customer" : "Learn how to use Company HQ effectively"}
          </p>
        </div>
        {isActualAdmin && <RolePreviewPanel />}
      </div>

      {previewRole && (
        <div className="bg-amber-100 border border-amber-300 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-amber-600" />
            <span className="font-medium text-amber-800">
              Preview Mode: Viewing as {previewRole}
            </span>
          </div>
          <Badge variant="outline" className="text-amber-700 border-amber-400">Test Mode</Badge>
        </div>
      )}

      <Card className="bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1">
              <h2 className="text-2xl font-heading font-bold mb-2">
                {isCustomer ? "Welcome to Your Customer Portal" : "New Here?"}
              </h2>
              <p className="text-muted-foreground mb-4">
                {isCustomer 
                  ? "Learn how to communicate with our team, request services, and access helpful resources for your landscaping."
                  : "Take a quick walkthrough to learn the basics of Company HQ. We'll show you where everything is and how to get started."}
              </p>
              <WalkthroughDialog 
                steps={isCustomer ? customerWalkthrough : adminWalkthrough} 
                triggerText={isCustomer ? "Take the Tour" : "Start Walkthrough"} 
              />
            </div>
            <div className="p-6 bg-background rounded-xl shadow-sm">
              {isCustomer ? <Leaf className="h-16 w-16 text-primary/50" /> : <BookOpen className="h-16 w-16 text-primary/50" />}
            </div>
          </div>
        </CardContent>
      </Card>

      {isCustomer ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <MessageSquare className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Send a Message</h3>
                    <p className="text-sm text-muted-foreground">
                      Questions? Reach out anytime through your portal.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <Calendar className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Request Service</h3>
                    <p className="text-sm text-muted-foreground">
                      Need work done? Submit a request and we'll follow up.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <Leaf className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Care Guides</h3>
                    <p className="text-sm text-muted-foreground">
                      Find tips for maintaining your beautiful landscape.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {customerFAQs.map((faq, i) => (
                <Card key={i}>
                  <CardHeader>
                    <CardTitle className="text-base">{faq.question}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{faq.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Need More Help?</h3>
                  <p className="text-sm text-muted-foreground">
                    If you can't find what you're looking for, send us a message through your Customer Portal. We're here to help!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <HelpCircle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Quick Tip: Info Icons</h3>
                  <p className="text-sm text-muted-foreground">
                    Hover over any menu item in the sidebar to see an info icon. Click it for a quick description and tips about that feature.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Common Questions</h2>
            <div className="space-y-4">
              {staffFAQs.map((faq, i) => (
                <Card key={i}>
                  <CardHeader>
                    <CardTitle className="text-base">{faq.question}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{faq.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
      
      <HelpArticlesSection />
    </div>
  );
}

function HelpArticlesSection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  
  const { data: articles = [] } = useQuery<HelpArticle[]>({
    queryKey: ["/api/help/articles"],
  });
  
  const { data: searchResults = [] } = useQuery<HelpArticle[]>({
    queryKey: ["/api/help/articles/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await fetch(`/api/help/articles/search?q=${encodeURIComponent(searchQuery)}`);
      return res.json();
    },
    enabled: searchQuery.trim().length > 0,
  });
  
  const displayedArticles = searchQuery.trim() ? searchResults : articles;
  
  if (selectedArticle) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedArticle(null)}
          className="gap-2"
          data-testid="back-to-articles"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Articles
        </Button>
        
        <Card>
          <CardHeader>
            <CardTitle>{selectedArticle.title}</CardTitle>
            <CardDescription>{selectedArticle.summary}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
              {selectedArticle.content}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (articles.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Help Articles</h2>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="help-search-input"
          />
        </div>
      </div>
      
      {displayedArticles.length === 0 ? (
        <Card className="bg-muted/30">
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No articles found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {displayedArticles.map((article) => (
            <Card 
              key={article.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedArticle(article)}
              data-testid={`article-${article.id}`}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium">{article.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{article.summary}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
