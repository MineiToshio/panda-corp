---
id: WO-01-009
type: work-order
slug: live-transport-sse
title: 'WO-01-009 — Foundation (FND-5): the shared live transport (SSE route + useLiveSnapshot)'
status: DRAFT
parent: FRD-01
implementation_status: PLANNED
foundation: true
artifacts:
  - 'src/app/api/live/**'
  - 'src/hooks/useLiveSnapshot.ts'
  - 'src/hooks/_tests/**'
source_requirements: [IF-01-events]
last_updated: '2026-06-19'
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

## Status Note (for the 4 consumers)
Publish the SSE frame shape + the `useLiveSnapshot` return contract in this WO's `## Status Note` so
FRD-05/06/12/18 subscribe against the real contract, not a guess.
