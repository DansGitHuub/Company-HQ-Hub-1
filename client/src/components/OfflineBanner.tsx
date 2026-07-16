import { useEffect, useRef, useState } from "react";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflineBanner() {
  const { isOnline, pendingCount, pendingWriteCount } = useOfflineSync();
  const prevOnlineRef = useRef(isOnline);
  const [justReconnected, setJustReconnected] = useState(false);

  const totalPending = pendingCount + pendingWriteCount;

  useEffect(() => {
    if (!prevOnlineRef.current && isOnline) {
      setJustReconnected(true);
      const t = setTimeout(() => setJustReconnected(false), 6000);
      return () => clearTimeout(t);
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  if (isOnline && !justReconnected && totalPending === 0) return null;

  // Syncing after reconnect
  if (isOnline && totalPending > 0) {
    return (
      <div
        data-testid="banner-syncing"
        className="sticky top-0 z-50 flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-green-800 bg-green-100 border-b border-green-200"
      >
        <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
        Back online — syncing {totalPending} saved event{totalPending !== 1 ? "s" : ""}…
      </div>
    );
  }

  // Just reconnected with nothing to sync
  if (isOnline && justReconnected) {
    return (
      <div
        data-testid="banner-reconnected"
        className="sticky top-0 z-50 flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-green-800 bg-green-100 border-b border-green-200"
      >
        <RefreshCw className="h-4 w-4 shrink-0" />
        Back online — all events synced.
      </div>
    );
  }

  // Offline
  return (
    <div
      data-testid="banner-offline"
      className="sticky top-0 z-50 flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-yellow-800 bg-yellow-100 border-b border-yellow-300"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      You're offline — events are saved locally and will sync when you reconnect.
      {totalPending > 0 && (
        <span className="ml-auto text-xs font-semibold bg-yellow-200 rounded-full px-2 py-0.5">
          {totalPending} queued
        </span>
      )}
    </div>
  );
}
