---
id: WO-09-002
type: work-order
slug: agent-xp-engine
title: 'WO-09-002 — `lib/gamification.ts`: agent XP/level engine'
status: DRAFT
parent: FRD-09
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-09-002 — `lib/gamification.ts`: agent XP/level engine

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`IF-09-agent-xp`](../blueprint.md#3-components--interfaces).

## Goal
Implement `computeAgentLevel(agentId, events)` in `lib/gamification.ts`: derive an agent's level,
title (Apprentice → Engineer → Senior → Architect), XP, next threshold and pct-to-next **only from
that agent's closed work orders** (events with `agent` + `work_order` + `status: ok`). Consumed by
FRD-07's agents section/detail.

## Acceptance criteria (EARS, from FRD-09 + FRD-07)
- **AC-09-002.1** — `computeAgentLevel(agentId, events)` SHALL return `{ level, title, xp, next, pctToNext }` with `title` from the ladder Apprentice → Engineer → Senior → Architect.
- **AC-09-002.2** — XP SHALL accrue **only** from that agent's completed work orders (each closed WO adds XP), NOT from message/read/tool events or activity volume (negative AC).
- **AC-09-002.3** — WHEN an agent has no closed work orders, the function SHALL return an honest zero state (no fake fill) (negative AC).
- **AC-09-002.4** — The function SHALL be pure and fixture-tested; an unknown `agentId` SHALL return the zero state, not throw.

## Dependencies
- FRD-06/12 `lib/events.ts`. Cross-feature.
- Shares threshold math with WO-09-001 (soft).

## TDD plan
1. RED: tests for level/title/xp from an agent's closed-WO events; a "non-WO events add 0 XP" negative test; "no WOs → zero, not fake"; unknown agent → zero.
2. GREEN: implement.
3. Refactor.

## Definition of done
- `pnpm vitest run lib/gamification.test.ts` green incl. negative ACs; tsc + biome clean; no `any`.
- Pure. `.pandacorp/verify.sh` passes.
</content>
