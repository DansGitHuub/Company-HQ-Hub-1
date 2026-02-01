import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, Sparkles, AlertCircle, Info, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";

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

interface UpdatesPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpdatesPopup({ isOpen, onClose }: UpdatesPopupProps) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: updates = [] } = useQuery<AppUpdate[]>({
    queryKey: ["/api/updates/unseen"],
    enabled: isOpen,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (updateId: string) => {
      await apiRequest("POST", `/api/updates/${updateId}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/updates/unseen"] });
    },
  });

  const acknowledgeAll = () => {
    updates.forEach((update) => {
      acknowledgeMutation.mutate(update.id);
    });
  };

  const getUpdateIcon = (type: string) => {
    switch (type) {
      case "feature":
        return <Sparkles className="h-4 w-4" />;
      case "improvement":
        return <Info className="h-4 w-4" />;
      case "bugfix":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getUpdateTypeColor = (type: string) => {
    switch (type) {
      case "feature":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "improvement":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "bugfix":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
                <h3 className="font-semibold">What's New</h3>
                {updates.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {updates.length}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {updates.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={acknowledgeAll}
                    className="text-xs"
                    data-testid="mark-all-read"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Mark all read
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={onClose} data-testid="close-updates">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="max-h-[60vh]">
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
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {update.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs capitalize">
                                {update.category}
                              </Badge>
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
