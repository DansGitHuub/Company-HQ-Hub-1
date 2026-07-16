const DB_NAME = "companyhq-offline";
const DB_VERSION = 2;

let _dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // ── v1 stores ──────────────────────────────────────────────────────────
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

      // ── v2: write queue for worksheet submits and future field actions ──────
      if (!db.objectStoreNames.contains("writeQueue")) {
        db.createObjectStore("writeQueue", { keyPath: "id", autoIncrement: true });
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

export interface WriteQueueItem {
  id?: number;
  type: "worksheet-submit";
  payload: Record<string, any>;
  timestamp: string;
  synced: boolean;
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

// ─── writeQueue store — worksheet submits and future field actions ────────────

export async function queueWrite(
  type: WriteQueueItem["type"],
  payload: Record<string, any>
): Promise<number> {
  const item: Omit<WriteQueueItem, "id"> = {
    type,
    payload,
    timestamp: new Date().toISOString(),
    synced: false,
    error: null,
  };
  return idbReq<IDBValidKey>((db) =>
    db.transaction("writeQueue", "readwrite").objectStore("writeQueue").add(item)
  ) as Promise<number>;
}

export async function getPendingWrites(): Promise<WriteQueueItem[]> {
  const all = await idbReq<WriteQueueItem[]>((db) =>
    db.transaction("writeQueue", "readonly").objectStore("writeQueue").getAll()
  );
  return all.filter((w) => !w.synced).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export async function markWriteSynced(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("writeQueue", "readwrite");
    const store = tx.objectStore("writeQueue");
    const get = store.get(id);
    get.onsuccess = () => {
      const item = get.result as WriteQueueItem;
      if (!item) { resolve(); return; }
      item.synced = true;
      item.error = null;
      const put = store.put(item);
      put.onsuccess = () => resolve();
      put.onerror = () => reject(put.error);
    };
    get.onerror = () => reject(get.error);
  });
}

export async function markWriteFailed(id: number, error: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("writeQueue", "readwrite");
    const store = tx.objectStore("writeQueue");
    const get = store.get(id);
    get.onsuccess = () => {
      const item = get.result as WriteQueueItem;
      if (!item) { resolve(); return; }
      item.error = error;
      const put = store.put(item);
      put.onsuccess = () => resolve();
      put.onerror = () => reject(put.error);
    };
    get.onerror = () => reject(get.error);
  });
}

export async function clearSyncedWrites(): Promise<void> {
  const all = await idbReq<WriteQueueItem[]>((db) =>
    db.transaction("writeQueue", "readonly").objectStore("writeQueue").getAll()
  );
  const synced = all.filter((w) => w.synced);
  if (synced.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("writeQueue", "readwrite");
    const store = tx.objectStore("writeQueue");
    let remaining = synced.length;
    let hasError = false;
    for (const item of synced) {
      const del = store.delete(item.id!);
      del.onsuccess = () => { if (--remaining === 0 && !hasError) resolve(); };
      del.onerror = () => { hasError = true; reject(del.error); };
    }
    if (remaining === 0) resolve();
  });
}
