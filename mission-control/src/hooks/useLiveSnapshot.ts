"use client";

/**
 * WO-01-009 — `useLiveSnapshot` hook
 *
 * The single client-side live transport reused by the four real-time surfaces:
 *   Party (FRD-06), Work orders (FRD-05), Inicio (FRD-18), Observabilidad (FRD-12).
 *
 * Opens a Server-Sent Events connection to `GET /api/live`, buffers the latest
 * `LiveFrame` snapshot, debounces high-frequency bursts, auto-reconnects after
 * a dropped connection, and tears down cleanly on unmount.
 *
 * Read-only contract (architecture §1, §7):
 *   This hook only READS data pushed by the server. It never writes to disk,
 *   never calls Claude, and never mutates factory state.
 *
 * Events without a `project` field are treated as legacy/global (CLAUDE.md §4).
 * The server-side route already filters the stream; the hook receives only what
 * matches its subscription.
 *
 * Traceability:
 *   AC-01-009.1 — event reaches subscribed client (hook receives SSE frames)
 *   AC-01-009.2 — ?project= passed to the endpoint; legacy/global events arrive
 *   AC-01-009.3 — debounces bursts; reconnects after dropped connection; no leak
 *
 * Published contract (for FRD-05/06/12/18 consumers):
 * ```ts
 * const { snapshot, connected, lastEventAt } = useLiveSnapshot({ project?, kinds? });
 * // snapshot:    LiveFrame | null  — latest filtered snapshot; null before first message
 * // connected:   boolean           — true when the SSE connection is open
 * // lastEventAt: string | null     — ISO 8601 timestamp of the latest event in snapshot
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { EventsSnapshot } from "@/lib/events/events";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The shape pushed over SSE — same as EventsSnapshot from the server. */
export type LiveFrame = EventsSnapshot;

/** Options accepted by the hook. */
export interface UseLiveSnapshotOptions {
  /** Only receive events for this project slug (+ legacy/global events). */
  project?: string;
  /** Only receive events whose `event` field is in this list. */
  kinds?: string[];
}

/** Return value of the hook. */
export interface UseLiveSnapshotResult {
  /** Latest filtered snapshot; null before the first SSE message is received. */
  snapshot: LiveFrame | null;
  /** True when the EventSource connection is open and healthy. */
  connected: boolean;
  /** ISO 8601 timestamp of the latest event in the snapshot; null until first message. */
  lastEventAt: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Debounce window: rapid SSE bursts are collapsed into a single state update. */
const DEBOUNCE_MS = 150;

/** Base reconnect delay in ms; we use a simple fixed delay (not exponential). */
const RECONNECT_DELAY_MS = 3_000;

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/**
 * Build the /api/live URL with optional query parameters.
 *
 * @param project - project slug filter
 * @param kinds   - event kind filter list
 */
function buildUrl(project?: string, kinds?: string[]): string {
  const params = new URLSearchParams();
  if (project !== undefined && project.trim() !== "") {
    params.set("project", project);
  }
  if (kinds !== undefined && kinds.length > 0) {
    params.set("kind", kinds.join(","));
  }
  const qs = params.toString();
  return qs !== "" ? `/api/live?${qs}` : "/api/live";
}

// ---------------------------------------------------------------------------
// Guard: is the parsed JSON a valid LiveFrame shape?
// ---------------------------------------------------------------------------

/**
 * Type guard — verifies the parsed JSON has at least the shape of a LiveFrame.
 * We require `events` to be an array; `lastEventAt` and `byProject` may be absent
 * (we default them).
 */
function isLiveFrame(val: unknown): val is LiveFrame {
  if (typeof val !== "object" || val === null || Array.isArray(val)) {
    return false;
  }
  const obj = val as Record<string, unknown>;
  return Array.isArray(obj.events);
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

/**
 * Subscribe to the shared SSE live transport.
 *
 * Usage:
 * ```tsx
 * // All events
 * const { snapshot, connected, lastEventAt } = useLiveSnapshot();
 *
 * // Scoped to one project
 * const { snapshot } = useLiveSnapshot({ project: "mission-control" });
 *
 * // Scoped to specific event kinds
 * const { snapshot } = useLiveSnapshot({ kinds: ["AgentWorking", "BuildEnd"] });
 * ```
 */
export function useLiveSnapshot(options: UseLiveSnapshotOptions = {}): UseLiveSnapshotResult {
  const { project, kinds } = options;

  const [snapshot, setSnapshot] = useState<LiveFrame | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);

  // Refs for stable identity across renders (no stale closure issues)
  const esRef = useRef<EventSource | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destroyedRef = useRef(false);

  // Stringify options for the dependency array (simple change detection)
  const url = buildUrl(project, kinds);

  /** Cancel the pending debounce timer, if any. */
  const cancelDebounce = useCallback((): void => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  /** Cancel the pending reconnect timer, if any. */
  const cancelReconnect = useCallback((): void => {
    if (reconnectRef.current !== null) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
  }, []);

  /** Close and discard the active EventSource, if any. */
  const closeEventSource = useCallback((): void => {
    if (esRef.current !== null) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  /** Apply a parsed LiveFrame to state (called after debounce). */
  const applyFrame = useCallback((frame: LiveFrame): void => {
    setSnapshot(frame);
    setLastEventAt(frame.lastEventAt ?? null);
  }, []);

  /** Handle an incoming SSE message event with debounce. */
  const handleMessage = useCallback(
    (ev: MessageEvent<string>): void => {
      cancelDebounce();
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        let parsed: unknown;
        try {
          parsed = JSON.parse(ev.data);
        } catch {
          // Malformed JSON — skip silently (tolerance rule)
          return;
        }
        if (isLiveFrame(parsed)) {
          applyFrame(parsed);
        }
        // Non-frame shapes are silently ignored
      }, DEBOUNCE_MS);
    },
    [cancelDebounce, applyFrame],
  );

  /** Open a new EventSource and wire up event handlers. */
  const connect = useCallback((): void => {
    if (destroyedRef.current) return;
    cancelReconnect();
    closeEventSource();

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = (): void => {
      if (destroyedRef.current) return;
      setConnected(true);
    };

    es.onmessage = (ev: MessageEvent<string>): void => {
      if (destroyedRef.current) return;
      handleMessage(ev);
    };

    es.onerror = (): void => {
      if (destroyedRef.current) return;
      setConnected(false);
      closeEventSource();

      // Schedule auto-reconnect
      reconnectRef.current = setTimeout(() => {
        reconnectRef.current = null;
        if (!destroyedRef.current) {
          connect();
        }
      }, RECONNECT_DELAY_MS);
    };
  }, [url, cancelReconnect, closeEventSource, handleMessage]);

  useEffect(() => {
    destroyedRef.current = false;
    connect();

    return () => {
      // Teardown: prevent reconnect, cancel timers, close stream
      destroyedRef.current = true;
      cancelDebounce();
      cancelReconnect();
      closeEventSource();
    };
  }, [connect, cancelDebounce, cancelReconnect, closeEventSource]);

  return { snapshot, connected, lastEventAt };
}
