import { useState, useEffect, useRef, useCallback } from "react";
import { Bell } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface StaffNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/staff-notifications/unread-count"],
    refetchInterval: 30_000,
  });

  const { data: notifications, isLoading } = useQuery<StaffNotification[]>({
    queryKey: ["/api/staff-notifications"],
    enabled: open,
  });

  const unreadCount = countData?.count ?? 0;

  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/staff-notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications/unread-count"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => apiRequest("POST", "/api/staff-notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-notifications/unread-count"] });
    },
  });

  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open, handleOutsideClick]);

  const handleNotificationClick = (n: StaffNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.link) { window.location.href = n.link; setOpen(false); }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[480px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 text-xs font-medium text-white bg-red-500 rounded-full px-1.5 py-0.5">
                  {unreadCount}
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button onClick={() => markAllRead.mutate()} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium">Mark all read</button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-gray-500">Loading…</div>
            ) : !notifications || notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn("px-4 py-3 cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0 hover:`bg-gray-50 dark:hover:bg-gray-800 transition-colors", !n.isRead && "bg-blue-50/50 dark:bg-blue-900/20")}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && (<span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />)}
                    <div className={cn("flex-1 min-w-0", n.isRead && "pl-4")}>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications && notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-center">
              <a href="/notifications" className="text-xs text-blue-600 hover:underline dark:text-blue-400" onClick={() => setOpen(false)}>View all notifications</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
