# Work orders — FRD-17 Proposals inbox (Propuestas)

> The authoritative order and parallelism is the **Build Plan** in [`../blueprint.md`](../blueprint.md) (the
> build engine reads that, not this file). This is the readable summary. Source-of-truth hierarchy:
> `FRD > FDD > design-tokens > blueprint > work order`. Platform: [`docs/product/architecture.md`](../../../product/architecture.md).

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-17-001 | memory-reader | VERIFIED | — | `lib/memory` lesson reader (parse, status, promotion, eval gate). Kept live as history. |
| WO-17-003 | self-suggest | VERIFIED | WO-17-001 | `lib/self-suggest`: the six local, no-Claude derivations. Kept live as history. |
| WO-17-005 | loop-v2-fields | VERIFIED | WO-17-001 | Loop v2 reader fields (`trigger`, `appliedIn`) and health facts (`lastSweepAt`, `harvestOrphans`). Kept live as history; its v1 UI is replaced in v2. |
| WO-17-008 | propuestas-orbita | PLANNED | WO-13-012, WO-25-001, WO-22-002, WO-17-001, WO-17-003, WO-17-005 | The v2 Propuestas surface: tabs, Resumen to-do, Memoria lesson flow, lesson dialog, the `ownerActions()` resolver (also the sidebar count) and the removal of the v1 streams, memory-health panel and dismissal. |

> **Depends on** mirrors each work order's `dependsOn` frontmatter (DR-087). The `Status` column is the
> `implementation_status` the engine owns.

## Build order

1. **W0 · WO-17-001**, then **W1 · WO-17-003 and WO-17-005** (in parallel, disjoint files): VERIFIED readers,
   not rebuilt.
2. **W4 · WO-17-008** - after WO-22-002 (FRD-22, W3: the Backlog tab it mounts), WO-13-012 (composite
   primitives) and WO-25-001 (URL codec keys). It builds `ownerActions()` first, then Resumen and Memoria,
   then the dialog and the segment validation, and deletes the v1 streams, panel and dismissal in the same
   work order.
3. Cross-FRD: **WO-19-003** (FRD-19, W6) mounts the sidebar Propuestas count from `ownerActions().badgeCount`;
   **WO-22-002** (FRD-22) provides `BacklogPanel`; **WO-13-013** (FRD-13, W7) deletes any v1 name left
   unreferenced.

## AC coverage

The eleven acceptance criteria of `frd.md`, plus the four of FRD-22 that define the tab shell this work order
builds.

| AC | Work order | Requirement |
|---|---|---|
| AC-17-001.1 | WO-17-008 | REQ-17-001 |
| AC-17-001.2 | WO-17-008 | REQ-17-001 |
| AC-17-001.3 | WO-17-008 | REQ-17-001 |
| AC-17-010.1 | WO-17-008 | REQ-17-010 |
| AC-17-010.2 | WO-17-008 | REQ-17-010 |
| AC-17-010.3 | WO-17-008 | REQ-17-010 |
| AC-17-010.4 | WO-17-008 | REQ-17-010 |
| AC-17-011.1 | WO-17-008 | REQ-17-011 |
| AC-17-011.2 | WO-17-008 | REQ-17-011 |
| AC-17-011.3 | WO-17-008 | REQ-17-011 |
| AC-17-011.4 | WO-17-008 | REQ-17-011 |
| AC-22-002.1 | WO-17-008 | REQ-22-002 (FRD-22) |
| AC-22-002.2 | WO-17-008 | REQ-22-002 (FRD-22) |
| AC-22-002.3 | WO-17-008 | REQ-22-002 (FRD-22) |
| AC-22-002.4 | WO-17-008 | REQ-22-002 (FRD-22) |

## Superseded (v1 history)

- WO-17-002 `memory-views` - superseded by WO-17-008 (the derived views are edited under WO-17-008's `src/lib/memory`).
- WO-17-004 `proposals-surface` - superseded by WO-17-008 (four dismissable streams, memory-health panel, badge and chip).
- WO-17-006 `remove-solo-demo-frame` - superseded by WO-17-008 (its target, the `MemoryHealth` panel, is removed).
- WO-17-007 `stream-show-more` - superseded by WO-17-008 (the "ver más" toggle is replaced by the shared `MoreBar`).

## Navigation scope alignment (2026-10-17)

Earlier local tab/detail selection, display-name URLs and bare nested query-link behavior in the historical
work orders is superseded by [FRD-25](../../frd-25-persistent-navigation/frd.md). Existing WO status and
verification fields remain historical executor-owned state.
