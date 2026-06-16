# WO-10-001 — `lib/achievements.ts`: stats (only-grow counters)

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`IF-10-stats`](../blueprint.md#4-components--interfaces) + [§2 honesty contract](../blueprint.md#2-where-the-stats-come-from-honesty-contract-shared-with-frd-09).

## Goal
Implement `computeStats(readerData)` in `lib/achievements.ts` (**new pure module**): derive the
character-sheet counters (products shipped, ideas captured, work orders, phases, iterations, flawless
launches, ideas discarded, PRDs, ADRs, agents coordinated, record streak, record idea→launch) from
the FRD-01/03/04/06 readers. Counters reflect real cumulative history (only grow).

## Acceptance criteria (EARS, from FRD-10)
- **AC-10-001.1** — `computeStats()` SHALL return all the stats listed in `docs/achievements.md`, each derived from a verifiable source (§2 table).
- **AC-10-001.2** — Each counter SHALL reflect real cumulative history (it only grows); it SHALL NOT be an app-incremented value (negative AC).
- **AC-10-001.3** — WHEN the factory is empty/fresh, the stats SHALL be honest zeros — never fabricated (negative AC).
- **AC-10-001.4** — The function SHALL be pure and fixture-tested over reader outputs (no direct fs).

## Dependencies
- FRD-01 `lib/ideas.ts`/`lib/status.ts`, FRD-03 `lib/portfolio.ts`, FRD-04/06 `lib/docs.ts`/`lib/events.ts`. Cross-feature.

## TDD plan
1. RED: tests deriving each stat from sample reader data; "empty factory → zeros" negative test.
2. GREEN: implement `computeStats()`.
3. Refactor.

## Definition of done
- `pnpm vitest run lib/achievements.test.ts` green incl. negative ACs; tsc + biome clean; pure; no `any`.
- New module recorded in blueprint §3. `.pandacorp/verify.sh` passes.
</content>
