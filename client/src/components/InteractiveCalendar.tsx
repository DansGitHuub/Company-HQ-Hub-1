import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
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
  MapPin
} from "lucide-react";
import type { CalendarConnection } from "@shared/schema";

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  location: string;
  allDay: boolean;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function MiniCalendar({ onSelectDate, events }: { onSelectDate: (date: Date) => void; events: CalendarEvent[] }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
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

  const hasEventsOnDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.some(event => event.start.startsWith(dateStr));
  };
  
  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    const selectedDate = new Date(year, month, day);
    onSelectDate(selectedDate);
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
            className={`py-1.5 rounded-md text-sm relative ${
              day === null ? "" :
              isToday(day) ? "bg-primary text-primary-foreground font-bold cursor-pointer" :
              selectedDay === day ? "bg-muted font-medium cursor-pointer" :
              "hover:bg-muted cursor-pointer"
            }`}
          >
            {day}
            {day !== null && hasEventsOnDay(day) && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500" />
            )}
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

  return (
    <ScrollArea className="h-[150px]">
      <div className="space-y-2 pr-3">
        {dayEvents.map(event => (
          <div key={event.id} className="p-2 rounded-lg bg-muted/50 border text-sm">
            <p className="font-medium truncate">{event.title}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3" />
              {event.allDay ? "All day" : formatTime(event.start)}
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

function ConnectionStatus({ connection }: { connection: CalendarConnection }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const repairMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/calendar/connections/${connection.id}/repair`, {
        method: "POST",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to repair connection");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/connections"] });
      toast({ title: "Connection repaired", description: "Your calendar is now connected." });
    },
    onError: () => {
      toast({ title: "Repair failed", description: "Please try again.", variant: "destructive" });
    }
  });
  
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/calendar/connections/${connection.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to delete connection");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/connections"] });
      toast({ title: "Connection removed" });
    }
  });
  
  const hasError = !!connection.lastError;
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card" data-testid={`connection-${connection.id}`}>
      <div className="flex items-center gap-3">
        <span className="text-xl">🗓️</span>
        <div>
          <p className="font-medium text-sm">{connection.provider === "google" ? "Google Calendar" : connection.provider}</p>
          {connection.calendarName && (
            <p className="text-xs text-muted-foreground">{connection.calendarName}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {hasError ? (
          <>
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Error
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => repairMutation.mutate()}
              disabled={repairMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${repairMutation.isPending ? "animate-spin" : ""}`} />
            </Button>
          </>
        ) : connection.isConnected ? (
          <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600">
            <Check className="h-3 w-3" />
            Connected
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Pending
          </Badge>
        )}
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

export default function InteractiveCalendar() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: gcStatus } = useQuery<{ connected: boolean }>({
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
  
  const { data: events = [], isLoading: eventsLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/google-calendar/events", startOfMonth.toISOString(), endOfMonth.toISOString()],
    queryFn: async () => {
      const res = await fetch(`/api/google-calendar/events?start=${startOfMonth.toISOString()}&end=${endOfMonth.toISOString()}`, {
        credentials: "include"
      });
      if (!res.ok) {
        if (res.status === 401) return [];
        throw new Error("Failed to fetch events");
      }
      return res.json();
    },
    enabled: gcStatus?.connected === true
  });

  const { data: connections = [] } = useQuery<CalendarConnection[]>({
    queryKey: ["/api/calendar/connections"]
  });
  
  const today = new Date();
  const dateString = today.toLocaleDateString(undefined, { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const isGoogleConnected = gcStatus?.connected === true;
  const todayEvents = events.filter(e => e.start.startsWith(today.toISOString().split('T')[0]));

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/events"] });
    toast({ title: "Calendar refreshed" });
  };
  
  return (
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
            {isGoogleConnected && (
              <Button variant="ghost" size="icon" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <MiniCalendar onSelectDate={setSelectedDate} events={events} />
          
          <Separator />
          
          {isGoogleConnected ? (
            <EventsList events={events} date={selectedDate} isLoading={eventsLoading} />
          ) : (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
                <CalendarIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Google Calendar Connected</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your calendar is connected via Replit. Events will sync automatically.
                </p>
              </div>
              <Badge variant="secondary" className="gap-1">
                <Check className="h-3 w-3" />
                Integration Active
              </Badge>
            </div>
          )}
          
          {connections.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">App Connections</p>
                {connections.map(conn => (
                  <ConnectionStatus key={conn.id} connection={conn} />
                ))}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
