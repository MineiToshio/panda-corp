# Work orders — FRD-10 Logros (Achievements Hall)

> The authoritative order and parallelism is the **Build Plan** in `../blueprint.md` (the build engine reads that, not this). This file is the readable summary. Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`. Platform: [`docs/product/architecture.md`](../../../product/architecture.md). Design detail: [`docs/achievements.md`](../../../achievements.md).

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-10-001 | achievements-engine | VERIFIED | WO-01-003, WO-01-005, WO-01-007 | History, kept live: the pure engine (stats, chains, uniques, secrets). |
| WO-10-009 | events-reader-extension | VERIFIED | — | History, kept live: the events reader surfaces the real enriched fields, fail-loud on an unrecognised shape. |
| WO-10-010 | signals-layer | VERIFIED | WO-10-009 | History, kept live: the single derivation of every real-event aggregate. |
| WO-10-011 | catalogue-v2 | VERIFIED | WO-10-010 | History, kept live: the 8-axis catalogue, rarity, Seals, sagas, secrets. |
| WO-10-014 | informe-data-layer | VERIFIED | — | History, kept live: the report readers (flow series, transitions, scalars, usage, funnel, lessons, verdict and next actions). |
| WO-10-016 | logros-orbita | PLANNED | WO-13-012, WO-25-001, WO-23-006, WO-01-010 | Logros frame and four tabs: guild hero, Resumen, Misiones, Trofeos, Rangos; the shared charts; the Estadísticas seam; removes NUEVO, estimated rarity, summit treatment, party roster, chain crown, per-tier date, revealed-secret treatment. |
| WO-10-017 | logros-estadisticas-orbita | PLANNED | WO-10-016, WO-10-014, WO-01-011, WO-18-002 | Estadísticas as the Órbita operator report: verdict and KPIs, records and ledgers, weekly charts, honest usage bands with the unreadable-stream notice, funnel and transitions, health, next action, «sin datos aún» versus «no cableado». |

> **Depends on** mirrors each work order's `dependsOn` frontmatter. Only WO-10-016 and WO-10-017 own live acceptance criteria.

## AC coverage

| AC | Work order |
|---|---|
| AC-10-020.1 | WO-10-017 |
| AC-10-020.2 | WO-10-017 |
| AC-10-020.3 | WO-10-017 |
| AC-10-021.1 | WO-10-017 |
| AC-10-021.2 | WO-10-017 |
| AC-10-021.3 | WO-10-017 |
| AC-10-022.1 | WO-10-017 |
| AC-10-022.2 | WO-10-017 |
| AC-10-022.3 | WO-10-017 |
| AC-10-023.1 | WO-10-017 |
| AC-10-023.2 | WO-10-017 |
| AC-10-023.3 | WO-10-017 |
| AC-10-024.1 | WO-10-017 |
| AC-10-024.2 | WO-10-017 |
| AC-10-025.1 | WO-10-017 |
| AC-10-026.1 | WO-10-017 |
| AC-10-026.2 | WO-10-017 |
| AC-10-027.1 | WO-10-017 |
| AC-10-028.1 | WO-10-016 |
| AC-10-028.2 | WO-10-016 |
| AC-10-028.3 | WO-10-016 |
| AC-10-028.4 | WO-10-016 |
| AC-10-028.5 | WO-10-017 |

## Build order

1. W0: WO-10-009 and WO-10-014 (VERIFIED history, disjoint). W1: WO-10-010. W2: WO-10-011. W3: WO-10-001.
2. W4: WO-10-016, after the FRD-13 primitives, the URL codec, the composed Informe reader WO-23-006 (the last writer of `page.tsx`) and the clock seam WO-01-010.
3. W6: WO-10-017, after WO-10-016, the adopted clock and git seams (WO-01-011, W5) and the dashboard `FunnelRow` (WO-18-002, W5).
4. W7: WO-13-013 deletes the retired primitives once nothing here references them.

## Superseded (v1 history)

- WO-10-005 — Hall surfaces. Superseded by WO-10-016.
- WO-10-006 — Rangos tab. Superseded by WO-10-016.
- WO-10-012 — Render v2. Superseded by WO-10-016.
- WO-10-013 — Missions and sagas standardization. Superseded by WO-10-016.
- WO-10-015 — Informe operativo UI. Superseded by WO-10-017.
