---
id: WO-18-001
type: work-order
slug: digest
title: WO-18-001 — `IF-18-digest` derivation + `Digest` component (`visto_hasta`)
status: DRAFT
parent: FRD-18
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-18'
---
# WO-18-001 — `IF-18-digest` derivation + `Digest` component (`visto_hasta`)

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`IF-18-digest`, `CMP-18-digest`, §4) · [architecture §4.8](../../../product/architecture.md).
> Visual reference: `prototype/index.html` `digestSection()` (593–609), `lsGet`/`seenMs`/`markSeen` (581–588).

## Goal
"Desde tu última visita": split events into new vs last-24h around the `visto_hasta` marker; the marker
is client-local UI state in `localStorage`.

## Scope
- `IF-18-digest(events, markerMs, nowMs)` — pure: returns `{ newEvents, last24h, atDia }`,
  change-framed, sorted newest-first.
- `components/dashboard/digest.tsx` (`"use client"`): read/write the marker via `localStorage`; render
  new (highlighted + counted) vs the last-24h fallback; "marcar visto" advances the marker; live count.

## Acceptance criteria
- **AC-18-001.1** (REQ-18-005) `IF-18-digest` returns change-framed items with relative timestamps from
  the event tail (not cumulative totals).
- **AC-18-001.2** (REQ-18-006) The marker is persisted in `localStorage` and survives a refresh and a
  tab close; a refresh/visit does NOT advance it.
- **AC-18-001.3** (REQ-18-007) The marker advances ONLY on "marcar visto" (or acting on an item); events
  newer than the marker are flagged "new" and counted.
- **AC-18-001.4** (REQ-18-008) WHEN there are no new events, the section shows an *al día* state PLUS the
  last-24h activity (dimmed) — never empty.
- **AC-18-001.5** (REQ-18-009, SHOULD) The "new" count can increment as new events arrive without a
  manual refresh.
- **AC-18-001.6** The marker is NEVER written to the factory/project (client-local only). Spanish + a11y.

## TDD
`IF-18-digest` pure tests with a fixture event tail + various marker positions. `digest.test.tsx`
(`@testing-library/react` + `jsdom`) for localStorage persistence, "marcar visto", al-día fallback.

## Definition of done
- ACs RED → GREEN; marker client-local; al-día fallback; Spanish. `.pandacorp/verify.sh` green.

## Dependencies
- FRD-06/12 `lib/events` (the capped tail). Constants (`last24h` window) in `lib/constants.ts`.

## Status Note

**Built (2026-06-18) — commit `539f5e6`**

### What it built
- **`IF-18-digest`** pure derivation helper at `src/app/_lib/digest.ts`: `computeDigest(events, markerMs, nowMs)` splits the event tail into `newEvents` (strictly newer than marker, newest-first), `last24h` (seen events within 24h rolling window, dimmed fallback, newest-first), and `atDia` (true when no new events). Change-framed (1 item per source event, never cumulative). Pure — no side effects.
- **`Digest` client component** at `src/components/modules/Digest/Digest.tsx` (`"use client"`): reads `visto_hasta` from `localStorage` on mount (key `mc:digest:visto_hasta`); visit/refresh does NOT advance the marker; "Marcar visto" button advances it to `nowMs`; live count badge (`role="status"`, `aria-live="polite"`); al-día state + last-24h dimmed fallback (never empty); fully Spanish; a11y (semantic `<section aria-label>`, `<ul aria-label>`, `<li aria-label>`, keyboard-accessible button).

### Interfaces/contracts exposed

```typescript
// src/app/_lib/digest.ts
export const LAST_24H_MS: number                          // 24h in ms
export interface DigestItem {
  event: Event;          // source event
  isNew: boolean;        // true → newer than marker
  relativeLabel: string; // e.g. "hace 30 min", "hace 2 h"
}
export interface DigestResult {
  newEvents: DigestItem[]; // newest-first, isNew=true
  last24h: DigestItem[];   // newest-first, isNew=false, within 24h window
  atDia: boolean;          // true when newEvents.length === 0
}
export function computeDigest(
  events: readonly Event[],
  markerMs: number,
  nowMs: number,
): DigestResult

// src/components/modules/Digest/Digest.tsx
export interface DigestProps {
  events: readonly Event[];
  nowMs?: number;  // injected for testability; defaults to Date.now()
}
export function Digest(props: DigestProps): React.JSX.Element
```

### Integration seams
- `Digest` is a `"use client"` leaf — the server (e.g. `app/page.tsx`) reads `lib/events.ts` and passes the capped tail as the `events` prop.
- `localStorage` key `mc:digest:visto_hasta` — same namespace pattern as `mc:build-mode:*` (established by FRD-11).
- `computeDigest` is pure and independently importable by any server or test context.

### Test files
- `src/app/_lib/_tests/digest.pure.test.ts` — 19 pure-function tests covering all marker positions, sort order, change-framed invariant, al-día fallback, empty tail.
- `src/components/modules/Digest/_tests/digest.test.tsx` — 20 RTL+jsdom tests covering localStorage persistence, "marcar visto" flow, al-día state, dimmed fallback, a11y, client-local invariant, live count via prop re-render.
- **39 tests total — all GREEN**. Full suite: 230 files, 5857 tests, 0 failures.
