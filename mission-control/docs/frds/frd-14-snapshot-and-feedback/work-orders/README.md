# Work orders — FRD-14 Probable snapshot and feedback channels

> The authoritative order and parallelism is the **Build Plan** in [`../blueprint.md`](../blueprint.md) (the
> build engine reads that, not this). Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| [WO-14-004](./wo-14-004-feedback-channels-doc.md) | feedback-channels-doc | VERIFIED | — | Kept live: the Documentación guide explaining the three feedback channels (owns AC-14-003.3). |
| [WO-14-001](./wo-14-001-snapshot-helpers.md) | snapshot-helpers | VERIFIED | WO-01-005 | History, kept live: `buildSnapshot` + `isSnapshotStale` pure helpers. |
| [WO-14-005](./wo-14-005-snapshot-panel-orbita.md) | snapshot-panel-orbita | PLANNED | WO-13-012, WO-01-010 | Órbita «Último commit en verde» panel + the read-only git gap probe (stale and no-signal states). |

> **Depends on** mirrors each work order's `dependsOn` frontmatter.

## AC coverage

| AC | Work order |
|---|---|
| AC-14-001.1 | WO-14-005 |
| AC-14-001.2 | WO-14-005 |
| AC-14-001.3 | WO-14-005 |
| AC-14-002.1 | WO-14-005 |
| AC-14-002.2 | WO-14-005 |
| AC-14-003.1 | WO-03-007 |
| AC-14-003.2 | WO-03-007 |
| AC-14-003.3 | WO-14-004 |

AC-14-003.1 and AC-14-003.2 are «Out of v2» rail behaviours, owned cross-FRD by FRD-03's WO-03-007, which
removes the rail and verifies their absence. AC-14-004.1 and AC-14-005.1 are struck (retired ids, not owned).

## Build order

1. W0: WO-14-004 (VERIFIED). W3: WO-14-001 (VERIFIED history).
2. W3: WO-14-005, after WO-13-012 (W2) and WO-01-010 (W2).
3. W6: FRD-04's WO-04-011 mounts the panel in the Resumen.

## Superseded (v1 history)

- WO-14-002 — SnapshotPanel: último commit en verde + worktree command (v1 skin). Superseded by WO-14-005.
- WO-14-003 — `CMP-14-status-chips`: decisions/bugs/rethink chips on the rail. Superseded by WO-03-007.
