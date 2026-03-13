import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, Sparkles, AlertCircle, Info, Check, Clock, Users, Briefcase, Wrench, FileText, Plus, Calendar, MessageSquare, TrendingUp, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface ActivityLogItem {
  id: string;
  userId: string | null;
  eventType: string;
  description: string;
  link: string | null;
  seenBy: string[];
  createdAt: string;
}

interface UpdatesPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpdatesPopup({ isOpen, onClose }: UpdatesPopupProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const isStaff = user?.role && user.role !== "Customer";
  const isAdmin = user?.role === "Admin" || user?.role === "Master Admin";

  const { data: updates = [] } = useQuery<AppUpdate[]>({
    queryKey: ["/api/updates/unseen"],
    enabled: isOpen,
  });

  const { data: activityItems = [] } = useQuery<ActivityLogItem[]>({
    queryKey: ["/api/activity-log"],
    enabled: isOpen && !!isStaff,
  });

  const unseenActivityCount = activityItems.filter((item) => {
    const seenBy = item.seenBy || [];
    return !seenBy.includes(user?.id || "");
  }).length;

  const acknowledgeMutation = useMutation({
    mutationFn: async (updateId: string) => {
      await apiRequest("POST", `/api/updates/${updateId}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/updates/unseen"] });
    },
  });

  const markActivitySeenMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/activity-log/mark-seen");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activity-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity-log/unseen-count"] });
    },
  });

  const acknowledgeAll = () => {
    updates.forEach((update) => {
      acknowledgeMutation.mutate(update.id);
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "job_stage_change": return <TrendingUp className="h-4 w-4" />;
      case "estimate_created":
      case "estimate_converted": return <Briefcase className="h-4 w-4" />;
      case "message_sent": return <MessageSquare className="h-4 w-4" />;
      case "calendar_event": return <Calendar className="h-4 w-4" />;
      case "document_uploaded": return <FileText className="h-4 w-4" />;
      case "work_request": return <Package className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "job_stage_change": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "estimate_created":
      case "estimate_converted": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "message_sent": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "calendar_event": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
      case "document_uploaded": return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300";
      case "work_request": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getUpdateIcon = (type: string) => {
    switch (type) {
      case "feature": return <Sparkles className="h-4 w-4" />;
      case "improvement": return <Info className="h-4 w-4" />;
      case "bugfix": return <AlertCircle className="h-4 w-4" />;
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
                <h3 className="font-semibold">{t("nav.updates")}</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} data-testid="close-updates">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {isStaff ? (
              <Tabs defaultValue="activity">
                <TabsList className="w-full grid grid-cols-2 mx-0 rounded-none border-b">
                  <TabsTrigger value="activity" className="relative" data-testid="tab-activity">
                    {t("updates.activity")}
                    {unseenActivityCount > 0 && (
                      <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                        {unseenActivityCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="updates" className="relative" data-testid="tab-app-updates">
                    {t("nav.updates")}
                    {updates.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                        {updates.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="activity" className="m-0">
                  <ScrollArea className="max-h-[55vh]">
                    {unseenActivityCount > 0 && (
                      <div className="flex justify-end p-2 pb-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => markActivitySeenMutation.mutate()}
                          data-testid="mark-all-activity-seen"
                        >
                          <Check className="h-3 w-3 mr-1" /> {t("updates.markAllSeen")}
                        </Button>
                      </div>
                    )}
                    {activityItems.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">{t("updates.noActivity")}</p>
                        <p className="text-sm mt-1">{t("updates.recentActivityWillAppear")}</p>
                      </div>
                    ) : (
                      <div className="p-2">
                        {activityItems.slice(0, 30).map((item) => {
                          const isSeen = (item.seenBy || []).includes(user?.id || "");
                          return (
                            <div
                              key={item.id}
                              className={`p-3 rounded-lg mb-1 transition-colors ${item.link ? "cursor-pointer" : ""} ${isSeen ? "opacity-60" : "bg-muted/30 hover:bg-muted/50"}`}
                              onClick={() => {
                                if (item.link) window.location.href = item.link;
                              }}
                              data-testid={`activity-item-${item.id}`}
                            >
                              <div className="flex items-start gap-2">
                                <span className={`p-1.5 rounded-md ${getActivityColor(item.eventType)}`}>
                                  {getActivityIcon(item.eventType)}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm leading-tight">{item.description}</p>
                                  <span className="text-xs text-muted-foreground flex items-center mt-1">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {formatTimeAgo(item.createdAt)}
                                  </span>
                                </div>
                                {!isSeen && (
                                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="updates" className="m-0">
                  {isAdmin && (
                    <div className="p-2 pb-0">
                      {!showPostForm ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => setShowPostForm(true)}
                          data-testid="button-post-update"
                        >
                          <Plus className="h-3 w-3 mr-1" /> {t("updates.postUpdate")}
                        </Button>
                      ) : (
                        <InlinePostUpdateForm
                          onClose={() => setShowPostForm(false)}
                          onSuccess={() => {
                            setShowPostForm(false);
                            queryClient.invalidateQueries({ queryKey: ["/api/updates/unseen"] });
                          }}
                        />
                      )}
                    </div>
                  )}
                  <RenderUpdates updates={updates} expandedId={expandedId} setExpandedId={setExpandedId} acknowledgeMutation={acknowledgeMutation} acknowledgeAll={acknowledgeAll} getUpdateIcon={getUpdateIcon} getUpdateTypeColor={getUpdateTypeColor} formatDate={formatDate} />
                </TabsContent>
              </Tabs>
            ) : (
              <RenderUpdates updates={updates} expandedId={expandedId} setExpandedId={setExpandedId} acknowledgeMutation={acknowledgeMutation} acknowledgeAll={acknowledgeAll} getUpdateIcon={getUpdateIcon} getUpdateTypeColor={getUpdateTypeColor} formatDate={formatDate} />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function InlinePostUpdateForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("feature");

  const postMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/updates", {
        title,
        description,
        category,
        version: new Date().toISOString().slice(0, 10),
        minRole: "Crew",
        isActive: true,
      });
    },
    onSuccess,
  });

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/20" data-testid="post-update-form">
      <Input
        placeholder={t("updates.updateTitle")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-sm h-8"
        data-testid="input-update-title"
      />
      <Textarea
        placeholder={t("updates.briefDescription")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="text-sm resize-none"
        data-testid="input-update-description"
      />
      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger className="h-8 text-xs" data-testid="select-update-category">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="feature">{t("updates.categories.feature")}</SelectItem>
          <SelectItem value="improvement">{t("updates.categories.improvement")}</SelectItem>
          <SelectItem value="bugfix">{t("updates.categories.bugfix")}</SelectItem>
          <SelectItem value="announcement">{t("updates.categories.announcement")}</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="text-xs h-7"
          onClick={() => postMutation.mutate()}
          disabled={!title.trim() || !description.trim() || postMutation.isPending}
          data-testid="button-submit-update"
        >
          <Check className="h-3 w-3 mr-1" /> {t("updates.post")}
        </Button>
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onClose}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}

function RenderUpdates({
  updates,
  expandedId,
  setExpandedId,
  acknowledgeMutation,
  acknowledgeAll,
  getUpdateIcon,
  getUpdateTypeColor,
  formatDate,
}: {
  updates: AppUpdate[];
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  acknowledgeMutation: any;
  acknowledgeAll: () => void;
  getUpdateIcon: (type: string) => React.ReactNode;
  getUpdateTypeColor: (type: string) => string;
  formatDate: (d: string) => string;
}) {
  const { t } = useTranslation();
  return (
    <ScrollArea className="max-h-[55vh]">
      {updates.length > 0 && (
        <div className="flex justify-end p-2 pb-0">
          <Button variant="ghost" size="sm" className="text-xs" onClick={acknowledgeAll} data-testid="mark-all-read">
            <Check className="h-3 w-3 mr-1" /> {t("updates.markAllRead")}
          </Button>
        </div>
      )}
      {updates.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t("updates.allCaughtUp")}</p>
          <p className="text-sm mt-1">{t("updates.noNewUpdates")}</p>
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
