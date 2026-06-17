---
id: WO-10-001
type: work-order
slug: achievements-engine
title: 'WO-10-001 — `lib/achievements.ts`: achievements engine (stats/chains/uniques/secrets)'
status: DRAFT
parent: FRD-10
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-10-001 — `lib/achievements.ts`: achievements engine (stats/chains/uniques/secrets)

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`IF-10-stats`](../blueprint.md#4-components--interfaces), [`IF-10-chains`](../blueprint.md#4-components--interfaces),
[`IF-10-uniques`](../blueprint.md#4-components--interfaces), [`IF-10-secrets`](../blueprint.md#4-components--interfaces)
+ [§2 honesty contract](../blueprint.md#2-where-the-stats-come-from-honesty-contract-shared-with-frd-09).
Thresholds/tier names/lists in [`docs/achievements.md`](../../../achievements.md).

## Goal
Implement the **complete `lib/achievements.ts`** pure module — all four achievement families in one
cohesive engine, since they share the file and the same reader inputs:

- `computeStats(readerData)` — derive the character-sheet counters (products shipped, ideas captured,
  work orders, phases, iterations, flawless launches, ideas discarded, PRDs, ADRs, agents coordinated,
  record streak, record idea→launch) from the FRD-01/03/04/06 readers. Counters reflect real
  cumulative history (only grow).
- `computeChains(stats)` — per chain, the current tier (Bronze→Silver→Gold→Platinum→Legend), the next
  tier, the **honest endowed-progress** pct to next, the unlock date+project per tier, and
  lower-is-better handling for idea→launch.
- `computeUniques(readerData)` — the one-time achievements grouped by category (Discovery, Speed,
  Quality, Consistency, Mastery), each with its unlock state, date+project when unlocked, and the
  condition when locked.
- `computeSecrets(readerData)` — the secret achievements: a cryptic hint while locked, and on unlock
  the **revealed criterion** (what triggered it) + date+project. Never an obscure, loot-box-style
  permanent mystery.

## In Scope
- `lib/achievements.ts` (**new pure module**) exporting `computeStats`, `computeChains`,
  `computeUniques`, `computeSecrets`, plus the chain/unique/secret data tables (thresholds, tier
  names, categories, hints) from `docs/achievements.md`.
- All functions pure and fixture-tested over reader outputs (no direct `fs`).
- Honesty encoded as negative ACs (no fabrication, no inflation, no stuck bars, no permanent mystery).

## Out of Scope
- The Hall page/components that consume this module (WO-10-005 page shell, WO-10-006 chains,
  WO-10-007 uniques, WO-10-008 secrets).
- The underlying readers themselves (FRD-01/03/04/06).

## Acceptance criteria (EARS, from FRD-10)

### Stats (only-grow counters)
- **AC-10-001.1** — `computeStats()` SHALL return all the stats listed in `docs/achievements.md`, each derived from a verifiable source (§2 table).
- **AC-10-001.2** — Each counter SHALL reflect real cumulative history (it only grows); it SHALL NOT be an app-incremented value (negative AC).
- **AC-10-001.3** — WHEN the factory is empty/fresh, the stats SHALL be honest zeros — never fabricated (negative AC).
- **AC-10-001.4** — The function SHALL be pure and fixture-tested over reader outputs (no direct fs).

### Chains + honest endowed progress
- **AC-10-002.1** — `computeChains()` SHALL tier up each chain when its stat crosses the threshold (per `docs/achievements.md`), returning current tier, next tier name and pct-to-next.
- **AC-10-002.2** — Each unlocked tier SHALL carry the **date** and **project** where it happened.
- **AC-10-002.3** — Progress SHALL be **honest endowed progress**: the bar starts from the progress **already achieved** (real), and the pct SHALL correspond to real work — it SHALL NEVER be inflated nor a bar stuck artificially (negative AC, FRD-09 forbidden pattern).
- **AC-10-002.4** — Lower-is-better chains (record idea→launch) SHALL compute progress correctly (improving = closer to the next, lower threshold), per the prototype `chainState` logic.
- **AC-10-002.5** — The function SHALL be pure and fixture-tested.

### Unique achievements
- **AC-10-003.1** — `computeUniques()` SHALL return each unique achievement (per `docs/achievements.md`) with `category`, `unlocked`, `date?`, `project?`, and `condition` (shown when locked).
- **AC-10-003.2** — An unlock SHALL be derived from a **verifiable** result (the triggering event/status), never asserted arbitrarily (negative AC).
- **AC-10-003.3** — A locked unique SHALL expose its condition (so it is achievable, not obscure); an unlocked one SHALL carry date + project.
- **AC-10-003.4** — The function SHALL be pure and fixture-tested.

### Secret achievements
- **AC-10-004.1** — `computeSecrets()` SHALL return each secret with `unlocked`, a `hint` (always available, cryptic), and — ONLY when unlocked — `criterion`, `date`, `project`.
- **AC-10-004.2** — WHEN locked, the criterion SHALL be hidden (silhouette + hint); WHEN unlocked, the criterion (what triggered it) SHALL be revealed (negative AC: it SHALL NOT stay obscure after unlock).
- **AC-10-004.3** — An unlock SHALL be derived from a verifiable result, never asserted arbitrarily.
- **AC-10-004.4** — The function SHALL be pure and fixture-tested.

## Dependencies
- FRD-01 `lib/ideas.ts` / `lib/status.ts` (+ `lib/config.ts`), FRD-03 `lib/portfolio.ts`,
  FRD-04/06 `lib/docs.ts` / `lib/events.ts`. Cross-feature.
- `docs/achievements.md` threshold/tier-name tables, unique list, secret list (hints).
- Intra-feature: `computeChains()` consumes the output of `computeStats()` (same module, built together).

## TDD plan
1. RED:
   - Stats: tests deriving each stat from sample reader data; "empty factory → zeros" negative test.
   - Chains: tier crossing, next-tier name, endowed pct from real progress, lower-is-better, date+project capture; a "no inflation / not stuck" negative test.
   - Uniques: category grouping, verifiable unlock, condition-when-locked, date+project-when-unlocked.
   - Secrets: hint-when-locked, criterion-revealed-when-unlocked, verifiable unlock, date+project.
2. GREEN: implement `computeStats()`, then `computeChains()` + the data tables, `computeUniques()`, `computeSecrets()`.
3. Refactor.

## Definition of done
- `pnpm vitest run lib/achievements.test.ts` green incl. all negative ACs; tsc + biome clean; pure; no `any`.
- New module recorded in blueprint §3. `.pandacorp/verify.sh` passes.
</content>
