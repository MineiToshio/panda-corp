# FRD-11 — Work orders

Implementation chunks for the **per-project build mode selector**, each testable in isolation.
Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
Read [`../blueprint.md`](../blueprint.md) first.

## Work orders

| WO | Title | Layer | Implements |
|---|---|---|---|
| [WO-11-001](./wo-11-001-mode-catalog.md) | `BUILD_MODES` catalog + per-project persistence | lib (TDD) | IF-11-modes, IF-11-mode-store |
| [WO-11-002](./wo-11-002-mode-selector.md) | `CMP-11-mode-selector` selector + command + memory | component | CMP-11-mode-selector |

## Order & parallelization

- **First:** WO-11-001 (the catalog + the persistence helper) — pure/client lib.
- **Then:** WO-11-002 (the selector component) consumes both.
- The selector is **mounted** by FRD-04 `CMP-04-tab-commands` (WO-04-007 reserves the slot).

## Cross-feature dependencies

- **FRD-04** (`CMP-04-tab-commands` mounts the selector; WO-04-007 slot).
- Shared `CopyButton` (FRD-02 component).
- **Out of MC scope:** REQ-11-004 — the `/pandacorp:implement` skill accepting the mode argument is a
  factory-plugin change, not a Mission Control work order (blueprint §5).
