---
id: WO-01-007
type: work-order
slug: read-events
title: WO-01-007 — `readEvents` (capped tail + state diffs)
status: ACTIVE
parent: FRD-01
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-01-007 — `readEvents` (capped tail + state diffs)

**Module:** `lib/events.ts`
**IDs touched:** `CMP-01-events`, `IF-01-readEvents`; REQ-01-008
**Dependencies:** WO-01-000 (fixtures)

## EARS criteria (from FRD-01)

- AC-01-008.1 — The system SHALL read the event stream (`~/.claude/dashboard-events.ndjson`) and
  compute state diffs to build the dashboard digest and the live / no-signal indicators (last-event
  timestamp per running build) and each project's time-in-current-phase (age-in-stage).

## Contract

```ts
type Event = {
  event: string; at: string; agent?: string; session?: string;
  tool?: string; status?: "ok" | "fail"; workOrder?: string; task?: string;
  project?: string;   // optional; missing ⇒ legacy/global (architecture §5, CLAUDE.md)
};
type EventsSnapshot = {
  events: Event[];                                 // capped tail (default 200)
  lastEventAt: string | null;
  byProject: Record<string, { lastEventAt: string }>;
};

export function readEvents(opts?: { path?: string; cap?: number }): EventsSnapshot;
```

- Read NDJSON as a **tail capped** at `cap` (default 200, architecture §3/§5). One JSON object per
  line; a malformed line is **skipped**, valid lines kept.
- Map field names to the schema (architecture §5): `work_order`→`workOrder`.
- Derive `lastEventAt` (max `at`) and `byProject` (last `at` per `project`; events without `project`
  are bucketed under a `__global__` key, NOT dropped).
- Missing file → `{ events: [], lastEventAt: null, byProject: {} }`.

## Definition of done

- `lib/events.test.ts` (RED first) against `events/`:
  - `dashboard-events.ndjson` → valid lines parsed; the malformed line skipped (no throw); the
    cap is respected when set below the line count.
  - `lastEventAt` = the latest `at`; `byProject` keys include the per-project ones and `__global__`
    for the project-less events.
  - `dashboard-events-empty.ndjson` and a missing path → empty snapshot.
- No write; fail-soft per blueprint §3.
- `.pandacorp/verify.sh` green.

## Status

- [x] **DONE** — `pnpm vitest run --reporter=dot` → 686 tests passed (25 test files); `biome check` clean; `tsc --noEmit` clean. `bash .pandacorp/verify.sh` green. Committed at `6b9496e` (implementation) + `476738a` (Party UI). Safe-point SHA recorded in `.pandacorp/status.yaml`.
