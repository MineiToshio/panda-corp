# FRD-11 — Work orders

Implementation chunks for the **per-project build mode selector + the Comandos tab**.
Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
Read [`../blueprint.md`](../blueprint.md) first — its **Build Plan (Phase 2)** is the live DAG.

## Work orders

| WO | Title | Layer | Status | Implements |
|---|---|---|---|---|
| [WO-11-001](./wo-11-001-mode-catalog.md) | `BUILD_MODES` catalog + per-project persistence | lib (TDD) | VERIFIED | IF-11-modes, IF-11-mode-store |
| [WO-11-002](./wo-11-002-mode-selector.md) | BuildModeSelector + Comandos tab | UI | PLANNED | CMP-11-mode-selector, CMP-04-tab-commands |

## Phase 2 re-plan (2026-06-19)

The data layer (WO-11-001: `BUILD_MODES` catalog + per-project `localStorage` store) is correct and
**VERIFIED** — untouched. **WO-11-002** was re-planned and **widened**: FRD-11 now owns the **whole
Comandos tab** (`_components/{mode-selector,tab-commands}`), re-anchored to the prototype
`projComandos()` (= `buildModePanel()` + `commandsBox()`). The Comandos tab UI moved here from FRD-04's
former WO-04-007. The selector remains a **read/copy-command** surface (not a build trigger).

## Order & parallelization (Phase 2)

- **Lib VERIFIED:** WO-11-001 — not rebuilt.
- **WO-11-002** is the only re-planned WO; it mounts into the FRD-04 workspace via the Tabbar shell seam.
  See `../blueprint.md` → **Build Plan (Phase 2)**.

## Cross-feature dependencies

- **FRD-13** — foundation primitives (`Tabs`/`Panel`/`CmdRow`/`Button`/`Toast`) consumed by the UI WO.
- **FRD-04** — the Comandos tab mounts into the workspace via the Tabbar seam; `workspaceCommands(phase)`
  lives in FRD-04's VERIFIED lib `lib/next-step.ts`.
- **Out of MC scope:** REQ-11-004 — the `/pandacorp:implement` skill accepting the mode argument is a
  factory-plugin change, not a Mission Control work order (blueprint §5).
