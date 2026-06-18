---
id: WO-06-002
type: work-order
slug: roster-positions
title: WO-06-002 — La Fragua layout (rooms + forge/tribunal/vault slots)
status: DRAFT
parent: FRD-06
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-18'
---
# WO-06-002 — La Fragua layout (rooms + forge/tribunal/vault slots)

**Components/Interfaces:** `IF-06-fragua-layout`, `IF-06-role-color` · **Traces:** REQ-06-001, REQ-06-003, REQ-06-004, REQ-06-005, REQ-06-007
**Deploy unit:** Party tab (pure logic module) · **Location:** `app/projects/[slug]/_party/layout.ts` (+ `.test.ts`)

> **REOPENED → PLANNED (2026-06-18, La Fragua redesign).** The old build was a 4-zone roster/positions
> layout (library/forge/workshop/lab + wandering cast). The faithful model has **three rooms** (Forja →
> Tribunal → Bóveda) with mode-driven forge slots, a 12-slot tribunal and a 9-slot compacting vault.
> Visual contract: `../../../prototype/party-proposal.html`. See the Status Note below for what changes.

## Acceptance criteria (verbatim EARS)
- AC-06-001.2: THE system SHALL cap the number of concurrently-built (sprite-bearing) work orders at the **wave size of the run mode** (pro = 2, balanced = 4, powerful = 8, deep = 6), reading the mode from state.
- AC-06-003.1: THE system SHALL render three rooms in a linear flow — **Sala de Forja** (left), **Tribunal del Juez** (right), **Bóveda** (bottom shelf) — each with its label, and SHALL NOT render a 3-column kanban.
- AC-06-004.3: THE Tribunal SHALL provide at least **12 non-overlapping slots** (4×3) so up to 11 work orders of a FRD can be judged without sprites overlapping.
- AC-06-005.2: IF the FRD's verified trophies exceed the shelf capacity (9), THEN THE system SHALL compact the overflow into a **"+N archivados"** indicator.
- AC-06-007.1: WHILE the run mode is **deep**, the forge SHALL use **6 wider stations** (2×3) so each WO's test→backend→frontend relay fits without overlap.

## Scope
- `forgeSlots(mode): Pos[]` — 8 normal slots (`FORGE_SLOTS`) / 6 wider deep slots (`DEEP_SLOTS`), ported from the prototype; the slot count caps the rendered wave (AC-06-001.2 / AC-06-007.1).
- `reviewSlots(): Pos[]` — the 12 tribunal slots (4×3, `REVIEW_SLOTS`) + the reviewer home (AC-06-004.3).
- `vaultSlots(): Pos[]` — 9 shelf positions + the "+N archivados" anchor (`VAULT_*`, `MAXVAULT=9`, AC-06-005.2).
- Room rectangles (forge/tribunal/vault) + the connecting paths (`FORGE_OUT→TRIB_IN`, `TRIB_OUT→SHELF_Y`) as typed constants (AC-06-003.1).
- `roleColor(role): string` — build role (`implementer`/`reviewer`/`test-writer`/`backend-dev`/`frontend-dev`) → CSS color token **key** (value owned by FRD-13).
- Remove the obsolete 4-zone `ZONE_ROLE` / `rosterFor` / `mcPositions` (no library/workshop/lab; no roster — one figure per running WO, not per role).

## Dependencies
- FRD-11 mode enum (`pro|balanced|powerful|deep`).
- FRD-01 `lib/status` for the build-mode field type (read elsewhere; here only the enum).
- FRD-13 token keys for `agentColor` (key only; no value coupling).

## TDD / Definition of done
- Tests: each mode yields the expected roster; positions for n=2..6 match the documented shapes and never collide with center; researcher present only in `powerful/deep` rosters; `agentColor` returns a stable key per role.
- Pure, no DOM. Gate green (vitest + tsc + biome).

## Status Note (La Fragua redesign — what the retry must build)

**Why reopened:** the shipped `layout.ts` (the green build below) implements the **fictitious** 4-zone
model — `rosterFor(mode)`, `mcPositions` (corner/column shapes), `ZONE_ROLE` (library/forge/workshop/lab)
and `MCCENTER` handoff routing. The faithful engine builds **FRD by FRD in three rooms**, with one figure
per *running work order* (not per role). The retry replaces the layout per the visual contract
`prototype/party-proposal.html`:

- **Forge slots** keyed by mode: `FORGE_SLOTS` (8, used for pro/balanced/powerful — the slot index caps
  the rendered wave at 2/4/8) and `DEEP_SLOTS` (6 wider 2×3 stations so the deep relay fits).
- **Tribunal** = `REVIEW_SLOTS` (12, 4×3, never overlapping for up to 11 WOs) + `REVIEWER_HOME`.
- **Bóveda** = 9 shelf slots (`VAULT_X0`/`VAULT_DX`/`VAULT_Y`, `MAXVAULT=9`) + the "+N archivados" anchor
  (`VAULT_MORE`).
- **Rooms + paths**: forge/tribunal/vault rectangles and the connectors `FORGE_OUT→TRIB_IN` and
  `TRIB_OUT→SHELF_Y` (linear flow, AC-06-003.1).
- **`roleColor(role)`** replaces `agentColor` with the real build roles only; delegates to FRD-13 tokens.
- **Delete** `ZONE_ROLE`, `rosterFor`, `mcPositions`, `MCCENTER` (no center routing — handoffs are
  station→station via the parchment).

Tests to rewrite accordingly: forge-slot count per mode (wave cap); 12 non-overlapping tribunal slots;
vault compaction at >9; rooms/paths exist; `roleColor` stable per role. Keep pure, no DOM.

---

## Status Note (La Fragua retry — built by this work order)

**Built:** Pure layout module `src/app/projects/[slug]/_party/layout.ts` — the La Fragua faithful model replacing the fictitious 4-zone roster. All prototype coordinates ported verbatim from `prototype/party-proposal.html`.

**Interfaces/contracts exposed:**

```ts
// IF-06-fragua-layout — forge slots (AC-06-001.2, AC-06-007.1)
export const FORGE_SLOTS: readonly Pos[]   // 8 stations (pro/balanced/powerful)
export const DEEP_SLOTS: readonly Pos[]    // 6 wider stations (deep 2×3 relay)
export function forgeSlots(mode: BuildMode): Pos[]
// pro/balanced/powerful → 8 FORGE_SLOTS; deep → 6 DEEP_SLOTS

// IF-06-fragua-layout — tribunal slots (AC-06-004.3)
export const REVIEW_SLOTS: readonly Pos[]  // 12 slots, 4×3 grid
export const REVIEWER_HOME: Pos            // [626, 108]
export function reviewSlots(): Pos[]       // fresh 12-slot array

// IF-06-fragua-layout — vault slots (AC-06-005.2)
export const MAXVAULT = 9
export const VAULT_Y = 492, VAULT_X0 = 112, VAULT_DX = 80
export const VAULT_MORE: Pos               // [820, 465] — "+N archivados" anchor
export function vaultSlots(): VaultLayout  // { slots: Pos[9], moreAnchor, maxVault }

// IF-06-fragua-layout — rooms + paths (AC-06-003.1)
export const FORGE_ROOM: Room              // Sala de Forja bounding rect
export const TRIBUNAL_ROOM: Room           // Tribunal del Juez bounding rect
export const VAULT_ROOM: Room              // Bóveda bounding rect
export const FORGE_OUT: Pos = [450, 170]  // forge exit → tribunal entry
export const TRIB_IN: Pos  = [476, 170]  // tribunal entry
export const TRIB_OUT: Pos = [688, 412]  // tribunal exit → vault drop
export const SHELF_Y = 420               // lateral shelf y-coord

// IF-06-role-color — build role → CSS token key (delegates to FRD-13)
export function roleColor(role: string): string
// implementer→"--color-agent-implementer", reviewer→"--color-agent-reviewer",
// test-writer, backend-dev, frontend-dev; unknown→"--color-agent-unknown"

// Supporting types
export type Pos = [number, number]
export interface Room { x: number; y: number; w: number; h: number }
export type BuildRole = "implementer"|"reviewer"|"test-writer"|"backend-dev"|"frontend-dev"
export interface VaultLayout { slots: Pos[]; moreAnchor: Pos; maxVault: number }

// Compatibility stubs (deprecated — for WO-06-004/005/006 pending redesign)
export type Role = ...  // wider union for pre-existing consumers
export const MCCENTER: Pos        // [380, 285] — deprecated, used by engine.ts
export const ZONE_ROLE: ...       // deprecated, used by PartyScene.tsx
export function rosterFor(mode): Role[]   // deprecated
export function mcPositions(roster, mode): Pos[]  // deprecated
export function agentColor(role): string  // delegates to roleColor()
```

**Integration seams:**
- `forgeSlots(mode)` → consumed by the La Fragua scene (WO-06-006 redesign) to place running WO sprites.
- `reviewSlots()` + `REVIEWER_HOME` → consumed by the tribunal renderer (WO-06-006 redesign).
- `vaultSlots()` → consumed by the Bóveda shelf renderer (WO-06-006 redesign) for trophy compaction.
- `roleColor(role)` → consumed by sprite coloring, relay steps, feed rows, and trophies.
- `FORGE_OUT/TRIB_IN/TRIB_OUT/SHELF_Y` → path waypoints for the WO-06-006 animation engine.
- Compatibility stubs keep `engine.ts` (WO-06-004), `PartyScene.tsx` (WO-06-006), `PartyTab.tsx` (WO-06-005) compiling until their redesign WOs are executed.
- Delegates to `AGENT_COLOR` from `@/app/_design/tokens/tokens` (FRD-13 — already implemented).
- Reads `BuildMode` type from `@/lib/constants` (FRD-11 — already implemented).

**Test coverage:** `src/app/projects/[slug]/_party/_tests/layout.test.ts` — 58 tests across 4 suites:
- `forgeSlots`: 13 tests (slot counts per mode, exact prototype coordinates, uniqueness, freshness)
- `reviewSlots`: 9 tests (12 slots, 4×3 grid, exact coordinates, REVIEWER_HOME, freshness)
- `vaultSlots`: 13 tests (MAXVAULT=9, 9 positions, VAULT_Y/X0/DX spacing, VAULT_MORE, freshness)
- Room constants + paths: 10 tests (Room shape, FORGE_OUT/TRIB_IN/TRIB_OUT/SHELF_Y coordinates, linear flow direction)
- `roleColor`: 13 tests (5 build roles, CSS var prefix, stability, distinct keys, FRD-13 token values, fallback)

**Gate:** 58/58 layout tests GREEN. 181 test files total (4980 passed + 2 expected-fail + 5 skipped; 1 pre-existing failure in agentColorTokens.integration.reviewer.test.ts unrelated to this WO). tsc clean. biome clean on changed files.

---

### Previous build (obsoleted by the redesign — kept for history)

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
