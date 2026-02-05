import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  Edit,
  FileQuestion,
  Hammer,
  Lightbulb,
  ListTodo,
  Loader2,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  XCircle
} from "lucide-react";

interface DevelopmentItem {
  id: string;
  featureName: string;
  category: string;
  status: string;
  priority: string;
  percentComplete: number;
  description?: string;
  currentState?: string;
  remainingWork?: string;
  blockers?: string;
  suggestions?: string;
  additionalInfo?: string;
  lastUpdated: string;
  updatedBy?: string;
  createdAt: string;
}

const CATEGORIES = [
  { value: "core", label: "Core Feature" },
  { value: "integration", label: "Integration" },
  { value: "ui", label: "UI/UX" },
  { value: "backend", label: "Backend" },
  { value: "automation", label: "Automation" },
  { value: "api", label: "API" },
  { value: "other", label: "Other" }
];

const STATUSES = [
  { value: "not_started", label: "Not Started", icon: Clock, color: "bg-gray-500" },
  { value: "in_progress", label: "In Progress", icon: Hammer, color: "bg-blue-500" },
  { value: "blocked", label: "Blocked", icon: XCircle, color: "bg-red-500" },
  { value: "needs_review", label: "Needs Review", icon: FileQuestion, color: "bg-yellow-500" },
  { value: "completed", label: "Completed", icon: CheckCircle2, color: "bg-green-500" }
];

const PRIORITIES = [
  { value: "critical", label: "Critical", color: "bg-red-500" },
  { value: "high", label: "High", color: "bg-orange-500" },
  { value: "medium", label: "Medium", color: "bg-yellow-500" },
  { value: "low", label: "Low", color: "bg-gray-500" }
];

function getStatusBadge(status: string) {
  const statusConfig = STATUSES.find(s => s.value === status) || STATUSES[0];
  return (
    <Badge className={`${statusConfig.color} hover:${statusConfig.color}`}>
      {statusConfig.label}
    </Badge>
  );
}

function getPriorityBadge(priority: string) {
  const priorityConfig = PRIORITIES.find(p => p.value === priority) || PRIORITIES[2];
  return (
    <Badge variant="outline" className="border-2" style={{ borderColor: priorityConfig.color.replace("bg-", "var(--") }}>
      {priorityConfig.label}
    </Badge>
  );
}

function getCategoryLabel(category: string) {
  const cat = CATEGORIES.find(c => c.value === category);
  return cat?.label || category;
}

function parseJsonArray(jsonStr?: string): string[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return jsonStr.split("\n").filter(s => s.trim());
  }
}

function ItemCard({ item, onEdit, onDelete }: { item: DevelopmentItem; onEdit: () => void; onDelete: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const remainingWork = parseJsonArray(item.remainingWork);
  const blockers = parseJsonArray(item.blockers);
  const suggestions = parseJsonArray(item.suggestions);

  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <div>
                  <CardTitle className="text-lg" data-testid={`text-feature-name-${item.id}`}>
                    {item.featureName}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Code2 className="h-3 w-3" />
                    {getCategoryLabel(item.category)}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getPriorityBadge(item.priority)}
                {getStatusBadge(item.status)}
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{item.percentComplete}%</span>
              </div>
              <Progress value={item.percentComplete} className="h-2" />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {item.description && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Description</h4>
                <p className="text-sm">{item.description}</p>
              </div>
            )}

            {item.currentState && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> What's Already Built
                </h4>
                <p className="text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">{item.currentState}</p>
              </div>
            )}

            {remainingWork.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center gap-1">
                  <ListTodo className="h-3 w-3" /> Remaining Work
                </h4>
                <ul className="space-y-1">
                  {remainingWork.map((work, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {work}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {blockers.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" /> Blockers
                </h4>
                <ul className="space-y-1">
                  {blockers.map((blocker, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded">
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      {blocker}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {suggestions.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3 text-yellow-500" /> Suggestions & Alternatives
                </h4>
                <ul className="space-y-1">
                  {suggestions.map((suggestion, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                      <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {item.additionalInfo && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Settings className="h-3 w-3" /> Additional Setup Info
                </h4>
                <p className="text-sm bg-muted p-3 rounded-lg">{item.additionalInfo}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(item.lastUpdated).toLocaleString()}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onEdit} data-testid={`button-edit-${item.id}`}>
                  <Edit className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={onDelete} data-testid={`button-delete-${item.id}`}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function ItemForm({ 
  item, 
  onSubmit, 
  onCancel, 
  isSubmitting 
}: { 
  item?: DevelopmentItem; 
  onSubmit: (data: any) => void; 
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState({
    featureName: item?.featureName || "",
    category: item?.category || "core",
    status: item?.status || "in_progress",
    priority: item?.priority || "medium",
    percentComplete: item?.percentComplete || 0,
    description: item?.description || "",
    currentState: item?.currentState || "",
    remainingWork: item?.remainingWork ? parseJsonArray(item.remainingWork).join("\n") : "",
    blockers: item?.blockers ? parseJsonArray(item.blockers).join("\n") : "",
    suggestions: item?.suggestions ? parseJsonArray(item.suggestions).join("\n") : "",
    additionalInfo: item?.additionalInfo || ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      remainingWork: formData.remainingWork ? JSON.stringify(formData.remainingWork.split("\n").filter(s => s.trim())) : null,
      blockers: formData.blockers ? JSON.stringify(formData.blockers.split("\n").filter(s => s.trim())) : null,
      suggestions: formData.suggestions ? JSON.stringify(formData.suggestions.split("\n").filter(s => s.trim())) : null
    };
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="featureName">Feature Name *</Label>
          <Input
            id="featureName"
            value={formData.featureName}
            onChange={(e) => setFormData({ ...formData, featureName: e.target.value })}
            placeholder="e.g., Google Calendar Integration"
            required
            data-testid="input-feature-name"
          />
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
            <SelectTrigger data-testid="select-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
            <SelectTrigger data-testid="select-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
            <SelectTrigger data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="percentComplete">Progress ({formData.percentComplete}%)</Label>
          <Input
            id="percentComplete"
            type="range"
            min="0"
            max="100"
            step="5"
            value={formData.percentComplete}
            onChange={(e) => setFormData({ ...formData, percentComplete: parseInt(e.target.value) })}
            className="cursor-pointer"
            data-testid="input-percent-complete"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="What this feature does..."
          rows={2}
          data-testid="input-description"
        />
      </div>

      <div>
        <Label htmlFor="currentState">What's Already Built</Label>
        <Textarea
          id="currentState"
          value={formData.currentState}
          onChange={(e) => setFormData({ ...formData, currentState: e.target.value })}
          placeholder="Describe what's already implemented..."
          rows={2}
          data-testid="input-current-state"
        />
      </div>

      <div>
        <Label htmlFor="remainingWork">Remaining Work (one item per line)</Label>
        <Textarea
          id="remainingWork"
          value={formData.remainingWork}
          onChange={(e) => setFormData({ ...formData, remainingWork: e.target.value })}
          placeholder="Set up OAuth credentials
Connect API endpoints
Build UI for calendar display"
          rows={3}
          data-testid="input-remaining-work"
        />
      </div>

      <div>
        <Label htmlFor="blockers">Blockers (one item per line)</Label>
        <Textarea
          id="blockers"
          value={formData.blockers}
          onChange={(e) => setFormData({ ...formData, blockers: e.target.value })}
          placeholder="Needs Google Cloud project setup
API credentials required"
          rows={2}
          data-testid="input-blockers"
        />
      </div>

      <div>
        <Label htmlFor="suggestions">Suggestions & Alternatives (one per line)</Label>
        <Textarea
          id="suggestions"
          value={formData.suggestions}
          onChange={(e) => setFormData({ ...formData, suggestions: e.target.value })}
          placeholder="Consider using a calendar service like Cal.com
Could implement manual calendar entry as fallback"
          rows={2}
          data-testid="input-suggestions"
        />
      </div>

      <div>
        <Label htmlFor="additionalInfo">Additional Setup Info</Label>
        <Textarea
          id="additionalInfo"
          value={formData.additionalInfo}
          onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
          placeholder="API keys needed, setup steps, documentation links..."
          rows={2}
          data-testid="input-additional-info"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} data-testid="button-submit">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {item ? "Save Changes" : "Add Item"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function DevelopmentTracker() {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<DevelopmentItem | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data: items = [], isLoading, refetch } = useQuery<DevelopmentItem[]>({
    queryKey: ["/api/development-tracker"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterCategory !== "all") params.set("category", filterCategory);
      const res = await fetch(`/api/development-tracker?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/development-tracker", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/development-tracker"] });
      setIsAddOpen(false);
      toast({ title: "Item added successfully" });
    },
    onError: () => {
      toast({ title: "Error adding item", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/development-tracker/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/development-tracker"] });
      setIsEditOpen(false);
      setEditingItem(null);
      toast({ title: "Item updated successfully" });
    },
    onError: () => {
      toast({ title: "Error updating item", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/development-tracker/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/development-tracker"] });
      toast({ title: "Item deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error deleting item", variant: "destructive" });
    }
  });

  const incompleteCount = items.filter(i => i.status !== "completed").length;
  const blockedCount = items.filter(i => i.status === "blocked").length;
  const avgProgress = items.length > 0 
    ? Math.round(items.reduce((acc, i) => acc + i.percentComplete, 0) / items.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Hammer className="h-5 w-5" />
            Development Tracker
          </h3>
          <p className="text-sm text-muted-foreground">
            Track incomplete features and what still needs to be done
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-tracker">
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-item">
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Development Item</DialogTitle>
                <DialogDescription>
                  Track a new incomplete feature or system
                </DialogDescription>
              </DialogHeader>
              <ItemForm
                onSubmit={(data) => createMutation.mutate(data)}
                onCancel={() => setIsAddOpen(false)}
                isSubmitting={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-orange-500">{incompleteCount}</p>
            <p className="text-sm text-muted-foreground">Incomplete</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-red-500">{blockedCount}</p>
            <p className="text-sm text-muted-foreground">Blocked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-blue-500">{avgProgress}%</p>
            <p className="text-sm text-muted-foreground">Avg Progress</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <div className="w-48">
          <Label className="text-xs">Filter by Status</Label>
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); }}>
            <SelectTrigger data-testid="filter-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUSES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Label className="text-xs">Filter by Category</Label>
          <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); }}>
            <SelectTrigger data-testid="filter-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-medium">No Incomplete Features</p>
            <p className="text-muted-foreground">All tracked features are complete!</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          {items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              onEdit={() => {
                setEditingItem(item);
                setIsEditOpen(true);
              }}
              onDelete={() => {
                if (confirm("Are you sure you want to delete this item?")) {
                  deleteMutation.mutate(item.id);
                }
              }}
            />
          ))}
        </ScrollArea>
      )}

      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) setEditingItem(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Development Item</DialogTitle>
            <DialogDescription>
              Update the status and details of this feature
            </DialogDescription>
          </DialogHeader>
          {editingItem && (
            <ItemForm
              item={editingItem}
              onSubmit={(data) => updateMutation.mutate({ id: editingItem.id, data })}
              onCancel={() => {
                setIsEditOpen(false);
                setEditingItem(null);
              }}
              isSubmitting={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
