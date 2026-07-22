import React, { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import {
  Plus,
  GripVertical,
  X,
  Settings2,
  RotateCcw,
  Maximize2,
  Minimize2,
  Check,
  AlertTriangle,
  Clock,
  Sun,
  MessageSquare,
  CheckSquare,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  WIDGET_DEFINITIONS,
  getDefaultWidgets,
  getAvailableWidgets,
  type WidgetConfig,
  type WidgetSize,
} from "@/components/dashboard/widgetRegistry";
import { WIDGET_COMPONENTS } from "@/components/dashboard/widgets";
import { PinnedReportsSection } from "@/components/dashboard/PinnedReportMiniWidget";
import HQOverview from "@/pages/HQOverview";

export default function Home() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const userRole = user?.role || "Crew";

  const [activeTab, setActiveTab] = useState(() =>
    new URLSearchParams(window.location.search).get("tab") === "company-hq"
      ? "company-hq"
      : "my-workspace"
  );

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    navigate(value === "company-hq" ? "/?tab=company-hq" : "/");
  };

  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { data: config, isLoading } = useQuery<{ widgets: WidgetConfig[] | null }>({
    queryKey: ["/api/dashboard-config"],
  });

  const isAdmin = userRole === "Admin" || user?.isMasterAdmin === true;
  const { data: qbStatus } = useQuery<{ connected: boolean; needs_reauth?: boolean }>({
    queryKey: ["/api/quickbooks/status"],
    enabled: isAdmin,
    refetchInterval: isAdmin ? 60000 : false,
  });

  useEffect(() => {
    if (config && !initialized) {
      if (config.widgets && Array.isArray(config.widgets) && config.widgets.length > 0) {
        setWidgets(config.widgets);
      } else {
        setWidgets(getDefaultWidgets(userRole));
      }
      setInitialized(true);
    }
  }, [config, initialized, userRole]);

  const saveMutation = useMutation({
    mutationFn: async (newWidgets: WidgetConfig[]) => {
      await apiRequest("PUT", "/api/dashboard-config", { widgets: newWidgets });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-config"] });
    },
  });

  const saveWidgets = useCallback(
    (newWidgets: WidgetConfig[]) => {
      setWidgets(newWidgets);
      saveMutation.mutate(newWidgets);
    },
    [saveMutation]
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      const items = Array.from(widgets);
      const [moved] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, moved);
      saveWidgets(items);
    },
    [widgets, saveWidgets]
  );

  const addWidget = useCallback(
    (widgetType: string) => {
      const def = WIDGET_DEFINITIONS.find((w) => w.type === widgetType);
      if (!def) return;
      const newWidget: WidgetConfig = {
        id: `widget-${widgetType}-${Date.now()}`,
        widgetType,
        size: def.defaultSize,
      };
      saveWidgets([...widgets, newWidget]);
      setShowAddPicker(false);
    },
    [widgets, saveWidgets]
  );

  const removeWidget = useCallback(
    (id: string) => {
      saveWidgets(widgets.filter((w) => w.id !== id));
    },
    [widgets, saveWidgets]
  );

  const cycleSize = useCallback(
    (id: string) => {
      const updated = widgets.map((w) => {
        if (w.id !== id) return w;
        const def = WIDGET_DEFINITIONS.find((d) => d.type === w.widgetType);
        if (!def) return w;
        const sizes = def.sizes;
        const currentIdx = sizes.indexOf(w.size);
        const nextSize = sizes[(currentIdx + 1) % sizes.length];
        return { ...w, size: nextSize };
      });
      saveWidgets(updated);
    },
    [widgets, saveWidgets]
  );

  const resetToDefaults = useCallback(() => {
    const defaults = getDefaultWidgets(userRole);
    saveWidgets(defaults);
    setIsEditing(false);
  }, [userRole, saveWidgets]);

  const { data: dmUnreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/dm/unread-count"],
    refetchInterval: 30000,
  });
  const dmUnreadCount = dmUnreadData?.count ?? 0;

  const available = getAvailableWidgets(userRole, user?.isMasterAdmin === true);
  const addedTypes = widgets.map((w) => w.widgetType);
  const notAdded = available.filter((w) => !addedTypes.includes(w.type));

  const getGridClass = (size: WidgetSize) => {
    switch (size) {
      case "small":
        return "col-span-1";
      case "medium":
        return "col-span-1 md:col-span-2";
      case "large":
        return "col-span-1 md:col-span-2 lg:col-span-3";
    }
  };

  const getSizeLabel = (size: WidgetSize) => {
    switch (size) {
      case "small":
        return "S";
      case "medium":
        return "M";
      case "large":
        return "L";
    }
  };

  return (
    <div className="space-y-4">
      {isAdmin && qbStatus?.needs_reauth && (
        <a
          href="/admin?tab=quickbooks"
          className="flex items-center gap-3 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors no-underline"
          data-testid="banner-qb-reauth"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">QuickBooks needs to be reauthorized — click here to reconnect</span>
        </a>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="my-workspace" data-testid="tab-my-workspace">
            {t("home.tabMyWorkspace")}
          </TabsTrigger>
          <TabsTrigger value="company-hq" data-testid="tab-company-hq">
            {t("home.tabCompanyHQ")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-workspace" className="space-y-4">
          {isLoading || !initialized ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-3">
                  <h1
                    className="text-2xl font-heading font-bold text-foreground"
                    data-testid="heading-workspace"
                  >
                    {t("dashboard.title")}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {t("dashboard.welcome", { name: user?.name?.split(" ")[0] })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isEditing && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetToDefaults}
                        className="gap-1 text-xs"
                        data-testid="button-reset-dashboard"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reset
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddPicker(true)}
                        className="gap-1 text-xs"
                        data-testid="button-add-widget"
                        disabled={notAdded.length === 0}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Widget
                      </Button>
                    </>
                  )}
                  <Button
                    variant={isEditing ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                    className="gap-1 text-xs"
                    data-testid="button-edit-dashboard"
                  >
                    {isEditing ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Done
                      </>
                    ) : (
                      <>
                        <Settings2 className="h-3.5 w-3.5" /> Customize
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Quick-access links — formerly the MY SPACE sidebar rows */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: Sun, labelKey: "home.quickLinks.myDay", href: "/my-day", iconBg: "bg-amber-100 dark:bg-amber-900/30", iconColor: "text-amber-600 dark:text-amber-400" },
                  { icon: MessageSquare, labelKey: "home.quickLinks.messages", href: "/messages", iconBg: "bg-violet-100 dark:bg-violet-900/30", iconColor: "text-violet-600 dark:text-violet-400", badge: dmUnreadCount },
                  { icon: CheckSquare, labelKey: "home.quickLinks.tasks", href: "/todos", iconBg: "bg-emerald-100 dark:bg-emerald-900/30", iconColor: "text-emerald-600 dark:text-emerald-400" },
                ].map((link) => {
                  const Icon = link.icon;
                  return (
                    <button
                      key={link.href}
                      onClick={() => navigate(link.href)}
                      data-testid={`quicklink-${link.href.replace("/", "")}`}
                      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left shadow-sm transition-all hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5"
                    >
                      <div className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg ${link.iconBg}`}>
                        <Icon className={`w-4 h-4 ${link.iconColor}`} />
                      </div>
                      <span className="text-sm font-semibold text-foreground leading-tight flex-1">{t(link.labelKey)}</span>
                      {"badge" in link && link.badge > 0 && (
                        <span className="ml-auto shrink-0 h-5 min-w-[20px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
                          {link.badge > 99 ? "99+" : link.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <PinnedReportsSection />

              {widgets.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Settings2 className="h-10 w-10 text-muted-foreground mb-3" />
                    <h3 className="text-lg font-semibold mb-1">No widgets yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add widgets to customize your dashboard
                    </p>
                    <Button
                      onClick={() => {
                        setIsEditing(true);
                        setShowAddPicker(true);
                      }}
                      className="gap-2"
                      data-testid="button-add-first-widget"
                    >
                      <Plus className="h-4 w-4" /> Add Your First Widget
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="dashboard" direction="horizontal" type="widget">
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3"
                      >
                        {widgets.map((widget, index) => {
                          const def = WIDGET_DEFINITIONS.find(
                            (d) => d.type === widget.widgetType
                          );
                          const Component = WIDGET_COMPONENTS[widget.widgetType];
                          if (!def || !Component) return null;

                          const Icon = def.icon;

                          return (
                            <Draggable
                              key={widget.id}
                              draggableId={widget.id}
                              index={index}
                              isDragDisabled={!isEditing}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`${getGridClass(widget.size)} ${
                                    snapshot.isDragging ? "z-50" : ""
                                  }`}
                                >
                                  <Card
                                    className={`h-full transition-shadow ${
                                      isEditing
                                        ? "ring-1 ring-dashed ring-primary/30 hover:ring-primary/50"
                                        : ""
                                    } ${snapshot.isDragging ? "shadow-lg rotate-1" : ""}`}
                                    data-testid={`widget-card-${widget.widgetType}`}
                                  >
                                    <CardHeader className="pb-2 pt-3 px-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0">
                                          {isEditing && (
                                            <div
                                              {...provided.dragHandleProps}
                                              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-manipulation"
                                              data-testid={`drag-handle-${widget.widgetType}`}
                                            >
                                              <GripVertical className="h-4 w-4" />
                                            </div>
                                          )}
                                          <Icon className="h-4 w-4 text-primary shrink-0" />
                                          <CardTitle className="text-sm truncate">
                                            {t(def.labelKey)}
                                          </CardTitle>
                                        </div>
                                        {isEditing && (
                                          <div className="flex items-center gap-1 shrink-0">
                                            {def.sizes.length > 1 && (
                                              <button
                                                onClick={() => cycleSize(widget.id)}
                                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors hidden md:flex items-center"
                                                title="Change size"
                                                data-testid={`resize-${widget.widgetType}`}
                                              >
                                                {widget.size === "large" ? (
                                                  <Minimize2 className="h-3.5 w-3.5" />
                                                ) : (
                                                  <Maximize2 className="h-3.5 w-3.5" />
                                                )}
                                                <span className="text-[10px] ml-0.5 font-medium">
                                                  {getSizeLabel(widget.size)}
                                                </span>
                                              </button>
                                            )}
                                            <button
                                              onClick={() => removeWidget(widget.id)}
                                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                              title="Remove widget"
                                              data-testid={`remove-${widget.widgetType}`}
                                            >
                                              <X className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                        )}
                                        {!isEditing && (
                                          <div {...provided.dragHandleProps} />
                                        )}
                                      </div>
                                    </CardHeader>
                                    <CardContent className="px-4 pb-3 pt-0">
                                      <Component size={widget.size} />
                                    </CardContent>
                                  </Card>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}

              <Dialog open={showAddPicker} onOpenChange={setShowAddPicker}>
                <DialogContent className="max-w-md max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Add Widget</DialogTitle>
                    <DialogDescription>
                      Choose a widget to add to your dashboard
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-1">
                    {notAdded.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        All available widgets have been added
                      </p>
                    ) : (
                      notAdded.map((def) => {
                        const Icon = def.icon;
                        return (
                          <button
                            key={def.type}
                            onClick={() => addWidget(def.type)}
                            className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors text-left"
                            data-testid={`add-widget-${def.type}`}
                          >
                            <div className="p-2 rounded-md bg-primary/10">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{t(def.labelKey)}</p>
                              <p className="text-xs text-muted-foreground">
                                {t(def.descriptionKey)}
                              </p>
                            </div>
                            <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                          </button>
                        );
                      })
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </TabsContent>

        <TabsContent value="company-hq">
          <HQOverview />
        </TabsContent>
      </Tabs>
    </div>
  );
}
