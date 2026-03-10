import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, Sparkles, AlertCircle, Info, Check, Clock, Users, Briefcase, Wrench, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface AppUpdate {
  id: string;
  version: string;
  title: string;
  description: string;
  detailedContent: string | null;
  minRole: string;
  category: string;
  isActive: boolean;
  publishedAt: string;
}

interface StaffNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  metadata: any;
  isRead: boolean;
  createdAt: string;
}

interface UpdatesPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpdatesPopup({ isOpen, onClose }: UpdatesPopupProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isStaff = user?.role && user.role !== "Customer";

  const { data: updates = [] } = useQuery<AppUpdate[]>({
    queryKey: ["/api/updates/unseen"],
    enabled: isOpen,
  });

  const { data: staffNotifications = [] } = useQuery<StaffNotification[]>({
    queryKey: ["/api/staff-notifications"],
    enabled: isOpen && !!isStaff,
  });

  const unreadNotifications = staffNotifications.filter((n) => !n.isRead);

  const acknowledgeMutation = useMutation({
    mutationFn: async (updateId: string) => {
      await apiRequest("POST", `/api/updates/${updateId}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/updates/unseen"] });
    },
  });

  const markNotifReadMutation = useMutation({
    mutationFn: async (notifId: string) => {
      await apiRequest("POST", `/api/staff-notifications/${notifId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications/unread-count"] });
    },
  });

  const markAllNotifReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/staff-notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications/unread-count"] });
    },
  });

  const acknowledgeAll = () => {
    updates.forEach((update) => {
      acknowledgeMutation.mutate(update.id);
    });
  };

  const getUpdateIcon = (type: string) => {
    switch (type) {
      case "feature": return <Sparkles className="h-4 w-4" />;
      case "improvement": return <Info className="h-4 w-4" />;
      case "bugfix": return <AlertCircle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "hiring_stage_change": return <Briefcase className="h-4 w-4" />;
      case "maintenance": return <Wrench className="h-4 w-4" />;
      case "document": return <FileText className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getUpdateTypeColor = (type: string) => {
    switch (type) {
      case "feature": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "improvement": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "bugfix": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getNotifTypeColor = (type: string) => {
    switch (type) {
      case "hiring_stage_change": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "maintenance": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      default: return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed right-4 top-16 w-96 max-w-[calc(100vw-2rem)] bg-background border rounded-xl shadow-xl z-50 overflow-hidden"
            data-testid="updates-popup"
          >
            <div className="flex items-center justify-between p-4 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Notifications</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} data-testid="close-updates">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {isStaff ? (
              <Tabs defaultValue="notifications">
                <TabsList className="w-full grid grid-cols-2 mx-0 rounded-none border-b">
                  <TabsTrigger value="notifications" className="relative" data-testid="tab-notifications">
                    Activity
                    {unreadNotifications.length > 0 && (
                      <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                        {unreadNotifications.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="updates" className="relative" data-testid="tab-app-updates">
                    Updates
                    {updates.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                        {updates.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="notifications" className="m-0">
                  <ScrollArea className="max-h-[55vh]">
                    {unreadNotifications.length > 0 && (
                      <div className="flex justify-end p-2 pb-0">
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => markAllNotifReadMutation.mutate()} data-testid="mark-all-notifs-read">
                          <Check className="h-3 w-3 mr-1" /> Mark all read
                        </Button>
                      </div>
                    )}
                    {staffNotifications.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No notifications</p>
                        <p className="text-sm mt-1">Activity notifications will appear here.</p>
                      </div>
                    ) : (
                      <div className="p-2">
                        {staffNotifications.slice(0, 20).map((notif) => (
                          <div
                            key={notif.id}
                            className={`p-3 rounded-lg mb-1 transition-colors cursor-pointer ${notif.isRead ? "opacity-60" : "bg-muted/30 hover:bg-muted/50"}`}
                            onClick={() => {
                              if (!notif.isRead) markNotifReadMutation.mutate(notif.id);
                              if (notif.link) window.location.href = notif.link;
                            }}
                            data-testid={`notif-item-${notif.id}`}
                          >
                            <div className="flex items-start gap-2">
                              <span className={`p-1.5 rounded-md ${getNotifTypeColor(notif.type)}`}>
                                {getNotifIcon(notif.type)}
                              </span>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm leading-tight">{notif.title}</h4>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                                <span className="text-xs text-muted-foreground flex items-center mt-1">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {formatTimeAgo(notif.createdAt)}
                                </span>
                              </div>
                              {!notif.isRead && (
                                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="updates" className="m-0">
                  {renderUpdates(updates, expandedId, setExpandedId, acknowledgeMutation, acknowledgeAll, getUpdateIcon, getUpdateTypeColor, formatDate)}
                </TabsContent>
              </Tabs>
            ) : (
              renderUpdates(updates, expandedId, setExpandedId, acknowledgeMutation, acknowledgeAll, getUpdateIcon, getUpdateTypeColor, formatDate)
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function renderUpdates(
  updates: AppUpdate[],
  expandedId: string | null,
  setExpandedId: (id: string | null) => void,
  acknowledgeMutation: any,
  acknowledgeAll: () => void,
  getUpdateIcon: (type: string) => React.ReactNode,
  getUpdateTypeColor: (type: string) => string,
  formatDate: (d: string) => string
) {
  return (
    <ScrollArea className="max-h-[55vh]">
      {updates.length > 0 && (
        <div className="flex justify-end p-2 pb-0">
          <Button variant="ghost" size="sm" className="text-xs" onClick={acknowledgeAll} data-testid="mark-all-read">
            <Check className="h-3 w-3 mr-1" /> Mark all read
          </Button>
        </div>
      )}
      {updates.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">You're all caught up!</p>
          <p className="text-sm mt-1">No new updates at this time.</p>
        </div>
      ) : (
        <div className="p-2">
          {updates.map((update) => (
            <motion.div
              key={update.id}
              layout
              className="p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors mb-2"
              onClick={() => setExpandedId(expandedId === update.id ? null : update.id)}
              data-testid={`update-item-${update.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  <span className={`p-1.5 rounded-md ${getUpdateTypeColor(update.category)}`}>
                    {getUpdateIcon(update.category)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm leading-tight">{update.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{update.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs capitalize">{update.category}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDate(update.publishedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    acknowledgeMutation.mutate(update.id);
                  }}
                  data-testid={`acknowledge-update-${update.id}`}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </div>
              <AnimatePresence>
                {expandedId === update.id && update.detailedContent && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t text-sm text-muted-foreground whitespace-pre-wrap">
                      {update.detailedContent}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
