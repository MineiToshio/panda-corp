# FRD-04 — Work orders

Implementation chunks for the **project workspace** shell.
Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
Read [`../blueprint.md`](../blueprint.md) first — its **Build Plan (Phase 2)** is the live DAG.

## Work orders

| WO | Title | Layer | Status | Implements |
|---|---|---|---|---|
| [WO-04-001](./wo-04-001-docs-reader.md) | `lib/docs.ts` — doc tree + raw read + comms readers | lib (TDD) | VERIFIED | IF-04-docs |
| [WO-04-003](./wo-04-003-workspace-commands.md) | `lib/next-step.ts` — `workspaceCommands(phase)` | lib (TDD) | VERIFIED | IF-04-next-step |
| [WO-04-004](./wo-04-004-workspace-shell.md) | Workspace shell: header + tabbar + objectives bar | UI | PLANNED | CMP-04-workspace/header/objectives-bar/tabbar |
| [WO-04-005](./wo-04-005-tab-summary.md) | Resumen + Documentos tabs | UI | PLANNED | CMP-04-tab-summary/decisions/activity-log/tab-documents |

## Phase 2 re-plan (2026-06-19)

The `lib/**` data layer is correct and **VERIFIED** — WO-04-001 / WO-04-003 are untouched. The gap was
**presentational**: the prior UI work orders (shell / summary / documents / commands) were collapsed to
the **coarse** Phase-2 set above and re-anchored to the approved prototype `projectPane()` and the
FRD-13 foundation primitives. Notes:
- WO-04-006 (Documentos tab) **folded into** WO-04-005 (it shares the `lib/docs.ts` reader and the tab seam).
- WO-04-007 (Comandos tab) **moved to FRD-11** — FRD-11 now owns `_components/{mode-selector,tab-commands}`.

## Order & parallelization (Phase 2)

- **Libs already VERIFIED:** WO-04-001, WO-04-003 — not rebuilt.
- **WO-04-004** (shell) first — it provides the **Tabbar mount seam** that every tab FRD plugs into.
- **WO-04-005** (Resumen + Documentos) after the shell (mounted into its tab bodies).
- See `../blueprint.md` → **Build Plan (Phase 2)** for the coarse DAG, parallelism and cross-FRD deps.

## Cross-feature dependencies

- **FRD-13** — the foundation primitives (`Tabs`/`ProgressBar`/`Chip`/`CountBadge`/`Panel`/`CmdRow`/
  `Button`/`Toast`/`DocHeading`) every UI WO consumes (reuse-before-create).
- **FRD-01** (data layer): `lib/config.ts`, `lib/status.ts`, `lib/portfolio.ts`.
- **FRD-02** (`lib/next-step.ts` base) — WO-04-003 extends it.
- **FRD-03** (portfolio rail) — provides the selected `slug` that opens this workspace.
- **FRD-05 / FRD-06 / FRD-11 / FRD-12 / FRD-14** — mounted tabs/panels/selector; FRD-04 provides the seam.
