# Work orders — FRD-05 Work orders (live view)

> The authoritative order + parallelism is the **Build Plan** in [`../blueprint.md`](../blueprint.md) (the build
> engine reads that, not this). This file is the readable summary. Each WO is a **coarse slice** (one cohesive
> view/capability), carries its own `implementation_status` frontmatter, and copies in its acceptance criteria.
> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| [WO-05-001](./wo-05-001-work-orders-reader.md) | work-orders-reader | VERIFIED | WO-01-000 | `listWorkOrders` + `readWorkOrderDoc`: the one work-order reader (v1, kept live) |
| [WO-05-002](./wo-05-002-aggregate-progress.md) | aggregate-progress | VERIFIED | WO-05-001 | `aggregateProgress`: the one done/total/% source (v1, kept live) |
| [WO-05-008](./wo-05-008-observabilidad-views.md) | observabilidad-views | PLANNED | WO-04-010, WO-12-007, WO-02-017, WO-05-001, WO-22-002 | Observabilidad frame: Por FRD, Tablero, Dependencias mount, drift badge, live refresh; removes timeline, WoDag and the old tab body |
| [WO-05-009](./wo-05-009-work-order-detail.md) | work-order-detail | PLANNED | WO-04-010, WO-05-002, WO-08-003, WO-12-007 | Work-order detail: Resumen in reading order, fact sheet, Documento completo, not-found; reader detail model and superseded exclusion |

> **Depends on** mirrors each WO's **`dependsOn`** frontmatter (DR-087).

## Build order

- W1-W2: the readers (WO-05-001, WO-05-002), VERIFIED history, never rebuilt.
- W6: WO-05-008 and WO-05-009 in parallel, after the workspace frame (WO-04-010, W5) and the dependency map
  (WO-12-007, W3). They meet only at the `WoDetail({ project, woId, view })` export, which WO-04-010 creates as an
  adapter in W5 (blueprint Contracts).
- Cross-FRD: WO-13-013 (W7) depends on both v2 WOs.

## AC coverage

| AC | Work order |
|---|---|
| AC-05-008.1 | WO-05-008 |
| AC-05-008.2 | WO-05-008 |
| AC-05-008.3 | WO-05-008 |
| AC-05-008.4 | WO-05-009 |

FRD-12 criteria implemented in FRD-05's components are listed in FRD-12's README (owner WO-05-008).

## Superseded (v1 history)

- WO-05-003 Work-orders tab board and detail (re-paint), superseded by WO-05-008 and WO-05-009.
- WO-05-007 Work-orders kanban secondary filter by state, superseded by WO-05-008.

## Navigation scope alignment (2026-10-17)

Earlier local tab/detail selection, display-name URLs and bare nested query-link behavior in these historical work orders is superseded by [FRD-25](../../frd-25-persistent-navigation/frd.md). The approved manual slices NAV-01..04 in [its work-order scope](../../frd-25-persistent-navigation/work-orders.md) implement URL/history restoration and identity preservation for this feature. Existing WO status/verification fields remain historical executor-owned state; delivery evidence is recorded separately.
