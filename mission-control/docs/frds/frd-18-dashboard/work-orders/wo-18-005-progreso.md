---
id: WO-18-005
type: work-order
slug: progreso
title: WO-18-005 — `Progreso` gamification strip
status: DRAFT
parent: FRD-18
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-18-005 — `Progreso` gamification strip

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`CMP-18-progress`) · FRD-09 (honest gamification).
> Visual reference: `prototype/index.html` `foot` strip (656–662).

## Goal
"Tu progreso": the honest gamification strip — guild level/XP, most recent achievement, next milestone,
all from real outcomes. No streaks, no false urgency (White-Hat, FRD-09).

## Scope
- `components/dashboard/progreso.tsx` — render level/XP (from FRD-09 derivation), the most recent
  achievement, and the next milestone with progress.

## Acceptance criteria (REQ-18-021)
- **AC-18-005.1** The strip shows guild level/XP, the most recent achievement, and the next milestone.
- **AC-18-005.2** All values derive from REAL outcomes (shipped, phases completed, lessons graduated) per
  FRD-09 — no synthetic/streak metric.
- **AC-18-005.3** No streaks and no false urgency (REQ-18-003 / FRD-09 White-Hat).
- **AC-18-005.4** Fresh factory (no achievements) → an honest "your first achievement awaits" state.
- **AC-18-005.5** `tabular-nums` on XP; Spanish + a11y.

## TDD
`progreso.test.tsx` with fixture FRD-09 data: with achievements + the fresh-factory empty case.

## Definition of done
- ACs RED → GREEN; real-outcome derived; no streaks; first-achievement state. `.pandacorp/verify.sh` green.

## Dependencies
- FRD-09 gamification derivation (`lib/events` / `lib/status` → XP/achievements).
