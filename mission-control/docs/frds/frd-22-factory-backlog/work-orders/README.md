# Work orders — FRD-22 Factory backlog surface (Propuestas · Backlog tab)

> The authoritative order and parallelism is the **Build Plan** in [`../blueprint.md`](../blueprint.md) (the
> build engine reads that, not this file). This is the readable summary. Each work order is a coarse slice,
> carries its own `implementation_status` frontmatter and copies in its acceptance criteria. Source-of-truth
> hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-22-001 | backlog-reader | PLANNED | — | Re-verify the backlog reader (fail-loud errors, duplicate ids, severity-then-id order), add the plain-name area helpers and let the bounded discard write record a typed reason. |
| WO-22-002 | backlog-tab-orbita | PLANNED | WO-22-001, WO-13-012, WO-25-001 | The Backlog panel: priority tiles, topic bars, Cómo avanzar, En curso and Abiertos by priority, collapsed history, read-error notice, item dialog and discard confirmation. |

> **Depends on** mirrors each work order's `dependsOn` frontmatter (DR-087).

## Build order

1. **W0 · WO-22-001** - a lane of its own (no dependency): the data layer, no UI.
2. **W3 · WO-22-002** - after WO-13-012 (FRD-13's composite primitives) and WO-22-001.
3. Cross-FRD: **WO-17-008** (FRD-17, W4) mounts `BacklogPanel` inside the Propuestas tabs and delivers the tab
   strip, the "Backlog" count badge and the mounted-panels rule (AC-22-002.1 to AC-22-002.4). **WO-05-008**
   (FRD-05, W6) reuses the core `StateTile` created by WO-22-002.

## AC coverage

Every live acceptance criterion of `frd.md` is owned by exactly one work order.

| AC | Work order | Requirement |
|---|---|---|
| AC-22-001.1 | WO-22-001 | REQ-22-001 |
| AC-22-001.2 | WO-22-002 | REQ-22-001 |
| AC-22-001.3 | WO-22-002 | REQ-22-001 |
| AC-22-002.1 | WO-17-008 | REQ-22-002 |
| AC-22-002.2 | WO-17-008 | REQ-22-002 |
| AC-22-002.3 | WO-17-008 | REQ-22-002 |
| AC-22-002.4 | WO-17-008 | REQ-22-002 |
| AC-22-003.1 | WO-22-002 | REQ-22-003 |
| AC-22-004.1 | WO-22-001 | REQ-22-004 |
| AC-22-004.2 | WO-22-002 | REQ-22-004 |
| AC-22-004.3 | WO-22-001 | REQ-22-004 |
| AC-22-005.1 | WO-22-002 | REQ-22-005 |
| AC-22-005.2 | WO-22-002 | REQ-22-005 |
| AC-22-005.3 | WO-22-002 | REQ-22-005 |
| AC-22-006.1 | WO-22-002 | REQ-22-006 |
| AC-22-006.2 | WO-22-002 | REQ-22-006 |
| AC-22-006.3 | WO-22-002 | REQ-22-006 |
| AC-22-007.1 | WO-22-002 | REQ-22-007 |
| AC-22-007.2 | WO-22-001 | REQ-22-007 |
| AC-22-007.3 | WO-22-002 | REQ-22-007 |
| AC-22-008.1 | WO-22-001 | REQ-22-008 |
| AC-22-009.1 | WO-22-002 | REQ-22-009 |
| AC-22-009.2 | WO-22-002 | REQ-22-009 |
| AC-22-010.1 | WO-22-002 | REQ-22-010 |
| AC-22-010.2 | WO-22-002 | REQ-22-010 |
| AC-22-010.3 | WO-22-002 | REQ-22-010 |
| AC-22-010.4 | WO-22-002 | REQ-22-010 |

## Superseded (v1 history)

None: FRD-22 had no work order before v2.
