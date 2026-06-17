---
id: WO-10-006
type: work-order
slug: chains-almost-there
title: WO-10-006 — Chains cards + "Almost there"
status: DRAFT
parent: FRD-10
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-10-006 — Chains cards + "Almost there"

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-10-chain-card`, `CMP-10-almost-there`](../blueprint.md#4-components--interfaces).

## Goal
Render the cumulative chains (tier pips, current tier badge, **honest endowed-progress** bar to next
tier via `CMP-09-xp-bar`, next-tier name, unlock date+project) and the **"Almost there"** section
(top chains by % to next tier — Zeigarnik).

## Acceptance criteria (EARS, from FRD-10)
- **AC-10-006.1** — Each chain card SHALL show the current tier (Bronze→Legend), a bar to the next tier with the next tier's name, and tier pips, from `computeChains()`.
- **AC-10-006.2** — Each unlocked tier SHALL show its **date** and **project**.
- **AC-10-006.3** — The progress bar SHALL show **honest endowed progress** (real achieved, never inflated/stuck) and SHALL reuse `CMP-09-xp-bar` (negative AC).
- **AC-10-006.4** — The **"Almost there"** section SHALL show the chains closest to their next tier; it SHALL NOT use false urgency, countdowns or nagging (negative AC, FRD-09).
- **AC-10-006.5** — Tier colors SHALL come from FRD-13 tier tokens; state never by color alone (badge label present).

## Dependencies
- WO-10-001 (`computeChains`), WO-10-005 (page shell). Intra-feature.
- FRD-09 `CMP-09-xp-bar`. FRD-13 tier tokens. Cross-feature.

## TDD plan
1. RED: tests for chain card (tier/badge/bar/next name/pips/date+project), "Almost there" ordering, "no false urgency", endowed-honest bar, tokens/not-color-alone.
2. GREEN: implement.
3. Refactor.

## Definition of done
- Component tests green incl. negative ACs; tsc + biome clean; tokens only. `.pandacorp/verify.sh` passes.
</content>
