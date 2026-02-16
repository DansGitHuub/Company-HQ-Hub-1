import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Wrench, Truck, Settings, Calendar, AlertTriangle, ChevronDown, ChevronUp, Trash2, Edit2, Upload, FileText, Image, Receipt, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { Equipment, MaintenanceSchedule, MaintenanceLog, EquipmentUpload } from "@shared/schema";

export default function EquipmentTracker() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [expandedEquipment, setExpandedEquipment] = useState<string | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<MaintenanceSchedule | null>(null);
  const [scheduleIntervalType, setScheduleIntervalType] = useState("days");

  const { data: equipment = [], isLoading } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: schedules = [] } = useQuery<MaintenanceSchedule[]>({
    queryKey: ["/api/maintenance-schedules"],
  });

  const { data: logs = [] } = useQuery<MaintenanceLog[]>({
    queryKey: ["/api/maintenance-logs"],
  });

  const createEquipment = useMutation({
    mutationFn: async (data: Partial<Equipment>) => {
      const res = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create equipment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setAddDialogOpen(false);
      toast({ title: "Equipment added successfully" });
    },
  });

  const updateEquipment = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Equipment> }) => {
      const res = await fetch(`/api/equipment/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update equipment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setEditingEquipment(null);
      toast({ title: "Equipment updated successfully" });
    },
  });

  const deleteEquipment = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/equipment/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete equipment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      toast({ title: "Equipment deleted" });
    },
  });

  const createSchedule = useMutation({
    mutationFn: async (data: Partial<MaintenanceSchedule>) => {
      const res = await fetch("/api/maintenance-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create schedule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-schedules"] });
      setScheduleDialogOpen(false);
      setScheduleIntervalType("days");
      toast({ title: "Maintenance schedule created" });
    },
  });

  const createLog = useMutation({
    mutationFn: async (data: Partial<MaintenanceLog>) => {
      const res = await fetch("/api/maintenance-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create log");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-schedules"] });
      setLogDialogOpen(false);
      setSelectedSchedule(null);
      toast({ title: "Maintenance logged successfully" });
    },
  });

  const getEquipmentSchedules = (equipmentId: string) => 
    schedules.filter(s => s.equipmentId === equipmentId);

  const getEquipmentLogs = (equipmentId: string) => 
    logs.filter(l => l.equipmentId === equipmentId);

  const getOverdueCount = () => {
    const now = new Date();
    return schedules.filter(s => s.nextDueDate && new Date(s.nextDueDate) < now).length;
  };

  const getUpcomingCount = () => {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return schedules.filter(s => {
      if (!s.nextDueDate) return false;
      const dueDate = new Date(s.nextDueDate);
      return dueDate >= now && dueDate <= weekFromNow;
    }).length;
  };

  const handleAddEquipment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createEquipment.mutate({
      name: formData.get("name") as string,
      type: formData.get("type") as string,
      year: formData.get("year") ? parseInt(formData.get("year") as string) : undefined,
      make: formData.get("make") as string || undefined,
      model: formData.get("model") as string || undefined,
      vin: formData.get("vin") as string || undefined,
      licensePlate: formData.get("licensePlate") as string || undefined,
      mileage: formData.get("currentMileage") ? parseInt(formData.get("currentMileage") as string) : undefined,
      hours: formData.get("currentHours") ? parseInt(formData.get("currentHours") as string) : undefined,
      notes: formData.get("notes") as string || undefined,
      status: "active",
    });
  };

  const handleEditEquipment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEquipment) return;
    const formData = new FormData(e.currentTarget);
    updateEquipment.mutate({
      id: editingEquipment.id,
      data: {
        name: formData.get("name") as string,
        type: formData.get("type") as string,
        year: formData.get("year") ? parseInt(formData.get("year") as string) : undefined,
        make: formData.get("make") as string || undefined,
        model: formData.get("model") as string || undefined,
        vin: formData.get("vin") as string || undefined,
        licensePlate: formData.get("licensePlate") as string || undefined,
        mileage: formData.get("currentMileage") ? parseInt(formData.get("currentMileage") as string) : undefined,
        hours: formData.get("currentHours") ? parseInt(formData.get("currentHours") as string) : undefined,
        notes: formData.get("notes") as string || undefined,
        status: formData.get("status") as string,
      },
    });
  };

  const handleAddSchedule = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEquipmentId) return;
    const formData = new FormData(e.currentTarget);
    const intervalType = scheduleIntervalType;
    const intervalValue = parseInt(formData.get("intervalValue") as string);
    
    let nextDueDate: Date | undefined;
    let nextDueMileage: number | undefined;
    let nextDueHours: number | undefined;
    
    const selectedEquip = equipment.find(e => e.id === selectedEquipmentId);
    
    if (intervalType === "days") {
      nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + intervalValue);
    } else if (intervalType === "miles" && selectedEquip?.mileage) {
      nextDueMileage = selectedEquip.mileage + intervalValue;
    } else if (intervalType === "hours" && selectedEquip?.hours) {
      nextDueHours = selectedEquip.hours + intervalValue;
    }
    
    createSchedule.mutate({
      equipmentId: selectedEquipmentId,
      name: formData.get("taskName") as string,
      description: formData.get("description") as string || undefined,
      intervalType,
      intervalValue,
      nextDueDate,
      nextDueMileage,
      nextDueHours,
      reminderDays: formData.get("reminderDays") ? parseInt(formData.get("reminderDays") as string) : undefined,
      reminderEmail: formData.get("notifyEmail") as string || undefined,
      isActive: true,
    });
  };

  const handleLogMaintenance = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSchedule) return;
    const formData = new FormData(e.currentTarget);
    const costStr = formData.get("cost") as string;
    const costCents = costStr ? Math.round(parseFloat(costStr) * 100) : undefined;
    createLog.mutate({
      equipmentId: selectedSchedule.equipmentId,
      scheduleId: selectedSchedule.id,
      name: selectedSchedule.name,
      completedDate: new Date(formData.get("completedDate") as string),
      mileageAtService: formData.get("mileageAtService") ? parseInt(formData.get("mileageAtService") as string) : undefined,
      hoursAtService: formData.get("hoursAtService") ? parseInt(formData.get("hoursAtService") as string) : undefined,
      cost: costCents,
      notes: formData.get("notes") as string || undefined,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground" data-testid="page-title">Equipment Tracker</h1>
          <p className="text-muted-foreground">Manage vehicles, equipment, and maintenance schedules</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-equipment">
              <Plus className="h-4 w-4 mr-2" />
              Add Equipment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Equipment</DialogTitle>
              <DialogDescription>Enter the details for the new vehicle or equipment.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddEquipment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" name="name" placeholder="e.g., Ford F-150 #1" required data-testid="input-equipment-name" />
                </div>
                <div>
                  <Label htmlFor="type">Type *</Label>
                  <Select name="type" defaultValue="vehicle" required>
                    <SelectTrigger data-testid="select-equipment-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vehicle">Vehicle</SelectItem>
                      <SelectItem value="trailer">Trailer</SelectItem>
                      <SelectItem value="mower">Mower</SelectItem>
                      <SelectItem value="equipment">Other Equipment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Input id="year" name="year" type="number" placeholder="2024" data-testid="input-equipment-year" />
                </div>
                <div>
                  <Label htmlFor="make">Make</Label>
                  <Input id="make" name="make" placeholder="e.g., Ford" data-testid="input-equipment-make" />
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" name="model" placeholder="e.g., F-150" data-testid="input-equipment-model" />
                </div>
                <div>
                  <Label htmlFor="vin">VIN</Label>
                  <Input id="vin" name="vin" placeholder="Vehicle Identification Number" data-testid="input-equipment-vin" />
                </div>
                <div>
                  <Label htmlFor="licensePlate">License Plate</Label>
                  <Input id="licensePlate" name="licensePlate" placeholder="ABC-1234" data-testid="input-equipment-plate" />
                </div>
                <div>
                  <Label htmlFor="currentMileage">Current Mileage</Label>
                  <Input id="currentMileage" name="currentMileage" type="number" placeholder="50000" data-testid="input-equipment-mileage" />
                </div>
                <div>
                  <Label htmlFor="currentHours">Current Hours</Label>
                  <Input id="currentHours" name="currentHours" type="number" placeholder="Hours of operation" data-testid="input-equipment-hours" />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" placeholder="Additional notes..." data-testid="input-equipment-notes" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createEquipment.isPending} data-testid="button-save-equipment">
                  {createEquipment.isPending ? "Adding..." : "Add Equipment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Equipment</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-equipment">{equipment.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Maintenance</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="stat-upcoming">{getUpcomingCount()}</div>
            <p className="text-xs text-muted-foreground">Due within 7 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="stat-overdue">{getOverdueCount()}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {equipment.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Truck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Equipment Yet</h3>
            <p className="text-muted-foreground mb-4">Add your first vehicle or piece of equipment to get started.</p>
            <Button onClick={() => setAddDialogOpen(true)} data-testid="button-add-first-equipment">
              <Plus className="h-4 w-4 mr-2" />
              Add Equipment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {equipment.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedEquipment(expandedEquipment === item.id ? null : item.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-full bg-primary/10">
                      {item.type === "vehicle" ? <Truck className="h-5 w-5 text-primary" /> : 
                       item.type === "mower" ? <Settings className="h-5 w-5 text-primary" /> :
                       <Wrench className="h-5 w-5 text-primary" />}
                    </div>
                    <div>
                      <CardTitle className="text-lg" data-testid={`equipment-name-${item.id}`}>{item.name}</CardTitle>
                      <CardDescription>
                        {item.year && `${item.year} `}{item.make && `${item.make} `}{item.model}
                        {item.licensePlate && ` • ${item.licensePlate}`}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={item.status === "active" ? "default" : item.status === "maintenance" ? "secondary" : "outline"}>
                      {item.status}
                    </Badge>
                    {getEquipmentSchedules(item.id).some(s => s.nextDueDate && new Date(s.nextDueDate) < new Date()) && (
                      <Badge variant="destructive">Overdue</Badge>
                    )}
                    {expandedEquipment === item.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </div>
              </CardHeader>
              
              {expandedEquipment === item.id && (
                <CardContent className="border-t">
                  <Tabs defaultValue="details" className="mt-4">
                    <TabsList>
                      <TabsTrigger value="details">Details</TabsTrigger>
                      <TabsTrigger value="schedules">Maintenance ({getEquipmentSchedules(item.id).length})</TabsTrigger>
                      <TabsTrigger value="history">History ({getEquipmentLogs(item.id).length})</TabsTrigger>
                      <TabsTrigger value="uploads">
                        <Upload className="h-4 w-4 mr-1" />
                        Documents
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="details" className="mt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        {item.vin && (
                          <div>
                            <Label className="text-muted-foreground text-xs">VIN</Label>
                            <p className="font-medium">{item.vin}</p>
                          </div>
                        )}
                        {item.mileage && (
                          <div>
                            <Label className="text-muted-foreground text-xs">Mileage</Label>
                            <p className="font-medium">{item.mileage.toLocaleString()} mi</p>
                          </div>
                        )}
                        {item.hours && (
                          <div>
                            <Label className="text-muted-foreground text-xs">Hours</Label>
                            <p className="font-medium">{item.hours.toLocaleString()} hrs</p>
                          </div>
                        )}
                        {item.notes && (
                          <div className="col-span-2">
                            <Label className="text-muted-foreground text-xs">Notes</Label>
                            <p className="font-medium">{item.notes}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingEquipment(item)} data-testid={`button-edit-${item.id}`}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this equipment?")) {
                              deleteEquipment.mutate(item.id);
                            }
                          }}
                          data-testid={`button-delete-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="schedules" className="mt-4">
                      <div className="space-y-3">
                        {getEquipmentSchedules(item.id).map((schedule) => {
                          const isOverdue = schedule.nextDueDate && new Date(schedule.nextDueDate) < new Date();
                          return (
                            <div key={schedule.id} className={`flex items-center justify-between p-3 rounded-lg border ${isOverdue ? 'border-red-200 bg-red-50' : 'bg-muted/30'}`}>
                              <div>
                                <p className="font-medium">{schedule.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Every {schedule.intervalValue} {schedule.intervalType}
                                  {schedule.nextDueDate && ` • Due: ${new Date(schedule.nextDueDate).toLocaleDateString()}`}
                                  {schedule.nextDueMileage && ` • Due: ${schedule.nextDueMileage.toLocaleString()} mi`}
                                  {schedule.nextDueHours && ` • Due: ${schedule.nextDueHours.toLocaleString()} hrs`}
                                </p>
                              </div>
                              <Button 
                                size="sm" 
                                onClick={() => { setSelectedSchedule(schedule); setLogDialogOpen(true); }}
                                data-testid={`button-log-${schedule.id}`}
                              >
                                Log Completed
                              </Button>
                            </div>
                          );
                        })}
                        <Button 
                          variant="outline" 
                          className="w-full" 
                          onClick={() => { setSelectedEquipmentId(item.id); setScheduleDialogOpen(true); }}
                          data-testid={`button-add-schedule-${item.id}`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Maintenance Schedule
                        </Button>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="history" className="mt-4">
                      <div className="space-y-2">
                        {getEquipmentLogs(item.id).length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">No maintenance history yet.</p>
                        ) : (
                          getEquipmentLogs(item.id).map((log) => (
                            <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                              <div>
                                <p className="font-medium">{log.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(log.completedDate).toLocaleDateString()}
                                  {log.mileageAtService && ` • ${log.mileageAtService.toLocaleString()} mi`}
                                  {log.hoursAtService && ` • ${log.hoursAtService.toLocaleString()} hrs`}
                                  {log.cost && ` • $${(log.cost / 100).toFixed(2)}`}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="uploads" className="mt-4">
                      <EquipmentUploadsTab equipmentId={item.id} />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editingEquipment} onOpenChange={(open) => !open && setEditingEquipment(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Equipment</DialogTitle>
          </DialogHeader>
          {editingEquipment && (
            <form onSubmit={handleEditEquipment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input id="edit-name" name="name" defaultValue={editingEquipment.name} required />
                </div>
                <div>
                  <Label htmlFor="edit-type">Type *</Label>
                  <Select name="type" defaultValue={editingEquipment.type}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vehicle">Vehicle</SelectItem>
                      <SelectItem value="trailer">Trailer</SelectItem>
                      <SelectItem value="mower">Mower</SelectItem>
                      <SelectItem value="equipment">Other Equipment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select name="status" defaultValue={editingEquipment.status || "active"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="maintenance">In Maintenance</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-year">Year</Label>
                  <Input id="edit-year" name="year" type="number" defaultValue={editingEquipment.year || ""} />
                </div>
                <div>
                  <Label htmlFor="edit-make">Make</Label>
                  <Input id="edit-make" name="make" defaultValue={editingEquipment.make || ""} />
                </div>
                <div>
                  <Label htmlFor="edit-model">Model</Label>
                  <Input id="edit-model" name="model" defaultValue={editingEquipment.model || ""} />
                </div>
                <div>
                  <Label htmlFor="edit-vin">VIN</Label>
                  <Input id="edit-vin" name="vin" defaultValue={editingEquipment.vin || ""} />
                </div>
                <div>
                  <Label htmlFor="edit-licensePlate">License Plate</Label>
                  <Input id="edit-licensePlate" name="licensePlate" defaultValue={editingEquipment.licensePlate || ""} />
                </div>
                <div>
                  <Label htmlFor="edit-currentMileage">Current Mileage</Label>
                  <Input id="edit-currentMileage" name="currentMileage" type="number" defaultValue={editingEquipment.mileage || ""} />
                </div>
                <div>
                  <Label htmlFor="edit-currentHours">Current Hours</Label>
                  <Input id="edit-currentHours" name="currentHours" type="number" defaultValue={editingEquipment.hours || ""} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Textarea id="edit-notes" name="notes" defaultValue={editingEquipment.notes || ""} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateEquipment.isPending}>
                  {updateEquipment.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Maintenance Schedule</DialogTitle>
            <DialogDescription>Set up a recurring maintenance task for this equipment.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSchedule} className="space-y-4">
            <div>
              <Label htmlFor="taskName">Task Name *</Label>
              <Input id="taskName" name="taskName" placeholder="e.g., Oil Change" required data-testid="input-task-name" />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" placeholder="Additional details..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="intervalValue">Interval Value *</Label>
                <Input id="intervalValue" name="intervalValue" type="number" placeholder="e.g., 5000" required data-testid="input-interval-value" />
              </div>
              <div>
                <Label htmlFor="intervalType">Interval Type *</Label>
                <Select value={scheduleIntervalType} onValueChange={setScheduleIntervalType}>
                  <SelectTrigger data-testid="select-interval-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="miles">Miles</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reminderDays">Reminder (days before)</Label>
                <Input id="reminderDays" name="reminderDays" type="number" placeholder="e.g., 7" data-testid="input-reminder-days" />
              </div>
              <div>
                <Label htmlFor="notifyEmail">Notify Email</Label>
                <Input id="notifyEmail" name="notifyEmail" type="email" placeholder="email@example.com" data-testid="input-notify-email" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createSchedule.isPending} data-testid="button-save-schedule">
                {createSchedule.isPending ? "Creating..." : "Create Schedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={logDialogOpen} onOpenChange={(open) => { setLogDialogOpen(open); if (!open) setSelectedSchedule(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Maintenance Completed</DialogTitle>
            <DialogDescription>
              {selectedSchedule && `Record completion of: ${selectedSchedule.name}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLogMaintenance} className="space-y-4">
            <div>
              <Label htmlFor="completedDate">Completed Date *</Label>
              <Input id="completedDate" name="completedDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} required data-testid="input-completed-date" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mileageAtService">Mileage at Service</Label>
                <Input id="mileageAtService" name="mileageAtService" type="number" placeholder="Current mileage" data-testid="input-log-mileage" />
              </div>
              <div>
                <Label htmlFor="hoursAtService">Hours at Service</Label>
                <Input id="hoursAtService" name="hoursAtService" type="number" placeholder="Current hours" data-testid="input-log-hours" />
              </div>
            </div>
            <div>
              <Label htmlFor="cost">Cost</Label>
              <Input id="cost" name="cost" placeholder="e.g., 75.00" data-testid="input-log-cost" />
            </div>
            <div>
              <Label htmlFor="log-notes">Notes</Label>
              <Textarea id="log-notes" name="notes" placeholder="Any notes about this maintenance..." data-testid="input-log-notes" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createLog.isPending} data-testid="button-save-log">
                {createLog.isPending ? "Logging..." : "Log Maintenance"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EquipmentUploadsTab({ equipmentId }: { equipmentId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [workType, setWorkType] = useState("");
  const [description, setDescription] = useState("");

  const { data: uploads = [], isLoading } = useQuery<EquipmentUpload[]>({
    queryKey: [`/api/equipment/${equipmentId}/uploads`],
  });

  const createUpload = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/equipment/${equipmentId}/uploads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create upload");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/equipment/${equipmentId}/uploads`] });
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setWorkType("");
      setDescription("");
      toast({ title: "Document uploaded successfully" });
    },
  });

  const deleteUpload = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/equipment-uploads/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete upload");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/equipment/${equipmentId}/uploads`] });
      toast({ title: "Document deleted" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedFile.name,
          size: selectedFile.size,
          contentType: selectedFile.type,
        }),
        credentials: "include",
      });
      
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();
      
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": selectedFile.type },
      });
      
      if (!uploadRes.ok) throw new Error("Upload failed");
      
      const fileType = selectedFile.type.startsWith("image/") ? "image" : 
                       selectedFile.name.toLowerCase().includes("receipt") ? "receipt" : "document";
      
      await createUpload.mutateAsync({
        fileName: selectedFile.name,
        fileUrl: objectPath,
        fileType,
        workType: workType || null,
        description: description || null,
      });
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "image": return <Image className="h-5 w-5 text-blue-500" />;
      case "receipt": return <Receipt className="h-5 w-5 text-green-500" />;
      default: return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const sortedUploads = [...uploads].sort((a, b) => 
    new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Upload receipts, photos, and documents for this equipment
        </p>
        <Button onClick={() => setUploadDialogOpen(true)} size="sm" data-testid="button-upload-document">
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : sortedUploads.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No documents uploaded yet</p>
          <p className="text-sm text-muted-foreground">Upload receipts, maintenance records, or photos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedUploads.map((upload) => (
            <div key={upload.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                {getFileIcon(upload.fileType)}
                <div>
                  <a 
                    href={upload.fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                  >
                    {upload.fileName}
                  </a>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{new Date(upload.uploadedAt || 0).toLocaleDateString()}</span>
                    {upload.workType && (
                      <>
                        <span>•</span>
                        <Badge variant="outline" className="text-xs">{upload.workType}</Badge>
                      </>
                    )}
                    {upload.description && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[200px]">{upload.description}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => deleteUpload.mutate(upload.id)}
                disabled={deleteUpload.isPending}
              >
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a receipt, photo, or document for this equipment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>File</Label>
              <div className="mt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx"
                />
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  {selectedFile ? selectedFile.name : "Choose file..."}
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="workType">Work/Repair Type</Label>
              <Select value={workType} onValueChange={setWorkType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Oil Change">Oil Change</SelectItem>
                  <SelectItem value="Tire Replacement">Tire Replacement</SelectItem>
                  <SelectItem value="Brake Service">Brake Service</SelectItem>
                  <SelectItem value="Engine Repair">Engine Repair</SelectItem>
                  <SelectItem value="Transmission">Transmission</SelectItem>
                  <SelectItem value="Inspection">Inspection</SelectItem>
                  <SelectItem value="Insurance">Insurance</SelectItem>
                  <SelectItem value="Registration">Registration</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="uploadDescription">Description</Label>
              <Textarea 
                id="uploadDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this document..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
