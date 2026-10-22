---
id: WO-09-005
type: work-order
slug: celebration-tiers
title: 'WO-09-005 — `lib/gamification.ts`: celebration tier classifier'
status: SUPERSEDED
superseded_by: [WO-19-002, WO-13-013]
parent: FRD-09
implementation_status: VERIFIED
source_requirements: []
dependsOn: [WO-06-012]
last_updated: '2026-06-16'
---
# WO-09-005 — `lib/gamification.ts`: celebration tier classifier

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`IF-09-celebration`](../blueprint.md#3-components--interfaces).

## Goal
Implement `classifyCelebration(event)` in `lib/gamification.ts`: map a verifiable outcome to its
celebration tier so celebrations **scale** — toast (work order) → animation (phase) → celebration
(release) → level-up — and are never flat. Pure function.

## Acceptance criteria (EARS, from FRD-09)
- **AC-09-005.1** — `classifyCelebration(event)` SHALL return `"toast" | "phase" | "release" | "levelup" | "none"` according to the outcome (WO close → toast, phase complete → phase, release → release, crossing a level threshold → levelup).
- **AC-09-005.2** — A non-result event (read/message/navigation/app-open) SHALL classify as `"none"` — no celebration for activity (negative AC).
- **AC-09-005.3** — The classifier SHALL be pure and fixture-tested; ambiguous/unknown events → `"none"` (never a default celebration).

## Dependencies
- FRD-06/12 `lib/events.ts` (event shape). Cross-feature.

## TDD plan
1. RED: tests mapping each outcome to its tier; negative tests (activity → none, unknown → none).
2. GREEN: implement.
3. Refactor.

## Definition of done
- `pnpm vitest run lib/gamification.test.ts` green incl. negative ACs; tsc + biome clean; pure; no `any`.
- `.pandacorp/verify.sh` passes.

## Status Note

**Built:** `classifyCelebration(event): CelebrationTier` in `lib/gamification.ts` — pure function, no side effects, no `any`, no `@ts-ignore`. Bootstraps `lib/gamification.ts` (the new file flagged in blueprint §7).

**Interface exposed:**
```ts
// lib/gamification.ts
export type CelebrationTier = "toast" | "phase" | "release" | "levelup" | "none";
export function classifyCelebration(event: Event): CelebrationTier;
```
`Event` imported from `lib/events.ts` (FRD-06/12 contract, read-only).

**Decision table (AC-09-005.1):**
- `achievement` + `task="levelup"|"level-up"` → `"levelup"`
- `achievement` + `task="release"` or `end`/`handoff` + `task="release"` → `"release"`
- `achievement`/`end`/`handoff` + `task` starting with `"phase:"` → `"phase"`
- `achievement`/`test_ok` + `workOrder` present, `status ≠ "fail"` → `"toast"`
- Any `status="fail"` → `"none"` (AC-09-005.3 ethical gate)
- Activity events (`read`, `write`, `edit`, `message`, `start`, `review`, `blocked`, `test_fail`, unknown) → `"none"` (AC-09-005.2)
- Ambiguous (no meaningful context) → `"none"` (AC-09-005.3: never a default celebration)

**Integration seam:** `lib/gamification.ts` is consumed by `CMP-09-celebration` (WO-09-006, not yet built) and any future component that needs to decide the celebration scale. Import path: `"@/lib/gamification"`.

**Tests:** `lib/gamification.test.ts` — 30 tests, 3 suites covering all ACs:
- Suite 1 (AC-09-005.1): 10 outcome-event fixtures → correct tier
- Suite 2 (AC-09-005.2): 11 activity/failure fixtures → all `"none"`
- Suite 3 (AC-09-005.3): 9 ambiguous/unknown/purity fixtures → all `"none"` or deterministic

**Gate:** biome clean, tsc clean, 30/30 vitest pass. Pre-existing biome error in `PartyTab.integration.reviewer.test.tsx` is out of scope (exists on HEAD before this WO).
</content>
