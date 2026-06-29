---
id: WO-10-010
type: work-order
slug: signals-layer
title: 'WO-10-010 — Signals layer: derive real-signal counters/flags from the event stream'
status: ACTIVE
parent: FRD-10
implementation_status: IN_PROGRESS
source_requirements: []
artifacts: [src/lib/achievements/signals.ts, src/lib/achievements/stats.ts, src/lib/achievements/_tests/**]
difficulty: high
dependsOn: [WO-10-009]
last_updated: '2026-06-29'
---
# WO-10-010 — Signals layer: derive real-signal counters/flags

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. Real-signal map in
[`docs/achievements.md`](../../../achievements.md) §1; chains in §6.

## Goal
A single pure derivation module that turns the (now-richer) `ReaderData` into the **real-signal
aggregates** the catalogue needs — so the ~80 trophies / ~21 chains read ONE shared derivation
(DR-092), never re-derive per predicate. Reuse the existing event classification in
`lib/gamification/gamification.ts` where it already derives a real outcome (DR-092 — do not duplicate).

## In Scope
- `lib/achievements/signals.ts` (new pure module) computing, from `ReaderData`:
  - **counts:** green WOs (`AgentDone result=green`), builds completed (`BuildComplete`), builds
    launched, relaunches, subagents stopped, gate PASS, review APPROVED, findings, distinct
    roles/agents, distinct build modes, distinct active UTC days.
  - **records/flags:** longest weekly streak; earliest/ latest time-of-day of a green WO; same-day
    multi-phase; max `maxAgents`; any `effortLevel=xhigh`; reopen-then-pass; ≥N relaunch then
    complete; etc. (the §3/§5 predicates consume these).
  - **first-event lookups** with their real `at` + `project` for unlock date/project stamping.
- Extend `computeStats` with the NEW chain stat keys (`builds`, `subagents`, `specs`, `gates`,
  `reviews`, `findings`, `modes`, `relaunches`, `activedays`) re-anchored to real signals, and
  **re-anchor** the existing event-based keys (`workorders`, `flawless`, `iterations`, `agents`,
  `streak`, `speed`) to the real vocabulary (no more `task="…"` reads that never fire).
- **Honesty:** never fabricate a date/value; an aggregate with no source is an honest 0 / null.

## Out of Scope
- The catalogue tables + predicates (WO-10-011) — this WO only provides the derivation they call.
- Rendering (WO-10-012).

## Acceptance criteria (EARS)
- **AC-10-010.1** — `signals(data)` SHALL derive every aggregate above from the REAL event vocabulary (no `achievement`/`task=` reads), pure, fixture-tested.
- **AC-10-010.2** — Each first-event lookup SHALL carry the source `at`/`project`; when no verifiable timestamp exists, date SHALL be omitted (never fabricated) — DR-078/honesty.
- **AC-10-010.3** — `computeStats` SHALL return the new + re-anchored keys; an empty factory → honest zeros (negative AC).
- **AC-10-010.4** — Shared derivation reused (DR-092): the existing `gamification.ts` outcome classification SHALL NOT be re-implemented here.

## TDD plan
RED: fixtures of real event streams → assert each aggregate; empty-factory zeros; no-fabricated-date. GREEN: implement. Refactor; files ≤500 lines (split signals by family if needed).

## Definition of done
`pnpm vitest run lib/achievements` green; tsc + biome clean; pure; no `any`; `.pandacorp/verify.sh` passes.
