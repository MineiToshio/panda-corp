import { now as clockNow } from "@/lib/clock/clock";
/**
 * WO-01-009 — GET /api/live — the shared SSE live transport
 *
 * Server-Sent Events endpoint that tails `~/.claude/dashboard-events.ndjson`
 * (and optionally watches the project status.yaml / work-order frontmatter)
 * and pushes an `EventsSnapshot` delta per change to all subscribers.
 *
 * Stream hygiene (2026-07-07): a module-level singleton `EventStore` owns ONE
 * `fs.watch` on the events file plus a memoized parsed snapshot keyed by
 * {size, mtimeMs}. Every SSE connection SUBSCRIBES to that shared store and
 * FILTERS the shared snapshot for its own `?project=`/`?kind=` — instead of each
 * connection opening its own watcher and re-parsing the whole file. Per-client
 * `stateVersion` stat-watchers stay (they are cheap and project-specific).
 *
 * Read-only invariant (architecture §1, §7):
 *   This route ONLY reads files via the existing `lib/events` reader — it never
 *   writes to disk, never calls Claude, and never mutates factory state.
 *
 * Query parameters:
 *   ?project=<slug>  — filter: only emit events for that project + legacy/global
 *   ?kind=<e1,e2>    — filter: only emit events whose `event` field matches
 *
 * SSE frame shape:
 *   data: <JSON-serialised LiveFrame>\n\n
 *
 *   type LiveFrame = {
 *     events: Event[];          // filtered snapshot tail
 *     lastEventAt: string | null;
 *     byProject: Record<string, { lastEventAt: string }>;
 *     stateVersion?: number;    // max mtime of the project machine state
 *   }
 *
 * Traceability:
 *   AC-01-009.1 — change appended to NDJSON reaches subscribed client via SSE
 *   AC-01-009.2 — ?project= filters stream; legacy/global events still arrive
 *   AC-01-009.3 — never throws on missing/locked file; close ends the watcher
 */

import fs from "node:fs";
import { problem } from "@/lib/problem";
import {
  getStore,
  readStoreSnapshot,
  __resetLiveEventStoresForTest as resetStores,
  subscribeToStore,
  unsubscribeFromStore,
} from "./eventStore";

const MAX_CONNECTIONS = 20;
const connections = new Set<symbol>();
/** Reset stores and connection accounting between isolated transport tests. */
export function __resetLiveEventStoresForTest(): void {
  connections.clear();
  resetStores();
}

import os from "node:os";
import path from "node:path";

import { resolveProjectPath } from "@/lib/config/config";
import { isNewerTimestamp } from "@/lib/events/event-time";
import type { EventsSnapshot } from "@/lib/events/events";
import { readPortfolio } from "@/lib/portfolio/portfolio";
import { stateVersion } from "@/lib/status/state-version";

/**
 * Use the Node.js runtime so `fs.watch` and `fs.readFileSync` are available.
 * The Edge runtime does not support Node built-ins.
 */
export const runtime = "nodejs";

/**
 * Never cache: the stream is live.
 */
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Throttle: minimum ms between successive SSE frames to prevent flooding. */
const EMIT_THROTTLE_MS = 200;

/** Inactivity keep-alive: send a comment every N ms to prevent proxy timeouts. */
const KEEPALIVE_MS = 15_000;

/** Per-connection tail cap after filtering — the historical ~200-event tail. */
const CONNECTION_TAIL = 200;

/** Default path to the events NDJSON file — `PANDACORP_EVENTS_FILE` env override first
 * (e2e runs tail a frozen fixture), else `~/.claude/dashboard-events.ndjson`. */
function defaultEventsPath(): string {
  const override = process.env.PANDACORP_EVENTS_FILE;
  if (override !== undefined && override.length > 0) {
    return override;
  }
  const home = process.env.HOME ?? process.env.USERPROFILE ?? os.homedir();
  return path.join(home, ".claude", "dashboard-events.ndjson");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The SSE frame payload pushed to every subscriber.
 * Matches EventsSnapshot so consumers can type it directly, plus `stateVersion` —
 * the max mtime of the project's machine state (status.yaml + WO frontmatter), so a
 * build that advances STATE without emitting an EVENT still signals clients to
 * re-read (DR-066 fix 3). Absent when no ?project= is given or the dir is unknown.
 */
export type LiveFrame = EventsSnapshot & { stateVersion?: number };

// ---------------------------------------------------------------------------
// Shared EventStore — ONE fs.watch + memoized snapshot per events file
// ---------------------------------------------------------------------------

/**
 * Resolve the ?project= key (the emitters' `basename $PWD`) to the project's
 * absolute root via the portfolio — never trusts a client-supplied path (the
 * watch targets stay inside known project roots).
 */
function resolveProjectDir(project: string | undefined): string | undefined {
  if (project === undefined || project.trim() === "") return undefined;
  try {
    for (const row of readPortfolio()) {
      const resolved = resolveProjectPath(row.path);
      if (path.basename(resolved) === project) return resolved;
    }
  } catch {
    // Portfolio unreadable → no state watching; the event stream still works.
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Filtering helpers
// ---------------------------------------------------------------------------

/**
 * Apply project + kind filters to a raw EventsSnapshot, then tail-cap.
 *
 * - When `project` is set: include only events whose `project` field matches
 *   OR events that carry no `project` field (legacy/global — CLAUDE.md).
 * - When `kinds` is set: include only events whose `event` field is in the set.
 * - The filtered set is tail-capped at `tailCap` (the historical ~200 tail), so
 *   a client frame stays bounded even though the shared read holds SHARED_CAP.
 *
 * `lastEventAt` and `byProject` are re-derived from the retained tail (both are
 * "latest" aggregates, so the tail carries them). Timestamps compare via
 * `isNewerTimestamp` so mixed second/millisecond precisions order correctly.
 */
function filterSnapshot(
  snapshot: EventsSnapshot,
  project?: string,
  kinds?: ReadonlySet<string>,
  tailCap: number = CONNECTION_TAIL,
): LiveFrame {
  let events = snapshot.events;

  if (project !== undefined) {
    events = events.filter((ev) => ev.project === undefined || ev.project === project);
  }

  if (kinds !== undefined && kinds.size > 0) {
    events = events.filter((ev) => kinds.has(ev.event));
  }

  if (events.length > tailCap) {
    events = events.slice(events.length - tailCap);
  }

  // Re-derive aggregates from the retained tail.
  let lastEventAt: string | null = null;
  const byProject: Record<string, { lastEventAt: string }> = {};

  for (const ev of events) {
    if (lastEventAt === null || isNewerTimestamp(ev.at, lastEventAt)) {
      lastEventAt = ev.at;
    }
    const key = ev.project ?? "__global__";
    const existing = byProject[key];
    if (existing === undefined || isNewerTimestamp(ev.at, existing.lastEventAt)) {
      byProject[key] = { lastEventAt: ev.at };
    }
  }

  const publicEvents = events.map(({ session: _session, agent: _agent, ...event }) => event);
  return { events: publicEvents, lastEventAt, byProject };
}

// ---------------------------------------------------------------------------
// SSE frame encoder
// ---------------------------------------------------------------------------

/**
 * Encode a LiveFrame as a proper SSE `data:` frame.
 * SSE spec: `data: <payload>\n\n`
 */
function encodeFrame(frame: LiveFrame): string {
  return `data: ${JSON.stringify(frame)}\n\n`;
}

/**
 * SSE keep-alive comment (prevents proxy / load balancer timeouts).
 * SSE spec: `: <comment>\n\n`
 */
const KEEPALIVE_FRAME = ": keep-alive\n\n";

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/** Parse the `?kind=` param into a trimmed set, or undefined when absent/empty. */
function parseKinds(kindParam: string | null): ReadonlySet<string> | undefined {
  if (kindParam === null || kindParam.trim() === "") return undefined;
  return new Set(
    kindParam
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  );
}

/**
 * GET /api/live
 *
 * Opens an SSE stream. Subscribes to the shared EventStore (ONE fs.watch on the
 * events file + memoized snapshot); on every shared change it filters the shared
 * snapshot and pushes a `data:` frame. Also keeps per-client state watchers so a
 * state-only advance (no event) still re-emits with a fresh stateVersion.
 *
 * Cleanup: when the client closes the tab / navigates away, `request.signal`
 * fires `abort`; the handler unsubscribes (closing the shared watcher when it was
 * the last subscriber), closes its state watchers and the ReadableStream
 * controller. No resource leak.
 */
export function GET(request: Request): Response {
  if (connections.size >= MAX_CONNECTIONS)
    return problem(429, "Too many live connections", {
      detail: "Close an existing live stream before opening another.",
      instance: "/api/live",
    });
  const connection = Symbol();
  connections.add(connection);
  const { searchParams } = new URL(request.url);
  const projectFilter = searchParams.get("project") ?? undefined;
  const kindsFilter = parseKinds(searchParams.get("kind"));

  const eventsFilePath = defaultEventsPath();
  // Project root for state watching + stateVersion stamping (DR-066 fix 3).
  const projectDir = resolveProjectDir(projectFilter);
  const store = getStore(eventsFilePath);

  const encoder = new TextEncoder();
  const stateWatchers: fs.FSWatcher[] = [];
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  let lastEmitAt = 0;
  let emitThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;
  let removeAbortListener: (() => void) | undefined;
  let storeNotify: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      /** Read the shared (memoized) snapshot, filter it, stamp state, enqueue. */
      function emitSnapshot(): void {
        if (destroyed) return;

        const snapshot = readStoreSnapshot(store);
        const frame: LiveFrame = filterSnapshot(snapshot, projectFilter, kindsFilter);
        // Stamp the machine-state version so a state-only advance (no event) still
        // signals the client to re-read the frontmatter (DR-066 fix 3).
        if (projectDir !== undefined) {
          frame.stateVersion = stateVersion(projectDir);
        }

        try {
          controller.enqueue(encoder.encode(encodeFrame(frame)));
        } catch {
          // Controller may have been closed already — swallow.
        }
      }

      /** Throttled wrapper: deduplicate rapid re-read bursts. */
      function scheduleEmit(): void {
        if (destroyed) return;
        const now = clockNow().getTime();
        const elapsed = now - lastEmitAt;

        if (emitThrottleTimer !== null) {
          clearTimeout(emitThrottleTimer);
          emitThrottleTimer = null;
        }

        if (elapsed >= EMIT_THROTTLE_MS) {
          lastEmitAt = now;
          emitSnapshot();
        } else {
          // Defer to the end of the throttle window.
          emitThrottleTimer = setTimeout(() => {
            emitThrottleTimer = null;
            lastEmitAt = clockNow().getTime();
            emitSnapshot();
          }, EMIT_THROTTLE_MS - elapsed);
        }
      }

      // ---- Send the initial snapshot immediately on connect ----------------
      emitSnapshot();

      // ---- Subscribe to the SHARED events-file watcher --------------------
      // One watcher + one memoized parse serves all connections; this connection
      // just re-filters the shared snapshot on each shared change.
      storeNotify = scheduleEmit;
      subscribeToStore(store, storeNotify);

      // ---- Watch the project's MACHINE STATE too (DR-066 fix 3) -----------
      // A build can advance status.yaml / WO frontmatter without emitting an
      // event (cold start, a long gate, a backward WO transition); watching only
      // the event stream would read as "dead". Each state change re-emits a frame
      // whose stateVersion moves, so the client refreshes its RSC structure.
      if (projectDir !== undefined) {
        const stateTargets = [
          path.join(projectDir, ".pandacorp"),
          path.join(projectDir, "docs", "frds"),
        ];
        for (const target of stateTargets) {
          try {
            stateWatchers.push(
              fs.watch(target, { persistent: false, recursive: true }, () => {
                scheduleEmit();
              }),
            );
          } catch {
            // Missing dir / unsupported recursive watch → skip; events still flow.
          }
        }
      }

      // ---- Keep-alive to prevent proxy / CDN timeouts ---------------------
      keepAliveTimer = setInterval(() => {
        if (destroyed) return;
        try {
          controller.enqueue(encoder.encode(KEEPALIVE_FRAME));
        } catch {
          // Stream already closed — let the interval be cleared on cleanup.
        }
      }, KEEPALIVE_MS);

      // ---- Cleanup on client disconnect (abort signal) --------------------
      request.signal.addEventListener("abort", handleAbort, { once: true });
      function handleAbort(): void {
        cleanup(controller);
      }
      removeAbortListener = () => request.signal.removeEventListener("abort", handleAbort);
      if (request.signal.aborted) cleanup(controller);
    },

    cancel() {
      cleanup();
    },
  });

  /** Close every per-client state watcher. Swallows already-closed errors. */
  function closeStateWatchers(): void {
    for (const stateWatcher of stateWatchers.splice(0)) {
      try {
        stateWatcher.close();
      } catch {
        // Already closed — ignore.
      }
    }
  }

  /** Close the ReadableStream controller if provided. Swallows already-closed errors. */
  function closeController(controller?: ReadableStreamDefaultController): void {
    if (controller === undefined) return;
    try {
      controller.close();
    } catch {
      // Already closed.
    }
  }

  /** Shared cleanup: unsubscribe from the store, clear timers, close controller. */
  function cleanup(controller?: ReadableStreamDefaultController): void {
    if (destroyed) return;
    destroyed = true;
    connections.delete(connection);
    removeAbortListener?.();

    if (emitThrottleTimer !== null) {
      clearTimeout(emitThrottleTimer);
      emitThrottleTimer = null;
    }

    if (keepAliveTimer !== null) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }

    if (storeNotify !== null) {
      unsubscribeFromStore(store, storeNotify);
      storeNotify = null;
    }

    closeStateWatchers();
    closeController(controller);
  }

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering for SSE
    },
  });
}
