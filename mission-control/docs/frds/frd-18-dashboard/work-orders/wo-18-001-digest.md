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
