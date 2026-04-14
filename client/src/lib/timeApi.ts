import {
  queueEvent,
  getActiveLocalEntry,
  setActiveLocalEntry,
} from "./offlineTimeQueue";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLocalId(): string {
  return `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function postJson(url: string, body: Record<string, any>): Promise<Response> {
  return fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Clock In ─────────────────────────────────────────────────────────────────

export async function clockIn(
  payload: Record<string, any>
): Promise<{ success: boolean; offline: boolean; entry?: any; error?: string }> {
  if (navigator.onLine) {
    try {
      const localId = makeLocalId();
      const res = await postJson("/api/time/clock-in", { ...payload, localId });

      if (res.ok) {
        const entry = await res.json();
        await setActiveLocalEntry(null);
        return { success: true, offline: false, entry };
      }

      if (res.status >= 400 && res.status < 500) {
        const errData = await res.json().catch(() => ({}));
        return { success: false, offline: false, error: errData.message ?? "Clock-in failed" };
      }
    } catch {
      // Network error → fall through to offline queue
    }
  }

  // ── Offline path ──────────────────────────────────────────────────────────
  const localId = makeLocalId();
  const payloadWithId = { ...payload, localId };
  await queueEvent("clock-in", payloadWithId);

  const offlineEntry = {
    ...payloadWithId,
    clock_in: new Date().toISOString(),
    isOffline: true,
  };
  await setActiveLocalEntry(offlineEntry);

  return { success: true, offline: true };
}

// ─── Clock Out ────────────────────────────────────────────────────────────────

export async function clockOut(
  payload: Record<string, any>
): Promise<{ success: boolean; offline: boolean; entry?: any; error?: string }> {
  if (navigator.onLine) {
    try {
      const res = await postJson("/api/time/clock-out", payload);

      if (res.ok) {
        const entry = await res.json();
        await setActiveLocalEntry(null);
        return { success: true, offline: false, entry };
      }

      if (res.status >= 400 && res.status < 500) {
        const errData = await res.json().catch(() => ({}));
        return { success: false, offline: false, error: errData.message ?? "Clock-out failed" };
      }
    } catch {
      // Network error → fall through to offline queue
    }
  }

  // ── Offline path ──────────────────────────────────────────────────────────
  await queueEvent("clock-out", payload);
  await setActiveLocalEntry(null);

  return { success: true, offline: true };
}

// ─── Get Active Session ───────────────────────────────────────────────────────

export async function getActiveSession(): Promise<any | null> {
  if (navigator.onLine) {
    try {
      const res = await fetch("/api/time/active", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data) return data;
      }
    } catch {
      // Fall through to local
    }
  }

  return getActiveLocalEntry();
}
