---
id: WO-06-002
type: work-order
slug: roster-positions
title: WO-06-002 — Roster + station positions (pure layout)
status: DRAFT
parent: FRD-06
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
# WO-06-002 — Roster + station positions (pure layout)

**Components/Interfaces:** `IF-06-roster`, `IF-06-positions`, `IF-06-agent-color` · **Traces:** REQ-06-001, REQ-06-002, REQ-06-005
**Deploy unit:** Party tab (pure logic module) · **Location:** `app/projects/[slug]/_party/layout.ts` (+ `.test.ts`)

## Acceptance criteria (verbatim EARS)
- AC-06-001.1: The view SHALL show 4 **pixel-art zones** (Research = library, Backend = forge, Frontend = workshop, Testing = lab), each with its label.
- AC-06-002.1: EACH workflow subagent (researcher, backend, frontend, testing) SHALL appear as a **sprite** (its avatar) placed in its zone.
- AC-06-005.1: The researcher is **on demand**: backend and frontend consult it when they need to (it is not a fixed step at the start).

## Scope
- `rosterFor(mode): Role[]` — port `MCROSTER` from the prototype (`pro/balanced/powerful/deep`), typed against FRD-11's mode enum.
- `mcPositions(roster, mode): Pos[]` — port the prototype's pure layout (2-in-column, 4-corner, 3+2, 3+3 deep, ring fallback). Center stays empty (handoffs route through `MCCENTER`).
- `agentColor(role): string` — role → CSS color token **key** (value owned by FRD-13).
- Zone↔role mapping (Research/library, Backend/forge, Frontend/workshop, Testing/lab) as a typed constant.

## Dependencies
- FRD-11 mode enum (`pro|balanced|powerful|deep`).
- FRD-01 `lib/status` for the build-mode field type (read elsewhere; here only the enum).
- FRD-13 token keys for `agentColor` (key only; no value coupling).

## TDD / Definition of done
- Tests: each mode yields the expected roster; positions for n=2..6 match the documented shapes and never collide with center; researcher present only in `powerful/deep` rosters; `agentColor` returns a stable key per role.
- Pure, no DOM. Gate green (vitest + tsc + biome).

## Status Note

**Built:** Pure layout module `app/projects/[slug]/_party/layout.ts` implementing the three interfaces scoped by this work order.

**Interfaces/contracts exposed:**

```ts
// IF-06-roster — build mode → role list
export function rosterFor(mode: BuildMode): Role[]
// pro=2, balanced=4, powerful=6, deep=6; researcher absent in pro/balanced (AC-06-005.1)

// IF-06-positions — roster → pixel-coordinate stations (prototype coordinate system)
export function mcPositions(roster: readonly Role[], mode: BuildMode): Pos[]
// n≤2 → [TC,BC]; n=3 → [T1,T3,BC]; n=4 → [TL,TR,BL,BR]; n=5 → [T1,T2,T3,B1,B2]
// n=6+deep → [T1,T2,T3,[148,408],[380,408],[612,408]]
// n=6+other → [T1,T2,T3,[200,408],[380,408],[560,408]]
// n>6 → ring fallback (mcRing). Never places at MCCENTER=[380,285].

// IF-06-agent-color — role → CSS token key (delegates to FRD-13 AGENT_COLOR)
export function agentColor(role: Role): string
// returns e.g. "--color-agent-researcher"; stable per call

// Zone↔role constant (AC-06-001.1)
export const ZONE_ROLE: Readonly<Record<"library"|"forge"|"workshop"|"lab", Role>>
// library→researcher, forge→backend-dev, workshop→frontend-dev, lab→test-writer

// Supporting types and the stage center
export type Pos = [number, number]
export type Role = "researcher"|"backend-dev"|"frontend-dev"|"test-writer"|"reviewer"|...
export const MCCENTER: Pos  // [380, 285] — handoff routing point, never a station
```

**Integration seams:**
- `rosterFor` consumes `BuildMode` from `@/lib/constants` (FRD-11 — already implemented).
- `agentColor` delegates to `AGENT_COLOR` from `@/app/_design/tokens` (FRD-13 — already implemented).
- `mcPositions` is a pure function; consumers are `CMP-06-scene` (WO-06-006) and future animation engine (WO-06-004).
- `ZONE_ROLE` will be consumed by `CMP-06-scene` to label zones with their names.

**Test coverage:** `app/projects/[slug]/_party/layout.test.ts` — 52 tests across 4 suites:
- `rosterFor`: 13 tests (sizes, researcher presence/absence per mode, immutability, no dupes)
- `mcPositions`: 20 tests (sizes n=1..7, exact coordinates per shape, no center collision, uniqueness, ring fallback, fresh array)
- `agentColor`: 14 tests (CSS var prefix, stability per role, FRD-13 token values, distinct keys)
- `ZONE_ROLE`: 6 tests (4 zones, correct mappings, frozen, non-empty values)

**Gate:** 140 test files, 3821 tests green + 2 expected-fail + 5 skipped. tsc clean. biome clean. Commit `5b7231e`.
