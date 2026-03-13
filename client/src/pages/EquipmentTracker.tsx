import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Plus, Wrench, Truck, AlertTriangle, ChevronRight, Trash2, Edit2,
  Upload, FileText, Clock, CheckCircle2, AlertCircle, Search,
  MapPin, Calendar, Shield, Eye, Download, ArrowLeft, Camera,
  Star, Activity, BarChart3, Settings, X, Loader2, CircleDot,
  ChevronDown, Send, Ban, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Equipment, MaintenanceSchedule, MaintenanceLog, EquipmentUpload, RepairRequest } from "@shared/schema";
import DocumentsPanel from "@/components/DocumentsPanel";

const CATEGORIES = ["Mower", "Tractor", "Truck", "Trailer", "Handheld", "Attachment", "Other"];
const STATUSES = ["Active", "In Service", "Stored", "Retired", "Sold"];
const TRACKING_TYPES = ["hours", "miles", "season"];
const DOC_FOLDERS = ["manuals", "purchase", "warranty", "registration", "insurance", "receipts", "photos", "other"];

type View = "dashboard" | "asset-detail";

export default function EquipmentTracker() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<View>("dashboard");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const openAsset = (id: string) => {
    setSelectedAssetId(id);
    setView("asset-detail");
  };

  return (
    <div className="space-y-4" data-testid="equipment-tracker">
      {view === "dashboard" ? (
        <FleetDashboard
          onOpenAsset={openAsset}
          onAddNew={() => setAddDialogOpen(true)}
          filterPriority={filterPriority}
          setFilterPriority={setFilterPriority}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          search={search}
          setSearch={setSearch}
        />
      ) : selectedAssetId ? (
        <AssetProfile
          assetId={selectedAssetId}
          onBack={() => { setView("dashboard"); setSelectedAssetId(null); }}
        />
      ) : null}

      <AddEquipmentWizard open={addDialogOpen} onClose={() => setAddDialogOpen(false)} />
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { label: string; className: string }> = {
    p1: { label: "P1 - Critical", className: "bg-red-100 text-red-800 border-red-300" },
    p2: { label: "P2 - Due Soon", className: "bg-orange-100 text-orange-800 border-orange-300" },
    p3: { label: "P3 - Approaching", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    p4: { label: "P4 - Good", className: "bg-green-100 text-green-800 border-green-300" },
  };
  const c = config[priority] || config.p4;
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

function HealthDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    p1: "bg-red-500",
    p2: "bg-orange-500",
    p3: "bg-yellow-500",
    p4: "bg-green-500",
  };
  return <div className={`h-3 w-3 rounded-full ${colors[priority] || colors.p4}`} />;
}

function FleetDashboard({
  onOpenAsset, onAddNew, filterPriority, setFilterPriority,
  filterCategory, setFilterCategory, filterStatus, setFilterStatus,
  search, setSearch,
}: {
  onOpenAsset: (id: string) => void;
  onAddNew: () => void;
  filterPriority: string | null;
  setFilterPriority: (v: string | null) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/fleet/dashboard"],
    queryFn: async () => (await apiRequest("GET", "/api/fleet/dashboard")).json(),
  });

  const { data: assets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/fleet/assets"],
    queryFn: async () => (await apiRequest("GET", "/api/fleet/assets")).json(),
  });

  const [showHoursDialog, setShowHoursDialog] = useState<string | null>(null);
  const [showServiceDialog, setShowServiceDialog] = useState<string | null>(null);
  const [showRepairDialog, setShowRepairDialog] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = assets.filter(a => {
    if (filterPriority && a.healthPriority !== filterPriority) return false;
    if (filterCategory !== "all" && a.category !== filterCategory) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (search && !`${a.name} ${a.assetId} ${a.make} ${a.model} ${a.nickname}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortField === "name") return a.name.localeCompare(b.name) * dir;
    if (sortField === "category") return (a.category || "").localeCompare(b.category || "") * dir;
    if (sortField === "status") return a.status.localeCompare(b.status) * dir;
    if (sortField === "priority") {
      const order = { p1: 0, p2: 1, p3: 2, p4: 3 } as Record<string, number>;
      return ((order[a.healthPriority] ?? 3) - (order[b.healthPriority] ?? 3)) * dir;
    }
    return 0;
  });

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const tiles = [
    { label: t("equipment.totalAssets"), value: stats?.total ?? 0, icon: Truck, color: "text-blue-600", bg: "bg-blue-50", filter: null },
    { label: t("equipment.p1Critical"), value: stats?.p1 ?? 0, icon: AlertCircle, color: "text-red-600", bg: "bg-red-50", filter: "p1" },
    { label: t("equipment.p2DueSoon"), value: stats?.p2 ?? 0, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50", filter: "p2" },
    { label: t("equipment.p3Approaching"), value: stats?.p3 ?? 0, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50", filter: "p3" },
    { label: t("equipment.inRepair"), value: stats?.inRepair ?? 0, icon: Wrench, color: "text-purple-600", bg: "bg-purple-50", filter: "repair" },
    { label: t("equipment.compliance"), value: stats?.complianceAlerts ?? 0, icon: Shield, color: "text-pink-600", bg: "bg-pink-50", filter: null },
  ];

  return (
    <div className="space-y-4" data-testid="fleet-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold" data-testid="text-page-title">{t("equipment.fleetManagement")}</h1>
          <p className="text-muted-foreground">{t("equipment.fleetDesc")}</p>
        </div>
        <Button onClick={onAddNew} data-testid="button-add-equipment">
          <Plus className="h-4 w-4 mr-2" /> {t("equipment.addEquipment")}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map(tile => {
          const Icon = tile.icon;
          const isActive = filterPriority === tile.filter;
          return (
            <Card
              key={tile.label}
              className={`cursor-pointer transition-all hover:shadow-md ${isActive ? "ring-2 ring-primary" : ""}`}
              onClick={() => {
                if (tile.filter === "repair") {
                  setFilterStatus("In Service");
                  setFilterPriority(null);
                } else {
                  setFilterPriority(isActive ? null : tile.filter);
                  setFilterStatus("all");
                }
              }}
              data-testid={`tile-${tile.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <CardContent className="p-3 text-center">
                <div className={`h-8 w-8 rounded-lg mx-auto mb-1 flex items-center justify-center ${tile.bg}`}>
                  <Icon className={`h-4 w-4 ${tile.color}`} />
                </div>
                <p className="text-2xl font-bold">{tile.value}</p>
                <p className="text-xs text-muted-foreground">{tile.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search equipment..." className="pl-9" data-testid="input-search-equipment" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {(filterPriority || filterCategory !== "all" || filterStatus !== "all" || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterPriority(null); setFilterCategory("all"); setFilterStatus("all"); setSearch(""); }}>
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded" />)}</div>
      ) : sorted.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No equipment found</CardContent></Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left text-xs font-medium cursor-pointer" onClick={() => toggleSort("name")}>
                  Asset {sortField === "name" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-3 text-left text-xs font-medium cursor-pointer hidden md:table-cell" onClick={() => toggleSort("category")}>
                  Category {sortField === "category" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-3 text-left text-xs font-medium hidden lg:table-cell">Assigned To</th>
                <th className="p-3 text-left text-xs font-medium cursor-pointer" onClick={() => toggleSort("status")}>
                  Status {sortField === "status" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-3 text-left text-xs font-medium cursor-pointer" onClick={() => toggleSort("priority")}>
                  Health {sortField === "priority" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-3 text-left text-xs font-medium hidden md:table-cell">Next Service</th>
                <th className="p-3 text-left text-xs font-medium hidden lg:table-cell">Hours/Miles</th>
                <th className="p-3 text-right text-xs font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(asset => (
                <tr key={asset.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => onOpenAsset(asset.id)} data-testid={`row-asset-${asset.id}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium text-sm">{asset.nickname || asset.name}</p>
                        <p className="text-xs text-muted-foreground">{asset.assetId} · {[asset.year, asset.make, asset.model].filter(Boolean).join(" ")}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-sm hidden md:table-cell">{asset.category}</td>
                  <td className="p-3 text-sm hidden lg:table-cell text-muted-foreground">{asset.assignedToName || "—"}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={asset.status === "Active" ? "bg-green-50 text-green-700" : asset.status === "In Service" ? "bg-orange-50 text-orange-700" : "bg-gray-50 text-gray-700"}>
                      {asset.status}
                    </Badge>
                  </td>
                  <td className="p-3"><HealthDot priority={asset.healthPriority || "p4"} /></td>
                  <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">
                    {asset.nextServiceTask ? (
                      <div>
                        <p>{asset.nextServiceTask}</p>
                        {asset.nextServiceDate && <p>{new Date(asset.nextServiceDate).toLocaleDateString()}</p>}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="p-3 text-sm hidden lg:table-cell">
                    {asset.trackingType === "miles" ? `${asset.mileage?.toLocaleString() || 0} mi` : `${asset.currentHours ?? asset.hours ?? 0} hrs`}
                  </td>
                  <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setShowHoursDialog(asset.id)} title="Update Hours" data-testid={`button-update-hours-${asset.id}`}>
                        <Clock className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowServiceDialog(asset.id)} title="Log Service" data-testid={`button-log-service-${asset.id}`}>
                        <Wrench className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowRepairDialog(asset.id)} title="Report Issue" data-testid={`button-report-issue-${asset.id}`}>
                        <AlertTriangle className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showHoursDialog && <UpdateHoursDialog assetId={showHoursDialog} onClose={() => setShowHoursDialog(null)} />}
      {showServiceDialog && <QuickServiceDialog assetId={showServiceDialog} onClose={() => setShowServiceDialog(null)} />}
      {showRepairDialog && <RepairRequestDialog assetId={showRepairDialog} onClose={() => setShowRepairDialog(null)} />}
    </div>
  );
}

function AssetProfile({ assetId, onBack }: { assetId: string; onBack: () => void }) {
  const [tab, setTab] = useState("overview");
  const { data: asset, isLoading } = useQuery<Equipment>({
    queryKey: [`/api/fleet/assets/${assetId}`],
    queryFn: async () => (await apiRequest("GET", `/api/fleet/assets/${assetId}`)).json(),
  });

  if (isLoading) return <div className="animate-pulse"><div className="h-8 bg-muted rounded w-64 mb-4" /><div className="h-96 bg-muted rounded" /></div>;
  if (!asset) return <p>Asset not found</p>;

  return (
    <div className="space-y-4" data-testid="asset-profile">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Fleet</Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{asset.nickname || asset.name}</h1>
          <p className="text-muted-foreground">{asset.assetId} · {[asset.year, asset.make, asset.model].filter(Boolean).join(" ")}</p>
        </div>
        <Badge variant="outline" className={asset.status === "Active" ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}>
          {asset.status}
        </Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="history">Service History</TabsTrigger>
          <TabsTrigger value="repairs">Repairs</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab asset={asset} /></TabsContent>
        <TabsContent value="maintenance"><MaintenanceTab assetId={assetId} asset={asset} /></TabsContent>
        <TabsContent value="history"><ServiceHistoryTab assetId={assetId} /></TabsContent>
        <TabsContent value="repairs"><RepairsTab assetId={assetId} /></TabsContent>
        <TabsContent value="documents">
          <DocumentsTab assetId={assetId} />
          <div className="mt-4">
            <DocumentsPanel
              entityType="equipment"
              entityId={assetId}
              canUpload
              canShare
              canLink
              canDelete
              canAttachFromLibrary
              module="equipment"
              title="Linked Documents"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ asset }: { asset: Equipment }) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    setForm({ ...asset });
  }, [asset]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/fleet/assets/${asset.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/fleet/assets/${asset.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/assets"] });
      setEditing(false);
      toast({ title: "Asset updated" });
    },
  });

  const now = new Date();
  const expiryColor = (date: any) => {
    if (!date) return "text-muted-foreground";
    const d = new Date(date);
    const days = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return "text-red-600 font-semibold";
    if (days < 30) return "text-orange-600 font-semibold";
    if (days < 60) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <div className="space-y-4 mt-4" data-testid="overview-tab">
      <div className="flex justify-end">
        {editing ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setEditing(false); setForm({ ...asset }); }}>Cancel</Button>
            <Button size="sm" onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="button-edit-asset">
            <Edit2 className="h-3 w-3 mr-1" /> Edit
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Identity</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {editing ? (
              <>
                <div><Label>Name</Label><Input value={form.name || ""} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div><Label>Nickname</Label><Input value={form.nickname || ""} onChange={e => setForm({...form, nickname: e.target.value})} /></div>
                <div><Label>Category</Label>
                  <Select value={form.category || ""} onValueChange={v => setForm({...form, category: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Status</Label>
                  <Select value={form.status || ""} onValueChange={v => setForm({...form, status: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Primary Location</Label><Input value={form.primaryLocation || ""} onChange={e => setForm({...form, primaryLocation: e.target.value})} /></div>
              </>
            ) : (
              <>
                <InfoRow label="Name" value={asset.name} />
                <InfoRow label="Nickname" value={asset.nickname} />
                <InfoRow label="Asset ID" value={asset.assetId} />
                <InfoRow label="Category" value={asset.category} />
                <InfoRow label="Year/Make/Model" value={[asset.year, asset.make, asset.model].filter(Boolean).join(" ")} />
                <InfoRow label="VIN" value={asset.vin} />
                <InfoRow label="Serial #" value={asset.serialNumber} />
                <InfoRow label="License Plate" value={asset.licensePlate} />
                <InfoRow label="Location" value={asset.primaryLocation} />
                <InfoRow label="Tracking" value={asset.trackingType} />
                <InfoRow label="Current Hours" value={asset.currentHours?.toString() ?? asset.hours?.toString()} />
                <InfoRow label="Mileage" value={asset.mileage?.toLocaleString()} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Compliance & Purchase</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {editing ? (
              <>
                <div><Label>Registration Expiry</Label><Input type="date" value={form.registrationExpiry ? new Date(form.registrationExpiry).toISOString().split("T")[0] : ""} onChange={e => setForm({...form, registrationExpiry: e.target.value ? new Date(e.target.value) : null})} /></div>
                <div><Label>Insurance Expiry</Label><Input type="date" value={form.insuranceExpiry ? new Date(form.insuranceExpiry).toISOString().split("T")[0] : ""} onChange={e => setForm({...form, insuranceExpiry: e.target.value ? new Date(e.target.value) : null})} /></div>
                <div><Label>Warranty Expiry</Label><Input type="date" value={form.warrantyExpiry ? new Date(form.warrantyExpiry).toISOString().split("T")[0] : ""} onChange={e => setForm({...form, warrantyExpiry: e.target.value ? new Date(e.target.value) : null})} /></div>
                <div><Label>Purchase Date</Label><Input type="date" value={form.purchaseDate ? new Date(form.purchaseDate).toISOString().split("T")[0] : ""} onChange={e => setForm({...form, purchaseDate: e.target.value ? new Date(e.target.value) : null})} /></div>
                <div><Label>Purchase Price ($)</Label><Input type="number" value={form.purchasePrice ? (form.purchasePrice / 100).toString() : ""} onChange={e => setForm({...form, purchasePrice: Math.round(parseFloat(e.target.value || "0") * 100)})} /></div>
                <div><Label>Purchased From</Label><Input value={form.purchasedFrom || ""} onChange={e => setForm({...form, purchasedFrom: e.target.value})} /></div>
              </>
            ) : (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Registration</span><span className={expiryColor(asset.registrationExpiry)}>{asset.registrationExpiry ? new Date(asset.registrationExpiry).toLocaleDateString() : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Insurance</span><span className={expiryColor(asset.insuranceExpiry)}>{asset.insuranceExpiry ? new Date(asset.insuranceExpiry).toLocaleDateString() : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Warranty</span><span className={expiryColor(asset.warrantyExpiry)}>{asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toLocaleDateString() : "—"}</span></div>
                <InfoRow label="Purchase Date" value={asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString() : undefined} />
                <InfoRow label="Purchase Price" value={asset.purchasePrice ? `$${(asset.purchasePrice / 100).toLocaleString()}` : undefined} />
                <InfoRow label="Purchased From" value={asset.purchasedFrom} />
                <InfoRow label="Condition" value={asset.conditionAtPurchase} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}

function MaintenanceTab({ assetId, asset }: { assetId: string; asset: Equipment }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addScheduleOpen, setAddScheduleOpen] = useState(false);

  const { data: schedules = [] } = useQuery<MaintenanceSchedule[]>({
    queryKey: [`/api/fleet/assets/${assetId}/schedules`],
    queryFn: async () => (await apiRequest("GET", `/api/fleet/assets/${assetId}/schedules`)).json(),
  });

  const completeMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      const res = await apiRequest("POST", `/api/fleet/schedules/${scheduleId}/complete`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/fleet/assets/${assetId}/schedules`] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/dashboard"] });
      toast({ title: "Service marked complete" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/fleet/schedules/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/fleet/assets/${assetId}/schedules`] }); },
  });

  const activeSchedules = schedules.filter(s => s.isActive);
  const sortedByPriority = [...activeSchedules].sort((a, b) => {
    const order = { p1: 0, p2: 1, p3: 2, p4: 3 } as Record<string, number>;
    return (order[a.priority || "p4"] ?? 3) - (order[b.priority || "p4"] ?? 3);
  });

  return (
    <div className="space-y-4 mt-4" data-testid="maintenance-tab">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Maintenance Schedule ({activeSchedules.length} tasks)</h3>
        <Button size="sm" onClick={() => setAddScheduleOpen(true)} data-testid="button-add-schedule">
          <Plus className="h-3 w-3 mr-1" /> Add Task
        </Button>
      </div>

      {sortedByPriority.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No maintenance tasks scheduled</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {sortedByPriority.map(sched => (
            <Card key={sched.id} data-testid={`schedule-${sched.id}`}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{sched.name}</p>
                      <PriorityBadge priority={sched.priority || "p4"} />
                    </div>
                    {sched.taskDescription && <p className="text-xs text-muted-foreground mt-1">{sched.taskDescription}</p>}
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                      {sched.hoursInterval && <span>Every {sched.hoursInterval} hrs</span>}
                      {sched.calendarIntervalDays && <span>Every {sched.calendarIntervalDays} days</span>}
                      {sched.lastServiceDate && <span>Last: {new Date(sched.lastServiceDate).toLocaleDateString()}</span>}
                      {sched.nextDueDate && <span>Due: {new Date(sched.nextDueDate).toLocaleDateString()}</span>}
                      {sched.nextDueHours && <span>Due at {sched.nextDueHours} hrs</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => completeMutation.mutate(sched.id)} disabled={completeMutation.isPending}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this schedule?")) deleteMutation.mutate(sched.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddScheduleDialog open={addScheduleOpen} onClose={() => setAddScheduleOpen(false)} assetId={assetId} />
    </div>
  );
}

function ServiceHistoryTab({ assetId }: { assetId: string }) {
  const { data: logs = [] } = useQuery<MaintenanceLog[]>({
    queryKey: [`/api/fleet/assets/${assetId}/service-history`],
    queryFn: async () => (await apiRequest("GET", `/api/fleet/assets/${assetId}/service-history`)).json(),
  });

  const sorted = [...logs].sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());

  return (
    <div className="space-y-3 mt-4" data-testid="service-history-tab">
      <h3 className="font-semibold">Service History ({sorted.length} records)</h3>
      {sorted.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No service history yet</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {sorted.map(log => (
            <Card key={log.id}>
              <CardContent className="p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{log.name}</p>
                      <Badge variant="outline" className="text-xs">{log.logType || "scheduled"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(log.completedDate).toLocaleDateString()}
                      {log.hoursAtService != null && ` · ${log.hoursAtService} hrs`}
                      {log.vendor && ` · ${log.vendor}`}
                    </p>
                    {log.notes && <p className="text-xs text-muted-foreground mt-1">{log.notes}</p>}
                    {log.partsUsed && Array.isArray(log.partsUsed) && (log.partsUsed as any[]).length > 0 && (
                      <div className="mt-1">
                        <p className="text-xs font-medium">Parts:</p>
                        {(log.partsUsed as any[]).map((p: any, i: number) => (
                          <p key={i} className="text-xs text-muted-foreground">{p.description} x{p.qty} @ ${(p.unitCost / 100).toFixed(2)}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    {(log.totalCost || log.cost) ? (
                      <p className="font-medium">${((log.totalCost || log.cost || 0) / 100).toFixed(2)}</p>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RepairsTab({ assetId }: { assetId: string }) {
  const { data: repairs = [] } = useQuery<RepairRequest[]>({
    queryKey: ["/api/fleet/repair-requests", assetId],
    queryFn: async () => (await apiRequest("GET", `/api/fleet/repair-requests?assetId=${assetId}`)).json(),
  });

  const sorted = [...repairs].sort((a, b) => new Date(b.reportDate || b.createdAt!).getTime() - new Date(a.reportDate || a.createdAt!).getTime());

  const severityColors: Record<string, string> = {
    minor: "bg-yellow-50 text-yellow-700",
    moderate: "bg-orange-50 text-orange-700",
    major: "bg-red-50 text-red-700",
  };

  const statusColors: Record<string, string> = {
    open: "bg-blue-50 text-blue-700",
    in_review: "bg-purple-50 text-purple-700",
    in_repair: "bg-orange-50 text-orange-700",
    resolved: "bg-green-50 text-green-700",
  };

  return (
    <div className="space-y-3 mt-4" data-testid="repairs-tab">
      <h3 className="font-semibold">Repair Requests ({sorted.length})</h3>
      {sorted.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No repair requests</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {sorted.map(repair => (
            <Card key={repair.id}>
              <CardContent className="p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={severityColors[repair.severity] || ""}>{repair.severity}</Badge>
                      <Badge variant="outline" className={statusColors[repair.status] || ""}>{repair.status.replace("_", " ")}</Badge>
                      {repair.isUsable !== "yes" && (
                        <Badge variant="outline" className="bg-red-50 text-red-700">
                          {repair.isUsable === "no" ? "Not Usable" : "Restricted Use"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm mt-1">{repair.problemDescription}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Reported {repair.reportDate ? new Date(repair.reportDate).toLocaleDateString() : ""}
                      {repair.shopName && ` · ${repair.shopName}`}
                    </p>
                    {repair.resolutionDescription && (
                      <p className="text-xs text-green-700 mt-1">Resolution: {repair.resolutionDescription}</p>
                    )}
                  </div>
                  {repair.totalRepairCost ? (
                    <p className="font-medium text-sm">${((repair.totalRepairCost || 0) / 100).toFixed(2)}</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentsTab({ assetId }: { assetId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeFolder, setActiveFolder] = useState("all");

  const { data: docs = [] } = useQuery<EquipmentUpload[]>({
    queryKey: [`/api/fleet/assets/${assetId}/documents`],
    queryFn: async () => (await apiRequest("GET", `/api/fleet/assets/${assetId}/documents`)).json(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/fleet/documents/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/fleet/assets/${assetId}/documents`] }); },
  });

  const filtered = activeFolder === "all" ? docs : docs.filter(d => d.folder === activeFolder);

  return (
    <div className="space-y-3 mt-4" data-testid="documents-tab">
      <h3 className="font-semibold">Documents</h3>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={activeFolder === "all" ? "default" : "outline"} onClick={() => setActiveFolder("all")}>All ({docs.length})</Button>
        {DOC_FOLDERS.map(f => {
          const count = docs.filter(d => d.folder === f).length;
          return (
            <Button key={f} size="sm" variant={activeFolder === f ? "default" : "outline"} onClick={() => setActiveFolder(f)}>
              {f} ({count})
            </Button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No documents in this folder</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => (
            <Card key={doc.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{doc.fileName}</p>
                    <div className="flex gap-2 items-center">
                      <Badge variant="outline" className="text-xs">{doc.folder || "other"}</Badge>
                      <span className="text-xs text-muted-foreground">{doc.fileType}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {doc.fileUrl && (
                    <Button size="sm" variant="ghost" onClick={() => window.open(doc.fileUrl, "_blank")}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete?")) deleteMutation.mutate(doc.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function UpdateHoursDialog({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const [value, setValue] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: asset } = useQuery<Equipment>({
    queryKey: [`/api/fleet/assets/${assetId}`],
    queryFn: async () => (await apiRequest("GET", `/api/fleet/assets/${assetId}`)).json(),
  });

  const isMiles = asset?.trackingType === "miles";

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = isMiles ? { mileage: parseInt(value) } : { hours: parseInt(value) };
      const res = await apiRequest("POST", `/api/fleet/assets/${assetId}/update-hours`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/dashboard"] });
      queryClient.invalidateQueries({ queryKey: [`/api/fleet/assets/${assetId}`] });
      onClose();
      toast({ title: isMiles ? "Mileage updated" : "Hours updated, priorities recalculated" });
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update {isMiles ? "Mileage" : "Hours"}</DialogTitle>
          <DialogDescription>Enter the current reading. Maintenance priorities will be recalculated automatically.</DialogDescription>
        </DialogHeader>
        <div>
          <Label>Current {isMiles ? "Mileage" : "Hours"}</Label>
          <Input type="number" value={value} onChange={e => setValue(e.target.value)} data-testid="input-hours" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!value || mutation.isPending} data-testid="button-save-hours">
            {mutation.isPending ? "Saving..." : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuickServiceDialog({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<any>({
    equipmentId: assetId,
    logType: "scheduled",
    name: "",
    completedDate: new Date().toISOString().split("T")[0],
    hoursAtService: "",
    vendor: "",
    serviceLocation: "",
    notes: "",
    partsUsed: [] as any[],
    laborCost: "",
    totalCost: "",
  });

  const { data: schedules = [] } = useQuery<MaintenanceSchedule[]>({
    queryKey: [`/api/fleet/assets/${assetId}/schedules`],
    queryFn: async () => (await apiRequest("GET", `/api/fleet/assets/${assetId}/schedules`)).json(),
  });

  const { data: staff = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/staff"],
    queryFn: async () => (await apiRequest("GET", "/api/fleet/staff")).json(),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        completedDate: new Date(form.completedDate),
        hoursAtService: form.hoursAtService ? parseInt(form.hoursAtService) : null,
        laborCost: form.laborCost ? Math.round(parseFloat(form.laborCost) * 100) : 0,
        totalCost: form.totalCost ? Math.round(parseFloat(form.totalCost) * 100) : 0,
        partsUsed: form.partsUsed.filter((p: any) => p.description),
      };
      const res = await apiRequest("POST", "/api/fleet/service-log", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/fleet/assets/${assetId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/dashboard"] });
      onClose();
      toast({ title: "Service logged" });
    },
  });

  const addPart = () => setForm({ ...form, partsUsed: [...form.partsUsed, { partNumber: "", description: "", qty: 1, unitCost: 0 }] });
  const removePart = (i: number) => setForm({ ...form, partsUsed: form.partsUsed.filter((_: any, idx: number) => idx !== i) });
  const updatePart = (i: number, field: string, value: any) => {
    const parts = [...form.partsUsed];
    parts[i] = { ...parts[i], [field]: value };
    setForm({ ...form, partsUsed: parts });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Service</DialogTitle>
          <DialogDescription>Record a maintenance service or inspection.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Link to Schedule (optional)</Label>
            <Select value={form.scheduleId || ""} onValueChange={v => {
              const sched = schedules.find(s => s.id === v);
              setForm({ ...form, scheduleId: v, name: sched?.name || form.name });
            }}>
              <SelectTrigger><SelectValue placeholder="Select task..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {schedules.filter(s => s.isActive).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Service Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} data-testid="input-service-name" /></div>
            <div><Label>Type</Label>
              <Select value={form.logType} onValueChange={v => setForm({...form, logType: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="hours_update">Hours Update</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Date</Label><Input type="date" value={form.completedDate} onChange={e => setForm({...form, completedDate: e.target.value})} /></div>
            <div><Label>Hours at Service</Label><Input type="number" value={form.hoursAtService} onChange={e => setForm({...form, hoursAtService: e.target.value})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Performed By</Label>
              <Select value={form.performedBy || ""} onValueChange={v => setForm({...form, performedBy: v})}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {staff.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  <SelectItem value="outside">Outside Shop</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Location</Label><Input value={form.serviceLocation} onChange={e => setForm({...form, serviceLocation: e.target.value})} /></div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Parts Used</Label>
              <Button type="button" size="sm" variant="outline" onClick={addPart}><Plus className="h-3 w-3 mr-1" /> Part</Button>
            </div>
            {form.partsUsed.map((p: any, i: number) => (
              <div key={i} className="grid grid-cols-5 gap-1 mt-1 items-center">
                <Input placeholder="Part #" value={p.partNumber} onChange={e => updatePart(i, "partNumber", e.target.value)} className="text-xs" />
                <Input placeholder="Description" value={p.description} onChange={e => updatePart(i, "description", e.target.value)} className="text-xs col-span-2" />
                <Input type="number" placeholder="Qty" value={p.qty} onChange={e => updatePart(i, "qty", parseInt(e.target.value) || 0)} className="text-xs" />
                <div className="flex gap-1">
                  <Input type="number" placeholder="$/ea" value={p.unitCost ? (p.unitCost / 100).toString() : ""} onChange={e => updatePart(i, "unitCost", Math.round(parseFloat(e.target.value || "0") * 100))} className="text-xs" />
                  <Button size="sm" variant="ghost" onClick={() => removePart(i)}><X className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div><Label>Labor Cost ($)</Label><Input type="number" value={form.laborCost} onChange={e => setForm({...form, laborCost: e.target.value})} /></div>
            <div><Label>Total Cost ($)</Label><Input type="number" value={form.totalCost} onChange={e => setForm({...form, totalCost: e.target.value})} /></div>
          </div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.name || mutation.isPending} data-testid="button-save-service">
            {mutation.isPending ? "Saving..." : "Log Service"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RepairRequestDialog({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    assetId,
    problemDescription: "",
    severity: "minor",
    isUsable: "yes",
    updateAssetStatus: false,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fleet/repair-requests", form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/repair-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/assets"] });
      onClose();
      toast({ title: "Repair request submitted" });
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report Issue</DialogTitle>
          <DialogDescription>Report a problem with this equipment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Problem Description *</Label><Textarea value={form.problemDescription} onChange={e => setForm({...form, problemDescription: e.target.value})} rows={3} data-testid="input-problem" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Severity</Label>
              <Select value={form.severity} onValueChange={v => setForm({...form, severity: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Equipment Usable?</Label>
              <Select value={form.isUsable} onValueChange={v => setForm({...form, isUsable: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="restricted">Restricted</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.updateAssetStatus} onCheckedChange={v => setForm({...form, updateAssetStatus: v})} />
            <Label>Mark equipment as "In Service"</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.problemDescription || mutation.isPending} data-testid="button-submit-repair">
            {mutation.isPending ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddScheduleDialog({ open, onClose, assetId }: { open: boolean; onClose: () => void; assetId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    taskDescription: "",
    intervalType: "hours",
    intervalValue: 100,
    hoursInterval: null as number | null,
    calendarIntervalDays: null as number | null,
    reminderEnabled: true,
    reminderDays: 7,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        hoursInterval: form.intervalType === "hours" ? form.intervalValue : null,
        calendarIntervalDays: form.intervalType === "days" ? form.intervalValue : null,
      };
      const res = await apiRequest("POST", `/api/fleet/assets/${assetId}/schedules`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/fleet/assets/${assetId}/schedules`] });
      onClose();
      toast({ title: "Schedule added" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Maintenance Task</DialogTitle>
          <DialogDescription>Set up a recurring maintenance schedule.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Task Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
          <div><Label>Description</Label><Textarea value={form.taskDescription} onChange={e => setForm({...form, taskDescription: e.target.value})} rows={2} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Interval Type</Label>
              <Select value={form.intervalType} onValueChange={v => setForm({...form, intervalType: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Calendar Days</SelectItem>
                  <SelectItem value="miles">Miles</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Interval Value</Label><Input type="number" value={form.intervalValue} onChange={e => setForm({...form, intervalValue: parseInt(e.target.value) || 0})} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.reminderEnabled} onCheckedChange={v => setForm({...form, reminderEnabled: v})} />
            <Label>Enable Reminders</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.name || mutation.isPending}>
            {mutation.isPending ? "Adding..." : "Add Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddEquipmentWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<any>({
    type: "Equipment",
    name: "",
    nickname: "",
    category: "",
    make: "",
    model: "",
    year: "",
    serialNumber: "",
    vin: "",
    licensePlate: "",
    status: "Active",
    trackingType: "hours",
    currentHours: 0,
    hoursAtPurchase: 0,
    mileage: 0,
    purchaseDate: "",
    purchasePrice: "",
    purchasedFrom: "",
    conditionAtPurchase: "",
    primaryLocation: "",
    notes: "",
    autoAssignTemplates: true,
  });
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [vinDecoded, setVinDecoded] = useState<any>(null);
  const [vinLoading, setVinLoading] = useState(false);

  const { data: allTemplates = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/oem-templates"],
    queryFn: async () => (await apiRequest("GET", "/api/fleet/oem-templates")).json(),
    enabled: open,
  });

  useEffect(() => {
    if (form.make && form.category) {
      const matching = allTemplates.filter(t =>
        t.brand.toLowerCase() === form.make.toLowerCase() && t.category.toLowerCase() === form.category.toLowerCase()
      );
      if (matching.length === 0) {
        const generic = allTemplates.filter(t => t.brand === "Generic" && t.category.toLowerCase() === form.category.toLowerCase());
        setTemplates(generic);
        setSelectedTemplateIds(generic.map(t => t.id));
      } else {
        setTemplates(matching);
        setSelectedTemplateIds(matching.map(t => t.id));
      }
    }
  }, [form.make, form.category, allTemplates]);

  const decodeVin = async () => {
    if (!form.vin) return;
    setVinLoading(true);
    try {
      const res = await apiRequest("GET", `/api/fleet/vin-decode/${form.vin}`);
      const data = await res.json();
      setVinDecoded(data);
      if (data.make) setForm((f: any) => ({ ...f, make: data.make || f.make, model: data.model || f.model, year: data.year || f.year }));
    } catch { }
    setVinLoading(false);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        year: form.year ? parseInt(form.year) : null,
        currentHours: form.trackingType === "miles" ? 0 : (parseInt(form.currentHours) || 0),
        hoursAtPurchase: parseInt(form.hoursAtPurchase) || 0,
        mileage: form.trackingType === "miles" ? (parseInt(form.mileage) || 0) : 0,
        purchasePrice: form.purchasePrice ? Math.round(parseFloat(form.purchasePrice) * 100) : null,
        purchaseDate: form.purchaseDate ? new Date(form.purchaseDate) : null,
        autoAssignTemplates: false,
      };
      const res = await apiRequest("POST", "/api/fleet/assets", payload);
      const asset = await res.json();

      if (selectedTemplateIds.length > 0) {
        await apiRequest("POST", `/api/fleet/assets/${asset.id}/assign-templates`, { templateIds: selectedTemplateIds });
      }
      return asset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/dashboard"] });
      onClose();
      setStep(1);
      setForm({ type: "Equipment", name: "", nickname: "", category: "", make: "", model: "", year: "", serialNumber: "", vin: "", licensePlate: "", status: "Active", trackingType: "hours", currentHours: 0, hoursAtPurchase: 0, mileage: 0, purchaseDate: "", purchasePrice: "", purchasedFrom: "", conditionAtPurchase: "", primaryLocation: "", notes: "", autoAssignTemplates: true });
      toast({ title: "Equipment added with maintenance schedules" });
    },
  });

  const isVehicle = ["Truck", "Trailer"].includes(form.category);

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); setStep(1); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Equipment — Step {step} of 4</DialogTitle>
          <DialogDescription>
            {step === 1 && "Basic identification"}
            {step === 2 && "OEM maintenance templates"}
            {step === 3 && "Purchase & tracking details"}
            {step === 4 && "Review and save"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Category *</Label>
                <Select value={form.category} onValueChange={v => setForm({...form, category: v, type: ["Truck", "Trailer"].includes(v) ? "Vehicle" : "Equipment"})}>
                  <SelectTrigger data-testid="select-category"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} data-testid="input-asset-name" /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Make</Label><Input value={form.make} onChange={e => setForm({...form, make: e.target.value})} data-testid="input-make" /></div>
              <div><Label>Model</Label><Input value={form.model} onChange={e => setForm({...form, model: e.target.value})} /></div>
              <div><Label>Year</Label><Input value={form.year} onChange={e => setForm({...form, year: e.target.value})} /></div>
            </div>
            <div><Label>Serial Number</Label><Input value={form.serialNumber} onChange={e => setForm({...form, serialNumber: e.target.value})} /></div>
            {isVehicle && (
              <div>
                <Label>VIN</Label>
                <div className="flex gap-2">
                  <Input value={form.vin} onChange={e => setForm({...form, vin: e.target.value})} data-testid="input-vin" />
                  <Button variant="outline" onClick={decodeVin} disabled={!form.vin || vinLoading} data-testid="button-decode-vin">
                    {vinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Decode"}
                  </Button>
                </div>
                {vinDecoded && (
                  <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-700">
                    VIN decoded: {[vinDecoded.year, vinDecoded.make, vinDecoded.model].filter(Boolean).join(" ")}
                    {vinDecoded.fuelType && ` · ${vinDecoded.fuelType}`}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {templates.length > 0 ? (
              <>
                <p className="text-sm">We found <span className="font-bold">{templates.length}</span> maintenance tasks for this equipment. These will be added to its schedule automatically.</p>
                <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                  {templates.map(t => (
                    <div key={t.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={selectedTemplateIds.includes(t.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedTemplateIds([...selectedTemplateIds, t.id]);
                          else setSelectedTemplateIds(selectedTemplateIds.filter(id => id !== t.id));
                        }}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{t.taskName}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.hoursInterval && `Every ${t.hoursInterval} hrs`}
                          {t.hoursInterval && t.calendarIntervalDays && " · "}
                          {t.calendarIntervalDays && `Every ${t.calendarIntervalDays} days`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No OEM templates found for this equipment. You can add custom maintenance schedules after saving.</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Tracking Type</Label>
                <Select value={form.trackingType} onValueChange={v => setForm({...form, trackingType: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TRACKING_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.trackingType === "miles" ? (
                <div><Label>Current Mileage</Label><Input type="number" value={form.mileage} onChange={e => setForm({...form, mileage: e.target.value})} /></div>
              ) : (
                <div><Label>Current Hours</Label><Input type="number" value={form.currentHours} onChange={e => setForm({...form, currentHours: e.target.value})} /></div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Purchase Date</Label><Input type="date" value={form.purchaseDate} onChange={e => setForm({...form, purchaseDate: e.target.value})} /></div>
              <div><Label>Purchase Price ($)</Label><Input type="number" value={form.purchasePrice} onChange={e => setForm({...form, purchasePrice: e.target.value})} /></div>
            </div>
            <div><Label>Purchased From</Label><Input value={form.purchasedFrom} onChange={e => setForm({...form, purchasedFrom: e.target.value})} /></div>
            <div><Label>Condition at Purchase</Label><Input value={form.conditionAtPurchase} onChange={e => setForm({...form, conditionAtPurchase: e.target.value})} /></div>
            <div><Label>Primary Location</Label><Input value={form.primaryLocation} onChange={e => setForm({...form, primaryLocation: e.target.value})} /></div>
            {isVehicle && <div><Label>License Plate</Label><Input value={form.licensePlate} onChange={e => setForm({...form, licensePlate: e.target.value})} /></div>}
            <div><Label>Nickname</Label><Input value={form.nickname} onChange={e => setForm({...form, nickname: e.target.value})} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} /></div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 text-sm">
            <h3 className="font-semibold">Review</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <InfoRow label="Name" value={form.name} />
              <InfoRow label="Category" value={form.category} />
              <InfoRow label="Make/Model" value={[form.make, form.model].filter(Boolean).join(" ")} />
              <InfoRow label="Year" value={form.year} />
              <InfoRow label="Tracking" value={form.trackingType} />
              <InfoRow label="Current" value={form.currentHours?.toString()} />
              {form.vin && <InfoRow label="VIN" value={form.vin} />}
              {form.serialNumber && <InfoRow label="Serial #" value={form.serialNumber} />}
            </div>
            {selectedTemplateIds.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">{selectedTemplateIds.length} maintenance tasks will be auto-assigned.</p>
            )}
          </div>
        )}

        <DialogFooter>
          {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)} disabled={step === 1 && (!form.name || !form.category)} data-testid="button-next-step">
              Next
            </Button>
          ) : (
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-create-asset">
              {createMutation.isPending ? "Creating..." : "Create Equipment"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
