import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
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
  Loader2
} from "lucide-react";
import type { CalendarConnection } from "@shared/schema";

const CALENDAR_PROVIDERS = [
  { id: "google", name: "Google Calendar", icon: "🗓️", color: "bg-blue-500" },
  { id: "apple", name: "Apple Calendar", icon: "🍎", color: "bg-gray-700" },
  { id: "samsung", name: "Samsung Calendar", icon: "📱", color: "bg-indigo-600" },
  { id: "outlook", name: "Outlook Calendar", icon: "📧", color: "bg-blue-600" },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function MiniCalendar() {
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
            className={`py-1.5 rounded-md text-sm ${
              day === null ? "" :
              isToday(day) ? "bg-primary text-primary-foreground font-bold" :
              "hover:bg-muted cursor-pointer"
            }`}
          >
            {day}
          </div>
        ))}
      </div>
    </div>
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
  
  const provider = CALENDAR_PROVIDERS.find(p => p.id === connection.provider);
  const hasError = !!connection.lastError;
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card" data-testid={`connection-${connection.id}`}>
      <div className="flex items-center gap-3">
        <span className="text-xl">{provider?.icon || "📅"}</span>
        <div>
          <p className="font-medium text-sm">{provider?.name || connection.provider}</p>
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
              size="sm"
              variant="outline"
              onClick={() => repairMutation.mutate()}
              disabled={repairMutation.isPending}
              data-testid={`repair-btn-${connection.id}`}
            >
              {repairMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              <span className="ml-1">Fix</span>
            </Button>
          </>
        ) : connection.isConnected ? (
          <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
            <Check className="h-3 w-3" />
            Connected
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Pending
          </Badge>
        )}
        
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          data-testid={`delete-connection-${connection.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ConnectionWizard({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [createdConnectionId, setCreatedConnectionId] = useState<string | null>(null);
  
  const { data: connections = [] } = useQuery<CalendarConnection[]>({
    queryKey: ["/api/calendar/connections"]
  });
  
  const createMutation = useMutation({
    mutationFn: async (provider: string) => {
      const res = await fetch("/api/calendar/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ provider })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create connection");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setCreatedConnectionId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/connections"] });
      setStep(3);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });
  
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!createdConnectionId) throw new Error("Connection not found");
      
      const res = await fetch(`/api/calendar/connections/${createdConnectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          isConnected: true, 
          lastSyncAt: new Date().toISOString(),
          calendarName: "My Calendar"
        })
      });
      if (!res.ok) throw new Error("Failed to complete connection");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/connections"] });
      toast({ title: "Calendar connected!", description: "Your calendar is now synced." });
      onClose();
    }
  });
  
  const connectedProviders = connections.map(c => c.provider);
  const availableProviders = CALENDAR_PROVIDERS.filter(p => !connectedProviders.includes(p.id));
  
  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Connect Calendar
        </DialogTitle>
        <DialogDescription>
          {step === 1 && "Choose a calendar provider to connect"}
          {step === 2 && "Authorizing connection..."}
          {step === 3 && "Complete your connection"}
        </DialogDescription>
      </DialogHeader>
      
      {step === 1 && (
        <div className="space-y-3 py-4">
          {availableProviders.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">All calendar providers are already connected!</p>
          ) : (
            availableProviders.map(provider => (
              <button
                key={provider.id}
                onClick={() => {
                  setSelectedProvider(provider.id);
                  createMutation.mutate(provider.id);
                  setStep(2);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
                data-testid={`provider-${provider.id}`}
              >
                <span className="text-2xl">{provider.icon}</span>
                <div className="text-left">
                  <p className="font-medium">{provider.name}</p>
                  <p className="text-xs text-muted-foreground">Click to connect</p>
                </div>
                <ChevronRight className="h-5 w-5 ml-auto text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      )}
      
      {step === 2 && (
        <div className="py-8 text-center">
          <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Connecting to {CALENDAR_PROVIDERS.find(p => p.id === selectedProvider)?.name}...</p>
          <p className="text-xs text-muted-foreground mt-2">This may take a moment</p>
        </div>
      )}
      
      {step === 3 && (
        <div className="py-4 space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <p className="font-medium">Ready to connect!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click "Complete" to finish setting up your {CALENDAR_PROVIDERS.find(p => p.id === selectedProvider)?.name}
            </p>
          </div>
        </div>
      )}
      
      <DialogFooter>
        {step === 1 && (
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        )}
        {step === 3 && (
          <>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending} data-testid="complete-connection-btn">
              {confirmMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Complete
            </Button>
          </>
        )}
      </DialogFooter>
    </DialogContent>
  );
}

export default function InteractiveCalendar() {
  const [isOpen, setIsOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  
  const { data: connections = [], isLoading } = useQuery<CalendarConnection[]>({
    queryKey: ["/api/calendar/connections"]
  });
  
  const today = new Date();
  const dateString = today.toLocaleDateString(undefined, { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const hasConnections = connections.length > 0;
  const hasErrors = connections.some(c => c.lastError);
  const allConnected = connections.length > 0 && connections.every(c => c.isConnected && !c.lastError);
  
  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-muted"
            data-testid="calendar-trigger"
          >
            <CalendarIcon className="h-4 w-4" />
            <span className="hidden md:inline">{dateString}</span>
            {hasErrors && (
              <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center rounded-full">
                <AlertCircle className="h-3 w-3" />
              </Badge>
            )}
            {allConnected && (
              <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center rounded-full bg-green-500/10 text-green-600 border-green-500/20">
                <Check className="h-3 w-3" />
              </Badge>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="p-4">
            <MiniCalendar />
          </div>
          
          <Separator />
          
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Calendar Connections</h4>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1"
                onClick={() => setShowWizard(true)}
                data-testid="add-calendar-btn"
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
            
            {isLoading ? (
              <div className="py-4 text-center">
                <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
              </div>
            ) : connections.length === 0 ? (
              <div className="py-4 text-center">
                <CalendarIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No calendars connected</p>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowWizard(true)}
                  data-testid="connect-calendar-btn"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Connect Calendar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {connections.map(connection => (
                  <ConnectionStatus key={connection.id} connection={connection} />
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <ConnectionWizard onClose={() => setShowWizard(false)} />
      </Dialog>
    </>
  );
}
