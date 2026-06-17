---
id: WO-04-003
type: work-order
slug: workspace-commands
title: 'WO-04-003 — `lib/next-step.ts`: `workspaceCommands(phase)`'
status: DRAFT
parent: FRD-04
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
# WO-04-003 — `lib/next-step.ts`: `workspaceCommands(phase)`

**Feature:** FRD-04 · **Implements:** IF-04-next-step (`workspaceCommands`) · **REQ-04-005**
**Deploy unit:** additions to `lib/next-step.ts` (+ `lib/next-step.test.ts`). Pure function, no fs, no UI.

## Acceptance criteria (copied)
- **AC-04-005.1** The Commands tab SHALL render the stage-relevant command rows from `lib/next-step.ts`, each with a copy button and a "when to use" description.

## Scope
- Add a **pure** `workspaceCommands(phase: Phase): CommandRow[]` that maps a project phase to the
  stage-relevant command rows shown in the Commands tab, mirroring the approved prototype
  (`commandsBox`):
  - `implementation`/building → `/pandacorp:implement` ("continue/resume the build"),
    `/pandacorp:release` ("when all work orders are done"), `/pandacorp:iterate` ("add an FRD, tweak or fix").
  - `operation`/shipped → `/pandacorp:iterate`, `/pandacorp:new-version` (optional milestone).
  - earlier phases → the single "next step" command (delegates to the existing FRD-02 base map).
- `CommandRow = { command: string; when: string }`.
- **Out of scope:** the copy button (component, shared `CopyButton`), the build mode selector
  (FRD-11), rendering (WO-04-007).

## Dependencies
- **Intra:** none.
- **Cross:** FRD-02 base `lib/next-step.ts` + `Phase` type (FRD-01 `lib/status.ts`).

## TDD (RED → GREEN → refactor)
`lib/next-step.test.ts`:
1. `workspaceCommands("implementation")` returns the three building commands in order (AC-04-005.1).
2. `workspaceCommands("operation")` returns iterate + new-version.
3. An early phase returns the FRD-02 next-step command (delegation, no duplication).
4. Pure: same input → same output, no fs/IO.

## Definition of done
- [x] Tests written first and green.
- [x] No `any`/`@ts-ignore`; function is pure (no fs).
- [x] `bash .pandacorp/verify.sh` passes.

## Status Note

**What was built:** `workspaceCommands(phase: Phase): CommandRow[]` added to `lib/next-step.ts`, plus `CommandRow` interface export. Pure function — no fs, no network, no side effects. Maps a project phase to the stage-relevant command rows for the Commands tab (AC-04-005.1, REQ-04-005, IF-04-next-step).

**Interfaces / contracts exposed:**
```ts
// lib/next-step.ts
export interface CommandRow { command: string; when: string; }
export function workspaceCommands(phase: Phase): CommandRow[];
```
- `implementation` | `release` → 3 rows: `/pandacorp:implement`, `/pandacorp:release`, `/pandacorp:iterate` (building set, deep-copied to prevent caller mutation of module constants)
- `operation` → 2 rows: `/pandacorp:iterate`, `/pandacorp:new-version` (deep-copied)
- `product` | `design` | `architecture` → 1 row delegating to FRD-02 `PHASE_COMMANDS` map (no duplication)
- unknown / undefined / null phase → 1 safe fallback row (`/pandacorp:spec <idea>`) — never throws, never returns empty array (regressions B1', I3)

**Integration seams:**
- Consumer: `CMP-04-tab-commands` (WO-04-007) — import `workspaceCommands` from `"@/lib/next-step"`, pass the `phase` from `.pandacorp/status.yaml` via `readStatus()`.
- `CommandRow` type is also available for `CMP-11-mode-selector` context if needed.

**Test files:**
- `lib/next-step.wo04003.test.ts` — 69 tests (AC-04-005.1 coverage: implementation/release/operation phases, early-phase delegation, pure-function invariants, mapping completeness, regression B1'/I3)
- `lib/next-step.wo04003.adversarial.test.ts` — 19 tests (shared-mutable-state / deep-copy isolation, `when` uniqueness per phase, context-specific iterate `when`, hostile/malformed phase strings, command→when pairing pins)
- **Total: 88/88 GREEN** — `bash .pandacorp/verify.sh` green (3381 pass + 2 expected-fail + 5 skipped; biome clean; tsc clean)
