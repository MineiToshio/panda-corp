---
id: WO-17-005
type: work-order
slug: memory-health
title: WO-17-005 — Memory-health panel
status: DRAFT
parent: FRD-17
implementation_status: IN_PROGRESS
source_requirements: []
last_updated: '2026-06-16'
---
# WO-17-005 — Memory-health panel

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`CMP-17-health`) · [architecture §4.6, §4.7](../../../product/architecture.md).

## Goal
The self-learning-loop health panel: raw-notes count, candidate count, last-`/pandacorp:memory`-run +
a staleness nudge — the on-demand refine-trigger surface.

## Scope
- `components/memory-health.tsx`: render `memoryHealth()` — `rawNotes`, `candidates`,
  `lastMemoryRunAt` (labelled approximate), `staleDays`.
- WHEN the backlog is large OR `staleDays` exceeds the threshold (`lib/constants.ts`), show a nudge
  with the exact command (`/pandacorp:memory harvest` / `review`) via `CopyButton`.

## Acceptance criteria (REQ-17-005)
- **AC-17-005.1** The panel shows the raw-notes count, the candidate count, and the last-run time.
- **AC-17-005.2** WHEN `rawNotes` ≥ threshold OR `staleDays` ≥ threshold, a nudge with the exact
  `/pandacorp:memory …` command appears (copyable); below threshold, no nudge (no nagging — REQ-17-008).
- **AC-17-005.3** WHEN there is no memory yet (`lastMemoryRunAt == null`), the panel invites a first
  `/pandacorp:memory harvest` rather than showing a broken/empty state.
- **AC-17-005.4** The last-run value is labelled as approximate (it is an mtime proxy, not an exact event).
- **AC-17-005.5** Spanish copy + a11y; staleness conveyed by text + icon, not color alone.

## TDD
`components/memory-health.test.tsx` with fixture `memoryHealth()` outputs: below-threshold,
above-threshold, fresh-factory (null).

## Definition of done
- ACs RED → GREEN; nudge only above threshold; first-run invite; Spanish. `.pandacorp/verify.sh` green.

## Dependencies
- WO-17-002; FRD-02 `CopyButton`.
