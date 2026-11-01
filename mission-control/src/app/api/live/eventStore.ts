import fs from "node:fs";
import { type EventsSnapshot, readEvents } from "@/lib/events/events";

const STORE_DEBOUNCE_MS = 50;
const SHARED_CAP = 600;
const EMPTY_SNAPSHOT: EventsSnapshot = { events: [], lastEventAt: null, byProject: {} };

/**
 * Per-events-file shared state. All connections to the same file share ONE
 * watcher and ONE memoized parsed snapshot; each connection filters it locally.
 */
interface EventStore {
  readonly filePath: string;
  /** The last parsed UNFILTERED snapshot (capped at SHARED_CAP). */
  snapshot: EventsSnapshot;
  /** Memo key `${size}:${mtimeMs}`; null when the file can't be statted (rotating/missing). */
  key: string | null;
  /** The single fs.watch on the events file; null when unarmed or torn down. */
  watcher: fs.FSWatcher | null;
  /** Debounce timer coalescing rapid watch bursts. */
  debounceTimer: ReturnType<typeof setTimeout> | null;
  /** Per-connection notify callbacks (each connection's throttled emitter). */
  readonly subscribers: Set<() => void>;
}

/** Module-level registry — normally one entry (the resolved events path). */
const eventStores = new Map<string, EventStore>();

/** Get (or lazily create) the shared store for a given events file path. */
export function getStore(filePath: string): EventStore {
  let store = eventStores.get(filePath);
  if (store === undefined) {
    store = {
      filePath,
      snapshot: EMPTY_SNAPSHOT,
      key: null,
      watcher: null,
      debounceTimer: null,
      subscribers: new Set(),
    };
    eventStores.set(filePath, store);
  }
  return store;
}

/** Cheap memo key from the file's size + mtime; null when it can't be statted. */
function statKey(filePath: string): string | null {
  try {
    const { size, mtimeMs } = fs.statSync(filePath);
    return `${size}:${mtimeMs}`;
  } catch {
    return null; // missing/rotating file → force a fresh read (fail-soft)
  }
}

/**
 * Read the shared snapshot, memoized by {size,mtimeMs}. When the file is
 * unchanged since the last parse the memoized snapshot is reused (no re-parse);
 * when the key moved — or can't be computed (rotation) — it re-reads. Never
 * throws: a transient failure yields the EMPTY snapshot.
 */
export function readStoreSnapshot(store: EventStore): EventsSnapshot {
  const key = statKey(store.filePath);
  if (key !== null && key === store.key) return store.snapshot;
  let snapshot: EventsSnapshot;
  try {
    snapshot = readEvents({ path: store.filePath, cap: SHARED_CAP });
  } catch {
    snapshot = EMPTY_SNAPSHOT;
  }
  store.snapshot = snapshot;
  store.key = key;
  return snapshot;
}

/** Close the shared watcher + clear its debounce; idempotent. */
function closeStoreWatcher(store: EventStore): void {
  if (store.debounceTimer !== null) {
    clearTimeout(store.debounceTimer);
    store.debounceTimer = null;
  }
  if (store.watcher === null) return;
  try {
    store.watcher.close();
  } catch {
    // Already closed — ignore.
  }
  store.watcher = null;
}

/** Debounced shared re-read then fan-out to every subscriber. */
function scheduleStoreReread(store: EventStore): void {
  if (store.debounceTimer !== null) clearTimeout(store.debounceTimer);
  store.debounceTimer = setTimeout(() => {
    store.debounceTimer = null;
    readStoreSnapshot(store);
    for (const notify of store.subscribers) notify();
  }, STORE_DEBOUNCE_MS);
}

/** Arm the ONE shared watcher if not already armed. Re-arms on rotation. */
function ensureWatcher(store: EventStore): void {
  if (store.watcher !== null) return;
  try {
    store.watcher = fs.watch(store.filePath, { persistent: false }, (eventType) => {
      if (eventType === "rename") {
        // File rotated/replaced — the old inode watch may be stale. Re-arm.
        closeStoreWatcher(store);
        ensureWatcher(store);
      }
      scheduleStoreReread(store);
    });
  } catch {
    // fs.watch may throw on missing path or unsupported filesystems. We continue
    // without watching — connections still get the initial + state-watch emits.
    store.watcher = null;
  }
}

/** Subscribe a connection's notifier; arms the shared watcher on first subscriber. */
export function subscribeToStore(store: EventStore, notify: () => void): void {
  store.subscribers.add(notify);
  ensureWatcher(store);
}

/** Unsubscribe a connection; closes the shared watcher when the last one leaves. */
export function unsubscribeFromStore(store: EventStore, notify: () => void): void {
  store.subscribers.delete(notify);
  if (store.subscribers.size === 0) closeStoreWatcher(store);
}

/**
 * Test-only: tear down every shared store (close watchers, drop subscribers,
 * reset the memo). The module singleton persists across tests within a file, so
 * suites that assert per-connection watcher wiring reset it in `beforeEach`.
 */
export function __resetLiveEventStoresForTest(): void {
  for (const store of eventStores.values()) {
    closeStoreWatcher(store);
    store.subscribers.clear();
    store.snapshot = EMPTY_SNAPSHOT;
    store.key = null;
  }
  eventStores.clear();
}
