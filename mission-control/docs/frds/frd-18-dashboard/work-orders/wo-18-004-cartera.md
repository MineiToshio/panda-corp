---
id: WO-18-004
type: work-order
slug: cartera
title: WO-18-004 — `IF-18-card` per-project derivation + `Cartera` cards
status: DRAFT
parent: FRD-18
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-18-004 — `IF-18-card` per-project derivation + `Cartera` cards

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`IF-18-card`, `CMP-18-cartera`) · [architecture §4.4](../../../product/architecture.md).
> Visual reference: `prototype/index.html` cartera cards (630–650).

## Goal
"Construcción y cartera": one card per active/shipped project with phase+version, WO progress,
age-in-stage, next command, and the live/stale/blocker/shipped flags. First-action card when none.

## Scope
- `IF-18-card(project)` — pure: derive phase+version, WO progress (`done/total`, %), age-in-stage, next
  command, and the flags: *en vivo* / *sin señal* (last-event freshness), *estancado* (phase age),
  inline blocker reason (failing/blocked WO), *estable · en operación* for shipped.
- `components/dashboard/cartera.tsx` — render the cards grid; first-action card with the start command
  when there are no active projects.

## Acceptance criteria
- **AC-18-004.1** (REQ-18-015) Each active/shipped project card shows phase+version, WO progress,
  age-in-stage, and the next command.
- **AC-18-004.2** (REQ-18-016) A running build whose last event is older than the freshness threshold is
  flagged *sin señal* with the last-event time; a fresh build is *en vivo*. (No-signal is the alarm.)
- **AC-18-004.3** (REQ-18-017) A project past the phase-staleness threshold is flagged *estancado* + age.
- **AC-18-004.4** (REQ-18-018) A failing/blocked WO surfaces its blocker reason inline (no log dive).
- **AC-18-004.5** (REQ-18-019) A shipped project shows *estable · en operación* with
  `/pandacorp:review-launch` as the next action.
- **AC-18-004.6** (REQ-18-020) No active projects → a first-action card with the start command
  (`/pandacorp:spec <idea>`), never blank.
- **AC-18-004.7** Thresholds from `lib/constants.ts`; Spanish + a11y; flags not by color alone.

## TDD
`IF-18-card` pure tests: fixtures for live build, stale build, stalled phase, blocked WO, shipped, and
empty-portfolio. `cartera.test.tsx` for the grid + first-action card.

## Definition of done
- ACs RED → GREEN; every flag covered; first-action card; Spanish. `.pandacorp/verify.sh` green.

## Dependencies
- FRD-01 `lib/status`, `lib/portfolio`; FRD-02 `lib/next-step`; FRD-05 `lib/work-orders`; FRD-06/12 `lib/events`.

## Status Note

**Built:** `IF-18-card` pure derivation + `Cartera` grid component (first-action card on empty portfolio).

**Files delivered:**
- `src/app/(dashboard)/_lib/card.ts` — `deriveCard(CardInput): CardData` (pure, no I/O, never throws).
- `src/components/dashboard/Cartera/Cartera.tsx` — `Cartera({ cards })` client component with `ProjectCard` and `FirstActionCard` sub-components.
- `src/app/(dashboard)/_lib/_tests/card.test.ts` — 30 pure-function tests (AC-18-004.1..5, AC-18-004.7, boundary conditions, invariants).
- `src/components/dashboard/Cartera/_tests/cartera.test.tsx` — 30 component tests (AC-18-004.1..7, edge cases).
- `src/lib/constants.ts` — added `FRESHNESS_THRESHOLD_MS` (30 min) and `STALENESS_THRESHOLD_DAYS` (7 days).

**Interfaces / contracts exposed:**
```ts
// src/app/(dashboard)/_lib/card.ts
export type CardInput = { name, phase, version, running, workOrdersDone, workOrdersTotal,
  phaseStartedAt, lastEventAt, failedWoReason, nowMs }
export type CardData = { name, phase, version, woProgress, ageInStageDays, nextCommand,
  isLive, isNoSignal, isStalled, isShipped, blockerReason, lastEventAt }
export type WoProgress = { done, total, pct }
export function deriveCard(input: CardInput): CardData  // pure, never throws

// src/components/dashboard/Cartera/Cartera.tsx
export type { WoProgress, CardData }
export function Cartera({ cards }: { cards: CardData[] }): React.JSX.Element
```

**Integration seams:**
- Caller (e.g. `app/(dashboard)/page.tsx`, WO-18-006) reads `activeProjects()` from `lib/portfolio`, reads events from `lib/events`, reads WOs from `lib/work-orders`, calls `deriveCard()` per project (server-side), passes `cards` array to `<Cartera cards={cards} />`.
- `Cartera` is `"use client"` only because `CopyButton` requires it; all derivation logic stays server-side in the caller.
- `data-testid` surface: `cartera-heading`, `cartera-grid`, `cartera-card-{slug}`, `cartera-flag-live`, `cartera-flag-nosignal`, `cartera-flag-stalled`, `cartera-blocker-reason`, `cartera-first-action`, `copy-button` (inherited from CopyButton).

**Side fix:** corrected pre-existing tsc error in `src/components/dashboard/Progreso/_tests/Progreso.test.tsx` (`"Maestría"` → `"Mastery"` to match `UniqueCategory` type from WO-18-005's adjacent implementer).

**Tests:** `src/app/(dashboard)/_lib/_tests/card.test.ts` + `src/components/dashboard/Cartera/_tests/cartera.test.tsx` (60 tests total, all GREEN). `verify.sh` passes: 230 files, 5857 tests, biome clean, tsc clean.
