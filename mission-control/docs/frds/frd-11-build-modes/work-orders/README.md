# Work orders — FRD-11 Per-project build modes

> The authoritative order + parallelism is the **Build Plan** in [`../blueprint.md`](../blueprint.md) (the build
> engine reads that, not this). This file is the readable summary. Each WO is a **coarse slice** (one cohesive
> view/capability), carries its own `implementation_status` frontmatter, and copies in its acceptance criteria.
> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| [WO-11-001](./wo-11-001-mode-catalog.md) | mode-catalog | VERIFIED | — | `BUILD_MODES` catalog and the per-project browser store (v1, kept live) |
| [WO-11-003](./wo-11-003-build-mode-picker.md) | build-mode-picker | PLANNED | WO-13-011, WO-11-001 | `BuildModePicker` module: four mode cards, power meter, remembered choice, the command |
| [WO-11-004](./wo-11-004-comandos-tab.md) | comandos-tab | PLANNED | WO-04-010, WO-11-003, WO-12-007 | Comandos tab: next step, mode picker, scoped build target, changes and decisions; removes the inline mode select |

> **Depends on** mirrors each WO's **`dependsOn`** frontmatter (DR-087).

## Build order

- W0: WO-11-001, VERIFIED history, never rebuilt.
- W2: WO-11-003 (module only), so La Campaña (WO-02-020, W3) can mount it.
- W6: WO-11-004 after the workspace frame (WO-04-010, W5), in parallel with the other panel work orders.

## AC coverage

| AC | Work order |
|---|---|
| AC-11-005.1 | WO-11-003 |
| AC-11-005.2 | WO-11-004 |
| AC-11-005.3 | WO-02-020 |

## Superseded (v1 history)

- WO-11-002 BuildModeSelector + Comandos tab, superseded by WO-11-003 and WO-11-004.

## Out of MC scope

REQ-11-004 (the `/pandacorp:implement` skill accepting `pro`, `powerful`, `deep`) is the factory plugin's; Mission
Control only shows the matching command.

## Navigation scope alignment (2026-10-17)

Earlier local tab/detail selection, display-name URLs and bare nested query-link behavior in these historical work orders is superseded by [FRD-25](../../frd-25-persistent-navigation/frd.md). The approved manual slices NAV-01..04 in [its work-order scope](../../frd-25-persistent-navigation/work-orders.md) implement URL/history restoration and identity preservation for this feature. Existing WO status/verification fields remain historical executor-owned state; delivery evidence is recorded separately.
