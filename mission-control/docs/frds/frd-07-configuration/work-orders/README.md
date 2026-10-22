# Work orders — FRD-07 Configuración

> The authoritative order and parallelism is the **Build Plan** in `../blueprint.md` (the build engine reads that, not this). This file is the readable summary. Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`. Platform: [`docs/product/architecture.md`](../../../product/architecture.md).

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-07-001 | reference-skills | VERIFIED | WO-01-001 | History, kept live: `src/lib/reference` skills and agents readers (extended additively by WO-07-006). |
| WO-07-003 | registry | VERIFIED | WO-01-001 | History, kept live: `src/lib/registry` decision-rules reader. |
| WO-07-004 | standards | VERIFIED | WO-01-001 | History, kept live: `src/lib/standards` reader with the derivation fallback. |
| WO-07-006 | configuracion-orbita | PLANNED | WO-13-012, WO-25-001, WO-07-001, WO-07-003, WO-07-004, WO-08-003 | The whole Órbita Configuración surface: hub, four catalogs, filters, dialogs, fail-loud read errors; removes the v1 mini-flow, explainer, creation buttons and agent XP. |

> **Depends on** mirrors each work order's `dependsOn` frontmatter. The three reader work orders carry no live acceptance criterion; WO-07-006 owns all of them.

## AC coverage

| AC | Work order |
|---|---|
| AC-07-013.1 | WO-07-006 |
| AC-07-013.2 | WO-07-006 |
| AC-07-013.3 | WO-07-006 |
| AC-07-013.4 | WO-07-006 |
| AC-07-013.5 | WO-07-006 |

## Build order

1. W2: WO-07-001, WO-07-003, WO-07-004 (VERIFIED history; siblings, disjoint modules).
2. W4: WO-07-006, after the FRD-13 composite primitives (WO-13-012, W2), the URL codec (WO-25-001, W0), the readers and WO-08-003 (W3), which removes Documentación's embed of this surface's v1 components. Deviation from the work-order map (W3): see the blueprint, section 6.
3. WO-13-013 (W7) then deletes `FlowGraph`, the skill-flows data and the agent XP engine, none of which this surface references any more.

## Superseded (v1 history)

- WO-07-005 — Configuración UI surface (re-anchor to prototype). Superseded by WO-07-006.
