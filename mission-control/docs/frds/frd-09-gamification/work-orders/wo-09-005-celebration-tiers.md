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
</content>
