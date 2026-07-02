/**
 * WO-01-009 — GET /api/live — the shared SSE live transport
 *
 * Server-Sent Events endpoint that tails `~/.claude/dashboard-events.ndjson`
 * (and optionally watches the project status.yaml / work-order frontmatter)
 * and pushes an `EventsSnapshot` delta per change to all subscribers.
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
 *   }
 *
 * Traceability:
 *   AC-01-009.1 — change appended to NDJSON reaches subscribed client via SSE
 *   AC-01-009.2 — ?project= filters stream; legacy/global events still arrive
 *   AC-01-009.3 — never throws on missing/locked file; close ends the watcher
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { type EventsSnapshot, readEvents } from "@/lib/events/events";

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
 * Matches EventsSnapshot so consumers can type it directly.
 */
export type LiveFrame = EventsSnapshot;

// ---------------------------------------------------------------------------
// Filtering helpers
// ---------------------------------------------------------------------------

/**
 * Apply project + kind filters to a raw EventsSnapshot.
 *
 * - When `project` is set: include only events whose `project` field matches
 *   OR events that carry no `project` field (legacy/global — CLAUDE.md).
 * - When `kinds` is set: include only events whose `event` field is in the set.
 * - When neither filter is set: return all events unchanged.
 *
 * `lastEventAt` and `byProject` are re-derived from the filtered set.
 */
function filterSnapshot(
  snapshot: EventsSnapshot,
  project?: string,
  kinds?: ReadonlySet<string>,
): LiveFrame {
  let events = snapshot.events;

  if (project !== undefined) {
    events = events.filter((ev) => ev.project === undefined || ev.project === project);
  }

  if (kinds !== undefined && kinds.size > 0) {
    events = events.filter((ev) => kinds.has(ev.event));
  }

  // Re-derive aggregates from the filtered set.
  let lastEventAt: string | null = null;
  const byProject: Record<string, { lastEventAt: string }> = {};

  for (const ev of events) {
    if (lastEventAt === null || ev.at > lastEventAt) {
      lastEventAt = ev.at;
    }
    const key = ev.project ?? "__global__";
    const existing = byProject[key];
    if (existing === undefined || ev.at > existing.lastEventAt) {
      byProject[key] = { lastEventAt: ev.at };
    }
  }

  return { events, lastEventAt, byProject };
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

/**
 * GET /api/live
 *
 * Opens an SSE stream. On every change to the events NDJSON file, reads the
 * latest snapshot via `readEvents` (the existing WO-01-007 reader — no
 * re-implementation of parsing), filters it, and pushes a `data:` frame.
 *
 * Cleanup: when the client closes the tab / navigates away, `request.signal`
 * fires `abort`; the handler closes the `fs.watch` watcher and the
 * ReadableStream controller. No resource leak.
 */
export function GET(request: Request): Response {
  const { searchParams } = new URL(request.url);
  const projectFilter = searchParams.get("project") ?? undefined;
  const kindParam = searchParams.get("kind");
  const kindsFilter: ReadonlySet<string> | undefined =
    kindParam !== null && kindParam.trim() !== ""
      ? new Set(
          kindParam
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
        )
      : undefined;

  const eventsFilePath = defaultEventsPath();

  const encoder = new TextEncoder();
  let watcher: fs.FSWatcher | null = null;
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  let lastEmitAt = 0;
  let emitThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  const stream = new ReadableStream({
    start(controller) {
      /** Read + filter + encode the current snapshot and enqueue it. */
      function emitSnapshot(): void {
        if (destroyed) return;

        // Project filter runs INSIDE readEvents (before the tail cap) so other
        // projects'/sessions' noise can't crowd a build's events out of the tail;
        // filterSnapshot keeps the kind filter + re-derives the aggregates.
        const snapshot = readEvents({ path: eventsFilePath, project: projectFilter });
        const frame = filterSnapshot(snapshot, projectFilter, kindsFilter);

        // Only emit if there is content (avoids useless empty frames on boot)
        // but we DO emit the initial snapshot unconditionally so the client
        // has data on first connect.
        try {
          controller.enqueue(encoder.encode(encodeFrame(frame)));
        } catch {
          // Controller may have been closed already — swallow.
        }
      }

      /** Throttled wrapper: deduplicate rapid fs.watch bursts. */
      function scheduleEmit(): void {
        if (destroyed) return;
        const now = Date.now();
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
            lastEmitAt = Date.now();
            emitSnapshot();
          }, EMIT_THROTTLE_MS - elapsed);
        }
      }

      // ---- Send the initial snapshot immediately on connect ----------------
      emitSnapshot();

      // ---- Watch the events file for appends / changes --------------------
      try {
        watcher = fs.watch(eventsFilePath, { persistent: false }, () => {
          scheduleEmit();
        });
      } catch {
        // fs.watch may throw on missing path (some platforms) or unsupported
        // filesystems. We continue without watching — the client will still
        // receive the initial snapshot and can poll if needed.
        watcher = null;
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
      request.signal.addEventListener("abort", () => {
        cleanup(controller);
      });
    },

    cancel() {
      cleanup();
    },
  });

  /** Close the fs.FSWatcher if active. Swallows already-closed errors. */
  function closeWatcher(): void {
    if (watcher === null) return;
    try {
      watcher.close();
    } catch {
      // Already closed — ignore.
    }
    watcher = null;
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

  /** Shared cleanup: close watcher, clear timers, close controller. */
  function cleanup(controller?: ReadableStreamDefaultController): void {
    if (destroyed) return;
    destroyed = true;

    if (emitThrottleTimer !== null) {
      clearTimeout(emitThrottleTimer);
      emitThrottleTimer = null;
    }

    if (keepAliveTimer !== null) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }

    closeWatcher();
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
