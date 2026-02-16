import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Puzzle,
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Settings,
  Play,
  RefreshCw,
  Zap,
  ArrowRight,
  Clock,
  DollarSign,
  Sparkles,
  Link2,
  Database,
  Users,
  FileText,
  Calendar,
  CreditCard,
  Mail,
  BarChart3,
  Building2,
  Package,
  MoreHorizontal,
} from "lucide-react";
import type { SoftwareIntegration, ConfiguredIntegration, IntegrationCapability, IntegrationResearchSession } from "@shared/schema";

const categoryIcons: Record<string, any> = {
  crm: Users,
  accounting: FileText,
  scheduling: Calendar,
  communication: Mail,
  payments: CreditCard,
  marketing: BarChart3,
  hr: Building2,
  inventory: Package,
  other: MoreHorizontal,
};

export default function IntegrationWizard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("discover");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSoftware, setSelectedSoftware] = useState<SoftwareIntegration | null>(null);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [researchSessionId, setResearchSessionId] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState(1);

  const { data: categories = [] } = useQuery<{ id: string; name: string; description: string }[]>({
    queryKey: ["/api/integration-categories"],
  });

  const { data: softwareIntegrations = [], refetch: refetchSoftware } = useQuery<SoftwareIntegration[]>({
    queryKey: ["/api/software-integrations", selectedCategory],
    queryFn: async () => {
      const url = selectedCategory 
        ? `/api/software-integrations?category=${selectedCategory}` 
        : "/api/software-integrations";
      return apiRequest("GET", url).then(r => r.json());
    },
  });

  const { data: configuredIntegrations = [], refetch: refetchConfigured } = useQuery<ConfiguredIntegration[]>({
    queryKey: ["/api/configured-integrations"],
  });

  const { data: researchSession, refetch: refetchResearch } = useQuery<IntegrationResearchSession>({
    queryKey: ["/api/integration-research", researchSessionId],
    queryFn: async () => {
      if (!researchSessionId) return null;
      return apiRequest("GET", `/api/integration-research/${researchSessionId}`).then(r => r.json());
    },
    enabled: !!researchSessionId,
    refetchInterval: researchSessionId ? 2000 : false,
  });

  useEffect(() => {
    if (researchSession?.status === "completed" && researchSessionId) {
      setResearchSessionId(null);
      refetchSoftware();
      toast({ title: "Research Complete", description: `Found capabilities for ${researchSession.softwareName}` });
    } else if (researchSession?.status === "failed" && researchSessionId) {
      setResearchSessionId(null);
      toast({ title: "Research Failed", description: "Could not research this software", variant: "destructive" });
    }
  }, [researchSession, researchSessionId, toast, refetchSoftware]);

  const researchMutation = useMutation({
    mutationFn: async ({ softwareName, category }: { softwareName: string; category?: string }) => {
      const res = await apiRequest("POST", "/api/integration-research", { softwareName, category });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.alreadyExists) {
        setSelectedSoftware(data.software);
        setShowSetupDialog(true);
        toast({ title: "Software Found", description: `${data.software.name} is already in our database` });
      } else {
        setResearchSessionId(data.sessionId);
        toast({ title: "Researching...", description: `AI is analyzing ${searchQuery}` });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start research", variant: "destructive" });
    },
  });

  const createConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/configured-integrations", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Integration Added", description: "You can now configure the connection" });
      setShowSetupDialog(false);
      setSelectedSoftware(null);
      setSetupStep(1);
      refetchConfigured();
      setActiveTab("active");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add integration", variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const res = await apiRequest("POST", `/api/configured-integrations/${integrationId}/test`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Test Started", description: "Running connection test..." });
      setTimeout(() => refetchConfigured(), 3000);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start test", variant: "destructive" });
    },
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    researchMutation.mutate({ softwareName: searchQuery, category: selectedCategory });
  };

  const handleSelectSoftware = (software: SoftwareIntegration) => {
    setSelectedSoftware(software);
    setShowSetupDialog(true);
    setSetupStep(1);
  };

  const handleAddIntegration = () => {
    if (!selectedSoftware) return;
    createConfigMutation.mutate({
      softwareId: selectedSoftware.id,
      name: selectedSoftware.name,
      status: "configuring",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
      case "error":
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
      case "configuring":
        return <Badge className="bg-yellow-100 text-yellow-800"><Settings className="h-3 w-3 mr-1" />Configuring</Badge>;
      case "testing":
        return <Badge className="bg-blue-100 text-blue-800"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Testing</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const filteredSoftware = softwareIntegrations.filter(s => 
    !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Puzzle className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Integration Wizard</h1>
            <p className="text-muted-foreground">
              Connect your business software with AI-powered setup
            </p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1">
          <Sparkles className="h-3 w-3" />
          AI-Powered
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="discover" data-testid="tab-discover">
            <Search className="h-4 w-4 mr-2" />
            Discover
          </TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active">
            <Link2 className="h-4 w-4 mr-2" />
            Active ({configuredIntegrations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discover" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Find Software to Integrate
              </CardTitle>
              <CardDescription>
                Search for any business software - AI will research its capabilities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="Enter software name (e.g., SynkedUp, QuickBooks, ServiceTitan...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    data-testid="input-search-software"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px]" data-testid="select-category">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleSearch} 
                  disabled={!searchQuery.trim() || researchMutation.isPending || !!researchSessionId}
                  data-testid="button-search"
                >
                  {researchMutation.isPending || researchSessionId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span className="ml-2">Research</span>
                </Button>
              </div>

              {researchSessionId && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <div>
                    <p className="font-medium text-sm">AI is researching {searchQuery}...</p>
                    <p className="text-xs text-muted-foreground">Discovering API capabilities and setup requirements</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
            {categories.map((cat) => {
              const Icon = categoryIcons[cat.id] || MoreHorizontal;
              const isSelected = selectedCategory === cat.id;
              return (
                <Button
                  key={cat.id}
                  variant={isSelected ? "default" : "outline"}
                  className="h-auto py-3 flex flex-col gap-1"
                  onClick={() => setSelectedCategory(isSelected ? "" : cat.id)}
                  data-testid={`category-${cat.id}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{cat.name}</span>
                </Button>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                {selectedCategory 
                  ? `${categories.find(c => c.id === selectedCategory)?.name || ""} Software`
                  : "Available Integrations"
                }
              </CardTitle>
              <CardDescription>
                {filteredSoftware.length} software options available
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredSoftware.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No software found. Use the search above to research new software.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSoftware.map((software) => (
                    <Card 
                      key={software.id} 
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => handleSelectSoftware(software)}
                      data-testid={`software-card-${software.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="h-10 w-10 bg-muted rounded-lg flex items-center justify-center">
                              <Puzzle className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium">{software.name}</p>
                              <Badge variant="outline" className="text-xs">{software.category}</Badge>
                            </div>
                          </div>
                          {software.isPopular && (
                            <Badge className="bg-purple-100 text-purple-800 text-xs">Popular</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {software.description || "Click to view capabilities"}
                        </p>
                        {software.aiResearchedAt && (
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            AI-analyzed {new Date(software.aiResearchedAt).toLocaleDateString()}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Active Integrations
              </CardTitle>
              <CardDescription>
                Your connected software and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {configuredIntegrations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Puzzle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No integrations configured yet.</p>
                  <Button 
                    variant="link" 
                    onClick={() => setActiveTab("discover")}
                    className="mt-2"
                  >
                    Discover software to integrate
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {configuredIntegrations.map((integration) => (
                    <div 
                      key={integration.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`integration-${integration.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center">
                          <Puzzle className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{integration.name}</p>
                            {getStatusBadge(integration.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {integration.lastSyncAt 
                              ? `Last synced: ${new Date(integration.lastSyncAt).toLocaleString()}`
                              : "Not synced yet"
                            }
                          </p>
                          {integration.lastTestMessage && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {integration.lastTestMessage}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => testMutation.mutate(integration.id)}
                          disabled={testMutation.isPending}
                          data-testid={`test-integration-${integration.id}`}
                        >
                          {testMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                          <span className="ml-1">Test</span>
                        </Button>
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4" />
                          <span className="ml-1">Configure</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Puzzle className="h-5 w-5" />
              Set Up {selectedSoftware?.name}
            </DialogTitle>
            <DialogDescription>
              AI-guided integration setup
            </DialogDescription>
          </DialogHeader>
          
          {selectedSoftware && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-sm">
                <div className={`flex items-center gap-1 ${setupStep >= 1 ? "text-primary" : "text-muted-foreground"}`}>
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${setupStep >= 1 ? "bg-primary text-white" : "bg-muted"}`}>1</div>
                  <span>Overview</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className={`flex items-center gap-1 ${setupStep >= 2 ? "text-primary" : "text-muted-foreground"}`}>
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${setupStep >= 2 ? "bg-primary text-white" : "bg-muted"}`}>2</div>
                  <span>Capabilities</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className={`flex items-center gap-1 ${setupStep >= 3 ? "text-primary" : "text-muted-foreground"}`}>
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${setupStep >= 3 ? "bg-primary text-white" : "bg-muted"}`}>3</div>
                  <span>Connect</span>
                </div>
              </div>

              {setupStep === 1 && (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="font-medium">{selectedSoftware.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{selectedSoftware.description}</p>
                    <div className="flex gap-2 mt-3">
                      <Badge variant="outline">{selectedSoftware.category}</Badge>
                      <Badge variant="outline">Auth: {selectedSoftware.authType}</Badge>
                    </div>
                  </div>
                  
                  {selectedSoftware.websiteUrl && (
                    <a 
                      href={selectedSoftware.websiteUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Visit {selectedSoftware.name} website
                    </a>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowSetupDialog(false)}>Cancel</Button>
                    <Button onClick={() => setSetupStep(2)}>
                      View Capabilities
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {setupStep === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Based on AI research, here's what you can do with {selectedSoftware.name}:
                  </p>
                  
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-3">
                      {(selectedSoftware.capabilitiesJson as any[] || []).map((cap: any, idx: number) => (
                        <div key={idx} className="p-3 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            <p className="font-medium text-sm">{cap.name}</p>
                            <Badge variant="outline" className="text-xs">{cap.capabilityType}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{cap.description}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {cap.direction === "inbound" ? "← Import" : cap.direction === "outbound" ? "→ Export" : "↔ Sync"}
                            </Badge>
                            {cap.dataType && (
                              <Badge variant="secondary" className="text-xs">{cap.dataType}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      {(selectedSoftware.capabilitiesJson as any[] || []).length === 0 && (
                        <p className="text-center text-muted-foreground py-4">
                          Capabilities will be discovered after connection
                        </p>
                      )}
                    </div>
                  </ScrollArea>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setSetupStep(1)}>Back</Button>
                    <Button onClick={() => setSetupStep(3)}>
                      Continue to Setup
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {setupStep === 3 && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <p className="font-medium text-sm">Setup Instructions</p>
                    </div>
                    <ScrollArea className="h-[150px]">
                      <div className="space-y-3">
                        {(selectedSoftware.setupInstructionsJson as any[] || []).map((step: any, idx: number) => (
                          <div key={idx} className="flex gap-3">
                            <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs flex-shrink-0">
                              {step.step}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{step.title}</p>
                              <p className="text-xs text-muted-foreground">{step.description}</p>
                            </div>
                          </div>
                        ))}
                        {(selectedSoftware.setupInstructionsJson as any[] || []).length === 0 && (
                          <div className="space-y-3">
                            <div className="flex gap-3">
                              <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs flex-shrink-0">1</div>
                              <div>
                                <p className="font-medium text-sm">Get API Credentials</p>
                                <p className="text-xs text-muted-foreground">Log in to {selectedSoftware.name} and find your API key or credentials</p>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs flex-shrink-0">2</div>
                              <div>
                                <p className="font-medium text-sm">Add Integration</p>
                                <p className="text-xs text-muted-foreground">Click the button below to add this integration</p>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs flex-shrink-0">3</div>
                              <div>
                                <p className="font-medium text-sm">Configure & Test</p>
                                <p className="text-xs text-muted-foreground">Enter your credentials and run a connection test</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setSetupStep(2)}>Back</Button>
                    <Button 
                      onClick={handleAddIntegration}
                      disabled={createConfigMutation.isPending}
                      data-testid="button-add-integration"
                    >
                      {createConfigMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Add Integration
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
