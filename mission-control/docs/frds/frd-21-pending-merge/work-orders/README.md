# Work orders — FRD-21 Pending-merge visibility

Build order (the Build Plan DAG): the data reader first, then the UI that consumes it.

| WO | Title | Depends on | Status |
|---|---|---|---|
| WO-21-001 | Pending-merge data reader (lib + snapshot wiring) | — | PLANNED |
| WO-21-002 | UI: global shell indicator + cross-project panel + Resumen block | WO-21-001 | PLANNED |

Integration: WO-21-002 consumes the `getPendingMerge()` aggregate published by WO-21-001 (its `## Status
Note` lists the exported reader + types). Both gate together at the FRD-21 review. Not urgent — the data
fills in once the worktree flow is in use (after the plugin update).
