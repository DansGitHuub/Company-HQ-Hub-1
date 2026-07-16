import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getPendingEvents,
  markEventSynced,
  markEventFailed,
  clearSyncedEvents,
  getPendingWrites,
  markWriteSynced,
  markWriteFailed,
  clearSyncedWrites,
} from "@/lib/offlineTimeQueue";

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingWriteCount, setPendingWriteCount] = useState(0);
  const qc = useQueryClient();
  const flushingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const [events, writes] = await Promise.all([getPendingEvents(), getPendingWrites()]);
      setPendingCount(events.length);
      setPendingWriteCount(writes.length);
    } catch {
      // IndexedDB unavailable (e.g. private browsing in Safari)
    }
  }, []);

  const flushPendingEvents = useCallback(async () => {
    if (flushingRef.current || !navigator.onLine) return;
    flushingRef.current = true;

    try {
      // ── Flush clock events (clock-in / clock-out) ───────────────────────────
      const events = await getPendingEvents();

      // Map offline localId string → real server entry id (for resolving clock-out payloads)
      const serverIdMap = new Map<string, number>();

      for (const event of events) {
        try {
          let payload = { ...event.payload };

          // Resolve clock-out that references an offline clock-in
          if (event.type === "clock-out" && payload.local_clock_in_id) {
            const resolved = serverIdMap.get(payload.local_clock_in_id);
            if (resolved == null) {
              await markEventFailed(
                event.localId!,
                "Could not resolve clock-in server ID — retry will happen on next sync"
              );
              continue;
            }
            payload = { ...payload, time_entry_id: resolved };
            delete payload.local_clock_in_id;
          }

          const endpoint =
            event.type === "clock-in" ? "/api/time/clock-in" : "/api/time/clock-out";

          const res = await fetch(endpoint, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            const serverId = data?.id ?? 0;
            await markEventSynced(event.localId!, serverId);

            // Track for subsequent clock-out resolution
            if (event.type === "clock-in" && payload.localId) {
              serverIdMap.set(payload.localId, serverId);
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            await markEventFailed(
              event.localId!,
              errData.message ?? `HTTP ${res.status}`
            );
          }
        } catch (err: any) {
          await markEventFailed(event.localId!, err?.message ?? "Network error");
        }
      }

      await clearSyncedEvents();

      // ── Flush write queue (worksheet submits) ───────────────────────────────
      const writes = await getPendingWrites();

      for (const write of writes) {
        try {
          if (write.type === "worksheet-submit") {
            const { worksheetId, notes, ...checklist } = write.payload;

            // Save notes first (best-effort — the worksheet may already be submitted)
            try {
              await fetch(`/api/worksheets/${worksheetId}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notes }),
              });
            } catch {
              // Ignore — notes save is best-effort; submit is what matters
            }

            const res = await fetch(`/api/worksheets/${worksheetId}/submit`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(checklist),
            });

            if (res.ok) {
              await markWriteSynced(write.id!);
            } else {
              const errData = await res.json().catch(() => ({}));
              // "already submitted" means our queued action already landed — treat as success
              const msg: string = errData.message ?? "";
              if (res.status === 400 && msg.includes("already been submitted")) {
                await markWriteSynced(write.id!);
              } else {
                await markWriteFailed(write.id!, msg || `HTTP ${res.status}`);
              }
            }
          }
        } catch (err: any) {
          await markWriteFailed(write.id!, err?.message ?? "Network error");
        }
      }

      await clearSyncedWrites();
      await refreshPendingCount();

      // Invalidate field-critical queries so UI reflects synced state
      qc.invalidateQueries({ queryKey: ["/api/time/active"] });
      qc.invalidateQueries({ queryKey: ["/api/time/entries"] });
      qc.invalidateQueries({ queryKey: ["/api/my-day/time-entries"] });
      qc.invalidateQueries({ queryKey: ["/api/worksheets/today"] });
    } finally {
      flushingRef.current = false;
    }
  }, [qc, refreshPendingCount]);

  // Listen for online/offline transitions
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      flushPendingEvents();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flushPendingEvents]);

  // Initial mount: read pending count and flush if online
  useEffect(() => {
    refreshPendingCount();
    if (navigator.onLine) flushPendingEvents();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll pending count while offline (catches new events queued offline)
  useEffect(() => {
    if (isOnline) return;
    const id = setInterval(refreshPendingCount, 5000);
    return () => clearInterval(id);
  }, [isOnline, refreshPendingCount]);

  return { isOnline, pendingCount, pendingWriteCount, flushPendingEvents, refreshPendingCount };
}
