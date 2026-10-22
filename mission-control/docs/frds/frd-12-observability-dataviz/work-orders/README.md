# Work orders — FRD-12 Observability and data visualization

> The authoritative order + parallelism is the **Build Plan** in [`../blueprint.md`](../blueprint.md) (the build
> engine reads that, not this). This file is the readable summary. Each WO is a **coarse slice** (one cohesive
> view/capability), carries its own `implementation_status` frontmatter, and copies in its acceptance criteria.
> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| [WO-12-007](./wo-12-007-dependency-map.md) | dependency-map | PLANNED | WO-13-012, WO-25-001, WO-05-001 | Dependencias: deterministic two-level dependency map, chain focus in the URL, narrow lists, and the project FRD index |

> **Depends on** mirrors each WO's **`dependsOn`** frontmatter (DR-087).

## Build order

- W3: WO-12-007, in parallel with the other W3 surface work orders (disjoint artifacts).
- W6: WO-05-008 (FRD-05) mounts the map in the Observabilidad tab and owns the frame, drift badge and live
  criteria of this FRD; WO-05-009 and WO-11-004 read the FRD index.
- Elsewhere: WO-18-002 (W5) owns the freshness and Pulso criteria; WO-04-010 (W5) the legacy-link criterion;
  WO-13-013 (W7) deletes the unmounted `src/app/_observability/**` and removes Dagre.

## AC coverage

| AC | Work order |
|---|---|
| AC-12-001.2 | WO-18-002 |
| AC-12-001.3 | WO-18-002 |
| AC-12-002.1 | WO-05-008 |
| AC-12-002.2 | WO-05-008 |
| AC-12-002.3 | WO-05-008 |
| AC-12-003.3 | WO-05-008 |
| AC-12-004.1 | WO-12-007 |
| AC-12-004.2 | WO-12-007 |
| AC-12-004.3 | WO-12-007 |
| AC-12-004.4 | WO-12-007 |
| AC-12-004.5 | WO-12-007 |
| AC-12-004.6 | WO-12-007 |
| AC-12-004.7 | WO-12-007 |
| AC-12-004.8 | WO-12-007 |
| AC-12-005.1 | WO-05-008 |
| AC-12-005.2 | WO-05-008 |
| AC-12-006.1 | WO-12-007 |
| AC-12-006.2 | WO-12-007 |
| AC-12-006.3 | WO-12-007 |
| AC-12-006.4 | WO-04-010 |

Struck and retired, owned by nobody: AC-12-001.1, AC-12-001.4, AC-12-003.1 (map §8.4).

## Superseded (v1 history)

The v1 gate reviews of this file (2026-06-20 rejected, 2026-06-21 pass) remain in its git history.

- WO-12-001 Top-N cap helper + freshness selector, superseded by WO-13-013.
- WO-12-002 KPI selector, superseded by WO-13-013.
- WO-12-003 Events-per-minute selector, superseded by WO-13-013.
- WO-12-004 Timeline selector, superseded by WO-13-013.
- WO-12-005 Observabilidad tab + Timeline view, superseded by WO-05-008.
- WO-12-006 Work-order DAG view (Dagre), superseded by WO-12-007 and WO-05-008.

## Navigation scope alignment (2026-10-17)

Earlier local tab/detail selection, display-name URLs and bare nested query-link behavior in these historical work orders is superseded by [FRD-25](../../frd-25-persistent-navigation/frd.md). The approved manual slices NAV-01..04 in [its work-order scope](../../frd-25-persistent-navigation/work-orders.md) implement URL/history restoration and identity preservation for this feature. Existing WO status/verification fields remain historical executor-owned state; delivery evidence is recorded separately.
