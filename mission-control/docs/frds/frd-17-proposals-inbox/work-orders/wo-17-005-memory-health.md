---
id: WO-17-005
type: work-order
slug: memory-health
title: WO-17-005 — Memory-health panel
status: DRAFT
parent: FRD-17
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-18'
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

## Status Note

**What was built:** The `MemoryHealth` UI component (CMP-17-health) for the self-learning-loop health panel. Pure presentation component that receives a pre-computed `MemoryHealth` data prop (from `memoryHealth()` in `lib/memory/memory-health.ts`, WO-17-002) and renders the panel. No filesystem reads; no Claude calls; no writes.

**Files delivered:**
- `src/components/modules/MemoryHealth/MemoryHealth.tsx` — the `MemoryHealth` Server Component
- `src/components/modules/MemoryHealth/_tests/memory-health.test.tsx` — 27 TDD tests RED→GREEN
- `src/lib/constants.ts` — added `MEMORY_RAW_NOTES_THRESHOLD = 10` and `MEMORY_STALE_DAYS_THRESHOLD = 7`

**Interfaces/contracts exposed:**
```tsx
// Component
export interface MemoryHealthProps { health: MemoryHealth; }
export function MemoryHealth({ health }: MemoryHealthProps): React.JSX.Element

// data-testid surface:
// "memory-health-panel"       — root <section> landmark
// "memory-health-raw-notes"   — raw notes count text node
// "memory-health-candidates"  — candidate lessons count text node
// "memory-health-last-run"    — last-run section (only when lastMemoryRunAt !== null)
// "memory-health-last-run-label" — "(aprox.)" label (AC-17-005.4)
// "memory-health-stale-days"  — stale days text node (staleDays indicator)
// "memory-health-stale-icon"  — staleness icon (role=img; text+icon, not color alone)
// "memory-health-nudge"       — nudge block (only above threshold)
// "memory-health-first-harvest" — first-harvest invite (only when lastMemoryRunAt === null)
// "copy-button"               — CopyButton inside nudge/invite (FRD-02)

// Constants added to lib/constants.ts:
export const MEMORY_RAW_NOTES_THRESHOLD = 10;
export const MEMORY_STALE_DAYS_THRESHOLD = 7;
```

**Integration seam:** Callers (`app/proposals/page.tsx` or any page rendering the panel) call `memoryHealth()` server-side and pass the result as `<MemoryHealth health={result} />`. The component is a Server Component (no `"use client"`; CopyButton handles client boundary).

**All 5 ACs verified:**
- AC-17-005.1: raw-notes, candidates, last-run shown — tests `memory-health-raw-notes`, `memory-health-candidates`, `memory-health-last-run`
- AC-17-005.2: nudge only above threshold (rawNotes ≥ 10 OR staleDays ≥ 7); below → no nudge — 6 tests
- AC-17-005.3: fresh factory (null) → `memory-health-first-harvest` invite with `/pandacorp:memory harvest` + CopyButton — 5 tests
- AC-17-005.4: last-run labelled "(aprox.)" via `memory-health-last-run-label` — 2 tests
- AC-17-005.5: Spanish copy, `<section>` landmark, staleness by text+icon (not color alone) — 5 tests

**Test files:** `src/components/modules/MemoryHealth/_tests/memory-health.test.tsx` (27 tests).

**Gate:** 27/27 tests GREEN. `verify.sh` PASS (203 test files, 5413 tests). `tsc --noEmit` clean. `biome check` clean on new files. Commit `8450fd6`.
