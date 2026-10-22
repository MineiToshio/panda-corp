---
id: WO-09-001
type: work-order
slug: guild-xp-engine
title: 'WO-09-001 — `lib/gamification.ts`: guild XP/level engine (honest)'
status: DRAFT
parent: FRD-09
implementation_status: VERIFIED
artifacts:
  - "src/lib/gamification/gamification.ts"
  - "src/lib/gamification/_tests/gamification.guild.test.ts"
source_requirements: ["FRD-09#U1", "FRD-09#U2", "FRD-09#U4", "FRD-09#U9"]
dependsOn: [WO-01-005, WO-06-012]
last_updated: '2026-10-22'
---
# WO-09-001 — `lib/gamification.ts`: guild XP/level engine (honest)

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`IF-09-guild-xp`](../blueprint.md#components--interfaces).

> **v2 «Órbita» disposition (2026-10-22): KEPT LIVE, already built.** The pure guild XP/level engine is
> unchanged in v2; it feeds the sidebar guild card (WO-19-003) and the Logros hero (WO-10-016) through
> `getGuildState()`. It owns no live acceptance criterion (FRD-09 states these rules as unnumbered
> bullets); its original v1 criteria are kept below as delivery history. The celebration classifier and
> the agent engine that once shared this module are removed in v2 by WO-13-013.

## Goal
Implement `computeGuildLevel(outcomes)` in `lib/gamification.ts` (**new pure module**): derive the
guild's level, title, XP, next threshold and pct-to-next **only from verifiable real outcomes**
(work orders / phases / releases closed, green tests) read via `lib/status.ts` + `lib/events.ts`.

## v1 delivery record

Non-owning history (the criteria this WO was verified against in v1):

- v1 AC-09-001.1: `computeGuildLevel(outcomes)` SHALL return `{ level, title, xp, next, pctToNext }`, with `title` from the rank ladder and `xp` a pure function of the outcome counts.
- v1 AC-09-001.2: XP SHALL be earned by verifiable result (work order / phase / release closed, green tests) and SHALL be zero contribution for activity, app opens, navigation, or trivial volume (negative AC).
- v1 AC-09-001.3: WHEN there are no outcomes, the function SHALL return an honest low/zero state; it SHALL NEVER return a bar artificially stuck near full (e.g. pinned ~80%) (negative AC, FRD-09 forbidden pattern).
- v1 AC-09-001.4: Any streak contribution SHALL be weekly (with a freeze concept), NEVER a daily-reset streak (negative AC).
- v1 AC-09-001.5: The function SHALL be pure (same outcomes → same result), with no time-of-day/decay/engagement term, and fixture-tested.

## Dependencies
- FRD-01 `lib/status.ts` (WO-01-005), FRD-06/12 `lib/events.ts` (WO-06-012): typed outcome inputs.

## TDD plan
1. RED: tests for level/title/xp/next from sample outcomes; a "navigation/app-open adds 0 XP" negative test; a "no outcomes → honest zero, not 80%" test; "streak is weekly not daily".
2. GREEN: implement the pure mapping.
3. Refactor: share threshold math with WO-09-002.

## Definition of done
- `pnpm vitest run lib/gamification.test.ts` green incl. negative ACs; tsc + biome clean; no `any`.
- Pure (no I/O in the function). `.pandacorp/verify.sh` passes.

## Status Note

**What was built:** `computeGuildLevel(outcomes: GuildOutcomes): GuildLevel` in `lib/gamification.ts` — the guild XP/level engine. Pure function, no I/O, no mutation, no clock/decay/engagement bonus. XP derived exclusively from verifiable outcomes: work orders closed, phases completed, releases, green test runs, and optional weekly streak (freeze-capped at 52 weeks). All FRD-09 ethical constraints enforced: no XP for activity/app-open, no daily-reset streak, no bar stuck at ~80%, no leaderboard.

**Interfaces/contracts exposed:**

```ts
// lib/gamification.ts

export type Rank = { readonly title: string; readonly threshold: number };
export const RANKS: readonly Rank[];  // 6 entries: Aprendiz→Maestro del Gremio

export type GuildOutcomes = {
  readonly workOrdersDone: number;
  readonly phasesCompleted: number;
  readonly releases: number;
  readonly greenTestRuns: number;
  readonly weeklyStreak?: number;  // NO dailyStreak — type enforces the weekly-only contract
};

export type GuildLevel = {
  readonly level: number;     // 1-based
  readonly title: string;     // from RANKS ladder
  readonly xp: number;        // total XP (0 when no outcomes)
  readonly next: number;      // next rank threshold (= current at max rank)
  readonly pctToNext: number; // [0, 100]; 0 at zero-state; 100 at max rank
};

export function computeGuildLevel(outcomes: GuildOutcomes): GuildLevel;
```

XP weights: WO closed = 10, phase = 50, release = 200, green test = 1, streak week = 5 (cap 52).

**Also added in this WO** (forward-compatibility for pre-existing `gamification.test.ts` which covers WO-09-002):

```ts
export const AGENT_RANKS: readonly string[];          // ["Apprentice","Engineer","Senior","Architect"]
export const AGENT_XP_THRESHOLDS: readonly number[]; // [5, 20, 60, 100] strictly ascending
export type AgentLevelResult = { level, title, xp, next, pctToNext };
export function computeAgentLevel(agentId: string, events: readonly Event[]): AgentLevelResult;
```

`computeAgentLevel` is a complete implementation (1 XP per closed WO for the agent, `pctToNext` in [0,1] fraction). The pre-existing `gamification.test.ts` (71 tests for WO-09-002) passes.

**Integration seams:**
- Consumer of `computeGuildLevel`: `CMP-09-guild-bar` (WO-09-003, top-bar guild XP block). Import: `import { computeGuildLevel, type GuildLevel, type GuildOutcomes, RANKS } from "@/lib/gamification"`.
- Consumer of `computeAgentLevel`: FRD-07 agent section/detail (WO-09-002 scope).
- Inputs (reconciled 2026-07-05, DR-092/DR-115): `workOrdersDone` comes live from `listWorkOrders(path).state === "done"` summed across the portfolio (`workOrdersDoneLive`, computed by `readGuildState`), NOT from `lib/status.ts`'s cached counter; `phasesCompleted` from `lib/status.ts` (`phase`); `lib/events.ts` supplies `greenTestRuns` (`test_ok` events) and `releases` (portfolio `phase: release`).

**Test files:**
- `lib/gamification.guild.test.ts` — 34 tests for WO-09-001 (AC-09-001.1–5, all negative ACs)
- `lib/gamification.test.ts` — 71 tests covering WO-09-002 + 30 tests for WO-09-005 (classifyCelebration), all green

**v2 note (2026-10-22):** paths today are `src/lib/gamification/gamification.ts` and
`src/lib/gamification/_tests/gamification.guild.test.ts` (the declared `artifacts`). The rank ladder
was later reconciled to the 40-rung granular-level model (blueprint §Rank ladder, superseded WO-09-007).
v2 consumers: WO-19-003 (guild card) and WO-10-016 (Logros hero) through `getGuildState()`.
