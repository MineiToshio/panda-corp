---
id: WO-01-009
type: work-order
slug: live-transport-sse
title: 'WO-01-009 — Foundation (FND-5): the shared live transport (SSE route + useLiveSnapshot)'
status: DRAFT
parent: FRD-01
implementation_status: VERIFIED
foundation: true
artifacts:
  - 'src/app/api/live/**'
  - 'src/hooks/useLiveSnapshot.ts'
  - 'src/hooks/_tests/**'
source_requirements: [IF-01-events]
dependsOn: [WO-01-005, WO-01-007, WO-05-001]
last_updated: '2026-06-20'
---
# WO-01-009 — Foundation (FND-5): the shared real-time wire (SSE, not polling)

> **FOUNDATION WO (DR-057/cross-cutting).** The single live transport reused by the FOUR real-time
> surfaces — **Party (FRD-06), Work orders (FRD-05), Inicio (FRD-18), Observabilidad (FRD-12)** — so
> none re-invents its own polling. Each surface subscribes to its **own slice** of events. Built before
> those surfaces (they declare a dependency on FRD-01). MC stays **read-only**: this only READS the
> events NDJSON + status files and pushes deltas; it never writes factory state.
> Source-of-truth: [`architecture.md`](../../product/architecture.md) · [`blueprint.md`](../blueprint.md).

## Goal
A Server-Sent-Events endpoint that tails `~/.claude/dashboard-events.ndjson` + watches the project
`status.yaml`/work-order frontmatter, and a client hook that subscribes to a filtered slice — replacing
any interval polling on the live surfaces with push.

## Scope (reuse the existing readers — do NOT re-implement parsing in `lib/`, which stays VERIFIED)
- **`src/app/api/live/route.ts`** — a streaming `GET` route (`text/event-stream`) that, on the server,
  watches the events file (append-tail) and the relevant status files via the **existing** `lib/events`,
  `lib/status`, `lib/work-orders` readers (WO-01-005/007), and emits an SSE `data:` frame per change.
  Filterable by `?project=<slug>` and `?kind=<…>` so a surface gets only its slice. Closes cleanly on
  unsubscribe; backpressure-safe; no busy-loop (fs.watch / tail, throttled).
- **`src/hooks/useLiveSnapshot.ts`** — `useLiveSnapshot({ project?, kinds? })` opens an `EventSource`,
  buffers the latest derived snapshot, debounces high-frequency bursts, auto-reconnects, and tears down
  on unmount. Returns `{ snapshot, connected, lastEventAt }`. Events without a `project` field are
  treated as legacy/global (CLAUDE.md). Respects the read-only contract.

## Acceptance criteria
- AC: a change appended to the events NDJSON reaches a subscribed client via SSE (no polling interval).
- AC: `?project=` filters the stream to that project's slice; a global/legacy event still arrives.
- AC: the route never throws on a missing/locked file (defensive, mirrors the readers); closing the tab
  ends the stream and the watcher (no leak).
- AC: the hook debounces bursts and reconnects after a dropped connection.
- Appended to `docs/design/components.md` (if a shared client piece) and the FRD-01 blueprint Build Plan.

## Status Note

### What was built

**`src/app/api/live/route.ts`** — SSE route (`GET /api/live`, Node.js runtime, `force-dynamic`):
- Uses `readEvents()` from the existing `lib/events/events.ts` (WO-01-007, VERIFIED — no re-implementation).
- Watches `~/.claude/dashboard-events.ndjson` via `fs.watch` (non-persistent, fail-soft — if `fs.watch`
  throws on missing/locked path, the route continues and serves the initial snapshot; the watcher is
  simply absent).
- Throttles emit bursts at `EMIT_THROTTLE_MS = 200ms` (deduplicates rapid fs.watch callbacks).
- Keep-alive SSE comment every `KEEPALIVE_MS = 15 000ms` to prevent proxy/CDN timeouts.
- Cleans up watcher + timers on `request.signal` abort (client disconnect) and on `ReadableStream.cancel`.
- Returns initial snapshot immediately on first connect (before any file-watch event fires).

**`src/hooks/useLiveSnapshot.ts`** — client hook (`"use client"`, React 19):
- Opens `EventSource` to `/api/live` (with optional `?project=` and `?kind=` query params).
- Debounces incoming SSE messages at `DEBOUNCE_MS = 150ms` — rapid bursts collapse to a single state update.
- Auto-reconnects after error with `RECONNECT_DELAY_MS = 3 000ms` fixed delay.
- Tears down cleanly on unmount: cancels debounce + reconnect timers, closes `EventSource`.
- Guards `destroyedRef` so reconnect timers fired after unmount are no-ops.

### SSE frame contract (for FRD-05/06/12/18 consumers)

```ts
// Frame shape pushed as:  data: <JSON>\n\n
type LiveFrame = {
  events: Event[];                                     // filtered + capped tail
  lastEventAt: string | null;                          // max `at` across retained events
  byProject: Record<string, { lastEventAt: string }>; // per-project latest `at`
};

// Event type (from lib/events/events.ts):
type Event = {
  event: string; at: string; agent?: string; session?: string;
  tool?: string; status?: "ok" | "fail"; workOrder?: string; task?: string;
  project?: string;   // absent → legacy/global (bucketed under __global__)
  frd?: string; phase?: "build" | "review"; activity?: string; mode?: string; role?: string;
};
```

### `useLiveSnapshot` hook contract (for FRD-05/06/12/18 consumers)

```ts
import { useLiveSnapshot } from "@/hooks/useLiveSnapshot";
import type { LiveFrame, UseLiveSnapshotOptions, UseLiveSnapshotResult } from "@/hooks/useLiveSnapshot";

// UseLiveSnapshotOptions:
//   project?: string     — filter: only receive events for this project + legacy/global
//   kinds?: string[]     — filter: only receive events whose `event` field is in this list

// UseLiveSnapshotResult:
//   snapshot:    LiveFrame | null  — latest filtered snapshot; null before first SSE message
//   connected:   boolean           — true while the EventSource is open and healthy
//   lastEventAt: string | null     — ISO 8601 timestamp of the latest event in snapshot

// Usage:
const { snapshot, connected, lastEventAt } = useLiveSnapshot({ project: "mission-control" });
const { snapshot: allSnapshot } = useLiveSnapshot();  // no filter — all events
const { snapshot: kindSlice } = useLiveSnapshot({ kinds: ["AgentWorking", "BuildEnd"] });
```

### SSE endpoint URL

```
GET /api/live
GET /api/live?project=<slug>
GET /api/live?kind=<event1,event2>
GET /api/live?project=<slug>&kind=<event1,event2>
```

### Implicit decisions & conventions made

1. **Filtering happens on the server** (in `route.ts filterSnapshot()`), not in the hook. The hook
   receives only the pre-filtered frame and passes it through unchanged. Consumers query the right
   slice at subscription time.
2. **Legacy/global events always pass the project filter** (architecture §5, CLAUDE.md §4): events
   with no `project` field are included in any `?project=` scoped stream so legacy emitters still work.
3. **`lastEventAt` and `byProject` are re-derived from the filtered set** on the server after
   filtering — they reflect only the events that made it through, not the raw full snapshot.
4. **Throttle (route) vs debounce (hook)** are independent layers: the route throttles `fs.watch`
   callbacks at 200ms (prevents read storms); the hook debounces SSE messages at 150ms (prevents React
   render storms on burst delivery). Together they give smooth, non-spammy updates.
5. **`snapshot` starts as `null`**, not an empty `{ events: [], ... }`. This lets consumers distinguish
   "not yet connected" from "connected but no events". The route sends the initial snapshot on first
   connect, so the null period is brief (~1 round-trip).
6. **`useLiveSnapshot` is a hook, not a React component**, but it is listed in `docs/design/components.md`
   for discoverability so downstream FRDs don't re-invent polling.
7. **`runtime = "nodejs"` and `dynamic = "force-dynamic"`** on the route — required for `fs.watch`
   (Edge runtime lacks Node built-ins) and to prevent Next.js caching a streaming response.
8. **No exponential back-off** on reconnect — fixed 3 000ms delay. Simple and sufficient for a local
   dashboard with no network latency.

### Test files

- `src/app/api/live/_tests/route.test.ts` — 17 tests covering headers, stream body, project filter,
  defensive missing/locked file, watcher setup, SSE frame shape.
- `src/hooks/_tests/useLiveSnapshot.test.ts` — 17 tests covering initial state, query params,
  connection lifecycle, message handling, debounce, auto-reconnect, legacy/global events.

### Integration seams for consumers (FRD-05/06/12/18)

- Import the hook: `import { useLiveSnapshot } from "@/hooks/useLiveSnapshot";`
- Subscribe with a project scope: `useLiveSnapshot({ project: slug })`
- The `snapshot.events` array is already filtered and capped (≤200 by the reader's default cap).
- `connected` can drive a live/no-signal indicator (FRD-12 `FreshnessBadge`).
- `lastEventAt` drives age-in-stage calculations (FRD-18 dashboard digest).
- To receive ALL events (e.g. the global party feed in FRD-06): call `useLiveSnapshot()` with no options.
