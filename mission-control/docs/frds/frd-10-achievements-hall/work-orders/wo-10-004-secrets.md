---
id: WO-10-004
type: work-order
slug: secrets
title: 'WO-10-004 — `lib/achievements.ts`: secret achievements'
status: DRAFT
parent: FRD-10
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-10-004 — `lib/achievements.ts`: secret achievements

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`IF-10-secrets`](../blueprint.md#4-components--interfaces). List in
[`docs/achievements.md`](../../../achievements.md).

## Goal
Implement `computeSecrets(readerData)` in `lib/achievements.ts`: the secret achievements — a cryptic
hint while locked, and on unlock the **revealed criterion** (what triggered it) + date+project. Never
an obscure, loot-box-style permanent mystery.

## Acceptance criteria (EARS, from FRD-10)
- **AC-10-004.1** — `computeSecrets()` SHALL return each secret with `unlocked`, a `hint` (always available, cryptic), and — ONLY when unlocked — `criterion`, `date`, `project`.
- **AC-10-004.2** — WHEN locked, the criterion SHALL be hidden (silhouette + hint); WHEN unlocked, the criterion (what triggered it) SHALL be revealed (negative AC: it SHALL NOT stay obscure after unlock).
- **AC-10-004.3** — An unlock SHALL be derived from a verifiable result, never asserted arbitrarily.
- **AC-10-004.4** — The function SHALL be pure and fixture-tested.

## Dependencies
- FRD-01 `lib/ideas.ts`/`lib/status.ts`, FRD-04/06 `lib/docs.ts`/`lib/events.ts`. Cross-feature.
- `docs/achievements.md` secret list (hints).

## TDD plan
1. RED: tests for hint-when-locked, criterion-revealed-when-unlocked, verifiable unlock, date+project.
2. GREEN: implement `computeSecrets()`.
3. Refactor.

## Definition of done
- `pnpm vitest run lib/achievements.test.ts` green incl. negative ACs; tsc + biome clean; pure; no `any`.
- `.pandacorp/verify.sh` passes.
</content>
