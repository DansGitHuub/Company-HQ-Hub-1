import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { showErrorToast } from "@/lib/errorToast";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit3,
  Clock,
  MapPin,
  Users,
  Link2,
  Loader2,
  ExternalLink,
  Globe,
  Lock,
  Building2,
  Filter,
  CalendarDays,
  List,
  LayoutGrid,
  Search,
  UserPlus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Phone,
  Mail,
  User,
  Settings,
  X,
  Palette,
} from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  startDatetime: string;
  endDatetime: string;
  allDay: boolean;
  location: string | null;
  createdBy: string;
  assignedTo: string | null;
  linkedRecordType: string | null;
  linkedRecordId: string | null;
  googleEventId: string | null;
  isCompanyEvent: boolean;
  isPrivate: boolean;
  recurrenceRule: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
  updatedAt: string;
  isGoogleEvent?: boolean;
}

interface GoogleCalendarEventData {
  id: string;
  userId: string;
  googleEventId: string;
  title: string;
  description: string | null;
  startDatetime: string;
  endDatetime: string;
  allDay: boolean;
  location: string | null;
  calendarId: string | null;
  syncedAt: string;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

interface GoogleStatus {
  connected: boolean;
  calendarId: string;
}

interface CategorySetting {
  categoryKey: string;
  displayName: string;
  color: string;
  isCustom: boolean;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const DEFAULT_CATEGORIES: CategorySetting[] = [
  { categoryKey: "job", displayName: "Job", color: "#16a34a", isCustom: false },
  { categoryKey: "shift", displayName: "Shift", color: "#7c3aed", isCustom: false },
  { categoryKey: "equipment", displayName: "Equipment", color: "#ea580c", isCustom: false },
  { categoryKey: "task", displayName: "Task", color: "#0284c7", isCustom: false },
  { categoryKey: "company", displayName: "Company Event", color: "#0d9488", isCustom: false },
  { categoryKey: "personal", displayName: "Personal", color: "#3b82f6", isCustom: false },
  { categoryKey: "customer_appointment", displayName: "Customer Appointment", color: "#e11d48", isCustom: false },
  { categoryKey: "google", displayName: "Google Calendar", color: "#d97706", isCustom: false },
];

const EVENT_TYPES = [
  { value: "personal", label: "Personal", color: "#3b82f6" },
  { value: "job", label: "Job", color: "#16a34a" },
  { value: "shift", label: "Shift", color: "#7c3aed" },
  { value: "equipment", label: "Equipment", color: "#ea580c" },
  { value: "task", label: "Task", color: "#0284c7" },
  { value: "meeting", label: "Meeting", color: "#a855f7" },
  { value: "deadline", label: "Deadline", color: "#ef4444" },
  { value: "maintenance", label: "Maintenance", color: "#f97316" },
  { value: "company", label: "Company", color: "#14b8a6" },
  { value: "customer_appointment", label: "Customer Appointment", color: "#e11d48" },
];

function getEventColorHex(eventType: string, isCompanyEvent: boolean, isGoogleEvent?: boolean, categorySettings?: CategorySetting[]): string {
  if (categorySettings && categorySettings.length > 0) {
    if (isGoogleEvent) {
      const gs = categorySettings.find(c => c.categoryKey === "google");
      if (gs) return gs.color;
    }
    if (isCompanyEvent) {
      const cs = categorySettings.find(c => c.categoryKey === "company");
      if (cs) return cs.color;
    }
    const found = categorySettings.find(c => c.categoryKey === eventType);
    if (found) return found.color;
  }
  if (isGoogleEvent) return "#f59e0b";
  if (isCompanyEvent) return "#14b8a6";
  const found = EVENT_TYPES.find(t => t.value === eventType);
  return found?.color || "#3b82f6";
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDateRange(start: string, end: string, allDay: boolean) {
  if (allDay) return "All Day";
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [viewMode, setViewMode] = useState<"month" | "week" | "day" | "list">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showDayPopup, setShowDayPopup] = useState(false);
  const [dayPopupDate, setDayPopupDate] = useState<Date | null>(null);
  const [dayPopupEvents, setDayPopupEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_connected") === "true") {
      toast({ title: "Google Calendar Connected", description: "Your Google Calendar is now synced." });
      window.history.replaceState({}, "", "/calendar");
    }
    if (params.get("google_error")) {
      toast({ title: "Connection Failed", description: "Could not connect Google Calendar. Please try again.", variant: "destructive" });
      window.history.replaceState({}, "", "/calendar");
    }
  }, []);

  const startOfRange = useMemo(() => {
    if (viewMode === "month") {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      d.setDate(d.getDate() - d.getDay());
      return d;
    }
    if (viewMode === "week") {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const d = new Date(currentDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentDate, viewMode]);

  const endOfRange = useMemo(() => {
    if (viewMode === "month") {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      d.setDate(d.getDate() + (6 - d.getDay()));
      d.setHours(23, 59, 59, 999);
      return d;
    }
    if (viewMode === "week") {
      const d = new Date(startOfRange);
      d.setDate(d.getDate() + 6);
      d.setHours(23, 59, 59, 999);
      return d;
    }
    const d = new Date(currentDate);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [currentDate, viewMode, startOfRange]);

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar/events", startOfRange.toISOString(), endOfRange.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/calendar/events?start=${startOfRange.toISOString()}&end=${endOfRange.toISOString()}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  const { data: allUsers = [] } = useQuery<UserOption[]>({
    queryKey: ["/api/calendar/users"],
    queryFn: async () => {
      const res = await fetch("/api/calendar/users", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: googleStatus } = useQuery<GoogleStatus>({
    queryKey: ["/api/calendar/google/status"],
    queryFn: async () => {
      const res = await fetch("/api/calendar/google/status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: googleEvents = [] } = useQuery<GoogleCalendarEventData[]>({
    queryKey: ["/api/calendar/google/events", startOfRange.toISOString(), endOfRange.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/calendar/google/events?start=${startOfRange.toISOString()}&end=${endOfRange.toISOString()}`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!googleStatus?.connected,
  });

  const { data: savedSettings = [] } = useQuery<CategorySetting[]>({
    queryKey: ["/api/calendar/settings"],
    queryFn: async () => {
      const res = await fetch("/api/calendar/settings", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const categorySettings = useMemo(() => {
    if (savedSettings.length === 0) return DEFAULT_CATEGORIES;
    const merged = DEFAULT_CATEGORIES.map(dc => {
      const saved = savedSettings.find((s: any) => s.categoryKey === dc.categoryKey);
      return saved ? { ...dc, displayName: saved.displayName, color: saved.color } : dc;
    });
    const customs = savedSettings.filter((s: any) => s.isCustom);
    return [...merged, ...customs];
  }, [savedSettings]);

  const allEventTypes = useMemo(() => {
    const base = EVENT_TYPES.map(et => {
      const cs = categorySettings.find(c => c.categoryKey === et.value);
      return cs ? { ...et, label: cs.displayName, color: cs.color } : et;
    });
    const customCats = categorySettings.filter(c => c.isCustom);
    const customTypes = customCats.map(c => ({
      value: c.categoryKey,
      label: c.displayName,
      color: c.color,
    }));
    return [...base, ...customTypes];
  }, [categorySettings]);

  const openDayPopup = useCallback((date: Date, events: CalendarEvent[]) => {
    setDayPopupDate(date);
    setDayPopupEvents(events);
    setShowDayPopup(true);
  }, []);

  const mergedEvents = useMemo(() => {
    const companyHQGoogleIds = new Set(
      events.filter(e => e.googleEventId).map(e => e.googleEventId)
    );

    const googleAsCalendarEvents: CalendarEvent[] = googleEvents
      .filter(ge => !companyHQGoogleIds.has(ge.googleEventId))
      .map(ge => ({
        id: ge.id,
        title: ge.title,
        description: ge.description,
        eventType: "personal",
        startDatetime: ge.startDatetime,
        endDatetime: ge.endDatetime,
        allDay: ge.allDay,
        location: ge.location,
        createdBy: ge.userId,
        assignedTo: null,
        linkedRecordType: null,
        linkedRecordId: null,
        googleEventId: ge.googleEventId,
        isCompanyEvent: false,
        isPrivate: false,
        recurrenceRule: null,
        contactName: null,
        contactEmail: null,
        contactPhone: null,
        createdAt: ge.syncedAt,
        updatedAt: ge.syncedAt,
        isGoogleEvent: true,
      }));

    return [...events, ...googleAsCalendarEvents];
  }, [events, googleEvents]);

  const syncGoogleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/calendar/google/sync");
      return res.json();
    },
    onSuccess: (data: { message: string; count: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/google/events"] });
      toast({ title: "Google Calendar Synced", description: data.message });
    },
    onError: (err: any) => showErrorToast(toast, err),
  });

  const filteredEvents = useMemo(() => {
    let result = mergedEvents;
    if (filterType !== "all") {
      if (filterType === "company") {
        result = result.filter(e => e.isCompanyEvent);
      } else if (filterType === "mine") {
        result = result.filter(e => e.createdBy === user?.id || e.assignedTo === user?.id);
      } else if (filterType === "google") {
        result = result.filter(e => e.isGoogleEvent);
      } else {
        result = result.filter(e => e.eventType === filterType);
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.location && e.location.toLowerCase().includes(q))
      );
    }
    return result;
  }, [mergedEvents, filterType, searchQuery, user?.id]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/calendar/events", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({ title: "Event Created" });
      setShowEventDialog(false);
    },
    onError: (err: any) => showErrorToast(toast, err),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/calendar/events/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({ title: "Event Updated" });
      setShowEventDialog(false);
      setEditingEvent(null);
    },
    onError: (err: any) => showErrorToast(toast, err),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/calendar/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({ title: "Event Deleted" });
      setShowDetailDialog(false);
      setDetailEvent(null);
    },
    onError: (err: any) => showErrorToast(toast, err),
  });

  const connectGoogleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/google/calendar", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to get auth URL");
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      window.location.href = data.url;
    },
    onError: (err: any) => showErrorToast(toast, err),
  });

  const disconnectGoogleMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/calendar/google/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/google/status"] });
      toast({ title: "Disconnected from Google Calendar" });
    },
  });

  const navigate = (direction: number) => {
    const d = new Date(currentDate);
    if (viewMode === "month") d.setMonth(d.getMonth() + direction);
    else if (viewMode === "week") d.setDate(d.getDate() + direction * 7);
    else d.setDate(d.getDate() + direction);
    setCurrentDate(d);
  };

  const goToToday = () => setCurrentDate(new Date());

  const headerLabel = useMemo(() => {
    if (viewMode === "month") return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (viewMode === "week") {
      const end = new Date(startOfRange);
      end.setDate(end.getDate() + 6);
      if (startOfRange.getMonth() === end.getMonth()) {
        return `${MONTHS[startOfRange.getMonth()]} ${startOfRange.getDate()} - ${end.getDate()}, ${startOfRange.getFullYear()}`;
      }
      return `${MONTHS[startOfRange.getMonth()]} ${startOfRange.getDate()} - ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    }
    return currentDate.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }, [currentDate, viewMode, startOfRange]);

  const openCreateDialog = (date?: Date) => {
    setEditingEvent(null);
    if (date) setSelectedDate(date);
    setShowEventDialog(true);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setShowEventDialog(true);
    setShowDetailDialog(false);
  };

  const openDetailDialog = (event: CalendarEvent) => {
    setDetailEvent(event);
    setShowDetailDialog(true);
  };

  return (
    <div className="flex flex-col h-full pb-6" data-testid="calendar-page">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="calendar-title">Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <GoogleCalendarStatus
            status={googleStatus}
            onConnect={() => connectGoogleMutation.mutate()}
            onDisconnect={() => disconnectGoogleMutation.mutate()}
            onSync={() => syncGoogleMutation.mutate()}
            isConnecting={connectGoogleMutation.isPending}
            isSyncing={syncGoogleMutation.isPending}
          />
          <Button onClick={() => openCreateDialog()} data-testid="create-event-button">
            <Plus className="h-4 w-4 mr-2" />
            New Event
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowSettingsDialog(true)} data-testid="calendar-settings-button">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between px-6 py-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} data-testid="calendar-nav-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday} data-testid="calendar-today">
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)} data-testid="calendar-nav-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold ml-2" data-testid="calendar-header-label">{headerLabel}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 w-48"
              placeholder="Search events..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              data-testid="calendar-search"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36" data-testid="calendar-filter">
              <Filter className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="mine">My Events</SelectItem>
              <SelectItem value="google">Google Calendar</SelectItem>
              {allEventTypes.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex border rounded-md">
            {([
              { key: "month", icon: LayoutGrid, label: "Month" },
              { key: "week", icon: CalendarDays, label: "Week" },
              { key: "day", icon: CalendarIcon, label: "Day" },
              { key: "list", icon: List, label: "List" },
            ] as const).map(v => (
              <TooltipProvider key={v.key}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === v.key ? "default" : "ghost"}
                      size="icon"
                      onClick={() => setViewMode(v.key)}
                      className="rounded-none first:rounded-l-md last:rounded-r-md"
                      data-testid={`view-${v.key}`}
                    >
                      <v.icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{v.label}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : viewMode === "month" ? (
          <MonthView
            currentDate={currentDate}
            events={filteredEvents}
            onDayClick={d => { setSelectedDate(d); setCurrentDate(d); }}
            onEventClick={openDetailDialog}
            onCreateEvent={openCreateDialog}
            onShowDayPopup={openDayPopup}
            categorySettings={categorySettings}
          />
        ) : viewMode === "week" ? (
          <WeekView
            startOfRange={startOfRange}
            events={filteredEvents}
            onEventClick={openDetailDialog}
            onCreateEvent={openCreateDialog}
          />
        ) : viewMode === "day" ? (
          <DayView
            date={currentDate}
            events={filteredEvents}
            onEventClick={openDetailDialog}
            onCreateEvent={openCreateDialog}
          />
        ) : (
          <ListView
            events={filteredEvents}
            onEventClick={openDetailDialog}
          />
        )}
      </div>

      <EventFormDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        event={editingEvent}
        selectedDate={selectedDate}
        users={allUsers}
        user={user}
        onCreate={data => createMutation.mutate(data)}
        onUpdate={data => updateMutation.mutate(data)}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        eventTypes={allEventTypes}
        categorySettings={categorySettings}
      />

      <EventDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        event={detailEvent}
        user={user}
        users={allUsers}
        onEdit={openEditDialog}
        onDelete={id => deleteMutation.mutate(id)}
        isDeleting={deleteMutation.isPending}
        categorySettings={categorySettings}
      />

      <DayEventsPopup
        open={showDayPopup}
        onOpenChange={setShowDayPopup}
        date={dayPopupDate}
        events={dayPopupEvents}
        onEventClick={(e) => { setShowDayPopup(false); openDetailDialog(e); }}
        categorySettings={categorySettings}
      />

      <CalendarSettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        categorySettings={categorySettings}
      />
    </div>
  );
}

function GoogleCalendarStatus({
  status,
  onConnect,
  onDisconnect,
  onSync,
  isConnecting,
  isSyncing,
}: {
  status: GoogleStatus | undefined;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
  isConnecting: boolean;
  isSyncing: boolean;
}) {
  if (!status) return null;

  if (status.connected) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
          <CheckCircle2 className="h-3 w-3" />
          Google Calendar
        </Badge>
        <Button variant="outline" size="sm" onClick={onSync} disabled={isSyncing} data-testid="sync-google">
          {isSyncing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          Sync Now
        </Button>
        <Button variant="ghost" size="sm" onClick={onDisconnect} data-testid="disconnect-google">
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onConnect}
      disabled={isConnecting}
      data-testid="connect-google"
    >
      {isConnecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
      Connect Google Calendar
    </Button>
  );
}

function MonthView({
  currentDate,
  events,
  onDayClick,
  onEventClick,
  onCreateEvent,
  onShowDayPopup,
  categorySettings,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (d: Date) => void;
  onEventClick: (e: CalendarEvent) => void;
  onCreateEvent: (d: Date) => void;
  onShowDayPopup: (date: Date, events: CalendarEvent[]) => void;
  categorySettings: CategorySetting[];
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDay = firstDayOfMonth.getDay();
  const totalDays = lastDayOfMonth.getDate();
  const today = new Date();

  const weeks: Date[][] = [];
  let current = new Date(firstDayOfMonth);
  current.setDate(current.getDate() - startDay);

  while (current <= lastDayOfMonth || weeks.length < 6) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
    if (weeks.length >= 6) break;
  }

  const getEventsForDay = (date: Date) => {
    return events.filter(e => {
      const start = new Date(e.startDatetime);
      return isSameDay(start, date);
    });
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 bg-muted/50">
        {DAYS.map(d => (
          <div key={d} className="px-2 py-2 text-center text-sm font-medium text-muted-foreground border-b">{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 min-h-[100px]">
          {week.map((day, di) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = day.getMonth() === month;
            const isToday = isSameDay(day, today);

            return (
              <div
                key={di}
                className={`border-b border-r p-1 cursor-pointer transition-colors hover:bg-muted/30 ${
                  !isCurrentMonth ? "bg-muted/10 text-muted-foreground" : ""
                }`}
                onClick={() => onDayClick(day)}
                onDoubleClick={() => onCreateEvent(day)}
                data-testid={`month-day-${day.getDate()}-${day.getMonth()}`}
              >
                <div
                  className={`text-sm mb-1 ${isToday
                    ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center mx-auto font-bold"
                    : "text-right pr-1"
                  } ${dayEvents.length > 0 ? "cursor-pointer hover:text-primary" : ""}`}
                  onClick={e => { if (dayEvents.length > 0) { e.stopPropagation(); onShowDayPopup(day, dayEvents); } }}
                >
                  {day.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map(evt => (
                    <div
                      key={evt.id}
                      className="text-xs px-1 py-0.5 rounded truncate text-white cursor-pointer"
                      style={{ backgroundColor: getEventColorHex(evt.eventType, evt.isCompanyEvent, evt.isGoogleEvent, categorySettings) }}
                      onClick={e => { e.stopPropagation(); onEventClick(evt); }}
                      data-testid={`event-chip-${evt.id}`}
                    >
                      {!evt.allDay && (
                        <span className="opacity-80 mr-1">{formatTime(evt.startDatetime)}</span>
                      )}
                      {evt.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div
                      className="text-xs text-primary font-medium pl-1 cursor-pointer hover:underline"
                      onClick={e => { e.stopPropagation(); onShowDayPopup(day, dayEvents); }}
                      data-testid={`day-more-${day.getDate()}-${day.getMonth()}`}
                    >
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function WeekView({
  startOfRange,
  events,
  onEventClick,
  onCreateEvent,
}: {
  startOfRange: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onCreateEvent: (d: Date) => void;
}) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfRange);
    d.setDate(d.getDate() + i);
    return d;
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForDayHour = (day: Date, hour: number) => {
    return events.filter(e => {
      if (e.allDay) return false;
      const start = new Date(e.startDatetime);
      return isSameDay(start, day) && start.getHours() === hour;
    });
  };

  const allDayEvents = (day: Date) => events.filter(e => {
    if (!e.allDay) return false;
    const start = new Date(e.startDatetime);
    return isSameDay(start, day);
  });

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] bg-muted/50 border-b">
        <div className="p-2 text-xs text-muted-foreground"></div>
        {days.map((d, i) => (
          <div
            key={i}
            className={`p-2 text-center border-l ${isSameDay(d, today) ? "bg-primary/5" : ""}`}
            onClick={() => onCreateEvent(d)}
          >
            <div className="text-xs text-muted-foreground">{DAYS[d.getDay()]}</div>
            <div className={`text-lg font-semibold ${isSameDay(d, today) ? "text-primary" : ""}`}>
              {d.getDate()}
            </div>
            <div className="space-y-0.5 mt-1">
              {allDayEvents(d).map(evt => (
                <div
                  key={evt.id}
                  className="text-xs px-1 py-0.5 rounded truncate text-white"
                  style={{ backgroundColor: getEventColorHex(evt.eventType, evt.isCompanyEvent, evt.isGoogleEvent) }}
                  onClick={e => { e.stopPropagation(); onEventClick(evt); }}
                >
                  {evt.title}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <ScrollArea className="h-[600px]">
        {hours.map(hour => (
          <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] min-h-[48px] border-b">
            <div className="p-1 text-xs text-muted-foreground text-right pr-2 pt-1">
              {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
            </div>
            {days.map((d, di) => {
              const hourEvents = getEventsForDayHour(d, hour);
              return (
                <div
                  key={di}
                  className={`border-l p-0.5 min-h-[48px] hover:bg-muted/20 cursor-pointer ${isSameDay(d, today) ? "bg-primary/5" : ""}`}
                  onDoubleClick={() => {
                    const eventDate = new Date(d);
                    eventDate.setHours(hour);
                    onCreateEvent(eventDate);
                  }}
                >
                  {hourEvents.map(evt => (
                    <div
                      key={evt.id}
                      className="text-xs px-1 py-0.5 rounded truncate text-white mb-0.5 cursor-pointer"
                      style={{ backgroundColor: getEventColorHex(evt.eventType, evt.isCompanyEvent, evt.isGoogleEvent) }}
                      onClick={() => onEventClick(evt)}
                    >
                      {formatTime(evt.startDatetime)} {evt.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

function DayView({
  date,
  events,
  onEventClick,
  onCreateEvent,
}: {
  date: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onCreateEvent: (d: Date) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayEvents = events.filter(e => {
    const start = new Date(e.startDatetime);
    return isSameDay(start, date);
  });
  const allDayEvts = dayEvents.filter(e => e.allDay);
  const timedEvts = dayEvents.filter(e => !e.allDay);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="p-3 bg-muted/50 border-b text-center">
        <div className="text-lg font-semibold">
          {date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </div>
        {allDayEvts.length > 0 && (
          <div className="flex gap-2 justify-center mt-2 flex-wrap">
            {allDayEvts.map(evt => (
              <div
                key={evt.id}
                className="text-xs px-2 py-1 rounded text-white cursor-pointer"
                style={{ backgroundColor: getEventColorHex(evt.eventType, evt.isCompanyEvent, evt.isGoogleEvent) }}
                onClick={() => onEventClick(evt)}
              >
                {evt.title}
              </div>
            ))}
          </div>
        )}
      </div>
      <ScrollArea className="h-[600px]">
        {hours.map(hour => {
          const hourEvents = timedEvts.filter(e => new Date(e.startDatetime).getHours() === hour);
          return (
            <div
              key={hour}
              className="flex border-b min-h-[52px] hover:bg-muted/20 cursor-pointer"
              onDoubleClick={() => {
                const d = new Date(date);
                d.setHours(hour);
                onCreateEvent(d);
              }}
            >
              <div className="w-16 p-2 text-xs text-muted-foreground text-right border-r flex-shrink-0">
                {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
              </div>
              <div className="flex-1 p-1 space-y-1">
                {hourEvents.map(evt => (
                  <div
                    key={evt.id}
                    className="text-sm px-2 py-1 rounded text-white cursor-pointer"
                    style={{ backgroundColor: getEventColorHex(evt.eventType, evt.isCompanyEvent, evt.isGoogleEvent) }}
                    onClick={() => onEventClick(evt)}
                    data-testid={`day-event-${evt.id}`}
                  >
                    <div className="font-medium">{evt.title}</div>
                    <div className="text-xs opacity-80">{formatDateRange(evt.startDatetime, evt.endDatetime, evt.allDay)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </ScrollArea>
    </div>
  );
}

function ListView({
  events,
  onEventClick,
}: {
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
}) {
  const sorted = useMemo(() =>
    [...events].sort((a, b) => new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime()),
    [events]
  );

  const grouped = useMemo(() => {
    const groups: Record<string, CalendarEvent[]> = {};
    sorted.forEach(evt => {
      const key = new Date(evt.startDatetime).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      if (!groups[key]) groups[key] = [];
      groups[key].push(evt);
    });
    return groups;
  }, [sorted]);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>No events found in this range.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([dateLabel, dayEvents]) => (
        <div key={dateLabel}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">{dateLabel}</h3>
          <div className="space-y-2">
            {dayEvents.map(evt => (
              <Card
                key={evt.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onEventClick(evt)}
                data-testid={`list-event-${evt.id}`}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: getEventColorHex(evt.eventType, evt.isCompanyEvent, evt.isGoogleEvent) }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {evt.title}
                      {evt.isCompanyEvent && <Building2 className="h-3 w-3 text-teal-500" />}
                      {evt.isPrivate && <Lock className="h-3 w-3 text-muted-foreground" />}
                      {evt.googleEventId && <Globe className="h-3 w-3 text-blue-500" />}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {formatDateRange(evt.startDatetime, evt.endDatetime, evt.allDay)}
                      {evt.location && (
                        <>
                          <MapPin className="h-3 w-3 ml-2" />
                          <span className="truncate">{evt.location}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {EVENT_TYPES.find(t => t.value === evt.eventType)?.label || evt.eventType}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventFormDialog({
  open,
  onOpenChange,
  event,
  selectedDate,
  users,
  user,
  onCreate,
  onUpdate,
  isSubmitting,
  eventTypes,
  categorySettings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  selectedDate: Date | null;
  users: UserOption[];
  user: any;
  onCreate: (data: any) => void;
  onUpdate: (data: any) => void;
  isSubmitting: boolean;
  eventTypes: { value: string; label: string; color: string }[];
  categorySettings: CategorySetting[];
}) {
  const isEditing = !!event;
  const defaultStart = selectedDate || new Date();
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);

  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("personal");
  const [startDatetime, setStartDatetime] = useState("");
  const [endDatetime, setEndDatetime] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [isCompanyEvent, setIsCompanyEvent] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  useEffect(() => {
    if (open) {
      if (event) {
        setTitle(event.title);
        setDescription(event.description || "");
        setEventType(event.eventType);
        setStartDatetime(toLocalInput(new Date(event.startDatetime)));
        setEndDatetime(toLocalInput(new Date(event.endDatetime)));
        setAllDay(event.allDay);
        setLocation(event.location || "");
        setAssignedTo(event.assignedTo);
        setIsCompanyEvent(event.isCompanyEvent);
        setIsPrivate(event.isPrivate);
        setContactName(event.contactName || "");
        setContactEmail(event.contactEmail || "");
        setContactPhone(event.contactPhone || "");
      } else {
        setTitle("");
        setDescription("");
        setEventType("personal");
        setStartDatetime(toLocalInput(defaultStart));
        setEndDatetime(toLocalInput(defaultEnd));
        setAllDay(false);
        setLocation("");
        setAssignedTo(null);
        setIsCompanyEvent(false);
        setIsPrivate(false);
        setContactName("");
        setContactEmail("");
        setContactPhone("");
      }
    }
  }, [open, event]);

  const handleSubmit = () => {
    if (!title.trim() || !startDatetime || !endDatetime) return;

    const data = {
      title: title.trim(),
      description: description.trim() || null,
      eventType,
      startDatetime: new Date(startDatetime).toISOString(),
      endDatetime: new Date(endDatetime).toISOString(),
      allDay,
      location: location.trim() || null,
      assignedTo: assignedTo || null,
      isCompanyEvent,
      isPrivate,
      contactName: contactName.trim() || null,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
    };

    if (isEditing && event) {
      onUpdate({ id: event.id, ...data });
    } else {
      onCreate(data);
    }
  };

  const canManageCompany = user?.role === "Admin" || user?.role === "Manager" || user?.isMasterAdmin;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle data-testid="event-form-title">{isEditing ? "Edit Event" : "New Event"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the event details below." : "Fill in the details for your new event."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <Label>Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Event title" data-testid="event-title-input" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" data-testid="event-description-input" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Event Type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger data-testid="event-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assign To</Label>
              <Select value={assignedTo || "none"} onValueChange={v => setAssignedTo(v === "none" ? null : v)}>
                <SelectTrigger data-testid="event-assign-select">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={allDay} onCheckedChange={setAllDay} id="allDay" data-testid="event-allday-switch" />
              <Label htmlFor="allDay">All Day</Label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start {allDay ? "Date" : "Date/Time"} *</Label>
              <Input
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? startDatetime.split("T")[0] : startDatetime}
                onChange={e => setStartDatetime(allDay ? e.target.value + "T00:00" : e.target.value)}
                data-testid="event-start-input"
              />
            </div>
            <div>
              <Label>End {allDay ? "Date" : "Date/Time"} *</Label>
              <Input
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? endDatetime.split("T")[0] : endDatetime}
                onChange={e => setEndDatetime(allDay ? e.target.value + "T23:59" : e.target.value)}
                data-testid="event-end-input"
              />
            </div>
          </div>
          <div>
            <Label>Location</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Optional location" data-testid="event-location-input" />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Contact Info
            </Label>
            <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Contact name" data-testid="event-contact-name" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="Email" type="email" data-testid="event-contact-email" />
              <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Phone" type="tel" data-testid="event-contact-phone" />
            </div>
          </div>
          {canManageCompany && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={isCompanyEvent} onCheckedChange={setIsCompanyEvent} id="companyEvent" data-testid="event-company-switch" />
                <Label htmlFor="companyEvent" className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> Company Event
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} id="privateEvent" data-testid="event-private-switch" />
                <Label htmlFor="privateEvent" className="flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" /> Private
                </Label>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !startDatetime || !endDatetime || isSubmitting}
            data-testid="event-save-button"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventDetailDialog({
  open,
  onOpenChange,
  event,
  user,
  users,
  onEdit,
  onDelete,
  isDeleting,
  categorySettings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  user: any;
  users: UserOption[];
  onEdit: (e: CalendarEvent) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  categorySettings: CategorySetting[];
}) {
  if (!event) return null;

  const canEdit = user?.role === "Admin" || user?.isMasterAdmin || user?.role === "Manager" || event.createdBy === user?.id;
  const assignedUser = users.find(u => u.id === event.assignedTo);
  const creator = users.find(u => u.id === event.createdBy);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="event-detail-title">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getEventColorHex(event.eventType, event.isCompanyEvent, event.isGoogleEvent, categorySettings) }} />
            {event.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{formatDateRange(event.startDatetime, event.endDatetime, event.allDay)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span>{new Date(event.startDatetime).toLocaleDateString(undefined, {
              weekday: "long", year: "numeric", month: "long", day: "numeric"
            })}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{event.location}</span>
            </div>
          )}
          {event.description && (
            <div className="text-sm text-muted-foreground bg-muted/30 p-2 rounded">{event.description}</div>
          )}
          <Separator />
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">
              {EVENT_TYPES.find(t => t.value === event.eventType)?.label || event.eventType}
            </Badge>
            {event.isCompanyEvent && (
              <Badge variant="outline" className="text-teal-600">
                <Building2 className="h-3 w-3 mr-1" /> Company
              </Badge>
            )}
            {event.isPrivate && (
              <Badge variant="outline" className="text-muted-foreground">
                <Lock className="h-3 w-3 mr-1" /> Private
              </Badge>
            )}
            {event.googleEventId && (
              <Badge variant="outline" className="text-blue-600">
                <Globe className="h-3 w-3 mr-1" /> {event.isGoogleEvent ? "Google Calendar" : "Synced"}
              </Badge>
            )}
          </div>
          {(event.contactName || event.contactEmail || event.contactPhone) && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">Contact</div>
              {event.contactName && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{event.contactName}</span>
                </div>
              )}
              {event.contactEmail && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <a href={`mailto:${event.contactEmail}`} className="text-primary hover:underline">{event.contactEmail}</a>
                </div>
              )}
              {event.contactPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <a href={`tel:${event.contactPhone}`} className="text-primary hover:underline">{event.contactPhone}</a>
                </div>
              )}
            </div>
          )}
          {(assignedUser || creator) && (
            <div className="text-xs text-muted-foreground space-y-1">
              {creator && <div>Created by: {creator.name}</div>}
              {assignedUser && <div>Assigned to: {assignedUser.name}</div>}
            </div>
          )}
        </div>
        {canEdit && !event.isGoogleEvent && (
          <DialogFooter className="gap-2">
            <Button variant="destructive" size="sm" onClick={() => onDelete(event.id)} disabled={isDeleting} data-testid="delete-event-button">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete
            </Button>
            <Button size="sm" onClick={() => onEdit(event)} data-testid="edit-event-button">
              <Edit3 className="h-4 w-4 mr-1" /> Edit
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DayEventsPopup({
  open,
  onOpenChange,
  date,
  events,
  onEventClick,
  categorySettings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  categorySettings: CategorySetting[];
}) {
  if (!date) return null;

  const dateLabel = date.toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle data-testid="day-popup-title">{dateLabel}</DialogTitle>
          <DialogDescription>{events.length} event{events.length !== 1 ? "s" : ""}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-2 pr-2">
            {events.map(evt => (
              <div
                key={evt.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onEventClick(evt)}
                data-testid={`day-popup-event-${evt.id}`}
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getEventColorHex(evt.eventType, evt.isCompanyEvent, evt.isGoogleEvent, categorySettings) }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{evt.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {evt.allDay ? "All Day" : formatTime(evt.startDatetime)}
                    {evt.isGoogleEvent && <span className="ml-1 text-amber-600">(Google)</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function CalendarSettingsDialog({
  open,
  onOpenChange,
  categorySettings: initialSettings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorySettings: CategorySetting[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [categories, setCategories] = useState<CategorySetting[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#6366f1");

  useEffect(() => {
    if (open) {
      setCategories([...initialSettings]);
    }
  }, [open, initialSettings]);

  const saveMutation = useMutation({
    mutationFn: async (cats: CategorySetting[]) => {
      const res = await apiRequest("POST", "/api/calendar/settings", { categories: cats });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/settings"] });
      toast({ title: "Settings Saved" });
      onOpenChange(false);
    },
    onError: (err: any) => showErrorToast(toast, err),
  });

  const updateCategory = (key: string, field: "displayName" | "color", value: string) => {
    setCategories(prev => prev.map(c => c.categoryKey === key ? { ...c, [field]: value } : c));
  };

  const addCustomCategory = () => {
    if (!newCatName.trim()) return;
    const key = newCatName.trim().toLowerCase().replace(/\s+/g, "_");
    if (categories.find(c => c.categoryKey === key)) {
      toast({ title: "Category already exists", variant: "destructive" });
      return;
    }
    setCategories(prev => [...prev, {
      categoryKey: key,
      displayName: newCatName.trim(),
      color: newCatColor,
      isCustom: true,
    }]);
    setNewCatName("");
    setNewCatColor("#6366f1");
  };

  const removeCustomCategory = (key: string) => {
    setCategories(prev => prev.filter(c => c.categoryKey !== key));
  };

  const defaultKeys = DEFAULT_CATEGORIES.map(c => c.categoryKey);
  const defaultCats = categories.filter(c => defaultKeys.includes(c.categoryKey));
  const customCats = categories.filter(c => !defaultKeys.includes(c.categoryKey));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="settings-title">
            <Settings className="h-5 w-5" /> Calendar Settings
          </DialogTitle>
          <DialogDescription>Customize event categories, colors, and names</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-2">
            <div>
              <Label className="text-sm font-semibold">Category Colors & Names</Label>
              <div className="space-y-2 mt-2">
                {defaultCats.map(cat => (
                  <div key={cat.categoryKey} className="flex items-center gap-2" data-testid={`setting-cat-${cat.categoryKey}`}>
                    <input
                      type="color"
                      value={cat.color}
                      onChange={e => updateCategory(cat.categoryKey, "color", e.target.value)}
                      className="w-8 h-8 rounded border cursor-pointer p-0.5"
                      data-testid={`color-picker-${cat.categoryKey}`}
                    />
                    <Input
                      value={cat.displayName}
                      onChange={e => updateCategory(cat.categoryKey, "displayName", e.target.value)}
                      className="flex-1 h-8 text-sm"
                      data-testid={`name-input-${cat.categoryKey}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-semibold">My Custom Categories</Label>
              <div className="space-y-2 mt-2">
                {customCats.map(cat => (
                  <div key={cat.categoryKey} className="flex items-center gap-2" data-testid={`setting-custom-${cat.categoryKey}`}>
                    <input
                      type="color"
                      value={cat.color}
                      onChange={e => updateCategory(cat.categoryKey, "color", e.target.value)}
                      className="w-8 h-8 rounded border cursor-pointer p-0.5"
                    />
                    <Input
                      value={cat.displayName}
                      onChange={e => updateCategory(cat.categoryKey, "displayName", e.target.value)}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCustomCategory(cat.categoryKey)}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {customCats.length === 0 && (
                  <div className="text-xs text-muted-foreground py-1">No custom categories yet</div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <input
                  type="color"
                  value={newCatColor}
                  onChange={e => setNewCatColor(e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer p-0.5"
                  data-testid="new-cat-color"
                />
                <Input
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="New category name"
                  className="flex-1 h-8 text-sm"
                  data-testid="new-cat-name"
                  onKeyDown={e => { if (e.key === "Enter") addCustomCategory(); }}
                />
                <Button size="sm" variant="outline" onClick={addCustomCategory} data-testid="add-category-button">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate(categories)}
            disabled={saveMutation.isPending}
            data-testid="save-settings-button"
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
