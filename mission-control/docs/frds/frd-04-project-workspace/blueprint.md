---
id: FRD-04-blueprint
type: blueprint
parent: FRD-04
status: DRAFT
implementation_status: PLANNED
readiness_gate:
grounding_gate:
consistency_gate:
last_updated: 2026-10-22
---
# FRD-04 Project workspace · feature blueprint (v2 «Órbita»)

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> Per-FRD blueprint (DR-049): how THIS feature is built on top of the platform
> ([`docs/product/architecture.md`](../../product/architecture.md): stack §2, data layer §6, cross-cutting
> §7, route map). It does not restate the platform. Visual contract: [`fdd.md`](./fdd.md) +
> [`mocks/project-workspace.html`](./mocks/project-workspace.html) and the oracle states listed per work
> order below; frozen design system `DESIGN.md`, `docs/design/components.md`, `docs/design/microcopy.es.json`.

## 1. Purpose

The project workspace is what opens for one project from the Portafolio, the sidebar or the project
picker. v2 rebuilds it on the Órbita contract: one frame (crumbs, `ProjectHero` on Resumen and
`ProjectHeroCompact` elsewhere, the eight-tab bar with count badges) and eight panels (Resumen · Spec ·
Observabilidad · Arquitectura · Cuentas · Cambios · Documentos · Comandos). There is no Party tab (La
Fragua heads the Resumen, FRD-06) and no Work orders tab (work orders are Observabilidad's views,
FRD-05). FRD-04 owns the frame, the panel contract, the Spec / Arquitectura / Cuentas mounts, the Resumen,
Cambios and Documentos panels and the decision reader fix; Observabilidad (FRD-05/12) and Comandos
(FRD-11) are mounted through the panel contract and rewritten by their own work orders.

## 2. What v2 keeps, changes and removes

| Kept (live code, unchanged contract) | Changed in v2 | Removed in v2 (map §6.C, §0.6) |
|---|---|---|
| `src/lib/docs/tree.ts` (`listProjectDocs`, `readDoc`, `countFrdFolders`), `src/lib/docs/activity.ts` (`readActivityLog`, `readDecisions`, `parseDecisionBlocks`, `countPendingDecisions`), `src/lib/next-step/next-step.ts` (`nextStep`, `workspaceCommands`), `src/lib/changes/changes.ts` (`readChangeQueue`), the discard-change Server Action and its bounded write, `document-links.ts`, `WorkspaceNavigation.tsx` | tab ids and order (eight, URL ids `summary · spec · observability · architecture · accounts · changes · documents · commands`); header (hero / compact hero); tab badges; Resumen composition; Cambios groups, state strip and dialog; Documentos index by purpose; absolute change dates (REQ-04-011); decision reader honours an in-entry resolution | Party tab and the whole sprite scene (`_party/**`, `src/components/modules/party/**`, their tests); the separate Work orders tab entry; `ObjectivesBar`; the header's deploy target; the Resumen deploy row, «Pendientes de merge» block, «Obsoleta» tag and the quiet «Última versión» badge; the `implemented_sha`/`closing_at` evidence; the relative change-card date (`formatChangeDate`) |

## 3. Components and interfaces

| ID | Kind | Responsibility | Path | REQ | WO |
|---|---|---|---|---|---|
| `CMP-04-workspace` | Server | The frame: resolves the project, builds `WorkspaceProject`, renders crumbs, hero or compact hero, the tab bar and the selected panel; unknown tab renders the not-found card under the compact header. Keeps its exported props for the Portafolio host. | `src/app/projects/[slug]/ProjectWorkspace.tsx`, `page.tsx`, `[...segments]/page.tsx`, `workspace-route.ts` | REQ-04-001, REQ-04-002 | WO-04-010 |
| `CMP-04-tabbar` | Client | The eight tabs on the shared `Tabs` (icon, hue, count badge, overflow arrows, arrow keys, selected tab scrolled into view), URL-driven through the codec. | `_components/tabbar.tsx` | REQ-04-002, AC-04-014.2 | WO-04-010 |
| `CMP-04-project-hero` | Server | `ProjectHero`: avatar, phase chip, version chip, build chip, h1, `ProjectSwitcher`, clamped subtitle, hero stats (ring + verified n/m, FRDs, documentos, ADRs, cambios abiertos, último movimiento), full `PhaseStepper`. Resumen only. | `_components/ProjectHero/` | REQ-04-001, AC-04-014.1, AC-04-014.3 | WO-04-010 |
| `CMP-04-project-hero-compact` | Server | `ProjectHeroCompact`: initials, name, phase chip, «n/m WO · pct», compact stepper, `ProjectSwitcher`. Every tab but Resumen. | `_components/ProjectHeroCompact/` | REQ-04-003, AC-04-014.1 | WO-04-010 |
| `IF-04-workspace-project` | Server module | `loadWorkspaceProject(item)`: the ONE request-scoped resolver (`React.cache()`) of every fact the frame, the badges, the heroes and the panels share (§4.1). | `_panels/workspaceProject.ts` | REQ-04-002, REQ-04-003, AC-04-014.2 | WO-04-010 |
| `IF-04-panel-contract` | Type + registry | `PanelProps` and the eight panel files (§4.2). | `_panels/*.tsx`, `_panels/types.ts` | REQ-04-001, REQ-04-002 | WO-04-010 (all eight created); WO-04-011, WO-04-012, WO-05-008, WO-11-004 rewrite theirs |
| `CMP-04-panel-spec` | Server | Spec panel: the shared `SpecDigest` (FRD-02) via the thin client link adapter `tab-spec.tsx`, live FRD count, project-scoped document links; «El spec todavía no está publicado.» state with «PRD completo» and the real FRD cards. | `_panels/SpecPanel.tsx`, `_components/tab-spec.tsx` | REQ-04-013 | WO-04-010 |
| `CMP-04-panel-architecture` | Server | Arquitectura panel: the shared `ArchitectureDigest` + `DataModelViewer` from `readArchitectureArtifacts`, keyed by project path; partial and error states of FRD-02. | `_panels/ArquitecturaPanel.tsx` | REQ-04-012 | WO-04-010 |
| `CMP-04-panel-accounts` | Server | Cuentas panel: the shared `AccountsTable` (FRD-26) filtered to this project. | `_panels/CuentasPanel.tsx` | REQ-04-002 | WO-04-010 |
| `CMP-04-section-not-found` | Server | «Esta sección no existe» card with «Ir al resumen» under the compact header. | `_panels/SectionNotFound.tsx` | REQ-04-002 | WO-04-010 |
| `CMP-04-resumen` | Server | Resumen panel: upgrade notice (FRD-20), «Siguiente paso», `FraguaScene` (FRD-06), `SnapshotPanel` (FRD-14), then two columns (Avance por FRD + Decisiones │ Tu turno + Últimos avances, Tu turno first below 1024 px) and the collapsed «Bitácora técnica del motor». | `_panels/ResumenPanel.tsx`, `_components/tab-summary/` | REQ-04-004, REQ-04-005, AC-04-014.3 to .7 | WO-04-011 |
| `CMP-04-frd-progress` | Server | «Avance por FRD»: `ListRow` per FRD with `StackBar` and n/m, unfinished first, eight shown, «N FRDs en total» + «Ver todos» to Observabilidad. | `_components/tab-summary/` | AC-04-014.4 | WO-04-011 |
| `CMP-04-decisions` | Client island | «Decisiones» list (Resuelta / Pendiente chip, «ya resuelta en el archivo», engine-log entries hidden with their count) and the decision dialog (kicker «Decisión · <Proyecto>», chips, the capture sentence, scoped `/pandacorp:decide <id>`, «Abrir <Proyecto>»). | `_components/tab-summary/` | REQ-04-004, FRD-04#U1, FRD-04#U2, AC-04-014.5 | WO-04-011 |
| `CMP-04-progress-list` | Server | `ProgressList`: «Últimos avances» from verified work orders (build track) and filed/started changes only. | `_components/ProgressList/` | AC-04-014.7 | WO-04-011 |
| `CMP-20-upgrade-notice` | Server | `VersionFreshness`, a consumer of `Notice` + `CommandBox` (FRD-20; built here). | `_components/version-freshness/` | REQ-20-001..004 | WO-04-011 |
| `CMP-04-changes` | Server + client island | Cambios panel: fail-loud banner, state strip, groups (Listos para construir, En construcción, Cerrando, Borradores), collapsed «Historial N», «Pedir un cambio» card. | `_panels/CambiosPanel.tsx`, `_components/tab-changes/` | FRD-04#U3, REQ-04-010, REQ-04-011 | WO-04-012 |
| `CMP-04-change-dialog` | Client | Change detail dialog (kicker «Cambio · <slug>», chips, «Depende de», «Rehace trabajo ya verificado» notice, sectioned body, `/pandacorp:implement change:<id>`) and the replacing `DialogConfirm` «Descartar cambio» with optional «Motivo». | `_components/tab-changes/` | FRD-04#U3, FRD-04#U4, REQ-04-010 | WO-04-012 |
| `CMP-04-documents` | Server + client island | Documentos panel: `DocIndex` (purpose groups, type `FilterChip`s with counts, search) on the right from 900 px and behind «Elegir documento · N» below; `Paper` reader at full width; in-document links through `document-links.ts`. | `_panels/DocumentosPanel.tsx`, `_components/tab-documents/` | FRD-04#U5, AC-04-014.8 | WO-04-012 |
| `IF-04-docs` | lib | `listProjectDocs` + `readDoc` (+ the purpose/type classification v2 adds) and `readActivityLog` / `readDecisions` | `src/lib/docs/tree.ts`, `src/lib/docs/activity.ts` | REQ-04-004, FRD-04#U5 | WO-04-001 (history), WO-04-012 (tree), WO-04-013 (activity) |
| `IF-04-decisions-resolved` | lib | `DecisionPoint.resolvedInFile`, the «· » title strip and the engine-log predicate (§4.4). | `src/lib/docs/activity.ts` | REQ-04-004, AC-04-014.5 | WO-04-013 |
| `IF-04-open-changes` | lib | `countOpenChanges(projectPath)`: the ONE count of open changes (§4.5). | `src/lib/changes/openChanges.ts` | AC-04-014.2, AC-04-014.3 | WO-04-013 |
| `IF-04-changes` | lib | `readChangeQueue` (fail-loud `errors[]`), the absolute change date, `discardChange` (+ optional `discard_reason`). | `src/lib/changes/` | FRD-04#U3, FRD-04#U4, REQ-04-010, REQ-04-011 | WO-04-012 |
| `IF-04-next-step` | lib | `nextStep` / `workspaceCommands` (unchanged). | `src/lib/next-step/next-step.ts` | REQ-04-006 | WO-04-003 (history) |
| Comandos panel | mounted | `_panels/ComandosPanel.tsx`, rewritten by FRD-11 (`BuildModePicker`, scoped commands) as the oracle draws it: «Siguiente paso» (phase commands), «Modo de construcción», «Construir un objetivo concreto» in every phase (not phase-gated) and «Cambios y decisiones» (change, decide, new-version); REQ-04-006 is amended by the PM to this drawn layout. | — | REQ-04-006 | WO-11-004 |
| Observabilidad panel | mounted | `_panels/ObservabilidadPanel.tsx`, rewritten by FRD-05 (views, `WoDetail`) and FRD-12 (`DependencyMap`). | — | REQ-04-002 | WO-05-008 |

Component locations: `ProjectHero`, `ProjectHeroCompact` and `ProgressList` are listed in `components.md` as
single files under `_components/`; this blueprint relocates each into its own folder of the same name
(component + its `_tests/`, project-structure rule), never renaming them. `ProjectSwitcher` comes from
WO-03-007 (`src/components/modules/ProjectSwitcher/`), `AskRow` from WO-18-002, `FraguaScene` from WO-06-013,
`SnapshotPanel` from WO-14-005, `SpecDigest` / `ArchitectureDigest` / `FrdCard` from WO-02-017,
`DataModelViewer` from WO-02-018, `AccountsTable` from WO-26-001, `DocIndex` / `Paper` from WO-08-003, every
primitive (`Tabs`, `Card`/`CardHeader`, `Chip`, `CommandBox`, `ListRow`, `Notice`, `EmptyState`, `Dialog`
family, `StackBar`, `Ring`, `Avatar`, `PhaseStepper`, `FilterChip`, `SearchField`, `Crumbs`) from WO-13-011/012.
No component is created that `components.md` does not list (reuse → adapt → create, DR-057).

## 4. Contracts

### 4.1 `IF-04-workspace-project` (WO-04-010)

- **Input:** the resolved portfolio entry (`ProjectListItem`, the caller keeps the not-found policy).
- **Success:** a `WorkspaceProject` value: identity (`slug` = the persisted navigation slug, never the
  display name, LESSON-0365; `name`; `initials`; `folder` = basename of the project path, the review-worktree
  and event key; absolute `projectPath`); `status` (`Partial<ProjectStatus>`), `phase`, `version` (or none);
  `build` = the value of `buildSignal()` (`src/lib/fragua/build-signal.ts`, WO-06-013: `idle | live |
  no-signal (+ age of the last signal)`, DR-066), never the `running` flag alone and never a second
  derivation from `src/lib/status/liveness.ts`; `progress` = `{ done, total, pct }` and `counts` = `{ orders,
  frds, documents, adrs, openChanges }` taken from the project's `ProjectOverviewItem` of
  `getProjectOverview()` (WO-03-007, which reads `listWorkOrders`/`aggregateProgress`, `countFrdFolders`,
  `listProjectDocs` and `countOpenChanges`), plus `services` = `projectServiceRows(getServicesDirectory(),
  id).length` (WO-26-001); `lastMove` = `getLastCommit(projectPath)` (WO-03-007, `src/lib/portfolio/`, through
  `runGit`), `null` when unknown; FRD names through `listProjectFrds()` (WO-12-007); `nextStep` = `{ command, sentence }` where
  sentence is the catalogue key + vars of «Siguiente paso» (implementation with open work orders →
  `/pandacorp:implement` + «Sigue la construcción: queda 1 work order abierta.» / «quedan N»; release →
  `/pandacorp:review-launch` + «Estable · en operación: revisa cómo va el lanzamiento.»; any other case → the
  command from `nextStep(phase)` and no sentence, because the catalogue draws none).
- **Errors:** every source keeps its own fail-loud result; a count whose reader failed is `null` (badge and
  stat omitted, never `0`), and the panel that owns that source renders the reader's error state.
- **Invariants:** one resolver per fact (DR-115, LESSON-0077): the tab badges, the hero stats, the compact
  header, the Resumen and the Comandos «Siguiente paso» (WO-11-004) all read this value; no panel recomputes
  a count. Reads go through `src/lib` only (no `fs`/git in this module).

### 4.2 `IF-04-panel-contract` (WO-04-010)

- `PanelProps = { project: WorkspaceProject; route: WorkspaceRoute }`; `WorkspaceRoute` = the codec-decoded
  workspace state of this request (tab, document, work order + view, Observabilidad view/filters, dependency
  level/focus, model mode/entity/search, as WO-25-001 ships them) plus `navigationBaseHref`.
- The eight files, one async Server Component each, default-exported names fixed:
  `ResumenPanel`, `SpecPanel`, `ObservabilidadPanel`, `ArquitecturaPanel`, `CuentasPanel`, `CambiosPanel`,
  `DocumentosPanel`, `ComandosPanel` in `src/app/projects/[slug]/_panels/<Name>.tsx`. Each loads its own
  data through `src/lib` readers.
- WO-04-010 wires Resumen, Observabilidad, Cambios, Documentos and Comandos to the CURRENT v1 content (an
  adapter: Resumen → v1 `TabSummary`; Observabilidad → the v1 work-order list or detail followed by the v1
  `ObservabilidadTab`; Cambios → v1 `TabChanges`; Documentos → v1 `TabDocuments`; Comandos → v1
  `TabCommands`), never a placeholder. The panel work orders then rewrite only their panel file and their
  component folders, never `ProjectWorkspace.tsx`, `workspace-route.ts`, `_panels/types.ts` or
  `_panels/workspaceProject.ts`.
- `ProjectWorkspace` keeps its exported props (`item`, `selection`, `headingLevel?`, `navigationBaseHref?`) and
  `workspaceSelection` / `workspaceHref` keep their signatures, because the Portafolio page (WO-03-007) hosts
  the workspace through them.
- `WoDetail({ project, woId, view })` (`_components/wo-detail/WoDetail.tsx`) is created by WO-04-010 as an
  adapter over the v1 `WorkOrderDetail` + `readWorkOrderDoc` and mounted by the Observabilidad adapter; in W6
  WO-05-008 mounts the same export and WO-05-009 rewrites its inside (signature fixed, map §0.3), so both build
  in parallel (reconciliation 2026-10-22: the map called the seam "existing", but the v1 export is
  `WorkOrderDetail({ order, content, activeWoTab })`).
- The standalone route resolves the project through `allProjects()` (every phase), never `activeProjects()`.

### 4.3 Tabs, URL and unknown tab (WO-04-010)

- Order and labels from the catalogue (`common.workspaceTabs.*`): Resumen · Spec · Observabilidad ·
  Arquitectura · Cuentas · Cambios · Documentos · Comandos; default Resumen. Badges: Observabilidad =
  `counts.orders`, Cuentas = `counts.services`, Cambios = `counts.openChanges`, Documentos =
  `counts.documents`; a zero or unknown count shows no badge.
- Tab ids are the codec's URL ids; legacy ids (`party`, `work-orders`, `observabilidad`, `?tab=Work orders`)
  resolve through the codec's alias table to the canonical tab and the canonical URL is written back
  (`NavigationCanonical`); an alias is never a not-found.
- An unknown tab renders `CMP-04-section-not-found` under the compact header (state
  `project-tab-not-found`), not the global not-found page.
- Selecting a tab clears the per-tab sub-selection (document, work order). Panels are keyed by the project
  path, so a project change resets every project-local state (AC-04-012.5, AC-04-013.5).

### 4.4 `IF-04-decisions-resolved` (WO-04-013)

- **Input:** the `decisions.md` content `parseDecisionBlocks` already receives.
- **Success:** the same ordered `DecisionPoint[]`, ids byte-identical to today (FRD-24 golden vectors stay
  green), plus: an explicit in-entry resolution record (the `Estado` field, with or without a leading list
  marker, bold markers or an emoji before the status word, e.g. `**Estado:** ✅ RESUELTO 2026-07-01`)
  wins over the heading, and when it resolves an entry whose heading classifies it as pending (or carries
  no status phrase) the point carries `resolvedInFile: true` (absent otherwise); a leading «· » is
  stripped from the title; `isEngineLogEntry(point)` classifies a timestamped engine log line (title
  starting with a clock time or an ISO timestamp) so every surface hides it with one rule.
- **Errors:** unchanged fail-soft wrapper (`readDecisions`), pure parser.
- **Invariants:** `countPendingDecisions` (DR-092 single count) automatically excludes resolved-in-file
  entries because they are `resolved`; marker parsing stays line-anchored (LESSON-0008).

### 4.5 `IF-04-open-changes` (WO-04-013)

- `countOpenChanges(projectPath)`: the number of change-queue items whose status is not `done` or
  `discarded` (the prototype's definition, which the Cambios badge, the hero stat, La Fragua's foot chip and
  the Portafolio «Cambios abiertos» column share). Returns a typed result: the count, or the reader's errors
  when `readChangeQueue` reports any (never a silent `0`, DR-078). Owner-pending items (Tu turno, the
  sidebar) stay `ready`/`draft` only (REQ-04-010) and are not this count.

### 4.6 Change queue and discard write (WO-04-012)

- Reader: `readChangeQueue` keeps its contract (`items`, `errors[]`; status enum
  `ready | draft | building | closing | done | discarded`).
- Card date: absolute Spanish date «19 oct. 2026» (es-PE short, date-only values in UTC), raw ISO in the
  tooltip, an unparseable date shown raw in the same slot (REQ-04-011), through the shared date formatter of
  the copy layer (ledger request to WO-13-010).
- Server Action `discardChange` (unchanged signature + optional `reason`): input `{ slug, id, reason? }`
  validated at the boundary with a typed guard (no validation library is installed; none is added); success `{ ok: true }` then `revalidatePath` of the workspace; expected failures
  `{ ok: false, reason: "not-found" | "parse-error" | "not-discardable" }` rendered inline in the confirm
  dialog; only `ready`/`draft` are discardable; the write sets `status: discarded`, records
  `status_before_discard`, records `discard_reason` only when a non-empty Motivo was typed, preserves every
  other byte (ADR-0002 pattern), path-traversal and symlink guards unchanged. No new write in the platform
  write set (architecture §7, item 3).

### 4.7 Visual spec per UI work order

| WO | Mocks (`mocks/project-workspace.html#…`) and oracle states | Assets |
|---|---|---|
| WO-04-010 | `#project-spec`, `#project-spec-empty`, `#project-architecture`, `#project-tab-not-found`, `#model-invalid`, scenario states `project-no-version`, `project-subtitle-open`; FRD-12 `observability-dataviz.html#observability-legacy-link`; the hero and tab bar of every state of this FRD | the 65 exported icons via `Icon` (WO-13-010); no raster |
| WO-04-011 | `#project-summary`, `#project-summary-funko`, `#project-summary-decisions`, `#project-decision-dialog`, `#project-snapshot`, scenario state `resumen-no-frds`; FRD-20 `overlay-freshness.html#overlay-behind` | La Fragua art is FRD-06's (staged by WO-13-010) |
| WO-04-012 | `#project-changes`, `#project-change-dialog`, `#project-change-discard`, `#project-change-rebuilds`, `#project-documents`, `#project-documents-search`, `#project-documents-index-open`, scenario states `changes-empty`, `documents-empty`, `document-empty-body` | icons only |

Recorded ids, classes and `data-*`/`aria-*` hooks of the prototype stay on the recorded elements
(`.hero`, `.hero.compact`, `.switcher[data-action="projects"]`, `.tabs-wrap`, `.tabs[role=tablist]`,
`[data-tabkey="tab"][data-tabval]`, `.badge`, `.notice.upgrade`, `.pst-next`, `.sum-cols`, `.lrow[data-decision]`,
`.ask-row`, `.progress-list .pg-row`, `.state-strip .state-tile`, `.lrow[data-change]`, `#doc-index`, `#paper`);
`data-testid` stays on interactive elements.

## 5. Dependencies and risks

- **Upstream:** FRD-13 foundation (WO-13-010..012), FRD-19 shell (WO-19-002), FRD-25 codec (WO-25-001), FRD-03
  `ProjectSwitcher` and last-commit resolver (WO-03-007), FRD-02 digests (WO-02-017), FRD-26 `AccountsTable`
  (WO-26-001), FRD-06 `FraguaScene` + restyled `FreshnessBadge` (WO-06-013), FRD-14 `SnapshotPanel`
  (WO-14-005), FRD-02 `DataModelViewer` (WO-02-018, also the earlier writer of `e2e/logical-data-model.spec.ts`,
  hence the `dependsOn` edge from WO-04-010), FRD-18 `AskRow` + `ownerTurnItems()` (WO-18-002), FRD-08 `DocIndex`/`Paper` (WO-08-003),
  FRD-20 verdict (WO-20-001), FRD-24 decision ids (WO-24-001).
- **Removal ordering risk:** `src/components/modules/party/**` is still imported by `CampaignPipeline` /
  `RoamingCast` (WO-02-020, W3) and by two FRD-13 reviewer tests; WO-04-010 (W5) deletes the folder, so those
  importers must be gone first (ledger requests). WO-04-010 must not import anything WO-06-013 replaced.
- **Shared-count risk:** open changes, last movement and the next step are shown on several surfaces; §4.1
  and §4.5 make each one resolver (LESSON-0077).
- **e2e risk:** the tab bar text now includes count badges; workspace specs assert the labels through
  `e2e/_workspaceTabs.ts` without the badge digits; Playwright traps per LESSON-0185 (hydration via
  `gotoHydrated`, no `networkidle`, LESSON-0066).
- **Reviewer tests:** derogated per map §3.3, listed in each work order; implementers never edit them.

## 6. Traceability

| REQ / bullet | Components / interfaces | Work order |
|---|---|---|
| REQ-04-001 (tabs-first) | `CMP-04-workspace`, `CMP-04-project-hero`, `IF-04-panel-contract` | WO-04-010 |
| REQ-04-002 (eight tabs) | `CMP-04-tabbar`, `CMP-04-section-not-found`, `CMP-04-panel-accounts` | WO-04-010 |
| REQ-04-003 (compact header) | `CMP-04-project-hero-compact`, `IF-04-workspace-project` | WO-04-010 |
| REQ-04-004 (Resumen order, decisions) + FRD-04#U1, FRD-04#U2 | `CMP-04-resumen`, `CMP-04-decisions`, `IF-04-decisions-resolved`, `IF-04-docs` | WO-04-011, WO-04-013 |
| REQ-04-005 (snapshot in Resumen) | `CMP-04-resumen` mounting `SnapshotPanel` (FRD-14) | WO-04-011 |
| REQ-04-006 (Comandos) | Comandos panel (FRD-11), `IF-04-next-step` | WO-11-004, WO-04-003 |
| FRD-04#U3, FRD-04#U4 (Cambios list and discard) | `CMP-04-changes`, `CMP-04-change-dialog`, `IF-04-changes` | WO-04-012 |
| REQ-04-010 (status enum, building/closing) | `CMP-04-changes`, `IF-04-changes`, `IF-04-open-changes` | WO-04-012, WO-04-013 |
| REQ-04-011 (absolute date) | `CMP-04-changes`, `IF-04-changes` | WO-04-012 |
| FRD-04#U5 (Documentos) | `CMP-04-documents`, `IF-04-docs` | WO-04-012 |
| REQ-04-012 (Arquitectura) | `CMP-04-panel-architecture`, `CMP-04-tabbar` | WO-04-010 |
| REQ-04-013 (Spec) | `CMP-04-panel-spec`, `CMP-04-tabbar` | WO-04-010 |
| REQ-04-014 (header, Resumen, Documentos) | `CMP-04-project-hero`, `CMP-04-project-hero-compact`, `CMP-04-tabbar`, `CMP-04-resumen`, `CMP-04-frd-progress`, `CMP-04-decisions`, `CMP-04-progress-list`, `CMP-04-documents` | WO-04-010, WO-04-011, WO-04-012 |
| La Fragua bullet (FRD-06) | `FraguaScene` mounted by `CMP-04-resumen` | WO-04-011 (owns AC-06-020.1) |

| AC | Work order |
|---|---|
| AC-04-012.1, AC-04-012.2, AC-04-012.3, AC-04-012.4, AC-04-012.5 | WO-04-010 |
| AC-04-013.1, AC-04-013.2, AC-04-013.3, AC-04-013.4, AC-04-013.5 | WO-04-010 |
| AC-04-014.1, AC-04-014.2 | WO-04-010 |
| AC-04-014.3, AC-04-014.4, AC-04-014.5, AC-04-014.6, AC-04-014.7 | WO-04-011 |
| AC-04-014.8 | WO-04-012 |
| Cross-FRD owned here: AC-12-006.4 | WO-04-010 |
| Cross-FRD owned here: AC-06-020.1, AC-20-001.1, AC-20-001.2, AC-20-001.3, AC-20-002.1, AC-20-002.2, AC-20-004.1 | WO-04-011 |

## Build Plan

> The build engine reads this table. One row per live work order; `dependsOn`, `artifacts` and the wave
> match each work order's frontmatter.

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-04-001 | WO-01-000, WO-01-001 | `src/lib/docs/tree.ts`, `src/lib/docs/activity.ts`, `src/lib/docs/_tests/docs.wo04001.test.ts`, `src/lib/docs/_tests/docs.wo04002.test.ts` | false | W2 (history, VERIFIED) |
| WO-04-003 | WO-02-003, WO-01-005 | `src/lib/next-step/next-step.ts`, `src/lib/next-step/_tests/next-step.wo04003.test.ts`, `src/lib/next-step/_tests/next-step.wo04003.adversarial.test.ts` | false | W4 (history, VERIFIED) |
| WO-04-013 | WO-24-001, WO-04-001 | `src/lib/docs/activity.ts`, `src/lib/docs/_tests/activity.resolved-in-file.test.ts`, `src/lib/changes/openChanges.ts`, `src/lib/changes/_tests/openChanges.test.ts` | false | W3 (with WO-14-005 and the other W3 work orders) |
| WO-04-010 | WO-19-002, WO-03-007, WO-02-017, WO-02-018, WO-26-001, WO-25-001, WO-13-012, WO-06-013, WO-04-013, WO-02-020, WO-12-007 | `src/app/projects/[slug]/page.tsx`, `src/app/projects/[slug]/ProjectWorkspace.tsx`, `src/app/projects/[slug]/workspace-route.ts`, `src/app/projects/[slug]/[...segments]/**`, `src/app/projects/[slug]/_panels/**`, `src/app/projects/[slug]/_components/{tabbar.tsx,workspace-header.tsx,objectives-bar.tsx,WorkspaceNavigation.tsx,tab-spec.tsx,document-links.ts}`, `src/app/projects/[slug]/_components/{ProjectHero,ProjectHeroCompact}/**`, `src/app/projects/[slug]/_components/_tests/{workspace-shell,workspace-navigation,spec-tab,spec-workspace,architecture-tab}*.test.tsx`, `src/app/projects/[slug]/_components/wo-detail/WoDetail.tsx`, `src/app/projects/[slug]/_components/wo-detail/_tests/wo-detail.integration.test.tsx`, `src/app/projects/[slug]/_tests/**`, `src/app/projects/[slug]/_party/**`, `src/components/modules/party/**`, `src/components/modules/ServicesDirectory/{ServicesDirectory.tsx,copy.ts}`, `src/components/modules/ServicesDirectory/_tests/ServicesDirectory.test.tsx`, `src/app/_design/tokens/_tests/frd13-wo06-09.adversarial.reviewer.test.tsx`, `src/app/_design/tokens/_tests/frd13-wo07-09.adversarial.reviewer2.test.tsx`, `e2e/{_workspaceTabs.ts,logical-data-model.spec.ts,portfolio-spec.spec.ts,persistent-navigation.spec.ts}`, `e2e/persistent-navigation/workspace.spec.ts` | false | W5 (with WO-18-002, WO-01-011) |
| WO-04-011 | WO-04-010, WO-06-013, WO-14-005, WO-04-013, WO-20-001, WO-18-002, WO-12-007 | `src/app/projects/[slug]/_panels/ResumenPanel.tsx`, `src/app/projects/[slug]/_components/{tab-summary,version-freshness,ProgressList}/**`, `e2e/resumen.spec.ts` | false | W6 (with WO-04-012, WO-05-008, WO-05-009, WO-11-004, WO-19-003, WO-10-017) |
| WO-04-012 | WO-04-010, WO-08-003 | `src/app/projects/[slug]/_panels/{CambiosPanel,DocumentosPanel}.tsx`, `src/app/projects/[slug]/_components/{tab-changes,tab-documents}/**`, `src/app/projects/[slug]/_actions/**`, `src/lib/changes/**`, `src/lib/docs/tree.ts`, `src/lib/docs/_tests/{tree,docs.wo04001}*.test.ts` | false | W6 (with WO-04-011 and the other W6 work orders) |

- **Order:** WO-04-013 (W3, data fixes) → WO-04-010 (W5, frame + panel contract) → WO-04-011 and WO-04-012
  (W6, in parallel; disjoint panel files and folders; `src/lib/changes/openChanges.ts` was written in W3, so
  WO-04-012's `src/lib/changes/**` overlaps no same-wave writer).
- **Disjointness:** W3: WO-04-013 writes `src/lib/docs/activity.ts` and the new `src/lib/changes/openChanges.ts`;
  no other W3 work order writes either (WO-14-005 writes `snapshot-panel/**` and `src/lib/snapshot/gap.ts`).
  W5: the workspace frame files are WO-04-010's alone (map §0.1). W6: WO-04-011 and WO-04-012 touch different
  `_panels/*.tsx` files and different `_components/` folders; other W6 work orders own `ObservabilidadPanel.tsx`,
  `ComandosPanel.tsx`, `wo-detail/**` (WO-05-009) and the sidebar.
- **Cross-FRD position:** FRD-04 consumes the W0-W4 foundations and surfaces and is the provider of the panel
  contract for WO-05-008 and WO-11-004 (W6). WO-13-013 (W7) runs after it.
- **Integration order:** the frame lands with v1 adapters (the gate stays green), then each W6 panel replaces
  its adapter; no consumer builds before its provider.
- **W5 disjointness of the additions:** `wo-detail/WoDetail.tsx` (WO-05-009 rewrites it in W6, WO-25-001 may touch
  `wo-detail/**` in W0), the `ServicesDirectory` facade files (WO-26-001 W3, WO-03-007 W4 `PortfolioViews.tsx`
  only), the two FRD-13 reviewer suites (WO-13-010 W0) and `e2e/persistent-navigation/workspace.spec.ts`
  (WO-25-001 W0): no other W5 work order (WO-18-002, WO-01-011) writes them. WO-04-011's `e2e/resumen.spec.ts`
  is new and no other W6 work order writes it.

## Reconciliation (2026-10-22, binding)

- **One resolver per fact.** `WorkspaceProject` composes `getProjectOverview()` / `getLastCommit()` (WO-03-007),
  `buildSignal()` (WO-06-013), `countOpenChanges()` (WO-04-013), `projectServiceRows()` (WO-26-001) and
  `listProjectFrds()` (WO-12-007); the Comandos «Siguiente paso» (WO-11-004) reads `WorkspaceProject.nextStep`.
- **La Fragua mount.** WO-04-011 passes `FraguaScene` the four cross-feature facts (`openChanges`,
  `ownerPending` = `ownerTurnItems({ project }).count`, `lastActivityAt` = `lastMove`, `frds`) and owns the
  behaviour e2e of the scene inside Resumen (`e2e/resumen.spec.ts`). WO-06-013 stays W3 (moving it would push
  WO-03-007 and WO-04-010 a wave later).
- **Removal ownership.** WO-04-010 `git rm`s the FRD-13 reviewer suites `frd13-wo06-09*` / `frd13-wo07-09*`
  (they import `src/components/modules/party/**`, deleted here; map §3.3 rule 3: a reviewer suite whose subject
  is deleted is `git rm`ed by the deleting work order and listed as derogated). It also deletes the transitional
  `ServicesDirectory` facade once `ProjectWorkspace.tsx` / `tabbar.tsx` stop importing it.
- **Legacy links.** WO-04-010 applies `normalizeLegacyNavigation` (`party` → `summary`, `work-orders[/<wo>/<view>]`
  and `observabilidad` → `observability`); an unknown tab arrives as `unknown` from `workspaceRouteState()`.
- **No `<main>`.** Panels and heroes render no `<main>` (the shell's `main#content` is the only one).
- **Copy.** The upgrade notice uses the drawn body in every case (the while-building variant is drawn nowhere and
  is not built); `readChangeQueue` keeps `id` / `title` / `status` stable in W6 for WO-11-004; WO-04-012 consumes
  FRD-08's `DocIndex` / `DocItem` / `Paper` props unchanged.
- **Cross-FRD ids.** Hosted components defined elsewhere are named by their owners' ids where referenced:
  `CMP-09-guild-card`, `CMP-09-achievement-notice` (FRD-09), `CMP-15-pill` (FRD-15), all built by WO-19-003.

## Work Orders

Build order (live): WO-04-001 (W2, VERIFIED) · WO-04-013 (W3) · WO-04-003 (W4, VERIFIED) · WO-04-010 (W5) ·
WO-04-011 ∥ WO-04-012 (W6). See [`work-orders/README.md`](./work-orders/README.md).

## Superseded (v1 history)

- WO-04-004 Workspace shell (header, tab bar, objectives bar), superseded by WO-04-010.
- WO-04-005 Resumen + Documentos tabs, superseded by WO-04-011 and WO-04-012.
- WO-04-008 Change card relative date, superseded by WO-04-012 (REQ-04-011 now asks for the absolute date).
- WO-04-009 Stale workspace e2e specs (ten tabs), superseded by WO-04-010 (it owns `e2e/_workspaceTabs.ts` and
  the eight-tab specs; change card `e2e-workspace-tabs-stale.md`).

## Readiness check (DR-100)

Every REQ and FRD bullet maps to a component or interface (§6); every live `AC-04-*` is owned by exactly one
live work order (§6 table, mirrored in the README); `dependsOn` is acyclic and names only live work orders;
same-wave artifacts are disjoint (Build Plan notes); foundation primitives come from WO-13-010..012 and
WO-19-002; no backend contract file is planned (map §0.3: no route or API change); no open clarification
marker survives in this feature's docs. Lessons applied: LESSON-0008 (line-anchored marker parsing),
LESSON-0009 (dates compared with `Date.parse`), LESSON-0066 and LESSON-0185 (e2e traps), LESSON-0077 (one
resolver per shared count), LESSON-0365 (stable slug, never a display name, in URLs and the worktree folder),
LESSON-0490 (Spanish chrome, shown content keeps its language).
