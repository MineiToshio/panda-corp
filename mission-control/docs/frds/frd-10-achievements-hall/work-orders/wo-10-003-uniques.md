# WO-10-003 — `lib/achievements.ts`: unique achievements

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`IF-10-uniques`](../blueprint.md#4-components--interfaces). List in
[`docs/achievements.md`](../../../achievements.md).

## Goal
Implement `computeUniques(readerData)` in `lib/achievements.ts`: the one-time achievements grouped by
category (Discovery, Speed, Quality, Consistency, Mastery), each with its unlock state, date+project
when unlocked, and the condition when locked.

## Acceptance criteria (EARS, from FRD-10)
- **AC-10-003.1** — `computeUniques()` SHALL return each unique achievement (per `docs/achievements.md`) with `category`, `unlocked`, `date?`, `project?`, and `condition` (shown when locked).
- **AC-10-003.2** — An unlock SHALL be derived from a **verifiable** result (the triggering event/status), never asserted arbitrarily (negative AC).
- **AC-10-003.3** — A locked unique SHALL expose its condition (so it is achievable, not obscure); an unlocked one SHALL carry date + project.
- **AC-10-003.4** — The function SHALL be pure and fixture-tested.

## Dependencies
- FRD-01 `lib/ideas.ts`/`lib/status.ts`, FRD-04/06 `lib/docs.ts`/`lib/events.ts`. Cross-feature.
- `docs/achievements.md` unique list.

## TDD plan
1. RED: tests for category grouping, verifiable unlock, condition-when-locked, date+project-when-unlocked.
2. GREEN: implement `computeUniques()`.
3. Refactor.

## Definition of done
- `pnpm vitest run lib/achievements.test.ts` green incl. negative ACs; tsc + biome clean; pure; no `any`.
- `.pandacorp/verify.sh` passes.
</content>
