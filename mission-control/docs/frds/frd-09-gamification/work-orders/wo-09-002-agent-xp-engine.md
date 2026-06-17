---
id: WO-09-002
type: work-order
slug: agent-xp-engine
title: 'WO-09-002 — `lib/gamification.ts`: agent XP/level engine'
status: DRAFT
parent: FRD-09
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
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

## Status Note

**Built:** `computeAgentLevel(agentId, events)` added to `/Users/Shared/Proyectos/panda-corp/mission-control/lib/gamification.ts` (existing file — appended to WO-09-005's `classifyCelebration`). Also exported `AGENT_RANKS`, `AGENT_XP_THRESHOLDS`, and `AgentLevelResult` type.

**Contracts / interfaces exposed:**

```ts
// Exported from lib/gamification.ts

export const AGENT_RANKS: readonly ["Apprentice", "Engineer", "Senior", "Architect"];
export type AgentRank = "Apprentice" | "Engineer" | "Senior" | "Architect";

export const AGENT_XP_THRESHOLDS: readonly [number, number, number, number];
// [0]=5 (Engineer), [1]=20 (Senior), [2]=60 (Architect entry), [3]=100 (Architect cap)

export type AgentLevelResult = {
  readonly level: number;      // 1–4
  readonly title: AgentRank;
  readonly xp: number;         // count of this agent's closed WOs
  readonly next: number;       // XP of next threshold (or cap at max)
  readonly pctToNext: number;  // [0, 1] — 0 at level start, 1 at Architect cap
};

export function computeAgentLevel(
  agentId: string,
  events: readonly Event[],  // Event from lib/events.ts
): AgentLevelResult;
```

**XP rule (honesty contract):** +1 XP per event where `agent === agentId` AND `workOrder` is non-empty AND `status === "ok"`. All other events (message, read, write, edit, tool, start, end, handoff, blocked, review, test_ok without workOrder, fail status, wrong agent, no agent) contribute 0 XP. Unknown agentId → zero state, never throws.

**Integration seam (FRD-07):** Import `computeAgentLevel` from `@/lib/gamification`. Pass the full `EventsSnapshot.events` array from `lib/events.ts` and the agent role string. The result drives the agent-level display in FRD-07's agents section/detail.

**Test coverage:** `/Users/Shared/Proyectos/panda-corp/mission-control/lib/gamification.test.ts` — 41 new WO-09-002 tests added to the existing 30 WO-09-005 tests (71 total). Covers all 4 ACs including all negative ACs (11 forbidden event types, wrong-agent, no-agent, fail status, open WO), zero state, purity, immutability, and threshold math. Gate: 71/71 green, tsc clean, biome clean, no `any`.
</content>
