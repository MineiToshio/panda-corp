---
id: WO-18-004
type: work-order
slug: cartera
title: WO-18-004 — `IF-18-card` per-project derivation + `Cartera` cards
status: DRAFT
parent: FRD-18
implementation_status: PLANNED
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
