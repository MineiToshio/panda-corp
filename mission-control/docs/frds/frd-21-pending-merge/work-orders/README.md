# Work orders — FRD-21 Pending-merge visibility

> The authoritative order and parallelism is the **Build Plan** in [`../blueprint.md`](../blueprint.md) (the
> build engine reads that, not this file). This is the readable summary. Source-of-truth hierarchy:
> `FRD > FDD > design-tokens > blueprint > work order`.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-21-003 | worktrees-by-repo | PLANNED | WO-01-010, WO-13-012 | Per-repository reader of un-merged branches and leftover worktrees with the legend-rule state, the pill summary, the Inicio card "Árboles de trabajo" and its branch dialog. |

> **Depends on** mirrors the work order's `dependsOn` frontmatter (DR-087).

## Build order

1. **W3 · WO-21-003** - after WO-01-010 (clock and git seams, W2) and WO-13-012 (composite primitives, W2).
2. Cross-FRD: **WO-18-002** (FRD-18, W5) places the card in Inicio's right column; **WO-19-003** (FRD-19, W6)
   builds the sidebar pill from `pendingPillSummary()` and the `worktrees-card` anchor and owns
   AC-21-008.1 and AC-21-008.2; **WO-04-011** (FRD-04, W6) removes the Resumen block (REQ-21-004).

## AC coverage

| AC | Work order | Requirement |
|---|---|---|
| AC-21-007.1 | WO-21-003 | REQ-21-007 |
| AC-21-007.2 | WO-21-003 | REQ-21-007 |
| AC-21-007.3 | WO-21-003 | REQ-21-007 |
| AC-21-008.1 | WO-19-003 | REQ-21-008 |
| AC-21-008.2 | WO-19-003 | REQ-21-008 |

## Superseded (v1 history)

- WO-21-001 `pending-merge-reader` - superseded by WO-21-003 (its code stays until WO-13-013 deletes it).
- WO-21-002 `pending-merge-ui` - superseded by WO-21-003 (the Inicio card) and WO-19-003 (the sidebar pill); the top-bar indicator and the Resumen block are removed in v2.
