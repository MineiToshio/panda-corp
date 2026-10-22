# Work orders — FRD-06 La Fragua (live build view)

> The authoritative order + parallelism is the **Build Plan** in [`../blueprint.md`](../blueprint.md) (the build
> engine reads that, not this). This file is the readable summary. Each WO is a **coarse slice** (one cohesive
> view/capability), carries its own `implementation_status` frontmatter, and copies in its acceptance criteria.
> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| [WO-06-012](./wo-06-012-events-enriched-fields.md) | events-enriched-fields | VERIFIED | WO-01-007 | `lib/events` parses the enriched nested-`data` event fields (v1, kept live) |
| [WO-06-013](./wo-06-013-fragua-four-stations.md) | fragua-four-stations | PLANNED | WO-13-012, WO-01-010, WO-25-001, WO-05-001, WO-06-012 | La Fragua four-station scene, the build-signal resolver and the shared `FreshnessBadge` chip |

> **Depends on** mirrors each WO's **`dependsOn`** frontmatter (DR-087).

## Build order

- W2: WO-06-012, VERIFIED history (the parser La Fragua reads), never rebuilt.
- W3: WO-06-013, in parallel with the other W3 surface work orders (disjoint artifacts).
- Integration: WO-04-010 (W5) removes the v1 sprite scene and the Party tab; WO-04-011 (W6) mounts the scene at
  the head of the Resumen; WO-18-002 (W5) reuses the build signal for the shared «Sin señal» rule.

## AC coverage

| AC | Work order |
|---|---|
| AC-06-001.5 | WO-06-013 |
| AC-06-001.6 | WO-06-013 |
| AC-06-002.3 | WO-06-013 |
| AC-06-011.1 | WO-06-013 |
| AC-06-011.2 | WO-06-013 |
| AC-06-011.3 | WO-06-013 |
| AC-06-012.1 | WO-06-013 |
| AC-06-012.2 | WO-06-013 |
| AC-06-012.3 | WO-06-013 |
| AC-06-013.1 | WO-06-013 |
| AC-06-013.2 | WO-06-013 |
| AC-06-013.3 | WO-06-013 |
| AC-06-013.4 | WO-06-013 |
| AC-06-014.1 | WO-06-013 |
| AC-06-018.5 | WO-06-013 |
| AC-06-019.7 | WO-18-002 |
| AC-06-020.1 | WO-04-011 |
| AC-06-020.2 | WO-06-013 |
| AC-06-020.3 | WO-06-013 |
| AC-06-020.4 | WO-06-013 |
| AC-06-020.5 | WO-06-013 |
| AC-06-020.6 | WO-06-013 |
| AC-06-020.7 | WO-06-013 |
| AC-06-020.8 | WO-06-013 |

## Superseded (v1 history)

All superseded by WO-06-013; the v1 code they built is deleted by WO-04-010 (map §6.C item 5):

- WO-06-001 Iconic event vocabulary + event view-model mapper.
- WO-06-002 La Fragua layout (rooms + forge/tribunal/vault slots).
- WO-06-003 Event → visual-action map.
- WO-06-004 La Fragua engine (RAF loop, wave cap, rooms, parchment, gate).
- WO-06-005 La Fragua tab + `FraguaSnapshot`.
- WO-06-007 La Fragua scene re-paint (FraguaScene + PartyScene/PartyTab shell).
