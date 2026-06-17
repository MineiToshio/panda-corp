---
id: WO-11-001
type: work-order
slug: mode-catalog
title: WO-11-001 — `BUILD_MODES` catalog + per-project persistence
status: DRAFT
parent: FRD-11
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-17'
---
# WO-11-001 — `BUILD_MODES` catalog + per-project persistence

**Feature:** FRD-11 · **Implements:** IF-11-modes, IF-11-mode-store · **REQ-11-001, REQ-11-003**
**Deploy unit:** `lib/constants.ts` (catalog) + a `"use client"` mode-store helper + colocated tests.

## Acceptance criteria (copied)
- **AC-11-001.1** The selector SHALL render four mode options in order: Pro/economical, Balanced, Powerful, Deep.
- **AC-11-001.3** The default selected mode SHALL be Balanced when no mode has been chosen.
- **AC-11-003.1** The chosen mode SHALL persist per project across refresh and tab close (client-local UI state, NOT a factory/project write).
- **AC-11-003.2** Re-opening the project's Commands tab SHALL restore its remembered mode.

> This WO provides the **data**: the catalog (order + defaults) and the persistence helper. The UI is WO-11-002.

## Scope
- `BUILD_MODES: readonly BuildModeInfo[]` in `lib/constants.ts` — four entries in order
  (pro, balanced, powerful, deep), each `{ id, label, description, command }`, with `command` =
  `/pandacorp:implement` (balanced) / `/pandacorp:implement <mode>` (others). i18n keys for label/description.
- `DEFAULT_BUILD_MODE = "balanced"`.
- `getRememberedMode(slug)` / `rememberMode(slug, mode)` over `localStorage`, keyed by slug;
  `getRememberedMode` returns `DEFAULT_BUILD_MODE` when unset or on parse error.
- **No write to `status.yaml`** — client-local only (architecture §4.8). Read-only invariant intact.
- **Out of scope:** the selector UI (WO-11-002).

## Dependencies
- **Intra:** none.
- **Cross:** none.

## TDD (RED → GREEN → refactor)
1. `BUILD_MODES` has four entries in the exact order; balanced's command is `/pandacorp:implement`,
   others carry their mode argument (AC-11-001.1).
2. `DEFAULT_BUILD_MODE === "balanced"` (AC-11-001.3).
3. `getRememberedMode` returns the default when storage is empty; returns the stored mode after
   `rememberMode` (AC-11-003.1/.2). Test with a jsdom `localStorage`.
4. Corrupt stored value → falls back to default, no throw.

## Definition of done
- [x] Tests written first and green.
- [x] Catalog in `lib/constants.ts` (no magic strings); types strict (`BuildMode` union).
- [x] No `status.yaml` / factory write; persistence is `localStorage` only.
- [x] `bash .pandacorp/verify.sh` passes.

## Evidence
`bash .pandacorp/verify.sh` — 2026-06-17 — all gates green: biome (0 errors), tsc --noEmit (exit 0), vitest 3492 passed / 2 expected-fail / 5 skipped (123 files). Original implementation at `3e5b02d` (feat), deep-freeze fix at `ad43d7e` (fix). Integration wiring (`page.tsx` → `TabCommands`, `tab-commands-body` testid deconflict) committed in this session.

## Status Note

**What was built:** IF-11-modes (`BUILD_MODES` catalog) + IF-11-mode-store (`getRememberedMode`/`rememberMode`) + integration of `TabCommands` into `page.tsx` (closing the AC-04-005.1/.2 integration seam that was left as a placeholder).

**Files delivered:**

- `/Users/Shared/Proyectos/panda-corp/mission-control/lib/constants.ts` — `BUILD_MODES: readonly BuildModeInfo[]`, `DEFAULT_BUILD_MODE: BuildMode`, `BuildMode` union type, `BuildModeInfo` interface. Four entries in EARS order: pro, balanced, powerful, deep. Deep-frozen (outer array + each entry object). Balanced command = `/pandacorp:implement` (no arg); others = `/pandacorp:implement <id>`.
- `/Users/Shared/Proyectos/panda-corp/mission-control/lib/build-mode-store.ts` — `"use client"` module; `getRememberedMode(slug): BuildMode` (localStorage, keyed `mc:build-mode:<slug>`, falls back to `DEFAULT_BUILD_MODE` on any error/corrupt/unknown value); `rememberMode(slug, mode): void` (localStorage, silent on error). No fs writes.
- `/Users/Shared/Proyectos/panda-corp/mission-control/app/projects/[slug]/page.tsx` — replaced `CommandsTabPlaceholder` with `<TabCommands phase={stage as Phase} slug={slug} />`. Removed unused placeholder function.
- `/Users/Shared/Proyectos/panda-corp/mission-control/app/projects/[slug]/_components/tab-commands.tsx` — renamed root `data-testid` from `"tab-commands"` to `"tab-commands-body"` to eliminate collision with TabBar's `tab-${id}` testid scheme.

**Interfaces/contracts exposed:**

```ts
// lib/constants.ts (IF-11-modes)
export type BuildMode = "pro" | "balanced" | "powerful" | "deep";
export interface BuildModeInfo { id: BuildMode; label: string; description: string; command: string; }
export const BUILD_MODES: readonly BuildModeInfo[];   // 4 entries, deep-frozen
export const DEFAULT_BUILD_MODE: BuildMode;           // "balanced"

// lib/build-mode-store.ts (IF-11-mode-store, "use client")
export function getRememberedMode(slug: string): BuildMode;
export function rememberMode(slug: string, mode: BuildMode): void;
```

**Integration seams:**

- `WO-11-002` (CMP-11-mode-selector): import `BUILD_MODES`, `DEFAULT_BUILD_MODE` from `@/lib/constants` and `getRememberedMode`, `rememberMode` from `@/lib/build-mode-store`. Mount inside `ModeSelectorSlot` in `tab-commands.tsx` (replace `ModeSelectorSlot` body with `<ModeSelector slug={slug} />`).
- `page.tsx` now passes `phase` and `slug` to `TabCommands`; `tab-commands-body` is the root testid for integration assertions.

**data-testid map (for WO-11-002 and integration tests):**

- `mode-selector-slot` — the placeholder/real selector section at the top of TabCommands (AC-04-005.2)
- `tab-commands-body` — root `<main>` of TabCommands (renamed from `tab-commands` to avoid collision with TabBar's `tab-commands` link testid)
- `commands-list`, `command-row`, `command-row-command`, `command-row-description` — command rows

**Test coverage:**

- `lib/build-modes.test.ts` — 41 tests (catalog order, default, mode-store round-trip, regression anchors B1'/I2/I3/FREEZE-ON-RED)
- `lib/build-modes.adversarial.test.ts` — 20 tests (hostile stored values, isolation, write-path throw-safety, deep-freeze catalog integrity)
- `app/projects/[slug]/page.reviewer.test.tsx` — 4 integration tests including AC-04-005.1 (real command rows) and AC-04-005.2 (mode-selector-slot present), now all GREEN

**verify.sh:** `bash .pandacorp/verify.sh` — 2026-06-17 — biome clean, tsc clean, 3492 tests pass (123 files, 0 failures).
