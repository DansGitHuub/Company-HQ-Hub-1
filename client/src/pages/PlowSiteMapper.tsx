import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { PlowSite, PlowSiteGroup, SitePhoto, SitePhotoVariant, SiteMapFeature } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, MapPin, Trash2, Edit, Save, X, Search, Loader2,
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Folder, FolderPlus,
  Image as ImageIcon, Pencil, ArrowRight, Circle, Square, Type,
  Undo, Redo, Minus, MoreVertical, Upload, Map, Camera, List,
  Navigation, Crosshair, Pentagon, MousePointer, PenTool, Eye,
  ArrowUp, ArrowDown, Menu, Satellite, Check, Compass, MapPinned,
  Layers, Ruler, Globe, ScanSearch,
} from "lucide-react";
import { Stage, Layer, Line, Rect, Circle as KonvaCircle, Arrow as KonvaArrow, Text as KonvaText, Image as KonvaImage } from "react-konva";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Annotation = {
  id: string;
  type: "pen" | "arrow" | "line" | "rect" | "circle" | "text";
  points?: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  color: string;
  strokeWidth: number;
  text?: string;
};

type Instruction = {
  id: string;
  step: number;
  title: string;
  description: string;
};

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6",
  "#8b5cf6", "#ec4899", "#ffffff", "#000000",
];

const LINE_WIDTHS = [2, 4, 6, 8, 12];

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function useLoadImage(src: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) { setImage(null); return; }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = src;
  }, [src]);
  return image;
}

export default function PlowSiteMapper() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("map");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(null);

  const [isCreateSiteOpen, setIsCreateSiteOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PlowSiteGroup | null>(null);

  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const permissions = useQuery({
    queryKey: ["/api/plow-site-permissions/my"],
    queryFn: async () => {
      const res = await fetch("/api/plow-site-permissions/my", { credentials: "include" });
      return res.json();
    },
  });

  const canEdit = user?.role === "Admin" || user?.isMasterAdmin || permissions.data?.canEdit;
  const canView = user?.role === "Admin" || user?.isMasterAdmin || user?.role === "Manager" || permissions.data?.canView;

  const { data: sites = [], isLoading: sitesLoading } = useQuery<PlowSite[]>({
    queryKey: ["/api/plow-sites"],
    enabled: !!canView,
  });

  const { data: groups = [] } = useQuery<PlowSiteGroup[]>({
    queryKey: ["/api/plow-site-groups"],
    enabled: !!canView,
  });

  const selectedSite = useMemo(() => sites.find((s) => s.id === selectedSiteId) || null, [sites, selectedSiteId]);

  const filteredSites = useMemo(() => {
    let result = sites;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || (s.address && s.address.toLowerCase().includes(q))
      );
    }
    if (selectedGroupFilter) {
      result = result.filter((s) => s.groupId === selectedGroupFilter);
    }
    return result;
  }, [sites, searchQuery, selectedGroupFilter]);

  const groupedSites = useMemo(() => {
    const map: globalThis.Map<string | null, PlowSite[]> = new globalThis.Map();
    filteredSites.forEach((s) => {
      const key = s.groupId || null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [filteredSites]);

  const deleteSite = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/plow-sites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plow-sites"] });
      if (selectedSiteId) setSelectedSiteId(null);
      toast({ title: "Site deleted" });
    },
    onError: () => toast({ title: "Failed to delete site", variant: "destructive" }),
  });

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-full p-8" data-testid="no-access">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No Access</h2>
            <p className="text-muted-foreground">You don't have permission to view the Site Mapper.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden pb-20" data-testid="plow-site-mapper">
      {sidebarOpen && (
        <aside className="w-80 border-r bg-card flex flex-col shrink-0" data-testid="sidebar">
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5" /> Sites
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} data-testid="close-sidebar">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="search-sites"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge
                variant={selectedGroupFilter === null ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setSelectedGroupFilter(null)}
                data-testid="filter-all"
              >
                All
              </Badge>
              {groups.map((g) => (
                <Badge
                  key={g.id}
                  variant={selectedGroupFilter === g.id ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  style={selectedGroupFilter === g.id ? { backgroundColor: g.color || undefined } : {}}
                  onClick={() => setSelectedGroupFilter(selectedGroupFilter === g.id ? null : g.id)}
                  data-testid={`filter-group-${g.id}`}
                >
                  {g.name}
                </Badge>
              ))}
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setIsCreateSiteOpen(true)} className="flex-1" data-testid="new-site-btn">
                  <Plus className="h-4 w-4 mr-1" /> New Site
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsCreateGroupOpen(true)} data-testid="new-group-btn">
                  <FolderPlus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {sitesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSites.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No sites found</p>
              ) : (
                <>
                  {groups.filter((g) => !selectedGroupFilter || g.id === selectedGroupFilter).map((group) => {
                    const groupSites = groupedSites.get(group.id) || [];
                    if (groupSites.length === 0) return null;
                    return (
                      <div key={group.id} className="mb-2">
                        <div className="flex items-center gap-2 px-2 py-1">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: group.color || "#6b7280" }} />
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{group.name}</span>
                          <Badge variant="outline" className="text-xs ml-auto">{groupSites.length}</Badge>
                        </div>
                        {groupSites.map((site) => (
                          <SiteCard
                            key={site.id}
                            site={site}
                            isSelected={selectedSiteId === site.id}
                            onSelect={() => { setSelectedSiteId(site.id); setActiveTab("map"); }}
                            onDelete={canEdit ? () => deleteSite.mutate(site.id) : undefined}
                          />
                        ))}
                      </div>
                    );
                  })}
                  {(() => {
                    const ungrouped = groupedSites.get(null) || [];
                    if (ungrouped.length === 0 || selectedGroupFilter) return null;
                    return (
                      <div className="mb-2">
                        <div className="flex items-center gap-2 px-2 py-1">
                          <Folder className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ungrouped</span>
                          <Badge variant="outline" className="text-xs ml-auto">{ungrouped.length}</Badge>
                        </div>
                        {ungrouped.map((site) => (
                          <SiteCard
                            key={site.id}
                            site={site}
                            isSelected={selectedSiteId === site.id}
                            onSelect={() => { setSelectedSiteId(site.id); setActiveTab("map"); }}
                            onDelete={canEdit ? () => deleteSite.mutate(site.id) : undefined}
                          />
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </ScrollArea>
        </aside>
      )}

      <main className="flex-1 flex flex-col overflow-hidden">
        {!sidebarOpen && (
          <div className="border-b p-2 flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} data-testid="open-sidebar">
              <Menu className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{selectedSite?.name || "Site Mapper"}</span>
          </div>
        )}

        {!selectedSite ? (
          <div className="flex-1 overflow-auto" data-testid="no-site-selected">
            <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 mb-2">
                  <Compass className="h-10 w-10 text-primary" />
                </div>
                <h1 className="text-2xl font-heading font-bold text-foreground">Site Photo Markup & Map Tool</h1>
                <p className="text-muted-foreground max-w-lg mx-auto">
                  Capture, annotate, and manage your job sites. Create detailed maps, mark up photos, and build instructions for your crew.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto">
                {canEdit && (
                  <Card
                    className="group cursor-pointer border-dashed border-2 border-primary/30 hover:border-primary hover:shadow-lg transition-all hover:scale-[1.02]"
                    onClick={() => setIsCreateSiteOpen(true)}
                    data-testid="action-new-site"
                  >
                    <CardContent className="p-8 text-center space-y-4">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Plus className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="font-semibold text-xl">Create New Site</h3>
                      <p className="text-sm text-muted-foreground">Add a new job site with address lookup, satellite imagery, and mapping tools.</p>
                    </CardContent>
                  </Card>
                )}

                <Card
                  className="group cursor-pointer border-dashed border-2 border-blue-500/30 hover:border-blue-500 hover:shadow-lg transition-all hover:scale-[1.02]"
                  onClick={() => { if (!sidebarOpen) setSidebarOpen(true); }}
                  data-testid="action-browse-sites"
                >
                  <CardContent className="p-8 text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                      <ScanSearch className="h-8 w-8 text-blue-500" />
                    </div>
                    <h3 className="font-semibold text-xl">Find Existing Site</h3>
                    <p className="text-sm text-muted-foreground">
                      {sites.length > 0
                        ? `Browse and search through your ${sites.length} saved site${sites.length !== 1 ? "s" : ""} in the sidebar.`
                        : "Open the sidebar to browse and search your saved sites."}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {canEdit && groups.length > 0 && (
                <div className="flex justify-center">
                  <Card
                    className="group cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] max-w-xs w-full"
                    onClick={() => setIsCreateGroupOpen(true)}
                    data-testid="action-manage-groups"
                  >
                    <CardContent className="p-5 text-center space-y-2">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors">
                        <Layers className="h-6 w-6 text-violet-500" />
                      </div>
                      <h3 className="font-semibold">Organize Groups</h3>
                      <p className="text-xs text-muted-foreground">Create and manage site groups to keep your projects organized.</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {sites.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <MapPinned className="h-5 w-5 text-muted-foreground" />
                      Recent Sites
                    </h2>
                    <Badge variant="outline">{sites.length} total</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sites.slice(0, 6).map((site) => {
                      const group = groups.find(g => g.id === site.groupId);
                      return (
                        <Card
                          key={site.id}
                          className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.01] overflow-hidden"
                          onClick={() => { setSelectedSiteId(site.id); setActiveTab("map"); }}
                          data-testid={`recent-site-${site.id}`}
                        >
                          {site.imageUrl ? (
                            <div className="h-28 bg-muted overflow-hidden">
                              <img src={site.imageUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="h-28 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                              <Globe className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                          )}
                          <CardContent className="p-3 space-y-1">
                            <p className="font-medium text-sm truncate">{site.name}</p>
                            {site.address && <p className="text-xs text-muted-foreground truncate">{site.address}</p>}
                            {group && (
                              <Badge variant="outline" className="text-[10px]" style={{ borderColor: group.color || undefined, color: group.color || undefined }}>
                                {group.name}
                              </Badge>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {sites.length === 0 && (
                <Card className="border-muted">
                  <CardContent className="py-10 text-center space-y-3">
                    <Globe className="h-12 w-12 mx-auto text-muted-foreground/20" />
                    <h3 className="font-medium text-muted-foreground">No sites yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">Get started by creating your first site. You can add addresses, satellite imagery, photos, and markup annotations.</p>
                    {canEdit && (
                      <Button onClick={() => setIsCreateSiteOpen(true)} className="mt-2" data-testid="empty-create-site">
                        <Plus className="h-4 w-4 mr-2" /> Create Your First Site
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {groups.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Folder className="h-5 w-5 text-muted-foreground" />
                    Site Groups
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {groups.map((g) => {
                      const count = sites.filter(s => s.groupId === g.id).length;
                      return (
                        <div key={g.id} className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className="cursor-pointer hover:bg-muted transition-colors py-1.5 px-3"
                            style={{ borderColor: g.color || undefined }}
                            onClick={() => { setSelectedGroupFilter(g.id); if (!sidebarOpen) setSidebarOpen(true); }}
                            data-testid={`landing-group-${g.id}`}
                          >
                            <div className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: g.color || "#6b7280" }} />
                            {g.name} ({count})
                          </Badge>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setEditingGroup(g)}
                              data-testid={`edit-group-${g.id}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b px-4 py-2 flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold" data-testid="site-name">{selectedSite.name}</h1>
                {selectedSite.address && (
                  <p className="text-sm text-muted-foreground" data-testid="site-address">{selectedSite.address}</p>
                )}
              </div>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid="site-actions">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => deleteSite.mutate(selectedSite.id)} className="text-destructive" data-testid="delete-site-action">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete Site
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-4 mt-2 w-fit">
                <TabsTrigger value="map" data-testid="tab-map"><Map className="h-4 w-4 mr-1" /> Map</TabsTrigger>
                <TabsTrigger value="overhead" data-testid="tab-overhead"><Satellite className="h-4 w-4 mr-1" /> Overhead Views</TabsTrigger>
                <TabsTrigger value="photos" data-testid="tab-photos"><ImageIcon className="h-4 w-4 mr-1" /> Photos</TabsTrigger>
                <TabsTrigger value="markup" data-testid="tab-markup"><Pencil className="h-4 w-4 mr-1" /> Markup</TabsTrigger>
                <TabsTrigger value="instructions" data-testid="tab-instructions"><List className="h-4 w-4 mr-1" /> Instructions</TabsTrigger>
              </TabsList>

              <TabsContent value="map" className="flex-1 overflow-hidden m-0 p-0">
                <MapTab site={selectedSite} canEdit={!!canEdit} />
              </TabsContent>
              <TabsContent value="overhead" className="flex-1 overflow-hidden m-0 p-0">
                <OverheadViewsTab site={selectedSite} canEdit={!!canEdit} />
              </TabsContent>
              <TabsContent value="photos" className="flex-1 overflow-auto m-0 p-4">
                <PhotosTab
                  site={selectedSite}
                  canEdit={!!canEdit}
                  onOpenMarkup={(photoId) => { setSelectedPhotoId(photoId); setActiveTab("markup"); }}
                />
              </TabsContent>
              <TabsContent value="markup" className="flex-1 overflow-hidden m-0 p-0">
                <MarkupTab
                  site={selectedSite}
                  canEdit={!!canEdit}
                  selectedPhotoId={selectedPhotoId}
                  onSelectPhoto={setSelectedPhotoId}
                  selectedVariantId={selectedVariantId}
                  onSelectVariant={setSelectedVariantId}
                />
              </TabsContent>
              <TabsContent value="instructions" className="flex-1 overflow-auto m-0 p-4">
                <InstructionsTab site={selectedSite} canEdit={!!canEdit} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      <CreateSiteDialog open={isCreateSiteOpen} onOpenChange={setIsCreateSiteOpen} groups={groups} />
      <CreateGroupDialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen} />
      <EditGroupDialog group={editingGroup} onOpenChange={(open) => { if (!open) setEditingGroup(null); }} />
    </div>
  );
}

function SiteCard({ site, isSelected, onSelect, onDelete }: {
  site: PlowSite;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors group ${
        isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"
      }`}
      onClick={onSelect}
      data-testid={`site-card-${site.id}`}
    >
      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        {site.imageUrl ? (
          <img src={site.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <MapPin className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{site.name}</p>
        {site.address && <p className="text-xs text-muted-foreground truncate">{site.address}</p>}
      </div>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          data-testid={`delete-site-${site.id}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function MapTab({ site, canEdit }: { site: PlowSite; canEdit: boolean }) {
  const { toast } = useToast();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isSatellite, setIsSatellite] = useState(false);
  const [drawMode, setDrawMode] = useState<"none" | "marker" | "polyline" | "polygon">("none");
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [featureName, setFeatureName] = useState("");
  const [featureColor, setFeatureColor] = useState("#ef4444");

  const hasCoords = site.latitude && site.longitude;
  const lat = parseFloat(site.latitude || "0");
  const lng = parseFloat(site.longitude || "0");

  const { data: features = [], isLoading: featuresLoading } = useQuery<SiteMapFeature[]>({
    queryKey: [`/api/plow-sites/${site.id}/map-features`],
    enabled: !!hasCoords,
  });

  const { data: mapsConfig } = useQuery<{ apiKey: string }>({
    queryKey: ["/api/maps-config"],
  });

  const createFeature = useMutation({
    mutationFn: async (data: { name: string; featureType: string; geojson: any; color: string }) => {
      const res = await apiRequest("POST", `/api/plow-sites/${site.id}/map-features`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/plow-sites/${site.id}/map-features`] });
      setDrawMode("none");
      setDrawingPoints([]);
      setFeatureName("");
      toast({ title: "Feature saved" });
    },
    onError: () => toast({ title: "Failed to save feature", variant: "destructive" }),
  });

  const deleteFeature = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/site-map-features/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/plow-sites/${site.id}/map-features`] });
      toast({ title: "Feature deleted" });
    },
  });

  const featuresKeyRef = useRef("");

  useEffect(() => {
    if (!mapContainerRef.current || !hasCoords) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [lng, lat],
      zoom: 16,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    new maplibregl.Marker({ color: "#ef4444" }).setLngLat([lng, lat]).addTo(map);

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [hasCoords, lat, lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !features.length) return;
    const key = features.map((f) => f.id).sort().join(",");
    if (key === featuresKeyRef.current) return;
    featuresKeyRef.current = key;

    const renderFeatures = () => {
      features.forEach((f) => {
        if (!f.geojson) return;
        const sourceId = `feature-${f.id}`;
        if (map.getSource(sourceId)) return;
        try {
          map.addSource(sourceId, { type: "geojson", data: f.geojson as any });
          const ft = f.featureType;
          if (ft === "marker") {
            const coords = (f.geojson as any)?.geometry?.coordinates || [lng, lat];
            new maplibregl.Marker({ color: f.color || "#3b82f6" })
              .setLngLat(coords as [number, number])
              .addTo(map);
          } else if (ft === "polyline") {
            map.addLayer({
              id: sourceId,
              type: "line",
              source: sourceId,
              paint: { "line-color": f.color || "#3b82f6", "line-width": 3 },
            });
          } else if (ft === "polygon") {
            map.addLayer({
              id: `${sourceId}-fill`,
              type: "fill",
              source: sourceId,
              paint: { "fill-color": f.color || "#3b82f6", "fill-opacity": 0.2 },
            });
            map.addLayer({
              id: `${sourceId}-line`,
              type: "line",
              source: sourceId,
              paint: { "line-color": f.color || "#3b82f6", "line-width": 2 },
            });
          }
        } catch (e) {
          console.warn("Failed to render feature", f.id, e);
        }
      });
    };

    if (map.loaded()) {
      renderFeatures();
    } else {
      map.on("load", renderFeatures);
    }
  }, [features, lng, lat]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasCoords) return;

    if (isSatellite && mapsConfig?.apiKey) {
      const satSourceId = "google-sat";
      if (!map.getSource(satSourceId)) {
        map.addSource(satSourceId, {
          type: "raster",
          tiles: [
            `https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&key=${mapsConfig.apiKey}`,
          ],
          tileSize: 256,
        });
        map.addLayer({ id: "google-sat-layer", type: "raster", source: satSourceId }, "osm");
      }
      map.setLayoutProperty("google-sat-layer", "visibility", "visible");
      map.setLayoutProperty("osm", "visibility", "none");
    } else {
      const map2 = mapRef.current;
      if (map2) {
        try {
          if (map2.getLayer("google-sat-layer")) map2.setLayoutProperty("google-sat-layer", "visibility", "none");
          map2.setLayoutProperty("osm", "visibility", "visible");
        } catch {}
      }
    }
  }, [isSatellite, mapsConfig, hasCoords]);

  const handleMapClick = useCallback((e: maplibregl.MapMouseEvent) => {
    if (drawMode === "none") return;
    const { lng, lat } = e.lngLat;
    if (drawMode === "marker") {
      const geojson = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {},
      };
      createFeature.mutate({ name: featureName || "Marker", featureType: "marker", geojson, color: featureColor });
    } else {
      setDrawingPoints((prev) => [...prev, [lng, lat]]);
    }
  }, [drawMode, featureName, featureColor, createFeature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.on("click", handleMapClick);
    return () => { map.off("click", handleMapClick); };
  }, [handleMapClick]);

  const finishDrawing = () => {
    if (drawingPoints.length < 2) return;
    const ft = drawMode === "polygon" ? "polygon" : "polyline";
    const coords = ft === "polygon" ? [...drawingPoints, drawingPoints[0]] : drawingPoints;
    const geojson = {
      type: "Feature",
      geometry: {
        type: ft === "polygon" ? "Polygon" : "LineString",
        coordinates: ft === "polygon" ? [coords] : coords,
      },
      properties: {},
    };
    createFeature.mutate({ name: featureName || (ft === "polygon" ? "Polygon" : "Polyline"), featureType: ft, geojson, color: featureColor });
  };

  if (!hasCoords) {
    return (
      <div className="flex-1 flex items-center justify-center p-8" data-testid="no-coords">
        <div className="text-center space-y-2">
          <Navigation className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <h3 className="font-medium">No coordinates</h3>
          <p className="text-sm text-muted-foreground">Enter an address for this site to view the map.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="absolute inset-0" data-testid="map-container" />
        <div className="absolute top-3 left-3 flex gap-2 z-10">
          <Button
            size="sm"
            variant={isSatellite ? "default" : "secondary"}
            onClick={() => setIsSatellite(!isSatellite)}
            data-testid="toggle-satellite"
          >
            <Satellite className="h-4 w-4 mr-1" /> Satellite
          </Button>
        </div>
        {canEdit && (
          <div className="absolute bottom-3 left-3 flex gap-2 z-10">
            <Button
              size="sm"
              variant={drawMode === "marker" ? "default" : "secondary"}
              onClick={() => setDrawMode(drawMode === "marker" ? "none" : "marker")}
              data-testid="draw-marker"
            >
              <Crosshair className="h-4 w-4 mr-1" /> Marker
            </Button>
            <Button
              size="sm"
              variant={drawMode === "polyline" ? "default" : "secondary"}
              onClick={() => { setDrawMode(drawMode === "polyline" ? "none" : "polyline"); setDrawingPoints([]); }}
              data-testid="draw-polyline"
            >
              <PenTool className="h-4 w-4 mr-1" /> Line
            </Button>
            <Button
              size="sm"
              variant={drawMode === "polygon" ? "default" : "secondary"}
              onClick={() => { setDrawMode(drawMode === "polygon" ? "none" : "polygon"); setDrawingPoints([]); }}
              data-testid="draw-polygon"
            >
              <Pentagon className="h-4 w-4 mr-1" /> Polygon
            </Button>
            {drawingPoints.length >= 2 && (
              <Button size="sm" onClick={finishDrawing} data-testid="finish-drawing">
                <Save className="h-4 w-4 mr-1" /> Finish
              </Button>
            )}
          </div>
        )}
        {drawMode !== "none" && canEdit && (
          <div className="absolute top-3 right-14 z-10 bg-card border rounded-lg p-3 space-y-2 w-48">
            <Input
              placeholder="Feature name"
              value={featureName}
              onChange={(e) => setFeatureName(e.target.value)}
              className="h-8 text-sm"
              data-testid="feature-name-input"
            />
            <div className="flex gap-1 flex-wrap">
              {PRESET_COLORS.slice(0, 6).map((c) => (
                <button
                  key={c}
                  className={`w-6 h-6 rounded-full border-2 ${featureColor === c ? "border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setFeatureColor(c)}
                  data-testid={`feature-color-${c}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="w-64 border-l bg-card overflow-auto p-3 space-y-3" data-testid="features-panel">
        <h3 className="text-sm font-semibold">Map Features</h3>
        {featuresLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
        ) : features.length === 0 ? (
          <p className="text-xs text-muted-foreground">No features yet. Use draw tools to add markers, lines, or polygons.</p>
        ) : (
          <div className="space-y-1">
            {features.map((f) => (
              <div key={f.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 group" data-testid={`feature-${f.id}`}>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: f.color || "#3b82f6" }} />
                <span className="text-sm flex-1 truncate">{f.name || f.featureType}</span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={() => deleteFeature.mutate(f.id)}
                    data-testid={`delete-feature-${f.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 400;

function OverheadViewsTab({ site, canEdit }: { site: PlowSite; canEdit: boolean }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"capture" | "review">("review");
  const [zoom, setZoom] = useState(19);
  const [panLat, setPanLat] = useState(0);
  const [panLng, setPanLng] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [captureTitle, setCaptureTitle] = useState("");
  const [recapturePhotoId, setRecapturePhotoId] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<SitePhoto | null>(null);

  const hasCoords = site.latitude && site.longitude;
  const baseLat = parseFloat(site.latitude || "0");
  const baseLng = parseFloat(site.longitude || "0");

  useEffect(() => {
    setPanLat(baseLat);
    setPanLng(baseLng);
    setZoom(19);
    setPreviewUrl(null);
    setCaptureTitle("");
    setRecapturePhotoId(null);
  }, [site.id]);

  const { data: overheadPhotos = [], isLoading: photosLoading } = useQuery<SitePhoto[]>({
    queryKey: [`/api/plow-sites/${site.id}/site-photos`],
  });

  const savedOverheads = useMemo(
    () => overheadPhotos.filter(p => p.source === "satellite" || p.source === "overhead"),
    [overheadPhotos]
  );

  const nudgeAmount = useMemo(() => {
    return 0.001 * Math.pow(2, 19 - zoom);
  }, [zoom]);

  const handleCapture = async () => {
    setIsCapturing(true);
    try {
      const res = await apiRequest("POST", "/api/capture-satellite-image", {
        lat: panLat,
        lng: panLng,
        zoom,
        width: CAPTURE_WIDTH,
        height: CAPTURE_HEIGHT,
      });
      const data = await res.json();
      if (data.imageBase64) {
        setPreviewUrl(data.imageBase64);
        setCaptureTitle(`Overhead View - Zoom ${zoom}`);
      }
    } catch {
      toast({ title: "Failed to capture image", variant: "destructive" });
    } finally {
      setIsCapturing(false);
    }
  };

  const saveCapture = useMutation({
    mutationFn: async () => {
      if (!previewUrl) throw new Error("No image to save");

      if (recapturePhotoId) {
        const res = await apiRequest("PATCH", `/api/site-photos/${recapturePhotoId}`, {
          imageUrl: previewUrl,
          title: captureTitle || `Overhead View - Zoom ${zoom}`,
          width: CAPTURE_WIDTH,
          height: CAPTURE_HEIGHT,
        });
        return res.json();
      }

      const res = await apiRequest("POST", `/api/plow-sites/${site.id}/site-photos`, {
        imageUrl: previewUrl,
        title: captureTitle || `Overhead View - Zoom ${zoom}`,
        source: "overhead",
        width: CAPTURE_WIDTH,
        height: CAPTURE_HEIGHT,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/plow-sites/${site.id}/site-photos`] });
      setPreviewUrl(null);
      setCaptureTitle("");
      setRecapturePhotoId(null);
      setMode("review");
      toast({ title: recapturePhotoId ? "Image recaptured" : "Overhead view saved" });
    },
    onError: () => toast({ title: "Failed to save image", variant: "destructive" }),
  });

  const deletePhoto = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/site-photos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/plow-sites/${site.id}/site-photos`] });
      setViewingPhoto(null);
      toast({ title: "Photo deleted" });
    },
  });

  const startRecapture = (photo: SitePhoto) => {
    setRecapturePhotoId(photo.id);
    setCaptureTitle(photo.title || "");
    setPreviewUrl(null);
    setMode("capture");
    setViewingPhoto(null);
  };

  if (!hasCoords) {
    return (
      <div className="flex-1 flex items-center justify-center p-8" data-testid="no-coords-overhead">
        <div className="text-center space-y-2">
          <Satellite className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <h3 className="font-medium">No coordinates</h3>
          <p className="text-sm text-muted-foreground">Enter an address for this site to capture overhead views.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="overhead-views-tab">
      <div className="border-b px-4 py-2 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={mode === "review" ? "default" : "outline"}
            onClick={() => { setMode("review"); setPreviewUrl(null); setRecapturePhotoId(null); }}
            data-testid="overhead-review-mode"
          >
            <Eye className="h-4 w-4 mr-1" /> Review ({savedOverheads.length})
          </Button>
          {canEdit && (
            <Button
              size="sm"
              variant={mode === "capture" ? "default" : "outline"}
              onClick={() => { setMode("capture"); setPreviewUrl(null); setRecapturePhotoId(null); }}
              data-testid="overhead-capture-mode"
            >
              <Camera className="h-4 w-4 mr-1" /> Capture New
            </Button>
          )}
        </div>
        {mode === "capture" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Zoom: {zoom}</Badge>
            <Badge variant="outline">{CAPTURE_WIDTH}x{CAPTURE_HEIGHT}px</Badge>
          </div>
        )}
      </div>

      {mode === "capture" ? (
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center bg-muted/30 p-4 overflow-auto">
            {previewUrl ? (
              <div className="space-y-4 w-full max-w-2xl">
                <div className="border rounded-lg overflow-hidden shadow-lg bg-card">
                  <img
                    src={previewUrl}
                    alt="Captured overhead"
                    className="w-full"
                    style={{ aspectRatio: `${CAPTURE_WIDTH}/${CAPTURE_HEIGHT}` }}
                    data-testid="captured-preview"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    value={captureTitle}
                    onChange={(e) => setCaptureTitle(e.target.value)}
                    placeholder="Name this overhead view..."
                    className="flex-1"
                    data-testid="capture-title-input"
                  />
                  <Button variant="outline" onClick={() => setPreviewUrl(null)} data-testid="retake-btn">
                    <Camera className="h-4 w-4 mr-1" /> Retake
                  </Button>
                  <Button onClick={() => saveCapture.mutate()} disabled={saveCapture.isPending} data-testid="save-capture-btn">
                    {saveCapture.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    {recapturePhotoId ? "Replace" : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 w-full max-w-2xl">
                <div className="relative border rounded-lg overflow-hidden shadow-lg bg-black" style={{ aspectRatio: `${CAPTURE_WIDTH}/${CAPTURE_HEIGHT}` }}>
                  <SatellitePreview lat={panLat} lng={panLng} zoom={zoom} width={CAPTURE_WIDTH} height={CAPTURE_HEIGHT} />

                  <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-white/40 m-1 rounded" />

                  {isCapturing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="text-center text-white space-y-2">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                        <p className="text-sm">Capturing...</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-3">
                  <div className="flex items-center gap-1 bg-card border rounded-lg p-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setPanLat(p => p + nudgeAmount)} data-testid="pan-up">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setPanLat(p => p - nudgeAmount)} data-testid="pan-down">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setPanLng(p => p - nudgeAmount)} data-testid="pan-left">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setPanLng(p => p + nudgeAmount)} data-testid="pan-right">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <Separator orientation="vertical" className="h-8" />

                  <div className="flex items-center gap-1 bg-card border rounded-lg p-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom(z => Math.max(15, z - 1))} data-testid="zoom-out">
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-mono w-8 text-center">{zoom}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom(z => Math.min(21, z + 1))} data-testid="zoom-in">
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>

                  <Separator orientation="vertical" className="h-8" />

                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setPanLat(baseLat); setPanLng(baseLng); setZoom(19); }} data-testid="reset-view">
                    <Crosshair className="h-4 w-4" />
                  </Button>

                  <Separator orientation="vertical" className="h-8" />

                  <Button onClick={handleCapture} disabled={isCapturing} data-testid="capture-btn">
                    {isCapturing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Camera className="h-4 w-4 mr-1" />}
                    Capture This View
                  </Button>
                </div>

                {recapturePhotoId && (
                  <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-md text-sm">
                    <Camera className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-amber-700">Recapturing: the captured image will replace the existing one</span>
                    <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => { setRecapturePhotoId(null); setMode("review"); }}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4" data-testid="overhead-review">
          {photosLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : savedOverheads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <Satellite className="h-16 w-16 text-muted-foreground/20" />
              <h3 className="font-medium text-lg text-muted-foreground">No overhead views yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm text-center">
                Capture satellite images of this site from different angles and zoom levels.
              </p>
              {canEdit && (
                <Button onClick={() => setMode("capture")} data-testid="start-capturing">
                  <Camera className="h-4 w-4 mr-2" /> Start Capturing
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Satellite className="h-5 w-5 text-muted-foreground" />
                  Saved Overhead Views
                  <Badge variant="outline">{savedOverheads.length}</Badge>
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {savedOverheads.map((photo) => (
                  <Card
                    key={photo.id}
                    className="overflow-hidden group cursor-pointer hover:shadow-md transition-all"
                    data-testid={`overhead-card-${photo.id}`}
                  >
                    <div
                      className="relative bg-muted"
                      style={{ aspectRatio: `${CAPTURE_WIDTH}/${CAPTURE_HEIGHT}` }}
                      onClick={() => setViewingPhoto(photo)}
                    >
                      <img
                        src={photo.imageUrl}
                        alt={photo.title || "Overhead view"}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Eye className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <CardContent className="p-3 space-y-1">
                      <p className="text-sm font-medium truncate">{photo.title || "Overhead View"}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {photo.createdAt ? new Date(photo.createdAt).toLocaleDateString() : ""}
                        </span>
                        {canEdit && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => { e.stopPropagation(); startRecapture(photo); }}
                              data-testid={`recapture-${photo.id}`}
                            >
                              <Camera className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={(e) => { e.stopPropagation(); deletePhoto.mutate(photo.id); }}
                              data-testid={`delete-overhead-${photo.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!viewingPhoto} onOpenChange={(open) => { if (!open) setViewingPhoto(null); }}>
        <DialogContent className="sm:max-w-3xl" data-testid="view-overhead-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Satellite className="h-5 w-5" />
              {viewingPhoto?.title || "Overhead View"}
            </DialogTitle>
            <DialogDescription>
              {viewingPhoto?.createdAt
                ? `Captured on ${new Date(viewingPhoto.createdAt).toLocaleString()}`
                : "Overhead satellite capture"
              }
            </DialogDescription>
          </DialogHeader>
          {viewingPhoto && (
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <img
                  src={viewingPhoto.imageUrl}
                  alt={viewingPhoto.title || "Overhead view"}
                  className="w-full"
                  style={{ aspectRatio: `${CAPTURE_WIDTH}/${CAPTURE_HEIGHT}` }}
                  data-testid="full-view-image"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{viewingPhoto.width || CAPTURE_WIDTH}x{viewingPhoto.height || CAPTURE_HEIGHT}px</Badge>
              </div>
            </div>
          )}
          {canEdit && viewingPhoto && (
            <DialogFooter>
              <Button variant="destructive" size="sm" onClick={() => { deletePhoto.mutate(viewingPhoto.id); }} data-testid="delete-from-view">
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
              <Button variant="outline" onClick={() => startRecapture(viewingPhoto)} data-testid="recapture-from-view">
                <Camera className="h-4 w-4 mr-1" /> Recapture
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SatellitePreview({ lat, lng, zoom, width, height }: { lat: number; lng: number; zoom: number; width: number; height: number }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiRequest("POST", "/api/capture-satellite-image", {
          lat, lng, zoom, width: Math.min(width, 640), height: Math.min(height, 640),
        });
        const data = await res.json();
        if (data.imageBase64) {
          setImgSrc(data.imageBase64);
        }
      } catch {
        setImgSrc(null);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [lat, lng, zoom, width, height]);

  if (loading && !imgSrc) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!imgSrc) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted">
        <p className="text-sm text-muted-foreground">Failed to load satellite view</p>
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt="Satellite preview"
      className="absolute inset-0 w-full h-full object-cover"
      data-testid="satellite-live-preview"
    />
  );
}

function PhotosTab({ site, canEdit, onOpenMarkup }: {
  site: PlowSite;
  canEdit: boolean;
  onOpenMarkup: (photoId: string) => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: photos = [], isLoading } = useQuery<SitePhoto[]>({
    queryKey: [`/api/plow-sites/${site.id}/site-photos`],
  });

  const createPhoto = useMutation({
    mutationFn: async (data: { imageUrl: string; title: string; source: string; width: number; height: number }) => {
      const res = await apiRequest("POST", `/api/plow-sites/${site.id}/site-photos`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/plow-sites/${site.id}/site-photos`] });
      toast({ title: "Photo uploaded" });
    },
    onError: () => toast({ title: "Failed to upload photo", variant: "destructive" }),
  });

  const deletePhoto = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/site-photos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/plow-sites/${site.id}/site-photos`] });
      toast({ title: "Photo deleted" });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        createPhoto.mutate({
          imageUrl: dataUrl,
          title: file.name.replace(/\.[^.]+$/, ""),
          source: "upload",
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          Photos <Badge variant="outline">{photos.length}</Badge>
        </h3>
        {canEdit && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              data-testid="photo-file-input"
            />
            <Button size="sm" onClick={() => fileInputRef.current?.click()} data-testid="upload-photo-btn">
              <Upload className="h-4 w-4 mr-1" /> Upload Photo
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : photos.length === 0 ? (
        <Card data-testid="no-photos">
          <CardContent className="py-12 text-center">
            <ImageIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No photos yet. Upload a photo to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <Card key={photo.id} className="overflow-hidden group cursor-pointer" data-testid={`photo-card-${photo.id}`}>
              <div className="relative aspect-video bg-muted" onClick={() => onOpenMarkup(photo.id)}>
                <img src={photo.imageUrl} alt={photo.title || ""} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Pencil className="h-6 w-6 text-white" />
                </div>
              </div>
              <CardContent className="p-3 flex items-center justify-between">
                <p className="text-sm truncate flex-1">{photo.title || "Untitled"}</p>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={(e) => { e.stopPropagation(); deletePhoto.mutate(photo.id); }}
                    data-testid={`delete-photo-${photo.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MarkupTab({ site, canEdit, selectedPhotoId, onSelectPhoto, selectedVariantId, onSelectVariant }: {
  site: PlowSite;
  canEdit: boolean;
  selectedPhotoId: string | null;
  onSelectPhoto: (id: string | null) => void;
  selectedVariantId: string | null;
  onSelectVariant: (id: string | null) => void;
}) {
  const { toast } = useToast();
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<"select" | "pen" | "arrow" | "line" | "rect" | "circle" | "text">("select");
  const [color, setColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [stageScale, setStageScale] = useState(1);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState("");

  const { data: photos = [] } = useQuery<SitePhoto[]>({
    queryKey: [`/api/plow-sites/${site.id}/site-photos`],
  });

  const selectedPhoto = photos.find((p) => p.id === selectedPhotoId) || null;
  const bgImage = useLoadImage(selectedPhoto?.imageUrl || null);

  const imgW = selectedPhoto?.width || bgImage?.naturalWidth || 800;
  const imgH = selectedPhoto?.height || bgImage?.naturalHeight || 600;

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setStageSize({ width, height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const fitScale = useMemo(() => {
    if (!imgW || !imgH) return 1;
    const sx = stageSize.width / imgW;
    const sy = stageSize.height / imgH;
    return Math.min(sx, sy, 1);
  }, [stageSize, imgW, imgH]);

  const displayScale = fitScale * stageScale;

  const { data: variants = [] } = useQuery<SitePhotoVariant[]>({
    queryKey: [`/api/site-photos/${selectedPhotoId}/variants`],
    enabled: !!selectedPhotoId,
  });

  const createVariant = useMutation({
    mutationFn: async (data: { name: string; annotations: any }) => {
      const res = await apiRequest("POST", `/api/site-photos/${selectedPhotoId}/variants`, data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/site-photos/${selectedPhotoId}/variants`] });
      onSelectVariant(data.id);
      toast({ title: "Variant created" });
    },
  });

  const updateVariant = useMutation({
    mutationFn: async ({ id, annotations }: { id: string; annotations: any }) => {
      await apiRequest("PATCH", `/api/site-photo-variants/${id}`, { annotations });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/site-photos/${selectedPhotoId}/variants`] });
      toast({ title: "Annotations saved" });
    },
    onError: () => toast({ title: "Failed to save annotations", variant: "destructive" }),
  });

  const deleteVariant = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/site-photo-variants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/site-photos/${selectedPhotoId}/variants`] });
      onSelectVariant(null);
      toast({ title: "Variant deleted" });
    },
  });

  useEffect(() => {
    if (!selectedVariantId) {
      setAnnotations([]);
      return;
    }
    const v = variants.find((v) => v.id === selectedVariantId);
    if (v?.annotations && Array.isArray(v.annotations)) {
      setAnnotations(v.annotations as Annotation[]);
    } else {
      setAnnotations([]);
    }
    setUndoStack([]);
    setRedoStack([]);
  }, [selectedVariantId, variants]);

  const pushUndo = () => {
    setUndoStack((prev) => [...prev, annotations]);
    setRedoStack([]);
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((rs) => [...rs, annotations]);
    setAnnotations(prev);
    setUndoStack((us) => us.slice(0, -1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((us) => [...us, annotations]);
    setAnnotations(next);
    setRedoStack((rs) => rs.slice(0, -1));
  };

  const toNorm = (px: number, dim: number) => px / dim;

  const handleMouseDown = (e: any) => {
    if (tool === "select" || !selectedVariantId) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const x = (pos.x / displayScale);
    const y = (pos.y / displayScale);
    const nx = toNorm(x, imgW);
    const ny = toNorm(y, imgH);

    if (tool === "text") {
      setTextInput({ x: nx, y: ny });
      setTextValue("");
      return;
    }

    setIsDrawing(true);
    pushUndo();

    const ann: Annotation = {
      id: genId(),
      type: tool,
      color,
      strokeWidth,
    };

    if (tool === "pen") {
      ann.points = [nx, ny];
    } else if (tool === "line" || tool === "arrow") {
      ann.points = [nx, ny, nx, ny];
    } else if (tool === "rect") {
      ann.x = nx; ann.y = ny; ann.width = 0; ann.height = 0;
    } else if (tool === "circle") {
      ann.x = nx; ann.y = ny; ann.radius = 0;
    }

    setCurrentAnnotation(ann);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || !currentAnnotation) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const x = pos.x / displayScale;
    const y = pos.y / displayScale;
    const nx = toNorm(x, imgW);
    const ny = toNorm(y, imgH);

    const updated = { ...currentAnnotation };
    if (updated.type === "pen" && updated.points) {
      updated.points = [...updated.points, nx, ny];
    } else if ((updated.type === "line" || updated.type === "arrow") && updated.points) {
      updated.points = [updated.points[0], updated.points[1], nx, ny];
    } else if (updated.type === "rect") {
      updated.width = nx - (updated.x || 0);
      updated.height = ny - (updated.y || 0);
    } else if (updated.type === "circle") {
      const dx = nx - (updated.x || 0);
      const dy = ny - (updated.y || 0);
      updated.radius = Math.sqrt(dx * dx + dy * dy);
    }
    setCurrentAnnotation(updated);
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentAnnotation) return;
    setIsDrawing(false);
    setAnnotations((prev) => [...prev, currentAnnotation]);
    setCurrentAnnotation(null);
  };

  const addTextAnnotation = () => {
    if (!textInput || !textValue.trim()) { setTextInput(null); return; }
    pushUndo();
    setAnnotations((prev) => [
      ...prev,
      { id: genId(), type: "text", x: textInput.x, y: textInput.y, text: textValue.trim(), color, strokeWidth },
    ]);
    setTextInput(null);
    setTextValue("");
  };

  const saveAnnotations = () => {
    if (!selectedVariantId) return;
    updateVariant.mutate({ id: selectedVariantId, annotations });
  };

  const handleNewVariant = () => {
    const names = variants.map((v) => v.name);
    let letter = "A";
    for (let i = 0; i < 26; i++) {
      const ch = String.fromCharCode(65 + i);
      if (!names.includes(ch)) { letter = ch; break; }
    }
    createVariant.mutate({ name: letter, annotations: [] });
  };

  const renderAnnotation = (ann: Annotation, isTemp = false) => {
    const key = isTemp ? `temp-${ann.id}` : ann.id;
    const sw = ann.strokeWidth;
    if (ann.type === "pen" && ann.points) {
      return (
        <Line
          key={key}
          points={ann.points.map((p, i) => p * (i % 2 === 0 ? imgW : imgH))}
          stroke={ann.color}
          strokeWidth={sw}
          tension={0.3}
          lineCap="round"
          lineJoin="round"
          globalCompositeOperation="source-over"
        />
      );
    }
    if (ann.type === "line" && ann.points) {
      return (
        <Line
          key={key}
          points={ann.points.map((p, i) => p * (i % 2 === 0 ? imgW : imgH))}
          stroke={ann.color}
          strokeWidth={sw}
          lineCap="round"
        />
      );
    }
    if (ann.type === "arrow" && ann.points) {
      return (
        <KonvaArrow
          key={key}
          points={ann.points.map((p, i) => p * (i % 2 === 0 ? imgW : imgH))}
          stroke={ann.color}
          strokeWidth={sw}
          fill={ann.color}
          pointerLength={sw * 3}
          pointerWidth={sw * 3}
        />
      );
    }
    if (ann.type === "rect") {
      return (
        <Rect
          key={key}
          x={(ann.x || 0) * imgW}
          y={(ann.y || 0) * imgH}
          width={(ann.width || 0) * imgW}
          height={(ann.height || 0) * imgH}
          stroke={ann.color}
          strokeWidth={sw}
        />
      );
    }
    if (ann.type === "circle") {
      const r = (ann.radius || 0) * Math.min(imgW, imgH);
      return (
        <KonvaCircle
          key={key}
          x={(ann.x || 0) * imgW}
          y={(ann.y || 0) * imgH}
          radius={r}
          stroke={ann.color}
          strokeWidth={sw}
        />
      );
    }
    if (ann.type === "text") {
      return (
        <KonvaText
          key={key}
          x={(ann.x || 0) * imgW}
          y={(ann.y || 0) * imgH}
          text={ann.text || ""}
          fill={ann.color}
          fontSize={sw * 4}
        />
      );
    }
    return null;
  };

  if (!selectedPhoto) {
    return (
      <div className="flex-1 flex items-center justify-center p-8" data-testid="no-photo-selected">
        <div className="text-center space-y-3">
          <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground/30" />
          <h3 className="font-medium text-lg">Select a photo first</h3>
          <p className="text-sm text-muted-foreground">Go to the Photos tab and click a photo to start marking it up.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b px-4 py-2 flex items-center gap-3 flex-wrap">
        <Select value={selectedPhotoId || ""} onValueChange={(v) => { onSelectPhoto(v); onSelectVariant(null); }}>
          <SelectTrigger className="w-48 h-8 text-sm" data-testid="photo-selector">
            <SelectValue placeholder="Select photo" />
          </SelectTrigger>
          <SelectContent>
            {photos.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.title || "Untitled"}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-6" />

        <Select value={selectedVariantId || "original"} onValueChange={(v) => onSelectVariant(v === "original" ? null : v)}>
          <SelectTrigger className="w-40 h-8 text-sm" data-testid="variant-selector">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="original">Original (read-only)</SelectItem>
            {variants.map((v) => (
              <SelectItem key={v.id} value={v.id}>Variant {v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canEdit && (
          <>
            <Button size="sm" variant="outline" onClick={handleNewVariant} className="h-8" data-testid="new-variant-btn">
              <Plus className="h-3 w-3 mr-1" /> Variant
            </Button>
            {selectedVariantId && (
              <>
                <Button size="sm" onClick={saveAnnotations} className="h-8" disabled={updateVariant.isPending} data-testid="save-annotations-btn">
                  <Save className="h-3 w-3 mr-1" /> Save
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteVariant.mutate(selectedVariantId)} className="h-8" data-testid="delete-variant-btn">
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </>
            )}
          </>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setStageScale((s) => Math.max(0.25, s - 0.25))} data-testid="zoom-out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs w-12 text-center">{Math.round(stageScale * 100)}%</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setStageScale((s) => Math.min(4, s + 0.25))} data-testid="zoom-in">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {selectedVariantId && canEdit && (
        <div className="border-b px-4 py-2 flex items-center gap-2 flex-wrap">
          {([
            ["select", MousePointer, "Select"],
            ["pen", PenTool, "Pen"],
            ["arrow", ArrowRight, "Arrow"],
            ["line", Minus, "Line"],
            ["rect", Square, "Rectangle"],
            ["circle", Circle, "Circle"],
            ["text", Type, "Text"],
          ] as const).map(([t, Icon, label]) => (
            <Tooltip key={t}>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={tool === t ? "default" : "ghost"}
                  className="h-8 w-8"
                  onClick={() => setTool(t)}
                  data-testid={`tool-${t}`}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}

          <Separator orientation="vertical" className="h-6 mx-1" />

          <div className="flex gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                  color === c ? "border-foreground scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                data-testid={`color-${c}`}
              />
            ))}
          </div>

          <Separator orientation="vertical" className="h-6 mx-1" />

          <Select value={String(strokeWidth)} onValueChange={(v) => setStrokeWidth(Number(v))}>
            <SelectTrigger className="w-20 h-8 text-sm" data-testid="stroke-width">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LINE_WIDTHS.map((w) => (
                <SelectItem key={w} value={String(w)}>{w}px</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="h-6 mx-1" />

          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={undo} disabled={undoStack.length === 0} data-testid="undo-btn">
            <Undo className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={redo} disabled={redoStack.length === 0} data-testid="redo-btn">
            <Redo className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div ref={containerRef} className="flex-1 overflow-auto bg-muted/30 relative" data-testid="markup-canvas-container">
        {textInput && (
          <div
            className="absolute z-50 bg-card border rounded shadow-lg p-2 space-y-2"
            style={{
              left: textInput.x * imgW * displayScale + 8,
              top: textInput.y * imgH * displayScale + 8,
            }}
          >
            <Input
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Enter text..."
              className="h-8 text-sm w-48"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") addTextAnnotation(); if (e.key === "Escape") setTextInput(null); }}
              data-testid="text-annotation-input"
            />
            <div className="flex gap-1">
              <Button size="sm" className="h-7" onClick={addTextAnnotation} data-testid="confirm-text">Add</Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setTextInput(null)}>Cancel</Button>
            </div>
          </div>
        )}
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          scaleX={displayScale}
          scaleY={displayScale}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          style={{ cursor: tool === "select" ? "default" : "crosshair" }}
        >
          <Layer>
            {bgImage && (
              <KonvaImage image={bgImage} width={imgW} height={imgH} />
            )}
            {annotations.map((ann) => renderAnnotation(ann))}
            {currentAnnotation && renderAnnotation(currentAnnotation, true)}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

function InstructionsTab({ site, canEdit }: { site: PlowSite; canEdit: boolean }) {
  const { toast } = useToast();
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (site.instructions && Array.isArray(site.instructions)) {
      setInstructions(site.instructions as Instruction[]);
    } else {
      setInstructions([]);
    }
    setDirty(false);
  }, [site.id]);

  const updateSite = useMutation({
    mutationFn: async (instructions: Instruction[]) => {
      await apiRequest("PATCH", `/api/plow-sites/${site.id}`, { instructions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plow-sites"] });
      setDirty(false);
      toast({ title: "Instructions saved" });
    },
    onError: () => toast({ title: "Failed to save instructions", variant: "destructive" }),
  });

  const addStep = () => {
    const step = instructions.length + 1;
    setInstructions((prev) => [...prev, { id: genId(), step, title: "", description: "" }]);
    setDirty(true);
  };

  const updateStep = (id: string, updates: Partial<Instruction>) => {
    setInstructions((prev) => prev.map((inst) => (inst.id === id ? { ...inst, ...updates } : inst)));
    setDirty(true);
  };

  const deleteStep = (id: string) => {
    setInstructions((prev) => {
      const filtered = prev.filter((i) => i.id !== id);
      return filtered.map((inst, idx) => ({ ...inst, step: idx + 1 }));
    });
    setDirty(true);
  };

  const moveStep = (id: string, dir: "up" | "down") => {
    const idx = instructions.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const newIdx = dir === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= instructions.length) return;
    const newInst = [...instructions];
    [newInst[idx], newInst[newIdx]] = [newInst[newIdx], newInst[idx]];
    setInstructions(newInst.map((inst, i) => ({ ...inst, step: i + 1 })));
    setDirty(true);
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Instructions</h3>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addStep} data-testid="add-instruction-btn">
              <Plus className="h-4 w-4 mr-1" /> Add Step
            </Button>
            {dirty && (
              <Button
                size="sm"
                onClick={() => updateSite.mutate(instructions)}
                disabled={updateSite.isPending}
                data-testid="save-instructions-btn"
              >
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            )}
          </div>
        )}
      </div>

      {instructions.length === 0 ? (
        <Card data-testid="no-instructions">
          <CardContent className="py-12 text-center">
            <List className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No instructions yet. Add steps to guide crews.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {instructions.map((inst) => (
            <Card key={inst.id} data-testid={`instruction-step-${inst.step}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <Badge variant="outline" className="w-8 h-8 flex items-center justify-center text-sm font-bold rounded-full">
                      {inst.step}
                    </Badge>
                    {canEdit && (
                      <>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveStep(inst.id, "up")} disabled={inst.step === 1} data-testid={`move-up-${inst.id}`}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveStep(inst.id, "down")} disabled={inst.step === instructions.length} data-testid={`move-down-${inst.id}`}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    {canEdit ? (
                      <>
                        <Input
                          value={inst.title}
                          onChange={(e) => updateStep(inst.id, { title: e.target.value })}
                          placeholder="Step title"
                          className="font-medium"
                          data-testid={`instruction-title-${inst.id}`}
                        />
                        <Textarea
                          value={inst.description}
                          onChange={(e) => updateStep(inst.id, { description: e.target.value })}
                          placeholder="Description..."
                          rows={2}
                          data-testid={`instruction-desc-${inst.id}`}
                        />
                      </>
                    ) : (
                      <>
                        <p className="font-medium">{inst.title || "Untitled step"}</p>
                        {inst.description && <p className="text-sm text-muted-foreground">{inst.description}</p>}
                      </>
                    )}
                  </div>
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => deleteStep(inst.id)}
                      data-testid={`delete-instruction-${inst.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateSiteDialog({ open, onOpenChange, groups }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groups: PlowSiteGroup[];
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [groupId, setGroupId] = useState<string>("");
  const [geocodeResults, setGeocodeResults] = useState<any[]>([]);
  const [selectedGeocode, setSelectedGeocode] = useState<any>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [satelliteUrl, setSatelliteUrl] = useState<string | null>(null);
  const [isLoadingSat, setIsLoadingSat] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetForm = () => {
    setStep(1);
    setName("");
    setAddress("");
    setGroupId("");
    setGeocodeResults([]);
    setSelectedGeocode(null);
    setSatelliteUrl(null);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) { setSuggestions([]); return; }
    try {
      const res = await apiRequest("POST", "/api/ai/address-autocomplete", { query });
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleAddressChange = (value: string) => {
    setAddress(value);
    setSelectedGeocode(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const selectSuggestion = (suggestion: string) => {
    setAddress(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
    handleGeocode(suggestion);
  };

  const handleGeocode = async (addr?: string) => {
    const searchAddr = addr || address;
    if (!searchAddr.trim()) return;
    setIsGeocoding(true);
    try {
      const res = await apiRequest("POST", "/api/geocode", { address: searchAddr });
      const data = await res.json();
      setGeocodeResults(data.results || []);
      if (data.results?.length > 0) {
        setSelectedGeocode(data.results[0]);
      }
    } catch {
      toast({ title: "Address lookup failed", variant: "destructive" });
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleCaptureSatellite = async () => {
    if (!selectedGeocode) return;
    setIsLoadingSat(true);
    try {
      const res = await apiRequest("POST", "/api/address-satellite-image", { address: selectedGeocode.formatted_address || address });
      const data = await res.json();
      setSatelliteUrl(data.imageUrl || null);
    } catch {
      toast({ title: "Failed to get satellite image", variant: "destructive" });
    } finally {
      setIsLoadingSat(false);
    }
  };

  useEffect(() => {
    if (step === 2 && selectedGeocode && !satelliteUrl) {
      handleCaptureSatellite();
    }
  }, [step, selectedGeocode]);

  const createSite = useMutation({
    mutationFn: async () => {
      const body: any = {
        name,
        address: selectedGeocode?.formatted_address || address || null,
        groupId: groupId || null,
        imageUrl: satelliteUrl || null,
        imageSource: satelliteUrl ? "satellite" : null,
      };
      if (selectedGeocode) {
        body.latitude = String(selectedGeocode.lat);
        body.longitude = String(selectedGeocode.lng);
      }
      const res = await apiRequest("POST", "/api/plow-sites", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plow-sites"] });
      onOpenChange(false);
      toast({ title: "Site created" });
    },
    onError: () => toast({ title: "Failed to create site", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="create-site-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Create New Site
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Enter site details and find its location."}
            {step === 2 && "Review the overhead satellite view."}
            {step === 3 && "Review and confirm the new site."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Site Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Street Office" data-testid="create-site-name" />
            </div>
            <div className="relative">
              <Label>Address</Label>
              <div className="flex gap-2">
                <Input
                  value={address}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  placeholder="Start typing an address..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { setShowSuggestions(false); handleGeocode(); }
                    if (e.key === "Escape") setShowSuggestions(false);
                  }}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  data-testid="create-site-address"
                />
                <Button variant="outline" onClick={() => handleGeocode()} disabled={isGeocoding || !address.trim()} data-testid="geocode-btn">
                  {isGeocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto" data-testid="address-suggestions">
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-muted transition-colors flex items-center gap-2"
                      onMouseDown={() => selectSuggestion(s)}
                      data-testid={`suggestion-${i}`}
                    >
                      <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{s}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Type at least 3 characters for address suggestions</p>
            </div>
            {geocodeResults.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-auto border rounded-md p-1">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">Matching locations:</p>
                {geocodeResults.map((r, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded text-sm cursor-pointer transition-colors ${
                      selectedGeocode === r ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedGeocode(r)}
                    data-testid={`geocode-result-${i}`}
                  >
                    <MapPin className="h-3 w-3 inline mr-1 text-primary" />
                    {r.formatted_address}
                  </div>
                ))}
              </div>
            )}
            {selectedGeocode && (
              <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-md">
                <Check className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-sm text-green-700">{selectedGeocode.formatted_address}</p>
              </div>
            )}
            <div>
              <Label>Group (optional)</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger data-testid="create-site-group">
                  <SelectValue placeholder="No group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: g.color || "#6b7280" }} />
                        {g.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {isLoadingSat ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : satelliteUrl ? (
              <div className="rounded-lg overflow-hidden border">
                <img src={satelliteUrl} alt="Satellite view" className="w-full" data-testid="satellite-preview" />
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center bg-muted rounded-lg">
                <p className="text-muted-foreground text-sm">No satellite image available</p>
              </div>
            )}
            {selectedGeocode && (
              <p className="text-sm text-muted-foreground">
                <MapPin className="h-3 w-3 inline mr-1" />
                {selectedGeocode.formatted_address} ({selectedGeocode.lat.toFixed(5)}, {selectedGeocode.lng.toFixed(5)})
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="font-medium">{name}</span>
                </div>
                {selectedGeocode && (
                  <p className="text-sm text-muted-foreground">{selectedGeocode.formatted_address}</p>
                )}
                {groupId && groupId !== "none" && (
                  <Badge variant="outline">{groups.find((g) => g.id === groupId)?.name}</Badge>
                )}
                {satelliteUrl && (
                  <img src={satelliteUrl} alt="Preview" className="w-full rounded mt-2" />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} data-testid="create-site-back">
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={step === 1 && !name.trim()} data-testid="create-site-next">
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => createSite.mutate()} disabled={createSite.isPending} data-testid="create-site-submit">
              {createSite.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Create Site
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateGroupDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [groupType, setGroupType] = useState("custom");
  const [color, setColor] = useState("#3b82f6");

  useEffect(() => {
    if (!open) { setName(""); setGroupType("custom"); setColor("#3b82f6"); }
  }, [open]);

  const createGroup = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/plow-site-groups", { name, groupType, color });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plow-site-groups"] });
      onOpenChange(false);
      toast({ title: "Group created" });
    },
    onError: () => toast({ title: "Failed to create group", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="create-group-dialog">
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
          <DialogDescription>Organize sites into groups for easy management.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Group Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Commercial Properties" data-testid="create-group-name" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={groupType} onValueChange={setGroupType}>
              <SelectTrigger data-testid="create-group-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="residential">Residential</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="municipal">Municipal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-1">
              {PRESET_COLORS.slice(0, 7).map((c) => (
                <button
                  key={c}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  data-testid={`group-color-${c}`}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createGroup.mutate()} disabled={!name.trim() || createGroup.isPending} data-testid="create-group-submit">
            {createGroup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditGroupDialog({ group, onOpenChange }: {
  group: PlowSiteGroup | null;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");

  useEffect(() => {
    if (group) {
      setName(group.name);
      setColor(group.color || "#3b82f6");
    }
  }, [group]);

  const updateGroup = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/plow-site-groups/${group!.id}`, { name, color });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plow-site-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plow-sites"] });
      onOpenChange(false);
      toast({ title: "Group updated" });
    },
    onError: () => toast({ title: "Failed to update group", variant: "destructive" }),
  });

  const deleteGroup = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/plow-site-groups/${group!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plow-site-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plow-sites"] });
      onOpenChange(false);
      toast({ title: "Group deleted" });
    },
    onError: () => toast({ title: "Failed to delete group", variant: "destructive" }),
  });

  return (
    <Dialog open={!!group} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="edit-group-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Edit Group
          </DialogTitle>
          <DialogDescription>Rename this group or change its color.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Group Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" data-testid="edit-group-name" />
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-1">
              {PRESET_COLORS.slice(0, 7).map((c) => (
                <button
                  key={c}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  data-testid={`edit-group-color-${c}`}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="destructive" size="sm" onClick={() => deleteGroup.mutate()} disabled={deleteGroup.isPending} data-testid="delete-group-btn">
            {deleteGroup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => updateGroup.mutate()} disabled={!name.trim() || updateGroup.isPending} data-testid="save-group-btn">
              {updateGroup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}