---
id: WO-18-003
type: work-order
slug: pulso
title: WO-18-003 — `IF-18-pulse` funnel + conversion + `Pulso` component
status: DRAFT
parent: FRD-18
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-18-003 — `IF-18-pulse` funnel + conversion + `Pulso` component

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`IF-18-pulse`, `CMP-18-pulse`) · [architecture §11](../../../product/architecture.md).
> Visual reference: `prototype/index.html` pulse stats (667–674).

## Goal
"Pulso de la fábrica": the funnel (ideas alive → in construction → shipped), the owner-waiting count,
and the idea→shipped conversion — the one metric. ≤5 signals.

## Scope
- `IF-18-pulse(...)` — pure: counts for ideas alive, in construction (split live vs stale), shipped,
  owner-waiting; the idea→shipped conversion percentage.
- `components/dashboard/pulso.tsx` — render the ≤5 signals + the conversion line.

## Acceptance criteria
- **AC-18-003.1** (REQ-18-013) The pulse shows the funnel, the owner-waiting count, and the idea→shipped
  conversion; total signals ≤ 5.
- **AC-18-003.2** (REQ-18-014) "In construction" distinguishes live builds from stale ones via the FRD-12
  live/no-signal indicator.
- **AC-18-003.3** Conversion = shipped / total ideas alive (rounded), with `tabular-nums` (FRD-13).
- **AC-18-003.4** Fresh factory (no ideas) → conversion 0% / calm state, no divide-by-zero, no fake metric.
- **AC-18-003.5** Spanish + a11y.

## TDD
`IF-18-pulse` pure tests with fixture idea/portfolio/event sets (incl. empty + a live build + a stale
build). `pulso.test.tsx` for render + ≤5 signals.

## Definition of done
- ACs RED → GREEN; ≤5 signals; live/stale split; safe on empty. `.pandacorp/verify.sh` green.

## Dependencies
- FRD-01 `lib/ideas`, `lib/portfolio`; FRD-02 `lib/board`; FRD-06/12 `lib/events`.
