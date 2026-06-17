---
id: WO-09-006
type: work-order
slug: celebration-surface
title: WO-09-006 — `CMP-09-celebration` scaling surface
status: DRAFT
parent: FRD-09
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-09-006 — `CMP-09-celebration` scaling surface

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-09-celebration`](../blueprint.md#3-components--interfaces).

## Goal
Build the client-side celebration surface (`"use client"`) that renders the scaling celebration —
toast → animation → celebration → level-up moment — driven by `classifyCelebration()` over new
events. Restrained, honoring `prefers-reduced-motion` and the FRD-13 motion budget.

## Acceptance criteria (EARS, from FRD-09 + FRD-13)
- **AC-09-006.1** — The celebration SHALL **scale** with the outcome tier: small toast (work order) → medium animation (phase) → celebration (release) → level-up moment; it SHALL NOT show a flat celebration on every action.
- **AC-09-006.2** — A non-result event SHALL produce **no** celebration (negative AC; from `classifyCelebration → "none"`).
- **AC-09-006.3** — Animation SHALL use only `transform`/`opacity`, duration <300ms (the expressive reserved for rare events), and SHALL be **disabled** under `prefers-reduced-motion` (FRD-13) — the data still updates without motion.
- **AC-09-006.4** — There SHALL be NO false-urgency timer, countdown, or nagging in the celebration (negative AC, FRD-09 forbidden patterns).
- **AC-09-006.5** — Announcements SHALL use `aria-live="polite"` (Spanish) without stealing focus (FRD-13).

## Dependencies
- WO-09-005 (`classifyCelebration`). Intra-feature.
- FRD-13 motion tokens + `prefers-reduced-motion`. Cross-feature.

## TDD plan
1. RED: tests for tier-scaled rendering; "activity → no celebration"; "reduced-motion → no animation, data still present"; "no timer/countdown"; `aria-live` polite.
2. GREEN: implement the surface.
3. Refactor.

## Definition of done
- Component tests green incl. negative ACs + reduced-motion; tsc + biome clean; tokens only. `.pandacorp/verify.sh` passes.
</content>
