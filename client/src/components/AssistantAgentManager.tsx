import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bot, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ALL_ROLES = ["Admin", "Master Admin", "Manager", "Crew Lead", "Crew", "New Hire", "HR", "Sales"];

export default function AssistantAgentManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: agents = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/assistant/agents"],
  });

  const { data: allTools = [] } = useQuery<string[]>({
    queryKey: ["/api/assistant/tools"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/assistant/agents", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/agents"] });
      setShowCreateDialog(false);
      toast({ title: "Agent created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/assistant/agents/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/agents"] });
      setEditingAgent(null);
      toast({ title: "Agent updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/assistant/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/agents"] });
      toast({ title: "Agent deleted" });
    },
  });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" /> Assistant Agents
            </CardTitle>
            <CardDescription>Configure AI assistant agents with custom prompts and tool access</CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="create-agent-btn"><Plus className="h-4 w-4 mr-1" /> New Agent</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create New Agent</DialogTitle></DialogHeader>
              <AgentForm allTools={allTools} onSubmit={(data: any) => createMutation.mutate(data)} isPending={createMutation.isPending} />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          {agents.map((agent: any) => (
            <div key={agent.id} className="border rounded-lg p-4 space-y-3" data-testid={`agent-card-${agent.id}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bot className="h-5 w-5 text-primary" />
                  <div>
                    <h4 className="font-medium">{agent.agent_name}</h4>
                    <p className="text-xs text-muted-foreground">Key: {agent.agent_key}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={agent.is_enabled ? "default" : "secondary"}>
                    {agent.is_enabled ? "Active" : "Disabled"}
                  </Badge>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingAgent(agent)} data-testid={`edit-agent-${agent.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {agent.agent_key !== "main" && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(agent.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {(agent.allowed_roles && agent.allowed_roles.length > 0)
                  ? agent.allowed_roles.map((r: string) => <Badge key={r} variant="outline" className="text-xs">{r}</Badge>)
                  : <Badge variant="outline" className="text-xs">All Roles</Badge>
                }
              </div>
              {agent.system_prompt_addition && (
                <p className="text-xs text-muted-foreground line-clamp-2">{agent.system_prompt_addition}</p>
              )}
              {agent.enabled_tools && agent.enabled_tools.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {agent.enabled_tools.map((t: string) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!editingAgent} onOpenChange={(open) => !open && setEditingAgent(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Agent: {editingAgent?.agent_name}</DialogTitle></DialogHeader>
          {editingAgent && (
            <AgentForm
              allTools={allTools}
              initialData={editingAgent}
              onSubmit={(data: any) => updateMutation.mutate({ id: editingAgent.id, ...data })}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgentForm({ allTools, initialData, onSubmit, isPending }: { allTools: string[]; initialData?: any; onSubmit: (data: any) => void; isPending: boolean }) {
  const [name, setName] = useState(initialData?.agent_name || "");
  const [key, setKey] = useState(initialData?.agent_key || "");
  const [promptAddition, setPromptAddition] = useState(initialData?.system_prompt_addition || "");
  const [enabledTools, setEnabledTools] = useState<string[]>(initialData?.enabled_tools || []);
  const [isEnabled, setIsEnabled] = useState(initialData?.is_enabled !== false);
  const [allowedRoles, setAllowedRoles] = useState<string[]>(initialData?.allowed_roles || []);

  const toggleTool = (tool: string) => {
    setEnabledTools((prev) => prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]);
  };

  const toggleRole = (role: string) => {
    setAllowedRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      agentName: name,
      agentKey: key,
      systemPromptAddition: promptAddition,
      enabledTools,
      isEnabled,
      allowedRoles,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Agent Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required data-testid="agent-name-input" />
      </div>
      {!initialData && (
        <div className="space-y-2">
          <Label>Agent Key (unique slug)</Label>
          <Input value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} required data-testid="agent-key-input" />
        </div>
      )}
      <div className="space-y-2">
        <Label>System Prompt Addition</Label>
        <Textarea value={promptAddition} onChange={(e) => setPromptAddition(e.target.value)} rows={4} placeholder="Additional instructions appended to the base system prompt..." data-testid="agent-prompt-input" />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={isEnabled} onCheckedChange={setIsEnabled} data-testid="agent-enabled-toggle" />
        <Label>Enabled</Label>
      </div>
      <div className="space-y-2">
        <Label>Allowed Roles (empty = all)</Label>
        <div className="flex flex-wrap gap-2">
          {ALL_ROLES.map((role) => (
            <Badge
              key={role}
              variant={allowedRoles.includes(role) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleRole(role)}
            >
              {role}
            </Badge>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Enabled Tools (empty = all)</Label>
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
          {allTools.map((tool) => (
            <Badge
              key={tool}
              variant={enabledTools.includes(tool) ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => toggleTool(tool)}
            >
              {tool}
            </Badge>
          ))}
        </div>
      </div>
      <Button type="submit" disabled={isPending || !name} className="w-full" data-testid="save-agent-btn">
        {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {initialData ? "Save Changes" : "Create Agent"}
      </Button>
    </form>
  );
}
