const DB_NAME = "companyhq-offline";
const DB_VERSION = 1;

let _dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("timeEvents")) {
        const store = db.createObjectStore("timeEvents", {
          keyPath: "localId",
          autoIncrement: true,
        });
        store.createIndex("byLocalId", "localId", { unique: true });
      }
      if (!db.objectStoreNames.contains("offlineState")) {
        db.createObjectStore("offlineState", { keyPath: "key" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TimeEvent {
  localId?: number;
  type: "clock-in" | "clock-out";
  payload: Record<string, any>;
  timestamp: string;
  synced: boolean;
  serverId: number | null;
  error: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function idbReq<T>(fn: (db: IDBDatabase) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

// ─── timeEvents store ─────────────────────────────────────────────────────────

export async function queueEvent(
  type: TimeEvent["type"],
  payload: Record<string, any>
): Promise<number> {
  const event: Omit<TimeEvent, "localId"> = {
    type,
    payload,
    timestamp: new Date().toISOString(),
    synced: false,
    serverId: null,
    error: null,
  };
  return idbReq<IDBValidKey>((db) =>
    db.transaction("timeEvents", "readwrite").objectStore("timeEvents").add(event)
  ) as Promise<number>;
}

export async function getPendingEvents(): Promise<TimeEvent[]> {
  const all = await idbReq<TimeEvent[]>((db) =>
    db.transaction("timeEvents", "readonly").objectStore("timeEvents").getAll()
  );
  return all.filter((e) => !e.synced).sort((a, b) => (a.localId ?? 0) - (b.localId ?? 0));
}

export async function markEventSynced(localId: number, serverId: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("timeEvents", "readwrite");
    const store = tx.objectStore("timeEvents");
    const get = store.get(localId);
    get.onsuccess = () => {
      const ev = get.result as TimeEvent;
      if (!ev) { resolve(); return; }
      ev.synced = true;
      ev.serverId = serverId;
      const put = store.put(ev);
      put.onsuccess = () => resolve();
      put.onerror = () => reject(put.error);
    };
    get.onerror = () => reject(get.error);
  });
}

export async function markEventFailed(localId: number, error: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("timeEvents", "readwrite");
    const store = tx.objectStore("timeEvents");
    const get = store.get(localId);
    get.onsuccess = () => {
      const ev = get.result as TimeEvent;
      if (!ev) { resolve(); return; }
      ev.error = error;
      const put = store.put(ev);
      put.onsuccess = () => resolve();
      put.onerror = () => reject(put.error);
    };
    get.onerror = () => reject(get.error);
  });
}

export async function clearSyncedEvents(): Promise<void> {
  const all = await idbReq<TimeEvent[]>((db) =>
    db.transaction("timeEvents", "readonly").objectStore("timeEvents").getAll()
  );
  const synced = all.filter((e) => e.synced);
  if (synced.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("timeEvents", "readwrite");
    const store = tx.objectStore("timeEvents");
    let remaining = synced.length;
    let hasError = false;
    for (const ev of synced) {
      const del = store.delete(ev.localId!);
      del.onsuccess = () => { if (--remaining === 0 && !hasError) resolve(); };
      del.onerror = () => { hasError = true; reject(del.error); };
    }
    if (remaining === 0) resolve();
  });
}

// ─── offlineState store ───────────────────────────────────────────────────────

export async function getActiveLocalEntry(): Promise<Record<string, any> | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offlineState", "readonly");
    const req = tx.objectStore("offlineState").get("activeEntry");
    req.onsuccess = () => resolve(req.result?.data ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function setActiveLocalEntry(
  data: Record<string, any> | null
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offlineState", "readwrite");
    const store = tx.objectStore("offlineState");
    const req = data
      ? store.put({ key: "activeEntry", data })
      : store.delete("activeEntry");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
