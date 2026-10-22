# Work orders — FRD-18 Dashboard ("Inicio")

> The authoritative order and parallelism is the **Build Plan** in [`../blueprint.md`](../blueprint.md) (the
> build engine reads that, not this file). This is the readable summary. Source-of-truth hierarchy:
> `FRD > FDD > design-tokens > blueprint > work order`.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-18-002 | inicio-orbita | PLANNED | WO-21-003, WO-03-007, WO-04-013, WO-06-013, WO-13-012, WO-25-001 | The whole Inicio surface: plugin banner, two columns (Tu turno with its Detalles dialog, Tu cartera, En marcha; Pulso, Gremio, Embudo, Árboles de trabajo), the `src/lib/inicio` resolvers and the removal of the digest and the dropped card facts. |

> **Depends on** mirrors the work order's `dependsOn` frontmatter (DR-087).

## Build order

1. **W5 · WO-18-002** - the only work order of this FRD and the join point of the surface. It starts after the
   worktrees card (WO-21-003, W3), the freshness voice (WO-06-013, W3), the decision reader fix (WO-04-013, W3)
   and the Portafolio `ProjectCard` (WO-03-007, W4) are verified.
2. Cross-FRD: **WO-19-003** (FRD-19, W6) reads `ownerTurnItems().count` for the sidebar's Inicio count and
   `lastAchievement()` for the achievement notice; **WO-13-013** (FRD-13, W7) deletes any v1 name left unreferenced.

## AC coverage

The four acceptance criteria of `frd.md`, plus the criteria of other FRDs that the plan assigns to this work
order (they are defined in FRD-15, FRD-06 and FRD-12 and owned here).

| AC | Work order | Requirement |
|---|---|---|
| AC-18-022.1 | WO-18-002 | REQ-18-022 |
| AC-18-022.2 | WO-18-002 | REQ-18-022 |
| AC-18-022.3 | WO-18-002 | REQ-18-022 |
| AC-18-022.4 | WO-18-002 | REQ-18-022 |
| AC-15-002.1 | WO-18-002 | REQ-15-002 (FRD-15) |
| AC-15-002.2 | WO-18-002 | REQ-15-002 (FRD-15) |
| AC-15-002.3 | WO-18-002 | REQ-15-002 (FRD-15) |
| AC-15-004.1 | WO-18-002 | REQ-15-004 (FRD-15) |
| AC-06-019.7 | WO-18-002 | REQ-18-015 (FRD-06) |
| AC-12-001.2 | WO-18-002 | REQ-18-015 (FRD-12) |
| AC-12-001.3 | WO-18-002 | REQ-18-013 (FRD-12) |

## Superseded (v1 history)

- WO-18-001 `inicio-dashboard` - superseded by WO-18-002 (the six-section real-time dashboard with the digest
  "Desde tu última visita"; its code is replaced in place).
