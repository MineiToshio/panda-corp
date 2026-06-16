# WO-09-001 — `lib/gamification.ts`: guild XP/level engine (honest)

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`IF-09-guild-xp`](../blueprint.md#3-components--interfaces) + [§2 honesty contract](../blueprint.md#2-where-xp-comes-from-the-honesty-contract).

## Goal
Implement `computeGuildLevel(outcomes)` in `lib/gamification.ts` (**new pure module**): derive the
guild's level, title, XP, next threshold and pct-to-next **only from verifiable real outcomes**
(work orders / phases / releases closed, green tests) read via `lib/status.ts` + `lib/events.ts`.

## Acceptance criteria (EARS, from FRD-09)
- **AC-09-001.1** — `computeGuildLevel(outcomes)` SHALL return `{ level, title, xp, next, pctToNext }`, with `title` from the rank ladder and `xp` a pure function of the outcome counts.
- **AC-09-001.2** — XP SHALL be earned by **verifiable result** (work order / phase / release closed, green tests) and SHALL be **zero contribution** for activity, app opens, navigation, or trivial volume (negative AC).
- **AC-09-001.3** — WHEN there are no outcomes, the function SHALL return an honest low/zero state — it SHALL NEVER return a bar artificially stuck near full (e.g. pinned ~80%) (negative AC, FRD-09 forbidden pattern).
- **AC-09-001.4** — Any streak contribution SHALL be **weekly** (with a freeze concept), NEVER a daily-reset streak (negative AC).
- **AC-09-001.5** — The function SHALL be **pure** (same outcomes → same result), with no time-of-day/decay/engagement term, and fixture-tested.

## Dependencies
- FRD-01 `lib/status.ts`, FRD-06/12 `lib/events.ts` (typed outcome inputs). Cross-feature.

## TDD plan
1. RED: tests for level/title/xp/next from sample outcomes; a "navigation/app-open adds 0 XP" negative test; a "no outcomes → honest zero, not 80%" test; "streak is weekly not daily".
2. GREEN: implement the pure mapping.
3. Refactor: share threshold math with WO-09-002.

## Definition of done
- `pnpm vitest run lib/gamification.test.ts` green incl. negative ACs; tsc + biome clean; no `any`.
- Pure (no I/O in the function). `.pandacorp/verify.sh` passes.
</content>
