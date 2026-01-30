import React, { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { PlowSite, PlowSiteGroup, User } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  MapPin, 
  Upload, 
  Trash2, 
  Edit, 
  Eye, 
  Save, 
  X, 
  Paintbrush, 
  Circle, 
  Square, 
  ArrowRight, 
  Type, 
  Undo, 
  Redo,
  Sparkles,
  Search,
  ChevronRight,
  Snowflake,
  Navigation,
  Folder,
  FolderPlus,
  Home,
  Building2,
  Route,
  Tag,
  Settings,
  Loader2,
  ZoomIn,
  ZoomOut,
  Camera,
  Minus,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Move,
  RotateCcw,
  ImagePlus
} from "lucide-react";

type Annotation = {
  id: string;
  type: "rect" | "circle" | "line" | "arrow" | "text" | "icon";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  endX?: number;
  endY?: number;
  color: string;
  text?: string;
  iconType?: string;
  step?: number;
};

type Instruction = {
  id: string;
  step: number;
  title: string;
  description: string;
};

type PlowPermissions = {
  canEdit: boolean;
  canView: boolean;
};

export default function PlowSiteMapper() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedSite, setSelectedSite] = useState<PlowSite | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [addressSearch, setAddressSearch] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteAddress, setNewSiteAddress] = useState("");
  const [newSiteGroupId, setNewSiteGroupId] = useState<string | null>(null);
  const [createStep, setCreateStep] = useState<"info" | "satellite" | "streetview" | "photos" | "confirm">("info");
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [satelliteImageUrl, setSatelliteImageUrl] = useState<string | null>(null);
  const [isLoadingSatellite, setIsLoadingSatellite] = useState(false);
  const [imageSource, setImageSource] = useState<"satellite" | "upload" | null>(null);
  const [mapCoordinates, setMapCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState(19);
  const [capturedMapImage, setCapturedMapImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [mapOffset, setMapOffset] = useState<{ lat: number; lng: number }>({ lat: 0, lng: 0 });
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "2:3" | "3:4" | "16:9">("16:9");
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const mapPreviewRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const [mapsApiKey, setMapsApiKey] = useState<string>("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<string>("custom");
  const [newGroupColor, setNewGroupColor] = useState("#3b82f6");
  const [editingGroup, setEditingGroup] = useState<PlowSiteGroup | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [currentTool, setCurrentTool] = useState<"select" | "rect" | "circle" | "line" | "arrow" | "text" | "icon">("select");
  const [currentColor, setCurrentColor] = useState("#ef4444");
  const [currentIcon, setCurrentIcon] = useState("plow");
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [streetViewAvailable, setStreetViewAvailable] = useState(false);
  const [streetViewHeading, setStreetViewHeading] = useState(0);
  const [streetViewPitch, setStreetViewPitch] = useState(0);
  const [streetViewFov, setStreetViewFov] = useState(90);
  const [capturedStreetViewImage, setCapturedStreetViewImage] = useState<string | null>(null);
  const [isCapturingStreetView, setIsCapturingStreetView] = useState(false);
  const [additionalImages, setAdditionalImages] = useState<Array<{ id: string; title: string; imageBase64: string; type: "streetview" | "upload" }>>([]);
  const streetViewRef = useRef<HTMLDivElement>(null);
  const additionalImageInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addressSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get user's location on mount for better address suggestions
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.log("Geolocation not available:", error.message);
        }
      );
    }
  }, []);

  // Fetch Google Maps API key on mount
  useEffect(() => {
    fetch("/api/maps-config", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.apiKey) {
          setMapsApiKey(data.apiKey);
        }
      })
      .catch(err => console.log("Could not load maps config:", err));
  }, []);

  const analyzeWithAI = async () => {
    if (!uploadedImage) return;
    setIsAnalyzing(true);
    setAiAnalysis(null);
    try {
      const res = await fetch("/api/ai/analyze-plow-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageBase64: uploadedImage }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data);
        toast({ title: "AI Analysis Complete" });
      } else {
        toast({ title: "AI analysis failed", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "AI analysis error", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const { data: permissions } = useQuery<PlowPermissions>({
    queryKey: ["/api/plow-site-permissions/my"],
  });

  const { data: sites = [] } = useQuery<PlowSite[]>({
    queryKey: ["/api/plow-sites"],
    enabled: permissions?.canView,
  });

  const { data: groups = [] } = useQuery<PlowSiteGroup[]>({
    queryKey: ["/api/plow-site-groups"],
    enabled: permissions?.canView,
  });

  const createGroup = useMutation({
    mutationFn: async (data: { name: string; groupType: string; color: string }) => {
      const res = await fetch("/api/plow-site-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create group");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plow-site-groups"] });
      setIsGroupDialogOpen(false);
      setNewGroupName("");
      setNewGroupType("custom");
      setNewGroupColor("#3b82f6");
      toast({ title: "Group created successfully" });
    },
    onError: () => toast({ title: "Failed to create group", variant: "destructive" }),
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PlowSiteGroup> }) => {
      const res = await fetch(`/api/plow-site-groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update group");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plow-site-groups"] });
      setEditingGroup(null);
      toast({ title: "Group updated successfully" });
    },
    onError: () => toast({ title: "Failed to update group", variant: "destructive" }),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/plow-site-groups/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete group");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plow-site-groups"] });
      toast({ title: "Group deleted" });
    },
    onError: () => toast({ title: "Failed to delete group", variant: "destructive" }),
  });

  const searchAddresses = useCallback(async (query: string) => {
    if (query.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    setIsSearchingAddress(true);
    try {
      const requestBody: { query: string; latitude?: number; longitude?: number } = { query };
      
      // Include user's location for better local results
      if (userLocation) {
        requestBody.latitude = userLocation.latitude;
        requestBody.longitude = userLocation.longitude;
      }
      
      const res = await fetch("/api/ai/address-autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });
      if (res.ok) {
        const data = await res.json();
        setAddressSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error("Address search error:", err);
    } finally {
      setIsSearchingAddress(false);
    }
  }, [userLocation]);

  const handleAddressChange = (value: string) => {
    setNewSiteAddress(value);
    if (addressSearchTimeoutRef.current) {
      clearTimeout(addressSearchTimeoutRef.current);
    }
    addressSearchTimeoutRef.current = setTimeout(() => {
      searchAddresses(value);
    }, 300);
  };

  const fetchSatelliteImage = async (address: string) => {
    setIsLoadingSatellite(true);
    setSatelliteImageUrl(null);
    setMapCoordinates(null);
    setCapturedMapImage(null);
    try {
      const res = await fetch("/api/address-satellite-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address }),
      });
      if (res.ok) {
        const data = await res.json();
        setSatelliteImageUrl(data.imageUrl);
        if (data.coordinates) {
          setMapCoordinates(data.coordinates);
          setMapZoom(19);
          checkStreetViewAvailability(data.coordinates.lat, data.coordinates.lng);
        }
      }
    } catch (err) {
      console.error("Failed to fetch satellite image:", err);
    } finally {
      setIsLoadingSatellite(false);
    }
  };

  const checkStreetViewAvailability = async (lat: number, lng: number) => {
    try {
      const res = await fetch("/api/streetview-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lat, lng }),
      });
      if (res.ok) {
        const data = await res.json();
        setStreetViewAvailable(data.available);
      } else {
        setStreetViewAvailable(false);
      }
    } catch (err) {
      console.error("Failed to check Street View availability:", err);
      setStreetViewAvailable(false);
    }
  };

  const captureStreetView = async () => {
    if (!mapCoordinates) return;
    setIsCapturingStreetView(true);
    try {
      const coords = getAdjustedCoordinates();
      const res = await fetch("/api/capture-streetview-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          lat: coords?.lat || mapCoordinates.lat,
          lng: coords?.lng || mapCoordinates.lng,
          heading: Math.round(streetViewHeading),
          pitch: Math.round(streetViewPitch),
          fov: Math.round(streetViewFov),
          width: 640,
          height: 480,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCapturedStreetViewImage(data.imageBase64);
        toast({ title: "Street View captured", description: "Image captured successfully" });
      } else {
        toast({ title: "Capture failed", description: "Could not capture Street View", variant: "destructive" });
      }
    } catch (err) {
      console.error("Failed to capture Street View:", err);
      toast({ title: "Error", description: "Failed to capture Street View image", variant: "destructive" });
    } finally {
      setIsCapturingStreetView(false);
    }
  };

  const handleAdditionalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageBase64 = event.target?.result as string;
        const id = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setAdditionalImages(prev => [
          ...prev,
          { id, title: file.name.replace(/\.[^/.]+$/, ""), imageBase64, type: "upload" }
        ]);
      };
      reader.readAsDataURL(file);
    });
    
    if (e.target) e.target.value = "";
  };

  const addStreetViewToAdditionalImages = () => {
    if (!capturedStreetViewImage) return;
    const id = `sv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setAdditionalImages(prev => [
      ...prev,
      { id, title: `Street View ${Math.round(streetViewHeading)}°`, imageBase64: capturedStreetViewImage, type: "streetview" }
    ]);
    setCapturedStreetViewImage(null);
    toast({ title: "Added", description: "Street View image added to site images" });
  };

  const removeAdditionalImage = (id: string) => {
    setAdditionalImages(prev => prev.filter(img => img.id !== id));
  };

  // Street View navigation is now handled by arrow buttons (no drag)

  const getImageDimensions = () => {
    // Always use HD quality (scale=2 gives 1280x800 effective resolution)
    switch (aspectRatio) {
      case "1:1": return { width: 640, height: 640 };
      case "2:3": return { width: 426, height: 640 };
      case "3:4": return { width: 480, height: 640 };
      case "16:9": return { width: 640, height: 360 };
      default: return { width: 640, height: 360 };
    }
  };

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case "1:1": return "aspect-square";
      case "2:3": return "aspect-[2/3]";
      case "3:4": return "aspect-[3/4]";
      case "16:9": return "aspect-video";
      default: return "aspect-video";
    }
  };

  const panMap = (direction: "up" | "down" | "left" | "right") => {
    const panAmount = 0.0005 * Math.pow(2, 19 - mapZoom);
    setMapOffset(prev => {
      switch (direction) {
        case "up": return { ...prev, lat: prev.lat + panAmount };
        case "down": return { ...prev, lat: prev.lat - panAmount };
        case "left": return { ...prev, lng: prev.lng - panAmount };
        case "right": return { ...prev, lng: prev.lng + panAmount };
        default: return prev;
      }
    });
  };

  const handleMapMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragDelta({ x: 0, y: 0 });
  };

  const handleMapMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    e.preventDefault();
    e.stopPropagation();
    
    // Use CSS transform for smooth visual feedback
    setDragDelta({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMapMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDragging && (dragDelta.x !== 0 || dragDelta.y !== 0)) {
      // Convert accumulated pixel movement to lat/lng offset
      const pixelToLatLng = 0.00002 * Math.pow(2, 19 - mapZoom);
      setMapOffset(prev => ({
        lat: prev.lat + dragDelta.y * pixelToLatLng,
        lng: prev.lng - dragDelta.x * pixelToLatLng
      }));
    }
    setIsDragging(false);
    setDragStart(null);
    setDragDelta({ x: 0, y: 0 });
  };

  const handleMapWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.deltaY < 0) {
      setMapZoom(prev => Math.min(21, prev + 1));
    } else {
      setMapZoom(prev => Math.max(15, prev - 1));
    }
  };

  const handleMapTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      e.stopPropagation();
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setDragDelta({ x: 0, y: 0 });
    }
  };

  const handleMapTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !dragStart || e.touches.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    
    setDragDelta({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const handleMapTouchEnd = () => {
    if (isDragging && (dragDelta.x !== 0 || dragDelta.y !== 0)) {
      const pixelToLatLng = 0.00002 * Math.pow(2, 19 - mapZoom);
      setMapOffset(prev => ({
        lat: prev.lat + dragDelta.y * pixelToLatLng,
        lng: prev.lng - dragDelta.x * pixelToLatLng
      }));
    }
    setIsDragging(false);
    setDragStart(null);
    setDragDelta({ x: 0, y: 0 });
  };

  const getAdjustedCoordinates = () => {
    if (!mapCoordinates) return null;
    return {
      lat: mapCoordinates.lat + mapOffset.lat,
      lng: mapCoordinates.lng + mapOffset.lng
    };
  };

  const captureMapView = async () => {
    const coords = getAdjustedCoordinates();
    if (!coords) return;
    setIsCapturing(true);
    
    const dimensions = getImageDimensions();
    
    try {
      // Fetch the image as base64 to avoid CORS issues on canvas
      const res = await fetch("/api/capture-satellite-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          lat: coords.lat,
          lng: coords.lng,
          zoom: mapZoom,
          width: dimensions.width,
          height: dimensions.height
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.imageBase64) {
          setCapturedMapImage(data.imageBase64);
          setUploadedImage(data.imageBase64);
          setImageSource("satellite");
          toast({ title: "View captured successfully!" });
        }
      } else {
        toast({ title: "Failed to capture view", variant: "destructive" });
      }
    } catch (err) {
      console.error("Failed to capture map view:", err);
      toast({ title: "Failed to capture view", variant: "destructive" });
    } finally {
      setIsCapturing(false);
    }
  };

  const handleAddressSelect = (address: string) => {
    setNewSiteAddress(address);
    setAddressSuggestions([]);
    // Fetch satellite image for the selected address
    fetchSatelliteImage(address);
    setCreateStep("satellite");
  };

  const resetCreateDialog = () => {
    setNewSiteName("");
    setNewSiteAddress("");
    setNewSiteGroupId(null);
    setUploadedImage(null);
    setAddressSuggestions([]);
    setCreateStep("info");
    setIsManualEntry(false);
    setSatelliteImageUrl(null);
    setImageSource(null);
    setMapCoordinates(null);
    setMapZoom(19);
    setCapturedMapImage(null);
    setIsCapturing(false);
    setMapOffset({ lat: 0, lng: 0 });
    setAspectRatio("16:9");
    setDragDelta({ x: 0, y: 0 });
    setStreetViewAvailable(false);
    setStreetViewHeading(0);
    setStreetViewPitch(0);
    setStreetViewFov(90);
    setCapturedStreetViewImage(null);
    setAdditionalImages([]);
  };

  const filteredSites = selectedGroupFilter 
    ? sites.filter(site => site.groupId === selectedGroupFilter)
    : sites;

  const createSite = useMutation({
    mutationFn: async (data: { name: string; address?: string; groupId?: string; imageUrl?: string; imageSource?: string }) => {
      const res = await fetch("/api/plow-sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create site");
      return res.json();
    },
    onSuccess: (site) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plow-sites"] });
      setSelectedSite(site);
      setIsCreateDialogOpen(false);
      setIsEditing(true);
      resetCreateDialog();
      toast({ title: "Site created successfully" });
    },
    onError: () => toast({ title: "Failed to create site", variant: "destructive" }),
  });

  const updateSite = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PlowSite> }) => {
      const res = await fetch(`/api/plow-sites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update site");
      return res.json();
    },
    onSuccess: (site) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plow-sites"] });
      setSelectedSite(site);
      toast({ title: "Site saved successfully" });
    },
    onError: () => toast({ title: "Failed to save site", variant: "destructive" }),
  });

  const deleteSite = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/plow-sites/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete site");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plow-sites"] });
      setSelectedSite(null);
      toast({ title: "Site deleted" });
    },
    onError: () => toast({ title: "Failed to delete site", variant: "destructive" }),
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateSite = () => {
    createSite.mutate({
      name: newSiteName,
      address: newSiteAddress,
      groupId: newSiteGroupId || undefined,
      imageUrl: uploadedImage || undefined,
      imageSource: imageSource || (uploadedImage ? "upload" : undefined),
    });
  };

  const handleCreateGroup = () => {
    createGroup.mutate({
      name: newGroupName,
      groupType: newGroupType,
      color: newGroupColor,
    });
  };

  const getGroupIcon = (groupType: string) => {
    switch (groupType) {
      case "residential": return <Home className="h-4 w-4" />;
      case "commercial": return <Building2 className="h-4 w-4" />;
      case "route": return <Route className="h-4 w-4" />;
      default: return <Tag className="h-4 w-4" />;
    }
  };

  const handleSaveSite = () => {
    if (!selectedSite) return;
    updateSite.mutate({
      id: selectedSite.id,
      data: {
        annotations: annotations as any,
        instructions: instructions as any,
        imageUrl: uploadedImage || selectedSite.imageUrl,
      },
    });
    setIsEditing(false);
  };

  const loadSiteData = useCallback((site: PlowSite) => {
    setAnnotations((site.annotations as Annotation[]) || []);
    setInstructions((site.instructions as Instruction[]) || []);
    if (site.imageUrl) {
      setUploadedImage(site.imageUrl);
    }
  }, []);

  useEffect(() => {
    if (selectedSite) {
      loadSiteData(selectedSite);
    }
  }, [selectedSite, loadSiteData]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || currentTool === "select") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDrawing(true);
    setDrawStart({ x, y });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    const newAnnotation: Annotation = {
      id: crypto.randomUUID(),
      type: currentTool as Annotation["type"],
      x: drawStart.x,
      y: drawStart.y,
      color: currentColor,
    };

    if (currentTool === "rect") {
      newAnnotation.width = Math.abs(endX - drawStart.x);
      newAnnotation.height = Math.abs(endY - drawStart.y);
      newAnnotation.x = Math.min(drawStart.x, endX);
      newAnnotation.y = Math.min(drawStart.y, endY);
    } else if (currentTool === "circle") {
      newAnnotation.radius = Math.sqrt(Math.pow(endX - drawStart.x, 2) + Math.pow(endY - drawStart.y, 2));
    } else if (currentTool === "line" || currentTool === "arrow") {
      newAnnotation.endX = endX;
      newAnnotation.endY = endY;
    } else if (currentTool === "text") {
      newAnnotation.text = "Label";
    } else if (currentTool === "icon") {
      newAnnotation.iconType = currentIcon;
    }

    setAnnotations([...annotations, newAnnotation]);
    setIsDrawing(false);
    setDrawStart(null);
  };

  const drawAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (uploadedImage && imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    }

    annotations.forEach((ann) => {
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color + "40";
      ctx.lineWidth = 3;

      if (ann.type === "rect" && ann.width && ann.height) {
        ctx.beginPath();
        ctx.rect(ann.x, ann.y, ann.width, ann.height);
        ctx.fill();
        ctx.stroke();
      } else if (ann.type === "circle" && ann.radius) {
        ctx.beginPath();
        ctx.arc(ann.x, ann.y, ann.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if ((ann.type === "line" || ann.type === "arrow") && ann.endX !== undefined && ann.endY !== undefined) {
        ctx.beginPath();
        ctx.moveTo(ann.x, ann.y);
        ctx.lineTo(ann.endX, ann.endY);
        ctx.stroke();
        if (ann.type === "arrow") {
          const angle = Math.atan2(ann.endY - ann.y, ann.endX - ann.x);
          ctx.beginPath();
          ctx.moveTo(ann.endX, ann.endY);
          ctx.lineTo(ann.endX - 15 * Math.cos(angle - Math.PI / 6), ann.endY - 15 * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(ann.endX - 15 * Math.cos(angle + Math.PI / 6), ann.endY - 15 * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fillStyle = ann.color;
          ctx.fill();
        }
      } else if (ann.type === "text" && ann.text) {
        ctx.font = "bold 16px Arial";
        ctx.fillStyle = ann.color;
        ctx.fillText(ann.text, ann.x, ann.y);
      } else if (ann.type === "icon") {
        ctx.font = "24px Arial";
        ctx.fillStyle = ann.color;
        const iconEmoji = ann.iconType === "plow" ? "🚜" : ann.iconType === "salt" ? "🧂" : ann.iconType === "shovel" ? "⛏️" : ann.iconType === "warning" ? "⚠️" : "📍";
        ctx.fillText(iconEmoji, ann.x, ann.y);
      }
    });
  }, [annotations, uploadedImage]);

  useEffect(() => {
    drawAnnotations();
  }, [drawAnnotations]);

  useEffect(() => {
    if (uploadedImage) {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        drawAnnotations();
      };
      img.src = uploadedImage;
    }
  }, [uploadedImage, drawAnnotations]);

  // Auto-skip streetview step if street view is not available
  useEffect(() => {
    if (createStep === "streetview" && (!streetViewAvailable || !mapCoordinates || !mapsApiKey)) {
      setCreateStep("photos");
    }
  }, [createStep, streetViewAvailable, mapCoordinates, mapsApiKey]);

  const addInstruction = () => {
    setInstructions([
      ...instructions,
      {
        id: crypto.randomUUID(),
        step: instructions.length + 1,
        title: `Step ${instructions.length + 1}`,
        description: "",
      },
    ]);
  };

  const updateInstruction = (id: string, updates: Partial<Instruction>) => {
    setInstructions(instructions.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  };

  const deleteInstruction = (id: string) => {
    setInstructions(instructions.filter((i) => i.id !== id).map((i, idx) => ({ ...i, step: idx + 1 })));
  };

  const colors = [
    { name: "Red", value: "#ef4444" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Green", value: "#22c55e" },
    { name: "Yellow", value: "#eab308" },
    { name: "Orange", value: "#f97316" },
    { name: "Purple", value: "#a855f7" },
  ];

  const icons = [
    { name: "Plow", value: "plow", emoji: "🚜" },
    { name: "Salt", value: "salt", emoji: "🧂" },
    { name: "Shovel", value: "shovel", emoji: "⛏️" },
    { name: "Warning", value: "warning", emoji: "⚠️" },
    { name: "Marker", value: "marker", emoji: "📍" },
  ];

  if (!permissions?.canView) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Snowflake className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground">You don't have access to the Plow Site Mapper tool.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="plow-site-mapper-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Snowflake className="h-6 w-6" />
            Plow Site Mapper
          </h1>
          <p className="text-muted-foreground">Create and manage snow removal route maps for your properties</p>
        </div>
        {permissions?.canEdit && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-site">
                <Plus className="h-4 w-4 mr-2" />
                New Site
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>
                  {createStep === "info" && "Step 1: Site Details"}
                  {createStep === "satellite" && "Step 2: Overhead View"}
                  {createStep === "streetview" && "Step 3: Street View"}
                  {createStep === "photos" && "Step 4: Additional Photos"}
                  {createStep === "confirm" && "Step 5: Confirm & Create"}
                </DialogTitle>
                <DialogDescription>
                  {createStep === "info" && "Enter site name and address"}
                  {createStep === "satellite" && "Drag to pan, scroll to zoom, then capture"}
                  {createStep === "streetview" && "Use arrows to look around, buttons to zoom"}
                  {createStep === "photos" && "Add any additional reference photos"}
                  {createStep === "confirm" && "Review your site details"}
                </DialogDescription>
              </DialogHeader>
              
              {/* Step indicator */}
              <div className="flex items-center justify-center gap-1 py-2">
                <div className={`w-6 h-1 rounded ${createStep === "info" ? "bg-primary" : "bg-muted"}`} />
                <div className={`w-6 h-1 rounded ${createStep === "satellite" ? "bg-primary" : "bg-muted"}`} />
                <div className={`w-6 h-1 rounded ${createStep === "streetview" ? "bg-primary" : streetViewAvailable ? "bg-muted" : "bg-muted/30"}`} />
                <div className={`w-6 h-1 rounded ${createStep === "photos" ? "bg-primary" : "bg-muted"}`} />
                <div className={`w-6 h-1 rounded ${createStep === "confirm" ? "bg-primary" : "bg-muted"}`} />
              </div>

              {/* Step 1: Info */}
              {createStep === "info" && (
                <div className="space-y-4 py-4">
                  {/* Toggle between address lookup and manual entry */}
                  <div className="flex gap-2 p-1 bg-muted rounded-lg">
                    <Button
                      variant={!isManualEntry ? "default" : "ghost"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setIsManualEntry(false)}
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Find Address
                    </Button>
                    <Button
                      variant={isManualEntry ? "default" : "ghost"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setIsManualEntry(true)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Manual Entry
                    </Button>
                  </div>

                  <div>
                    <Label>Site Name</Label>
                    <Input
                      value={newSiteName}
                      onChange={(e) => setNewSiteName(e.target.value)}
                      placeholder="e.g., Johnson Property"
                      data-testid="input-site-name"
                    />
                  </div>

                  {!isManualEntry ? (
                    <div className="relative">
                      <Label>Address</Label>
                      <div className="relative">
                        <Input
                          value={newSiteAddress}
                          onChange={(e) => handleAddressChange(e.target.value)}
                          placeholder="Start typing an address..."
                          data-testid="input-site-address"
                        />
                        {isSearchingAddress && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      {addressSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {addressSuggestions.map((suggestion, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-accent cursor-pointer"
                              onClick={() => handleAddressSelect(suggestion)}
                              data-testid={`address-suggestion-${idx}`}
                            >
                              <MapPin className="h-3 w-3 inline mr-2 text-muted-foreground" />
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Select an address to see satellite imagery
                      </p>
                      {newSiteAddress.length > 5 && addressSuggestions.length === 0 && !isSearchingAddress && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 w-full"
                          onClick={() => handleAddressSelect(newSiteAddress)}
                          data-testid="button-use-typed-address"
                        >
                          Use this address
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label>Address (Optional)</Label>
                        <Input
                          value={newSiteAddress}
                          onChange={(e) => setNewSiteAddress(e.target.value)}
                          placeholder="Enter address manually..."
                          data-testid="input-site-address-manual"
                        />
                      </div>
                      <div>
                        <Label>Property Image</Label>
                        <div className="mt-2 space-y-2">
                          <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full"
                            data-testid="button-upload-image"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Image
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                          {uploadedImage && (
                            <div className="relative">
                              <img src={uploadedImage} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 right-2"
                                onClick={() => setUploadedImage(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <Label>Group (Optional)</Label>
                    <Select value={newSiteGroupId || "none"} onValueChange={(val) => setNewSiteGroupId(val === "none" ? null : val)}>
                      <SelectTrigger data-testid="select-site-group">
                        <SelectValue placeholder="Select a group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Group</SelectItem>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            <span className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color || "#3b82f6" }} />
                              {group.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Step 2: Satellite View */}
              {createStep === "satellite" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {newSiteAddress}
                    </div>
                    <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as typeof aspectRatio)}>
                      <SelectTrigger className="h-7 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="16:9">16:9</SelectItem>
                        <SelectItem value="3:4">3:4</SelectItem>
                        <SelectItem value="2:3">2:3</SelectItem>
                        <SelectItem value="1:1">1:1</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isLoadingSatellite ? (
                    <div className="h-80 flex items-center justify-center bg-muted rounded-lg">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading map...</span>
                    </div>
                  ) : mapCoordinates ? (
                    <div 
                      ref={mapPreviewRef}
                      className={`relative rounded-lg overflow-hidden border-2 border-muted select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} w-full ${getAspectRatioClass()}`}
                      style={{ maxWidth: '100%' }}
                      onMouseDown={handleMapMouseDown}
                      onMouseMove={handleMapMouseMove}
                      onMouseUp={handleMapMouseUp}
                      onMouseLeave={handleMapMouseUp}
                      onWheel={handleMapWheel}
                      onTouchStart={handleMapTouchStart}
                      onTouchMove={handleMapTouchMove}
                      onTouchEnd={handleMapTouchEnd}
                    >
                      <img 
                        src={mapsApiKey && getAdjustedCoordinates() ? `https://maps.googleapis.com/maps/api/staticmap?center=${getAdjustedCoordinates()!.lat},${getAdjustedCoordinates()!.lng}&zoom=${mapZoom}&size=640x640&scale=2&maptype=satellite&key=${mapsApiKey}` : satelliteImageUrl || ''}
                        alt="Satellite view" 
                        className="w-full h-full object-cover pointer-events-none"
                        style={{ transform: isDragging ? `translate(${dragDelta.x}px, ${dragDelta.y}px)` : 'none' }}
                        draggable={false}
                      />
                      
                      {/* Zoom controls */}
                      <div className="absolute right-2 top-2 flex flex-col gap-1">
                        <Button variant="secondary" size="icon" className="h-8 w-8 bg-background/90 shadow-md"
                          onClick={(e) => { e.stopPropagation(); setMapZoom(Math.min(21, mapZoom + 1)); }} disabled={mapZoom >= 21}>
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button variant="secondary" size="icon" className="h-8 w-8 bg-background/90 shadow-md"
                          onClick={(e) => { e.stopPropagation(); setMapZoom(Math.max(15, mapZoom - 1)); }} disabled={mapZoom <= 15}>
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <Button variant="secondary" size="icon" className="h-8 w-8 bg-background/90 shadow-md"
                          onClick={(e) => { e.stopPropagation(); setMapOffset({ lat: 0, lng: 0 }); }} title="Reset">
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>

                      {capturedMapImage && (
                        <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                          <Camera className="h-3 w-3" /> Captured
                        </div>
                      )}
                      
                      <div className="absolute bottom-2 left-2 bg-background/90 text-foreground px-2 py-1 rounded text-xs">
                        Zoom: {mapZoom}
                      </div>
                    </div>
                  ) : (
                    <div className="h-80 flex flex-col items-center justify-center bg-muted rounded-lg gap-3">
                      <span className="text-muted-foreground">Map not available</span>
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" /> Upload Image Instead
                      </Button>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleImageUpload(e);
                      setImageSource("upload");
                    }}
                  />
                </div>
              )}

              {/* Step 3: Street View */}
              {createStep === "streetview" && mapCoordinates && mapsApiKey && (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Navigation className="h-4 w-4" />
                    Street-level view of {newSiteAddress}
                  </div>

                  <div ref={streetViewRef} className="relative rounded-lg overflow-hidden border-2 border-muted h-80">
                    <img 
                      src={`https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${mapCoordinates.lat},${mapCoordinates.lng}&heading=${Math.round(streetViewHeading)}&pitch=${Math.round(streetViewPitch)}&fov=${Math.round(streetViewFov)}&key=${mapsApiKey}`}
                      alt="Street View"
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                    
                    {/* Arrow navigation controls */}
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-background/90 hover:bg-background shadow-lg z-10"
                      onClick={() => setStreetViewHeading(prev => (prev - 30 + 360) % 360)}
                      data-testid="button-streetview-left"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Button>
                    
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-14 top-1/2 -translate-y-1/2 h-10 w-10 bg-background/90 hover:bg-background shadow-lg z-10"
                      onClick={() => setStreetViewHeading(prev => (prev + 30) % 360)}
                      data-testid="button-streetview-right"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                    
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute top-2 left-1/2 -translate-x-1/2 h-10 w-10 bg-background/90 hover:bg-background shadow-lg z-10"
                      onClick={() => setStreetViewPitch(prev => Math.min(90, prev + 15))}
                      data-testid="button-streetview-up"
                    >
                      <ChevronUp className="h-6 w-6" />
                    </Button>
                    
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute bottom-12 left-1/2 -translate-x-1/2 h-10 w-10 bg-background/90 hover:bg-background shadow-lg z-10"
                      onClick={() => setStreetViewPitch(prev => Math.max(-90, prev - 15))}
                      data-testid="button-streetview-down"
                    >
                      <ChevronDown className="h-6 w-6" />
                    </Button>
                    
                    {/* Zoom controls */}
                    <div className="absolute right-2 top-2 flex flex-col gap-1">
                      <Button variant="secondary" size="icon" className="h-8 w-8 bg-background/80 shadow-md"
                        onClick={() => setStreetViewFov(prev => Math.max(30, prev - 15))}
                        data-testid="button-streetview-zoom-in">
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <Button variant="secondary" size="icon" className="h-8 w-8 bg-background/80 shadow-md"
                        onClick={() => setStreetViewFov(prev => Math.min(120, prev + 15))}
                        data-testid="button-streetview-zoom-out">
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <Button variant="secondary" size="icon" className="h-8 w-8 bg-background/80 shadow-md"
                        onClick={() => { setStreetViewHeading(0); setStreetViewPitch(0); setStreetViewFov(90); }}
                        data-testid="button-streetview-reset">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {capturedStreetViewImage && (
                      <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                        <Camera className="h-3 w-3" /> Captured
                      </div>
                    )}
                    
                    <div className="absolute bottom-2 left-2 bg-background/90 text-foreground px-2 py-1 rounded text-xs flex gap-2">
                      <span>{Math.round(streetViewHeading)}°</span>
                      <span>Pitch: {Math.round(streetViewPitch)}°</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={captureStreetView}
                      disabled={isCapturingStreetView}
                      className="flex-1"
                      data-testid="button-capture-streetview"
                    >
                      {isCapturingStreetView ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Capturing...</>
                      ) : (
                        <><Camera className="h-4 w-4 mr-2" /> {capturedStreetViewImage ? "Recapture" : "Capture This View"}</>
                      )}
                    </Button>
                    {capturedStreetViewImage && (
                      <Button variant="outline" onClick={addStreetViewToAdditionalImages} data-testid="button-add-streetview">
                        <Plus className="h-4 w-4 mr-2" /> Save & Add Another
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Additional Photos */}
              {createStep === "photos" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <ImagePlus className="h-4 w-4" />
                      Additional Reference Photos ({additionalImages.length})
                    </Label>
                    <Button
                      variant="outline"
                      onClick={() => additionalImageInputRef.current?.click()}
                      data-testid="button-add-photos"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Photos
                    </Button>
                    <input
                      ref={additionalImageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleAdditionalImageUpload}
                    />
                  </div>

                  {additionalImages.length > 0 ? (
                    <div className="grid grid-cols-4 gap-3">
                      {additionalImages.map((img) => (
                        <div key={img.id} className="relative group">
                          <img src={img.imageBase64} alt={img.title} className="w-full h-24 object-cover rounded-lg border" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                            <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => removeAdditionalImage(img.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 rounded-b-lg truncate">
                            {img.type === "streetview" ? "Street View" : img.title}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-48 flex flex-col items-center justify-center bg-muted rounded-lg gap-3">
                      <ImagePlus className="h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">No additional photos yet</p>
                      <p className="text-xs text-muted-foreground">Upload photos to help crews identify specific areas</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Confirm */}
              {createStep === "confirm" && (
                <div className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground text-xs">Site Name</Label>
                        <p className="font-medium">{newSiteName}</p>
                      </div>
                      {newSiteGroupId && (
                        <div>
                          <Label className="text-muted-foreground text-xs">Group</Label>
                          <p className="text-sm">{groups.find(g => g.id === newSiteGroupId)?.name || "None"}</p>
                        </div>
                      )}
                    </div>
                    {newSiteAddress && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Address</Label>
                        <p className="text-sm">{newSiteAddress}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {uploadedImage && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Main Image</Label>
                        <img src={uploadedImage} alt="Property" className="w-full h-32 object-cover rounded-lg mt-1" />
                      </div>
                    )}
                    {additionalImages.length > 0 && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Additional Images ({additionalImages.length})</Label>
                        <div className="flex gap-1 mt-1 overflow-x-auto">
                          {additionalImages.slice(0, 3).map((img) => (
                            <img key={img.id} src={img.imageBase64} alt={img.title} className="h-32 w-20 object-cover rounded" />
                          ))}
                          {additionalImages.length > 3 && (
                            <div className="h-32 w-20 bg-muted rounded flex items-center justify-center text-sm">
                              +{additionalImages.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {createStep === "info" && (
                  <>
                    <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetCreateDialog(); }}>
                      Cancel
                    </Button>
                    {isManualEntry && (
                      <Button onClick={() => setCreateStep("photos")} disabled={!newSiteName} data-testid="button-next-step">
                        Continue
                      </Button>
                    )}
                  </>
                )}
                {createStep === "satellite" && (
                  <>
                    <Button variant="outline" onClick={() => setCreateStep("info")}>Back</Button>
                    <Button
                      onClick={async () => {
                        if (!capturedMapImage) await captureMapView();
                        setCreateStep(streetViewAvailable ? "streetview" : "photos");
                      }}
                      disabled={isCapturing}
                      data-testid="button-next-step"
                    >
                      {capturedMapImage ? "Next" : "Capture & Continue"}
                    </Button>
                  </>
                )}
                {createStep === "streetview" && (
                  <>
                    <Button variant="outline" onClick={() => setCreateStep("satellite")}>Back</Button>
                    <Button variant="ghost" onClick={() => setCreateStep("photos")}>Skip</Button>
                    <Button
                      onClick={async () => {
                        if (capturedStreetViewImage) addStreetViewToAdditionalImages();
                        setCreateStep("photos");
                      }}
                      data-testid="button-next-step"
                    >
                      {capturedStreetViewImage ? "Save & Continue" : "Continue"}
                    </Button>
                  </>
                )}
                {createStep === "photos" && (
                  <>
                    <Button variant="outline" onClick={() => setCreateStep(streetViewAvailable && mapCoordinates ? "streetview" : mapCoordinates ? "satellite" : "info")}>
                      Back
                    </Button>
                    <Button onClick={() => setCreateStep("confirm")} data-testid="button-next-step">
                      Review Site
                    </Button>
                  </>
                )}
                {createStep === "confirm" && (
                  <>
                    <Button variant="outline" onClick={() => setCreateStep("photos")}>Back</Button>
                    <Button 
                      onClick={handleCreateSite} 
                      disabled={!newSiteName || createSite.isPending} 
                      data-testid="button-submit-site"
                    >
                      Create Site
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  Groups
                </CardTitle>
                {permissions?.canEdit && (
                  <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid="button-create-group">
                        <FolderPlus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Group</DialogTitle>
                        <DialogDescription>Organize your sites into groups</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>Group Name</Label>
                          <Input
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="e.g., Downtown Route"
                            data-testid="input-group-name"
                          />
                        </div>
                        <div>
                          <Label>Type</Label>
                          <Select value={newGroupType} onValueChange={setNewGroupType}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="residential">
                                <span className="flex items-center gap-2"><Home className="h-4 w-4" /> Residential</span>
                              </SelectItem>
                              <SelectItem value="commercial">
                                <span className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Commercial</span>
                              </SelectItem>
                              <SelectItem value="route">
                                <span className="flex items-center gap-2"><Route className="h-4 w-4" /> Route</span>
                              </SelectItem>
                              <SelectItem value="custom">
                                <span className="flex items-center gap-2"><Tag className="h-4 w-4" /> Custom</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Color</Label>
                          <div className="flex gap-2 mt-2">
                            {["#3b82f6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#a855f7", "#ec4899"].map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setNewGroupColor(color)}
                                className={`w-8 h-8 rounded-full transition-all ${newGroupColor === color ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsGroupDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateGroup} disabled={!newGroupName || createGroup.isPending}>
                          Create Group
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <button
                type="button"
                onClick={() => setSelectedGroupFilter(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedGroupFilter === null ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                }`}
                data-testid="filter-all-sites"
              >
                All Sites ({sites.length})
              </button>
              {groups.map((group) => {
                const groupSiteCount = sites.filter(s => s.groupId === group.id).length;
                return (
                  <div key={group.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedGroupFilter(group.id)}
                      className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                        selectedGroupFilter === group.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                      }`}
                      data-testid={`filter-group-${group.id}`}
                    >
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color || "#3b82f6" }} />
                      {getGroupIcon(group.groupType || "custom")}
                      <span className="flex-1 truncate">{group.name}</span>
                      <span className="text-xs text-muted-foreground">({groupSiteCount})</span>
                    </button>
                    {permissions?.canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => deleteGroup.mutate(group.id)}
                        data-testid={`delete-group-${group.id}`}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Sites</CardTitle>
              <CardDescription>
                {selectedGroupFilter ? `${filteredSites.length} in group` : `${sites.length} total`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredSites.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {selectedGroupFilter ? "No sites in this group" : "No sites yet"}
                </p>
              ) : (
                filteredSites.map((site) => {
                  const siteGroup = groups.find(g => g.id === site.groupId);
                  return (
                    <div
                      key={site.id}
                      onClick={() => {
                        setSelectedSite(site);
                        setIsEditing(false);
                      }}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedSite?.id === site.id ? "bg-primary/10 border border-primary" : "bg-muted/50 hover:bg-muted"
                      }`}
                      data-testid={`card-site-${site.id}`}
                    >
                      <div className="flex items-center gap-2">
                        {siteGroup && (
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: siteGroup.color || "#3b82f6" }} />
                        )}
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{site.name}</span>
                      </div>
                      {site.address && (
                        <p className="text-xs text-muted-foreground mt-1 ml-6">{site.address}</p>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {selectedSite ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedSite.name}</CardTitle>
                    {selectedSite.address && <CardDescription>{selectedSite.address}</CardDescription>}
                  </div>
                  <div className="flex gap-2">
                    {permissions?.canEdit && !isEditing && (
                      <Button variant="outline" onClick={() => setIsEditing(true)} data-testid="button-edit-site">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    )}
                    {isEditing && (
                      <>
                        <Button variant="outline" onClick={() => setIsEditing(false)}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                        <Button onClick={handleSaveSite} data-testid="button-save-site">
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                      </>
                    )}
                    {permissions?.canEdit && (
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => deleteSite.mutate(selectedSite.id)}
                        data-testid="button-delete-site"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="map">
                  <TabsList>
                    <TabsTrigger value="map">Map View</TabsTrigger>
                    <TabsTrigger value="instructions">Instructions ({instructions.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="map" className="space-y-4">
                    {isEditing && (
                      <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                        <div className="flex gap-1 border-r pr-2">
                          <Button
                            variant={currentTool === "select" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setCurrentTool("select")}
                          >
                            <Navigation className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={currentTool === "rect" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setCurrentTool("rect")}
                          >
                            <Square className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={currentTool === "circle" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setCurrentTool("circle")}
                          >
                            <Circle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={currentTool === "arrow" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setCurrentTool("arrow")}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={currentTool === "text" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setCurrentTool("text")}
                          >
                            <Type className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={currentTool === "icon" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setCurrentTool("icon")}
                          >
                            🚜
                          </Button>
                        </div>
                        <div className="flex gap-1 border-r pr-2">
                          {colors.map((c) => (
                            <button
                              key={c.value}
                              className={`w-6 h-6 rounded-full border-2 ${currentColor === c.value ? "border-foreground" : "border-transparent"}`}
                              style={{ backgroundColor: c.value }}
                              onClick={() => setCurrentColor(c.value)}
                            />
                          ))}
                        </div>
                        {currentTool === "icon" && (
                          <div className="flex gap-1">
                            {icons.map((icon) => (
                              <Button
                                key={icon.value}
                                variant={currentIcon === icon.value ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setCurrentIcon(icon.value)}
                              >
                                {icon.emoji}
                              </Button>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-1 ml-auto">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAnnotations(annotations.slice(0, -1))}
                            disabled={annotations.length === 0}
                          >
                            <Undo className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                        </div>
                        {uploadedImage && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={analyzeWithAI}
                            disabled={isAnalyzing}
                            className="ml-auto"
                            data-testid="button-ai-analyze"
                          >
                            {isAnalyzing ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            AI Analyze
                          </Button>
                        )}
                      </div>
                    )}

                    {aiAnalysis && (
                      <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            AI Analysis Results
                          </h4>
                          <Button variant="ghost" size="sm" onClick={() => setAiAnalysis(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        {aiAnalysis.suggestedRoute && (
                          <div>
                            <p className="text-sm font-medium text-primary">Suggested Route:</p>
                            <p className="text-sm text-muted-foreground">{aiAnalysis.suggestedRoute}</p>
                          </div>
                        )}
                        {aiAnalysis.driveways?.length > 0 && (
                          <div>
                            <p className="text-sm font-medium">Driveways ({aiAnalysis.driveways.length}):</p>
                            {aiAnalysis.driveways.map((d: any, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground ml-2">- {d.description} ({d.location})</p>
                            ))}
                          </div>
                        )}
                        {aiAnalysis.walkways?.length > 0 && (
                          <div>
                            <p className="text-sm font-medium">Walkways ({aiAnalysis.walkways.length}):</p>
                            {aiAnalysis.walkways.map((w: any, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground ml-2">- {w.description}</p>
                            ))}
                          </div>
                        )}
                        {aiAnalysis.obstacles?.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-orange-600">Obstacles:</p>
                            {aiAnalysis.obstacles.map((o: any, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground ml-2">- {o.description} {o.warning && `(${o.warning})`}</p>
                            ))}
                          </div>
                        )}
                        {aiAnalysis.specialNotes && (
                          <div>
                            <p className="text-sm font-medium">Notes:</p>
                            <p className="text-xs text-muted-foreground">{aiAnalysis.specialNotes}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="relative border rounded-lg overflow-hidden bg-gray-100">
                      {uploadedImage ? (
                        <canvas
                          ref={canvasRef}
                          width={800}
                          height={500}
                          className="w-full cursor-crosshair"
                          onMouseDown={handleCanvasMouseDown}
                          onMouseUp={handleCanvasMouseUp}
                        />
                      ) : (
                        <div className="h-[500px] flex items-center justify-center">
                          <div className="text-center">
                            <MapPin className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                            <p className="text-muted-foreground mb-4">No image uploaded yet</p>
                            {isEditing && (
                              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                                <Upload className="h-4 w-4 mr-2" />
                                Upload Property Image
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="instructions" className="space-y-4">
                    {isEditing && (
                      <Button onClick={addInstruction} variant="outline" data-testid="button-add-instruction">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Step
                      </Button>
                    )}
                    {instructions.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No instructions added yet</p>
                    ) : (
                      <div className="space-y-4">
                        {instructions.map((inst) => (
                          <Card key={inst.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                                  {inst.step}
                                </div>
                                <div className="flex-1 space-y-2">
                                  {isEditing ? (
                                    <>
                                      <Input
                                        value={inst.title}
                                        onChange={(e) => updateInstruction(inst.id, { title: e.target.value })}
                                        placeholder="Step title"
                                        className="font-medium"
                                      />
                                      <Textarea
                                        value={inst.description}
                                        onChange={(e) => updateInstruction(inst.id, { description: e.target.value })}
                                        placeholder="Describe what to do..."
                                        rows={2}
                                      />
                                    </>
                                  ) : (
                                    <>
                                      <h4 className="font-medium">{inst.title}</h4>
                                      {inst.description && <p className="text-sm text-muted-foreground">{inst.description}</p>}
                                    </>
                                  )}
                                </div>
                                {isEditing && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteInstruction(inst.id)}
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
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Snowflake className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-semibold mb-2">Select or Create a Site</h2>
                <p className="text-muted-foreground">
                  Choose a property from the list or create a new one to start mapping snow removal routes.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
    </div>
  );
}
