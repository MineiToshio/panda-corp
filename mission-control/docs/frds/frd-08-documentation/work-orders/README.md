# Work orders — FRD-08 Documentación

> The authoritative order and parallelism is the **Build Plan** in `../blueprint.md` (the build engine reads that, not this). This file is the readable summary. Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`. Platform: [`docs/product/architecture.md`](../../../product/architecture.md).

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-08-001 | manual-index | VERIFIED | WO-01-001 | History, kept live: `readManualPages()` indexes the authored pages under `content/manual`. |
| WO-08-003 | documentacion-ui | PLANNED | WO-13-012, WO-25-001 | The Documentación UI: home, full-text search with snippets, reader with breadcrumbs, step bar and index at the right, not-found, plus the shared `DocIndex` and `Paper` module. |
| WO-08-004 | documentacion-contenido | PLANNED | WO-13-012, WO-08-001, WO-14-004 | Content refresh and removals: Claude Design sunset wording, retired Mission Control surfaces, guards for REQ-08-013 to REQ-08-019, flow graph and curated explainers off the pages. |

> **Depends on** mirrors each work order's `dependsOn` frontmatter. WO-08-001 and WO-08-004 own no live acceptance criterion; WO-08-003 owns all three.

## AC coverage

| AC | Work order |
|---|---|
| AC-08-020.1 | WO-08-003 |
| AC-08-020.2 | WO-08-003 |
| AC-08-020.3 | WO-08-003 |

## Build order

1. W2: WO-08-001 (VERIFIED history).
2. W3: WO-08-003 and WO-08-004 in parallel (disjoint files; see the blueprint Build Plan). WO-08-004 carries the Manual half of the change card `design-phase-copy-claude-design-sunset.md` (its Campaña half is WO-02-020).
3. After W3: WO-04-012 mounts `DocIndex` and `Paper`; WO-07-006 rewrites Configuración once WO-08-003 removed the Referencia embed; WO-13-013 (W7) deletes `FlowGraph`, the skill-flows data and the dead navigation members.

## Superseded (v1 history)

- WO-08-002 — Documentación UI surface (re-anchor to prototype). Superseded by WO-08-003 and WO-08-004.
