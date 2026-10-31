---
id: WO-02-018
type: work-order
slug: data-model-viewer-orbita
title: WO-02-018 Data-model viewer Órbita restyle and v2 removals
status: ACTIVE
parent: FRD-02
foundation: false
implementation_status: VERIFIED
difficulty: high
reopen_count: 0
artifacts:
  - 'src/components/modules/{DataModelViewer,GraphControls}/**'
  - 'src/hooks/useFullscreen.ts'
  - 'src/hooks/_tests/useFullscreen*.test.ts'
  - 'e2e/model-usability.spec.ts'
  - 'e2e/logical-data-model.spec.ts'
  - 'e2e/persistent-navigation/model.spec.ts'
source_requirements: [REQ-02-015]
dependsOn: [WO-13-012, WO-02-019, WO-25-001]
last_updated: '2026-10-30'
---

# WO-02-018 Data-model viewer Órbita restyle and v2 removals

## Summary

Restyle the shared logical data-model viewer to Órbita on the kept layout engine: Diagrama / Esquema as a
`Segmented` switch (phones open on Esquema), the compact top-right `GraphControls` toolbar (Alejar, percentage,
Acercar, Ajustar a la vista, Restablecer, Pantalla completa with native fullscreen only), search and entity
selection that light related cards and connectors, the folded «Relaciones N» list with explicit cardinalities, the
designed-model line, and the explicit none / missing / single error notice states. It removes the visual
distinctions and interactions the owner left out of v2.

## In Scope

- **Band content** (inside «Modelo de datos», mounted by `ArchitectureDigest` with unchanged props, blueprint
  Contracts C4): the line «Modelo diseñado, no verificado contra una base viva», the stats line (entities ·
  relations · source path), `SearchField` «Buscar entidad o atributo…», `Segmented` Diagrama / Esquema
  (`aria-pressed`, URL key `model`), the hint «Selecciona una entidad para resaltar sus relaciones; vuelve a pulsarla
  para limpiar la selección.», the folded «Relaciones N» list (`from min..max → to min..max`).
- **Diagrama:** content-sized entity cards from the kept geometry (full names and types, 24 px rows, 12 px field
  text, PK/FK/UQ as per-attribute badges), orthogonal routes from the kept engine; selecting an entity outlines it,
  lights the related cards and their connectors and dims the rest; search reveals and centers matches;
  pointer-drag panning of the background, keyboard arrows and labelled directional buttons; text selection prevented
  inside cards and cleared on canvas pointer-down.
- **`GraphControls`** (restyle in place): the compact icon toolbar at the top right (− % + fit reset fullscreen,
  15% button steps, frame-batched wheel/pointer camera of the kept `useFrameView`); «Pantalla completa» requests native
  browser fullscreen on a model-only host within the activating gesture (`useFullscreen`), restores focus to the
  activating control on exit, keeps model and selection, and isolates the project (no other project's model leaks).
- **Esquema:** one column of collapsed accordions («<Entity> N atributos»), one open at a time (native
  `details[name]`), selectable Prisma-like text with attributes, keys and relationship/cardinality text; default view
  on phones (below the phone breakpoint of the shell), Diagrama at desktop and tablet.
- **Relationship selection** through the «Relaciones N» rows: activating a row selects that relationship and lights its
  routed connector and cardinality strokes; activating the selected one again clears it; a relationship only lit by an
  entity neighbourhood is selected first. Canvas connectors are not independently focusable or selectable (AC-02-015.2
  Out of v2); the selected connector's indicator is its stroke, never an outline box.
- **States:** valid model; explicit `persistence: none` («Este proyecto declara explícitamente que no usa base de
  datos.»); valid with no entities; missing source; malformed, oversized, unreadable or unsupported source → ONE
  `Notice` error naming the file and what failed, plus «No se dibuja ningún diagrama hasta que el archivo sea
  válido.»; the rest of Arquitectura stays usable. The async layout loading/error states are WO-02-019's (kept).
- Copy from `t()` (`workspace.arquitectura.dataModel.*`); delete the local `DataModelViewer/copy.es.ts` and
  `GraphControls/copy.es.ts` once unused.
- **Backward compatibility:** `GraphControls` props and the `useFullscreen` export stay compatible while
  `src/app/projects/[slug]/_observability/WoDag/**` still imports them (deleted by WO-05-008 in W6).
- **E2E:** update `e2e/model-usability.spec.ts` and the viewer steps of `e2e/logical-data-model.spec.ts` to the v2
  viewer (Segmented instead of tabs, native fullscreen instead of the «Ampliar modelo» dialog, phones on Esquema). The
  workspace tab-list steps of `e2e/logical-data-model.spec.ts` stay WO-04-010's (W5).

**Removals (map §6.C item 15, §0.6: code, exports and tests here):** the visual distinction of composite-key groups,
isolated entities and self-relations (keys show as per-attribute badges only); the attribute mappings drawn on links;
independently selectable/focusable graph connectors; the viewport-filling fullscreen fallback dialog (the
non-fullscreen expansion path of `useModelExpansion`, the expanded dialog, its search dialog chrome); the lower
inspector and duplicate relationship-button list if any remains.

## Out of Scope

- Idea-page placement (AC-02-015.14, owned by WO-02-016).
- The layout engine and its async lifecycle (kept; flake fixed by WO-02-019 before this WO).
- The reader/validator `src/lib/architecture/data-model/**` (unchanged; WO-02-017 owns `src/lib/architecture`).
- The band heading and the not-published message of Arquitectura (WO-02-017).
- The dependency map (FRD-12, WO-12-007): it no longer uses `GraphControls`.

## Requirements & Acceptance Criteria

Delivers REQ-02-015 and its graph-control consistency amendment, except AC-02-015.11 (WO-02-019).

- **AC-02-015.1** — WHEN a valid version-1 relational or document model is available, THE viewer SHALL display every declared entity, ordered attribute, logical type, optionality, PK/FK/UQ membership as per-attribute badges and composite-key group, preserving isolated entities, self-relations, parallel edges and declared association entities without inventing joins. **Out of v2 (owner decision 2026-10-21):** the visual distinction of composite key groups, isolated entities and self-relations (the keys show as per-attribute badges only).
- **AC-02-015.2** — WHEN a relationship is displayed or selected, THE viewer SHALL preserve both endpoint cardinalities, explicitly labelled `1`, `0..1`, `0..*` or `1..*` (the "Relaciones N" list shows each as `from min..max → to min..max`); it SHALL NOT render a lower relationship inspector or duplicate relationship-button list. **Out of v2 (owner decision 2026-10-21):** the attribute mappings shown on links and the independently selectable graph connectors.
- **AC-02-015.3** — WHEN the viewer opens at desktop or tablet width, THE default SHALL be **Diagrama** (on phones it opens on **Esquema**, amended 2026-10-22), using content-sized entity cards that show full names, attribute names and types without ellipsis, 24px attribute rows and 12px field text; THE viewer SHALL offer native pointer-drag panning of the canvas background, zoom, fit/reset, keyboard arrows and labelled directional buttons without requiring scrollbars to navigate the diagram.
- **AC-02-015.4** — WHEN the owner chooses **Esquema**, THE viewer SHALL display a single column of compact, initially collapsed entity accordions; activating an entity SHALL expand its natural-height, selectable Prisma-like text, attributes, keys and explicit relationship/cardinality text from the same artifact, close any other open entity in that viewer, and permit collapsing it again; this SHALL be a viewing representation, not an executable Prisma schema or an HTML attribute table.
- **AC-02-015.5** — (amended 2026-10-22, v2 reconciliation) WHEN the owner searches an entity/attribute or selects an entity or a relationship (via the "Relaciones N" rows; activating a graph connector is out of v2, consistent with AC-02-015.2), THE viewer SHALL reveal matching entities, center diagram search results and highlight matching/connected graph elements without editing or dropping model data or adding a lower detail panel. Activating the same explicitly selected relationship row again SHALL clear selection. Selected relationships SHALL use the routed line/cardinality strokes as their visual indicator, without an outline around the SVG group bounds; other controls SHALL retain their existing focus indicators. Active expanded search SHALL announce matches or no matches inside its dialog.
- **AC-02-015.6** — WHEN the owner expands the model, THE viewer SHALL request native browser fullscreen ("Pantalla completa") on a model-only host within the activating gesture (**Out of v2 (owner decision 2026-10-21):** the fallback to a viewport-filling diagram dialog when native fullscreen is unavailable or rejected); it SHALL use its own compact top-right icon toolbar (amended 2026-10-22, v2 plan: the dependency map no longer has this toolbar, FRD-12 AC-12-004.5) for zoom, percentage/reset, fit and fullscreen/minimize, with search and click-pan alternatives and no source bands, tabs, visible instructions, legend or lower details; it SHALL preserve its model and selection, provide modal keyboard navigation/Escape, restore the actual activating text/icon trigger focus on close or native fullscreen exit, and prevent another selected project's model from leaking into the view.
- **AC-02-015.7** — WHEN the source is absent, explicitly `persistence: none`, valid with no entities, malformed, oversized, unreadable or unsupported, THE viewer SHALL show the corresponding missing/none/empty/error state and keep the rest of Architecture usable; invalid input SHALL never appear as a valid empty diagram. Malformed, oversized, unsupported and unreadable sources share ONE explicit error notice in Modelo de datos (same copy shape, naming what failed), distinct from the explicit-none state ("Este proyecto declara explícitamente que no usa base de datos.") and from the not-published state.
- **AC-02-015.8** — WHEN a usable designed model is displayed without independent schema verification, THE inline viewer SHALL state **"Modelo diseñado, no verificado contra una base viva"**; phase, timestamps and work-order state SHALL NOT imply operational-schema verification.
- **AC-02-015.9** — WHEN identical project artifacts are opened from the board, portfolio workspace or direct project page, THE system SHALL use the same reader and viewer and SHALL retain all other Architecture sections (REQ-02-013).
- **AC-02-015.10** — WHEN arranging a valid model, THE viewer SHALL use deterministic orthogonal field-port routing, keep every entity nonoverlapping and every connector outside card interiors, retain distinct self/parallel links and center an initially readable, complete connected entity rather than clipping the first table. Ajustar SHALL fit the complete graph; Restablecer SHALL restore the readable starting view. (Unchanged in v2: the owner kept the app's layout engine at M1 2026-10-22; the prototype's simpler masonry layout is not adopted for the data model, and its canvas is compared by computed styles, not pixels.)
- **AC-02-015.12** — WHEN the owner zooms or pans, THE model viewer SHALL use 15% button steps and delta-mode-normalized proportional wheel scaling, batch wheel/pointer updates once per animation frame, retain unchanged entity/edge content and cancel queued frames on direct reset/fit or unmount.
- **AC-02-015.13** — WHEN interacting with inline or expanded diagram entity cards, THE viewer SHALL prevent text selection inside those cards and clear any existing browser selection on canvas pointer-down; expanded schema text SHALL remain selectable.

Reading the Out-of-v2 notes together: AC-02-015.5's relationship activation runs through the «Relaciones N» rows (the
connectors are not separately selectable, AC-02-015.2), with the same toggle and neighbourhood-first semantics; the
"dialog" of the expanded search is the native fullscreen host.

**Completeness (DR-100):** every source state above has a test with a real production-shaped fixture and a malformed
one that must fail loud (DR-078); a fullscreen request rejected by the browser leaves the inline viewer intact and
focused (no fallback dialog); zero search matches are announced politely with the catalogue's wording (no ad-hoc string, DR-130). **NFRs:** accessibility
(Segmented `aria-pressed`, labelled toolbar buttons and directional controls, focus return after fullscreen, Esquema
fully keyboard operable, state never by colour alone), performance (frame-batched camera, memoized cards/edges,
no layout rerun on camera changes, INP within budget), reduced motion (no animated camera transitions under
`prefers-reduced-motion`), fidelity (canvas by computed styles only, owner M1).

## Components

Builds `CMP-02-data-model-viewer`, `CMP-02-graph-controls`, `IF-02-data-model-viewer-props` (unchanged). Reuse first:
`Segmented`, `SearchField`, `Notice`, `Chip` (key badges), `IconButton`, `Icon` (WO-13-011/012); kept modules
`ModelDiagram`, `ModelSchema`, `EntityCard`, `ModelEdges`, `useViewport`, `useFrameView`, `useModelLayout`, layout
engine. Restyle in place: `DataModelViewer`, `GraphControls`, `DiagramControls`. Create nothing new. Installs: none
(`elkjs@0.12.0` stays pinned).

## Visual reference

- **Mock screens:** `docs/frds/frd-02-ideas-board/mocks/ideas-board.html#model-diagram`, `#model-entity-selected`,
  `#model-zoomed-out`, `#model-schema`, `#model-none`, `#model-invalid` (oracle states of the same ids, built under the
  workspace Arquitectura route; the canvas compared by computed styles only).
- **Token slice:** `--surface`, `--surface-2`, `--line`, `--line-strong`, `--text`..`--text-3`, `--blue` / `--teal` /
  `--violet` key badge hues via `data-tone`, `--coral` (error notice), `--r` / `--r-lg` (cards, toolbar), `--shadow-node`,
  `--font-mono` (attribute names, types, Esquema text), `--fs-xs` (12 px field text), `--focus`.
  Reference CSS: 10-segmented, 27-architecture, 14-empty-notice.
- **FDD pointer:** `docs/frds/frd-02-ideas-board/fdd.md` (Screens: Data model, Diagrama; Data model, Esquema; States:
  entity selected, zoomed out, declared no database, unreadable data model; the behaviour-only list).
- **Fidelity criterion:** the built viewer matches `mocks/ideas-board.html` for the states above (structure, toolbar,
  band lines, cards and badges, both themes, 1280/768/375 with Esquema on phones) on the frozen tokens, keeping the
  recorded ids/classes (`#diagram`, `.entity`, `.schema-list`, `.rel-row`); verified by the preview smoke gate (DR-055)
  and the close-out computed-style comparison.

## Tests

- Component: Segmented default by width, search reveal/center + announcement, entity selection highlight, relations
  list toggle semantics, Esquema accordion exclusivity (real browser check in the e2e), none/missing/error states,
  fullscreen request in the gesture + focus return + no fallback dialog (`useFullscreen` unit test).
- E2E: `e2e/model-usability.spec.ts` and the viewer steps of `e2e/logical-data-model.spec.ts` updated as in scope;
  `e2e/persistent-navigation/model.spec.ts` (split out by WO-25-001): the "expanded paste" step asserted the v1
  dialog and now asserts the inline viewer restored from `expanded` with no native fullscreen request until a user
  gesture. The viewer tests that cover this cite AC-25-011.1 (owned by WO-25-001, re-verified here).

### Derogated tests (BL-0051)

- Implementer tests updated or deleted here: `src/components/modules/DataModelViewer/_tests/{DataModelViewer.test.tsx,navigation.test.tsx,viewport.test.tsx}`,
  the GraphControls tests, `e2e/model-usability.spec.ts`, the viewer steps of `e2e/logical-data-model.spec.ts`.
- Reviewer-authored, derogated for the FRD-02 gate reviewer (never edited here): `src/components/modules/DataModelViewer/_tests/fullscreen.ux.reviewer.test.tsx`
  and `fullscreen.consistency.reviewer.test.tsx` (fallback dialog removed), `usability.reviewer.test.tsx` (connector
  selection removed), `viewer.reviewer.test.tsx` and `frame.consistency.reviewer.test.tsx` (where they pin the v1 tab
  pattern or the removed distinctions). The layout/routing reviewer tests (`layout*.reviewer`, `routing.ux.reviewer`,
  `hostile-ids.reviewer`, `async.ux.reviewer`) cover the kept engine and must stay green untouched.

## Dependencies

WO-13-012 (Segmented, SearchField, Notice; leaf primitives through WO-13-011), WO-02-019 (the confirmed layout fix
lands first in the same module). W3 in parallel with WO-02-015, WO-02-017, WO-02-020 (disjoint artifacts). Consumers:
`ArchitectureDigest` (WO-02-017) and the workspace Arquitectura panel (WO-04-010).

## Definition of done

The ACs above pass with tests that fail without the change; the §6.C item 15 removals are gone (code, exports,
tests); the kept engine's reviewer tests stay green; both e2e specs pass hydrated; `.pandacorp/verify.sh --since <ref>`
green; tokens only; every string from `t()`.

## Status Note

- 2026-10-30 (S2B): Built the Segmented viewer, phone schema default, relationship-row selection, key chips, native-only fullscreen and trigger focus return. Kept layout/routing/frame-camera logic. Scoped Vitest (excluding the six derogated presentation/identity reviewer suites) passed: 13 files, 40 tests. `pnpm exec tsc --noEmit --incremental false` passed after fixes. Browser execution and visual fidelity are unverified by task constraint.
- 2026-10-30: Reviewer reconciliation required for fullscreen.ux, fullscreen.consistency, usability, viewer, frame.consistency and modelIdentity (tab/expanded shape), plus navigation v2-boundaries/v2-survivors. No reviewer tests or visual baselines edited. The legacy copy.es export stays because reviewer-owned modelIdentity imports it; some legacy control/loading labels have no frozen catalogue keys and remain in the adapter.
- 2026-10-30 (agent-inferred): Fullscreen focus tests require a stable ref object; replacing the ref on every hook render executes native-exit cleanup and invalidates the test's fullscreen state.

- 2026-10-30: Moved the unchanged AC-02-015.14 ownership cross-reference to Out of Scope, as wave-plan finding 5 requires, so the acceptance extractor does not demand WO-02-016's future test from this work order.

- 2026-10-30: Final combined S2B verification: scoped TypeScript and Biome (47 files) passed; implementer Vitest passed 131 tests / 22 files. The retained layout/routing/async/frame reviewer coverage passed in the separate reviewer run. Remaining reviewer failures are documented in WO-02-017.

- 2026-10-30 (S2B round 2): Search matches are excluded from selection dimming while a query is active. Removed the four dead copy keys, distinguished fit/fullscreen using the existing maximize/external icons, and replaced the scrollbar instruction with controls in diagramAria and the implementer assertions. The independent S2B viewer probe passed without modification. No browser or visual verification was performed.
- 2026-10-30 (S2B round 2 verification): With PORT=3952 and PANDACORP_E2E_PORT=3952, scoped Vitest passed 193 tests in 36 files, including both unchanged s2b.adversarial.reviewer suites (13 tests, also passed separately). TypeScript (`pnpm exec tsc --noEmit --incremental false`) passed; scoped Biome passed 84 files. Knip exited 1 for the three out-of-scope exports recorded in WO-02-017. Browser/E2E and visual fidelity remain unverified. Changes remain uncommitted by owner instruction.
