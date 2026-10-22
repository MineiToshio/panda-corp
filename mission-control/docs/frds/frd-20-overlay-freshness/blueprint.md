---
id: FRD-20-blueprint
type: blueprint
parent: FRD-20
status: DRAFT
implementation_status: PLANNED
readiness_gate:
grounding_gate:
consistency_gate:
last_updated: 2026-10-22
---
# FRD-20 Project overlay freshness · feature blueprint (v2 «Órbita»)

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> Per-FRD blueprint (DR-049) on top of [`docs/product/architecture.md`](../../product/architecture.md)
> (read-only invariant and copy accessor §7). Visual contract: [`fdd.md`](./fdd.md) +
> [`mocks/overlay-freshness.html#overlay-behind`](./mocks/overlay-freshness.html).

## 1. Purpose

Tell the owner, at the top of a project's Resumen, that the project's Pandacorp engine (its `.pandacorp/`
overlay, `overlay_version`) is strictly behind the factory's `OVERLAY_VERSION`, with the one command to run
and the folder to run it in. v2 shows only that notice: an up-to-date project and an unknown verdict render
nothing. The verdict is computed server-side per Resumen render from the already-parsed status plus one
small file read; nothing is polled, run or written.

## 2. What v2 keeps, changes and removes

| Kept | Changed | Removed (map §6.C item 22) |
|---|---|---|
| `src/lib/overlay-freshness/overlay-freshness.ts`: `readFactoryOverlayVersion`, `getOverlayFreshness` → `OverlayFreshnessState` (`behind \| up-to-date \| unknown`, both versions, `UPGRADE_COMMAND`), defensive, never throws | `VersionFreshness` becomes a consumer of `Notice` (amber, «Actualización pendiente») + `CommandBox` + the folder line, with the heading and detail of the frozen catalogue | the quiet «Última versión de Pandacorp» ok badge |

## 3. Components and interfaces

| ID | Kind | Responsibility | Path | REQ | WO |
|---|---|---|---|---|---|
| `IF-20-freshness` | lib | The verdict: strict semver compare of the project's `overlay_version` against `plugin/templates/OVERLAY_VERSION` under the factory root; missing or unparseable on either side → `unknown` with a reason. | `src/lib/overlay-freshness/overlay-freshness.ts` | REQ-20-001, REQ-20-003 | WO-20-001 (history) |
| `CMP-20-upgrade-notice` | Server | `VersionFreshness`: `behind` → the amber notice (alert icon, bold heading, detail naming both versions, `/pandacorp:upgrade` in a tinted `CommandBox`, «Córrelo en la carpeta de <Proyecto>»); `up-to-date` and `unknown` → nothing. While the build is live the detail uses the catalogue's `bodyBuilding` variant. | `src/app/projects/[slug]/_components/version-freshness/` | REQ-20-001, REQ-20-002, REQ-20-004 | WO-04-011 |
| Mount | — | First block of the Resumen panel, above «Siguiente paso» and La Fragua. | `src/app/projects/[slug]/_panels/ResumenPanel.tsx` | REQ-20-001 | WO-04-011 |

FRD-20 has no v2 work order of its own: the notice is folded into FRD-04's Resumen work order WO-04-011
(a standalone notice slice would sit under the DR-100 floor, map §4). WO-04-011 owns every FRD-20 AC.

## 4. Contracts

- `getOverlayFreshness(projectOverlayVersion, factoryRoot?)` (unchanged): input the project's
  `overlay_version` (already parsed by `readStatus`) and the factory root (`resolveFactoryRoot`); success an
  `OverlayFreshnessState` with `reason`, `projectVersion`, `factoryVersion`, `upgradeCommand`; no error path
  (every unreadable input is `unknown` with its reason, DR-078 explicit, never a false alarm).
- Notice copy: `workspace.resumen.upgrade.{aria,title,body,bodyBuilding,runIn}` from the frozen catalogue via
  `t()`; the two versions and the project name are data; the term «el motor de Pandacorp» is the owner-facing
  name of the overlay.
- Read-only: no command is executed; the command is text to copy.

## 5. Dependencies and risks

- WO-04-011 (W6) depends on WO-20-001 (W0) and on WO-04-010's panel contract and liveness (the building variant).
- Risk: rendering the ok badge by habit; v2 renders nothing for `up-to-date` (AC-20-001.2 «Out of v2»), tested.

## 6. Traceability

| REQ | AC | Components / interfaces | Work order |
|---|---|---|---|
| REQ-20-001 | AC-20-001.1, AC-20-001.2, AC-20-001.3 | `IF-20-freshness`, `CMP-20-upgrade-notice` | WO-04-011 (WO-20-001 supplies the verdict) |
| REQ-20-002 | AC-20-002.1, AC-20-002.2 | `CMP-20-upgrade-notice` | WO-04-011 |
| REQ-20-003 (no AC bullet) | — | `IF-20-freshness` | WO-20-001 |
| REQ-20-004 | AC-20-004.1 | `CMP-20-upgrade-notice` | WO-04-011 |

## Build Plan

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-20-001 | — | `src/lib/overlay-freshness/overlay-freshness.ts`, `src/lib/overlay-freshness/_tests/overlay-freshness.test.ts` | false | W0 (history, VERIFIED) |

- **Order:** WO-20-001 is VERIFIED history; the notice is built in W6 by FRD-04's WO-04-011
  (`src/app/projects/[slug]/_components/version-freshness/**`), which lists WO-20-001 in its `dependsOn`.
- **Visual spec (DR-054):** `mocks/overlay-freshness.html#overlay-behind` (oracle state `overlay-behind`),
  reproduced by WO-04-011.

## Work Orders

WO-20-001 (W0, VERIFIED). Notice: FRD-04 WO-04-011 (W6). See [`work-orders/README.md`](./work-orders/README.md).

## Superseded (v1 history)

- WO-20-002 `VersionFreshness` badge (Banner consumer), superseded by WO-04-011.

## Readiness check (DR-100)

Every REQ maps to a component or interface; every live FRD-20 AC is owned by exactly one live work order
(WO-04-011, cross-FRD); `dependsOn` acyclic; no shared artifact in W0; no open clarification marker.
