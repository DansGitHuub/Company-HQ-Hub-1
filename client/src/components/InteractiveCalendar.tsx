import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { showErrorToast } from "@/lib/errorToast";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  AlertCircle, 
  RefreshCw, 
  Plus,
  Trash2,
  Link2,
  Loader2,
  Clock,
  MapPin,
  AlertTriangle,
  ExternalLink
} from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  location: string;
  allDay: boolean;
  source?: "google" | "fleet";
  priority?: string;
}

interface CalendarStatus {
  connected: boolean;
  hasCredentials: boolean;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function MiniCalendar({ onSelectDate, selectedDate, events }: { 
  onSelectDate: (date: Date) => void; 
  selectedDate: Date | null;
  events: CalendarEvent[] 
}) {
  const [viewDate, setViewDate] = useState(new Date());
  const today = new Date();
  
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  
  const isToday = (day: number) => {
    return day === today.getDate() && 
           month === today.getMonth() && 
           year === today.getFullYear();
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return day === selectedDate.getDate() && 
           month === selectedDate.getMonth() && 
           year === selectedDate.getFullYear();
  };

  const getEventsOnDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(event => event.start.startsWith(dateStr));
  };

  const getDotColor = (dayEvents: CalendarEvent[]) => {
    const fleetEvents = dayEvents.filter(e => e.source === "fleet");
    if (fleetEvents.some(e => e.priority === "p1")) return "bg-red-500";
    if (fleetEvents.some(e => e.priority === "p2")) return "bg-orange-500";
    if (fleetEvents.some(e => e.priority === "p3")) return "bg-yellow-500";
    if (fleetEvents.length > 0) return "bg-green-500";
    return "bg-blue-500";
  };
  
  const handleDayClick = (day: number) => {
    const selectedDateNew = new Date(year, month, day);
    onSelectDate(selectedDateNew);
  };
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth} data-testid="calendar-prev-month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium">{MONTHS[month]} {year}</span>
        <Button variant="ghost" size="icon" onClick={nextMonth} data-testid="calendar-next-month">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {DAYS.map(d => (
          <div key={d} className="py-1 text-muted-foreground font-medium">{d}</div>
        ))}
        {days.map((day, i) => (
          <div
            key={i}
            onClick={() => day !== null && handleDayClick(day)}
            data-testid={day !== null ? `calendar-day-${day}` : undefined}
            className={`py-1.5 rounded-md text-sm relative ${
              day === null ? "" :
              isToday(day) ? "bg-primary text-primary-foreground font-bold cursor-pointer" :
              isSelected(day) ? "bg-blue-100 dark:bg-blue-900 font-medium cursor-pointer ring-2 ring-blue-500" :
              "hover:bg-muted cursor-pointer"
            }`}
          >
            {day}
            {day !== null && (() => {
              const dayEvts = getEventsOnDay(day);
              if (dayEvts.length === 0) return null;
              return <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${getDotColor(dayEvts)}`} />;
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}

function EventsList({ events, date, isLoading }: { events: CalendarEvent[]; date: Date | null; isLoading: boolean }) {
  if (!date) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        Select a date to view events
      </div>
    );
  }

  const dateStr = date.toISOString().split('T')[0];
  const dayEvents = events.filter(event => event.start.startsWith(dateStr));

  const formatTime = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        <p className="text-xs text-muted-foreground mt-2">Loading events...</p>
      </div>
    );
  }

  if (dayEvents.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No events on {date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
      </div>
    );
  }

  const priorityBorder: Record<string, string> = {
    p1: "border-l-red-500",
    p2: "border-l-orange-500",
    p3: "border-l-yellow-500",
    p4: "border-l-green-500",
  };

  const priorityLabel: Record<string, string> = {
    p1: "Critical",
    p2: "Due Soon",
    p3: "Approaching",
    p4: "Good",
  };

  return (
    <ScrollArea className="h-[120px]">
      <div className="space-y-2 pr-3">
        {dayEvents.map(event => (
          <div
            key={event.id}
            className={`p-2 rounded-lg bg-muted/50 border text-sm ${
              event.source === "fleet" ? `border-l-4 ${priorityBorder[event.priority || "p4"] || ""}` : ""
            }`}
          >
            <div className="flex items-center gap-1.5">
              {event.source === "fleet" && (
                <span className="text-[10px] font-bold uppercase px-1 py-0.5 rounded bg-muted text-muted-foreground">Maint</span>
              )}
              <p className="font-medium truncate flex-1">{event.title}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              {event.source === "fleet" ? (
                <>
                  <AlertTriangle className="h-3 w-3" />
                  <span>{priorityLabel[event.priority || "p4"]}</span>
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  {event.allDay ? "All day" : formatTime(event.start)}
                </>
              )}
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{event.location}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function CreateEventDialog({ 
  open, 
  onOpenChange, 
  selectedDate,
  onConflictCheck 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  onConflictCheck: (start: string, end: string) => Promise<{ hasConflicts: boolean; conflicts: any[] }>;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  
  useState(() => {
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      setStartDate(dateStr);
      setEndDate(dateStr);
    }
  });
  
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/google-calendar/events", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/events"] });
      toast({ title: "Event created", description: "Added to your Google Calendar" });
      onOpenChange(false);
      resetForm();
    },
    onError: (err: any) => {
      showErrorToast(err, "Failed to create event");
    }
  });
  
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setStartTime("09:00");
    setEndTime("10:00");
    setAllDay(false);
    setConflicts([]);
  };
  
  const handleCheckConflicts = async () => {
    if (!startDate || !endDate) return;
    
    setCheckingConflicts(true);
    try {
      const start = allDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`;
      const end = allDay ? `${endDate}T23:59:59` : `${endDate}T${endTime}:00`;
      
      const result = await onConflictCheck(start, end);
      setConflicts(result.conflicts);
      
      if (result.hasConflicts) {
        toast({ 
          title: "Scheduling conflict detected", 
          description: "There are existing events during this time",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("Error checking conflicts:", err);
    } finally {
      setCheckingConflicts(false);
    }
  };
  
  const handleSubmit = () => {
    if (!title.trim() || !startDate || !endDate) {
      toast({ title: "Missing required fields", variant: "destructive" });
      return;
    }
    
    const start = allDay ? startDate : `${startDate}T${startTime}:00`;
    const end = allDay ? endDate : `${endDate}T${endTime}:00`;
    
    createMutation.mutate({ title, description, location, start, end, allDay });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Event</DialogTitle>
          <DialogDescription>Create a new event in your Google Calendar</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="event-title">Title *</Label>
            <Input 
              id="event-title"
              placeholder="Event title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="event-title-input"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date *</Label>
              <Input 
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="event-start-date"
              />
            </div>
            {!allDay && (
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time</Label>
                <Input 
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  data-testid="event-start-time"
                />
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date *</Label>
              <Input 
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="event-end-date"
              />
            </div>
            {!allDay && (
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time</Label>
                <Input 
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  data-testid="event-end-time"
                />
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="all-day" 
              checked={allDay} 
              onCheckedChange={(checked) => setAllDay(checked === true)}
            />
            <Label htmlFor="all-day" className="text-sm">All day event</Label>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input 
              id="location"
              placeholder="Event location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              data-testid="event-location-input"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description"
              placeholder="Event description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              data-testid="event-description-input"
            />
          </div>
          
          {conflicts.length > 0 && (
            <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Conflict Warning</span>
              </div>
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                You have {conflicts.length} existing event(s) during this time
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={handleCheckConflicts}
            disabled={!startDate || !endDate || checkingConflicts}
            data-testid="check-conflicts-button"
          >
            {checkingConflicts ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <AlertCircle className="h-4 w-4 mr-2" />
            )}
            Check Conflicts
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={createMutation.isPending || !title.trim()}
            data-testid="create-event-button"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Create Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function InteractiveCalendar() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showFleetOnly, setShowFleetOnly] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: gcStatus } = useQuery<CalendarStatus>({
    queryKey: ["/api/google-calendar/status"],
  });

  const startOfMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  const endOfMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 2, 0);
  }, []);
  
  const { data: gcEvents = [], isLoading: eventsLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/google-calendar/events", startOfMonth.toISOString(), endOfMonth.toISOString()],
    queryFn: async () => {
      const res = await fetch(`/api/google-calendar/events?start=${startOfMonth.toISOString()}&end=${endOfMonth.toISOString()}`, {
        credentials: "include"
      });
      if (!res.ok) {
        if (res.status === 401) return [];
        throw new Error("Failed to fetch events");
      }
      const data = await res.json();
      return data.map((e: any) => ({ ...e, source: "google" as const }));
    },
    enabled: gcStatus?.connected === true
  });

  const { data: fleetEvents = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/fleet/calendar-events"],
    queryFn: async () => {
      const res = await fetch("/api/fleet/calendar-events", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return [];
        return [];
      }
      const data = await res.json();
      return data.map((e: any) => ({
        id: `fleet-${e.id}`,
        title: e.title,
        description: `${e.assetName} - ${e.category || ""}`,
        start: typeof e.date === "string" ? e.date : new Date(e.date).toISOString().split("T")[0],
        end: typeof e.date === "string" ? e.date : new Date(e.date).toISOString().split("T")[0],
        location: "",
        allDay: true,
        source: "fleet" as const,
        priority: e.priority || "p4",
      }));
    },
  });

  const events = useMemo(() => {
    if (showFleetOnly) return fleetEvents;
    return [...gcEvents, ...fleetEvents];
  }, [gcEvents, fleetEvents, showFleetOnly]);
  
  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/google/connect", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to start OAuth");
      return res.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err: any) => {
      showErrorToast(err, "Connection failed");
    }
  });
  
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/google-calendar/disconnect", { 
        method: "DELETE",
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/events"] });
      toast({ title: "Calendar disconnected" });
    }
  });
  
  const checkConflicts = async (start: string, end: string) => {
    const res = await apiRequest("POST", "/api/google-calendar/check-conflicts", { start, end });
    return res.json();
  };
  
  const today = new Date();
  const dateString = today.toLocaleDateString(undefined, { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const isConnected = gcStatus?.connected === true;
  const hasCredentials = gcStatus?.hasCredentials === true;
  const todayEvents = events.filter(e => e.start.startsWith(today.toISOString().split('T')[0]));

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/events"] });
    queryClient.invalidateQueries({ queryKey: ["/api/fleet/calendar-events"] });
    toast({ title: "Calendar refreshed" });
  };
  
  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative"
            data-testid="calendar-button"
          >
            <CalendarIcon className="h-5 w-5" />
            {todayEvents.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center">
                {todayEvents.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-4" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Calendar</h3>
                <p className="text-xs text-muted-foreground">{dateString}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant={showFleetOnly ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => setShowFleetOnly(!showFleetOnly)}
                  title="Show equipment maintenance only"
                  data-testid="button-fleet-filter"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Fleet
                </Button>
                {isConnected && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefresh}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            
            <MiniCalendar 
              onSelectDate={setSelectedDate} 
              selectedDate={selectedDate}
              events={events} 
            />
            
            <Separator />
            
            <EventsList events={events} date={selectedDate} isLoading={eventsLoading} />

            {isConnected ? (
              <>
                <div className="flex gap-2">
                  <Button 
                    className="flex-1" 
                    size="sm"
                    onClick={() => setShowCreateEvent(true)}
                    data-testid="add-event-button"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Event
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="h-3 w-3 text-green-500" />
                  <span>Connected to Google Calendar</span>
                </div>
              </>
            ) : hasCredentials ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <CalendarIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Connect Your Calendar</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Link your Google Calendar to view events and check for conflicts
                  </p>
                </div>
                <Button 
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending}
                  className="w-full"
                  data-testid="connect-google-calendar-button"
                >
                  {connectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Connect Google Calendar
                </Button>
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Calendar Not Configured</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Google Calendar integration requires setup by an administrator
                  </p>
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      
      <CreateEventDialog 
        open={showCreateEvent}
        onOpenChange={setShowCreateEvent}
        selectedDate={selectedDate}
        onConflictCheck={checkConflicts}
      />
    </>
  );
}
