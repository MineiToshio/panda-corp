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
- [ ] Tests written first and green.
- [ ] Catalog in `lib/constants.ts` (no magic strings); types strict (`BuildMode` union).
- [ ] No `status.yaml` / factory write; persistence is `localStorage` only.
- [ ] `bash .pandacorp/verify.sh` passes.
