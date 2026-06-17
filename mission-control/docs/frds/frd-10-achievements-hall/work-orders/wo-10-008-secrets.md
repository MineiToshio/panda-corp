---
id: WO-10-008
type: work-order
slug: secrets
title: WO-10-008 — Secret achievements
status: DRAFT
parent: FRD-10
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-10-008 — Secret achievements

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-10-secrets`](../blueprint.md#4-components--interfaces).

## Goal
Render the secret achievements: a silhouette + cryptic hint while locked; on unlock, **reveal the
criterion** (what triggered it) plus date+project. Never a permanent, loot-box-style obscurity.

## Acceptance criteria (EARS, from FRD-10)
- **AC-10-008.1** — A locked secret SHALL render as a silhouette + its cryptic hint (from `computeSecrets()`), with no criterion shown.
- **AC-10-008.2** — WHEN unlocked, the secret SHALL **reveal its criterion** (what triggered it) and show date + project — it SHALL NOT remain obscure (negative AC, FRD-10 anti-loot-box).
- **AC-10-008.3** — The reveal SHALL be honest (the actual triggering result), never fabricated.
- **AC-10-008.4** — Styling SHALL use FRD-13 tokens only; locked/unlocked distinction not by color alone (silhouette/icon/label).

## Dependencies
- WO-10-004 (`computeSecrets`), WO-10-005 (page shell). Intra-feature.
- FRD-13 tokens. Cross-feature.

## TDD plan
1. RED: tests for locked silhouette+hint (no criterion), unlocked reveal (criterion+date+project), not-color-alone, tokens.
2. GREEN: implement.
3. Refactor.

## Definition of done
- Component tests green incl. negative ACs; tsc + biome clean; tokens only. `.pandacorp/verify.sh` passes.
</content>
