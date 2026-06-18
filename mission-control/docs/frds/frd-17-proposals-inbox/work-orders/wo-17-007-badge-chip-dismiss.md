---
id: WO-17-007
type: work-order
slug: badge-chip-dismiss
title: WO-17-007 — Guild badge + portfolio-rail chip + dismissal
status: DRAFT
parent: FRD-17
implementation_status: IN_PROGRESS
source_requirements: []
last_updated: '2026-06-16'
---
# WO-17-007 — Guild badge + portfolio-rail chip + dismissal

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`CMP-17-badge`, `CMP-17-dismiss`) · [architecture §4.8, §7](../../../product/architecture.md).

## Goal
Surface the open-proposal count as a top-bar guild badge and a per-project portfolio-rail chip
(extending FRD-14's chips), and make proposals honestly dismissible with the dismissal remembered
client-locally.

## Scope
- `CMP-17-badge`: top-bar badge with the open proposal count (candidates + promotions + prune +
  self-suggestions, minus dismissed); per-project rail chip for that project's proposals.
- `CMP-17-dismiss`: dismissing a proposal hides it and persists the dismissal in `localStorage`
  (client-local UI state — NOT a factory write, architecture §4.8). Honest/White-Hat: no streaks, no
  false urgency.

## Acceptance criteria (REQ-17-001, REQ-17-008)
- **AC-17-007.1** The top-bar badge shows the open proposal count and links to `app/proposals`.
- **AC-17-007.2** The portfolio-rail chip shows a project's proposal count, alongside FRD-14's
  pending-decisions/bugs chips (third stream).
- **AC-17-007.3** Dismissing a proposal removes it from the count and the list; the dismissal survives a
  refresh (localStorage) and is NOT a write to the factory.
- **AC-17-007.4** WHEN there are no open proposals, the badge/chip reads calm (e.g. hidden or an *al día*
  state) — no false urgency, no nagging (White-Hat, FRD-09).
- **AC-17-007.5** Spanish copy + a11y; count not conveyed by color alone.

## TDD
`components/proposals-badge.test.tsx`: assert count, dismissal persistence (localStorage), calm
empty/al-día state, no factory write.

## Definition of done
- ACs RED → GREEN; dismissal remembered client-locally; calm when empty; Spanish. `.pandacorp/verify.sh` green.

## Dependencies
- WO-17-002, WO-17-003; FRD-14 chip placement in the portfolio rail.
