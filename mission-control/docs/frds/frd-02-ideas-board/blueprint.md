---
id: BP-02
type: blueprint
slug: ideas-board
title: FRD-02 Ideas board (v2 «Órbita»)
status: ACTIVE
parent: FRD-02
implementation_status: VERIFIED
readiness_gate: passed 2026-10-22
grounding_gate: passed 2026-10-22
consistency_gate: passed 2026-10-22
last_updated: 2026-10-22
---

# Blueprint — FRD-02 Ideas board (v2 «Órbita»)

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Per-feature blueprint (DR-049): how the ideas board, the idea page (Propuesta · Spec · Arquitectura ·
> Documentos · Campaña), the shared Spec/Arquitectura digests, the logical data-model viewer and the bounded
> idea-card writes are built on the platform. The platform (stack, route map, data layer boundary, fixture seams,
> copy accessor `t()` over `docs/design/microcopy.es.json`, read-only invariant) lives in
> [`../../product/architecture.md`](../../product/architecture.md) and the ADRs; this file does not restate it.
> Binding plan inputs: `.pandacorp/run/architecture/wo-map.md` (§0 global rules, §2 FRD-02 catalogue, §3 DAG,
> §6.C removals, §8 resolutions). Visual contract: [`fdd.md`](fdd.md) + [`mocks/ideas-board.html`](mocks/ideas-board.html)
> + the FRD-02 states of `docs/design/prototype/reference/oracle-states.json`.

## Purpose

v2 rebuilds the three FRD-02 surfaces on the frozen Órbita design (ADR-0012): the **Tablero** (`/board`: phase
columns, search, phase chips, hide-empty, category filter, favourite star, capture and discarded dialogs), the
**idea page** (`/board/:idea/:tab`: header, five icon tabs, Propuesta memo-pitch, Documentos index + reader,
discard/restore confirmations) and the **shared digests** (Spec, Arquitectura with the data-model viewer and the
plan mosaic) that the project workspace (FRD-04) mounts unchanged. **La Campaña** becomes the dark journey map with
the pinned phase sheet and the build-mode picker (FRD-11). The data layer and the three bounded writes
(discard, restore, favourite: ADR-0002, ADR-0003) are kept as they are; v2 changes presentation, routing of the idea
page and the removals the frozen design implies (§ Removals).

## What is kept from v1 (live code, not rebuilt)

- `src/lib/board/board.ts` (`deriveColumn`, two-axis column derivation, WO-02-001), `src/lib/next-step/next-step.ts`
  (`nextStep`, `workspaceCommands`, WO-02-003), `src/lib/discard/{discard,restore}.ts` + the Server Actions in
  `src/app/board/actions/actions.ts` (WO-02-004, ADR-0002), `src/lib/campaign/campaign.ts` (`phaseFromStatus`,
  WO-02-011), `src/lib/favorite/favorite.ts` + `toggleFavoriteAction` (WO-02-012, ADR-0003).
- The shared architecture read seam `src/lib/architecture/read-artifacts.ts::readArchitectureArtifacts(projectPath)`
  (narrative digest, `readDataModel`, live work orders, `.env.example` entries, ADRs), the spec reader
  `src/lib/spec/read-spec.ts`, and the data-model reader/validator under `src/lib/architecture/data-model/`
  (ADR-0006: version-1 JSON, bounded UTF-8 read, missing distinct from invalid/unreadable/none). No logical schema
  change in v2 (`docs/product/data-model.json` unchanged, DATA-7: the reviewer records "unchanged").
- The data-model layout engine (owner decision M1, 2026-10-22; ADR-0007): ELK layered orthogonal routing with fixed
  field ports (`layout.ts`, `routing.ts`, `entityGeometry.ts`, `elkEngine.ts`), `useModelLayout` (model-scoped,
  cancellable, bounded), `useViewport`/`useFrameView` (frame-batched camera, 15% button steps, delta-mode-normalized
  wheel), `ModelSchema` (native `details[name]` accordion). Only the Órbita styling and the v2 removals change.
- FRD-25 URL identity: stable idea/project navigation slugs (`getIdeaNavigation`, `resolveIdeaNavigation`), the
  canonical redirect in `src/app/board/[...segments]/page.tsx`, `useUrlState`/`updateNavigation`.

## Components & Interfaces

Kept components keep their id; v2 components are new ids or restyles in place (components.md "restyle": same file
and exported name, new props optional while un-migrated consumers exist).

| ID | Kind | Artifact | Responsibility | Traces | Built by |
|---|---|---|---|---|---|
| `CMP-02-board-derive` | module | `src/lib/board/board.ts` | Board column from card `status` + project phase; `documented` fallback. | REQ-02-001 | WO-02-001 (kept) |
| `CMP-02-next-step` | module | `src/lib/next-step/next-step.ts` | Lifecycle position → next command (+ `workspaceCommands`). | REQ-02-004 | WO-02-003 (kept) |
| `CMP-02-discard` | module (write) | `src/lib/discard/{discard,restore}.ts` | Discard with optional `discard_reason` + `status_before_discard`; exact restore. | REQ-02-007, REQ-02-008, FRD-02#U5 | WO-02-004 (kept) |
| `CMP-02-phase-from-status` | module | `src/lib/campaign/campaign.ts` | Active campaign phase 0-5 from the two axes; `research` fallback. | REQ-02-010 | WO-02-011 (kept) |
| `CMP-02-favorite` | module (write) | `src/lib/favorite/favorite.ts` | Set/remove the `favorite` frontmatter field only. | REQ-02-012 | WO-02-012 (kept) |
| `CMP-02-board-view` | UI (Server page + client shell) | `src/app/board/page.tsx`, `_components/BoardShell/` | Tablero: `PageHead` «Tablero» with «Descartadas · N» and «Capturar ideas», toolbar (search, category `FilterChip`s, «Ocultar columnas vacías» `Switch`), match line «N ideas coinciden» + «Limpiar», `PhaseNav`, columns. | REQ-02-002, REQ-02-005, REQ-02-016, FRD-02#U4 | WO-02-015 |
| `CMP-02-board-column` | UI | `src/app/board/_components/BoardColumn/` | Equal-width phase column (numbered campaign phase name, count chip), narrow when empty with the `role="status"` marker «Sin ideas en esta fase»; «Sin coincidencias» while filtering. Restyle of `KanbanColumn` usage. | REQ-02-002, REQ-02-014 | WO-02-015 |
| `CMP-02-phase-nav` | UI | `src/app/board/_components/PhaseNav/` | One chip per (visible) phase with its count; activation scrolls that column into view. | REQ-02-016 | WO-02-015 |
| `CMP-02-card` | UI | `src/components/modules/IdeaCard/` | `IdeaCard` / `IdeaCardProject`: title (link to the idea page), star, category + return chips, score bar; project variant adds `n/m WO` and «Construyendo» / «Proyecto creado». Owns `projectMetaChips` (shared "qué es" chips, AC-02-009.5). | REQ-02-005, REQ-02-006, REQ-02-012 | WO-02-015 |
| `CMP-02-favorite-action` | UI (client) | `src/components/core/FavoriteButton/` | Labelled star toggle (`aria-pressed`, Spanish label naming the idea), `useOptimistic` flip with auto-revert. | REQ-02-012 | WO-02-015 (restyle; v1 WO-02-012) |
| `CMP-02-intake-dialog` | UI (client) | `src/app/board/_components/IntakeModal/` | «Capturar ideas» `Dialog`: kicker, intro sentence, four `CommandBox` rows. | REQ-02-003 | WO-02-015 |
| `CMP-02-discarded-dialog` | UI (client) | `src/app/board/_components/DiscardedModal/` | «Ideas descartadas · N» `Dialog` of `ListRow`s (title, category, reason); a row opens the idea page. | FRD-02#U4 | WO-02-015 |
| `CMP-02-idea-page` | UI (Server route) | `src/app/board/[...segments]/` | Idea route: FRD-25 identity resolution and canonical redirect, one per-request idea read, unknown-idea card, mounts header + tabs. | REQ-02-004, REQ-02-009, REQ-02-016 | WO-02-016 |
| `CMP-02-idea-header` | UI | `src/app/board/_components/IdeaHeader/` | Title + chips + «Etapa: <fase>» or «Descartada» (no stepper), «Volver al tablero», star, «Abrir en Portafolio», discard or «Restaurar» on one row; discarded `Notice` banner with the reason. | REQ-02-008, REQ-02-016, FRD-02#U3, FRD-02#U5 | WO-02-016 |
| `CMP-02-card-detail` | UI (client) | `src/app/board/_components/CardDetail/CardDetail.tsx` | Tab frame on the shared `Tabs` (icons, counts): availability rules, stage-derived default, URL-persisted pick; hosts each tab body. | REQ-02-009, REQ-02-015 | WO-02-016 |
| `CMP-02-idea-pitch` | UI | `src/app/board/_components/CardDetail/IdeaPitch/` | Propuesta memo-pitch on `DigestHero` + `ReportBand` blocks. | REQ-02-009 | WO-02-016 |
| `CMP-02-idea-docs` | UI (client) | `src/app/board/_components/IdeaDocs/` | `IdeaDocsRail` / `IdeaDocsItem`: Resumen + project documents by purpose, rail on the right, folded list below 900 px; reader on `Paper`; in-document link resolution. | REQ-02-004, REQ-02-009 | WO-02-016 |
| `CMP-02-discard-action` | UI (client + Server Action) | `src/components/core/{DiscardButton,RestoreButton}/` | `DialogConfirm` «Descartar idea» with optional «Motivo (opcional)»; «Restaurar idea» confirm without a reason; call the existing actions. | REQ-02-007, REQ-02-008, FRD-02#U5 | WO-02-016 |
| `CMP-02-spec-digest` | UI | `src/app/board/_components/CardDetail/SpecDigest/` | Three bands (PRD, Research, FRDs) with label-classified scannable subsections; FRD cards + FRD `DialogSheet`. Shared with FRD-04. | REQ-02-011, REQ-02-016 | WO-02-017 |
| `CMP-02-architecture-digest` | UI | `src/app/board/_components/CardDetail/ArchitectureDigest/` | Hero, Stack y tecnologías, Integraciones y operación, Modelo de datos (hosts the viewer), Variables de entorno, Decisiones (ADR rows + dialog), Plan de implementación mosaic, per-FRD cards + dialog; not-published state. Shared with FRD-04. | REQ-02-013, REQ-02-016 | WO-02-017 |
| `CMP-02-report-band` | UI | `src/components/modules/ReportBand/` | `DigestHero`, `ReportBand` (label \| content rows; Propuesta blocks folded in), `EnvRow` / `EnvFold`, `AdrRow`, `PlanMosaic`. | REQ-02-009, REQ-02-011, REQ-02-013 | WO-02-017 |
| `CMP-02-frd-card` | UI | `src/components/modules/Spec/FrdCard.tsx` | Fully clickable FRD card: code, coloured kind tag, state stack bar once building (planned count before). | REQ-02-016 | WO-02-017 |
| `CMP-02-data-model-viewer` | UI (client) | `src/components/modules/DataModelViewer/` | Diagrama / Esquema (`Segmented`), search, selection, relations list with cardinalities, designed-model line, none / not-published / single error notice. | REQ-02-015 | WO-02-018 |
| `CMP-02-graph-controls` | UI (client) | `src/components/modules/GraphControls/` + `src/hooks/useFullscreen.ts` | Compact top-right icon toolbar (Alejar, %, Acercar, Ajustar a la vista, Restablecer, Pantalla completa); native fullscreen within the gesture. | REQ-02-015 | WO-02-018 |
| `CMP-02-model-layout` | module (client) | `src/components/modules/DataModelViewer/{useModelLayout,elkEngine}.ts` | Bounded, cancellable, model-scoped async layout with explicit loading/error. | REQ-02-015 | WO-02-019 |
| `CMP-02-campaign-pipeline` | UI (client) | `src/components/modules/CampaignPipeline/` | Dark journey map (`--map-*`): six `CampaignRoom`s in the snake, corridors carrying the hand-off artifact, «N/6 entregadas» strip; cast roaming (transform only) unless reduced motion; live markers only while `running`. | REQ-02-010, REQ-02-016 | WO-02-020 |
| `CMP-02-phase-sheet` | UI (client) | `src/components/modules/CampaignPipeline/{PhaseSheet,TeamMember}.tsx` | Pinned sheet: kicker, name, state chip, prev/next arrows, Descripción, Entra y sale (Lee → Escribe), Equipo, Qué puedes correr (`CommandBox` rows, spec-mode disclosure, «Elegir modo de construcción» → `BuildModePicker`), «Entrar a La Fragua» link from build only. | REQ-02-010, REQ-11-005 | WO-02-020 |
| `CMP-02-command-modes` | module | `src/lib/command-modes.ts` | Spec clarification modes (`--ask`/`--auto`/`--infer`) with hints; implement modes derived from `BUILD_MODES`. | REQ-02-010 | WO-02-020 |
| `IF-02-deriveColumn` | interface | `deriveColumn(card, projectStatus)` | Unchanged. | REQ-02-001 | WO-02-001 |
| `IF-02-nextStep` | interface | `nextStep(input)` | Unchanged. | REQ-02-004 | WO-02-003 |
| `IF-02-discardIdea` | interface | `discardIdea(slug, reason?)` / `restoreIdea(slug)` + `discardIdeaAction` / `restoreIdeaAction` | Unchanged (Contracts C1). | REQ-02-007, REQ-02-008 | WO-02-004 |
| `IF-02-setFavorite` | interface | `setFavorite(slug, favorite)` + `toggleFavoriteAction` | Unchanged (Contracts C1). | REQ-02-012 | WO-02-012 |
| `IF-02-phaseFromStatus` | interface | `phaseFromStatus(input)` | Unchanged. | REQ-02-010 | WO-02-011 |
| `IF-02-architecture-artifacts` | interface | `readArchitectureArtifacts(projectPath)` | One bundle for board and workspace (Contracts C3). | REQ-02-013, REQ-02-015 | WO-02-017 |
| `IF-02-idea-page-read` | interface | idea page server read (`src/app/board/_utils/`) | One `React.cache()` resolver per request for the open idea (Contracts C2). | REQ-02-004, REQ-02-009 | WO-02-016 |
| `IF-02-digest-props` | interface | `SpecDigest` / `ArchitectureDigest` props | The seam FRD-04 mounts (Contracts C3). | REQ-02-011, REQ-02-013 | WO-02-017 |
| `IF-02-data-model-viewer-props` | interface | `DataModelViewer` props | Unchanged in v2 (Contracts C4). | REQ-02-015 | WO-02-018 |
| `IF-02-campaign-props` | interface | `CampaignPipeline` props | Adds `forgeHref`; drops the no-op `onEnterForge` and `deployTarget` (Contracts C5). | REQ-02-010 | WO-02-020 |
| `IF-02-hide-empty-pref` | interface | browser-local preference | «Ocultar columnas vacías» remembered per browser (Contracts C6). | REQ-02-016 | WO-02-015 |

**Relocations recorded here (components.md allows relocating, never renaming or forking):** the `DigestHero`,
`ReportBand`, `EnvRow` / `EnvFold`, `AdrRow` and `PlanMosaic` rows live in `src/components/modules/ReportBand/`
(shared by the board and the workspace, promotion rule) instead of `src/app/board/_components/ReportBand/`;
`PhaseNav`, `BoardColumn` and `IdeaDocsRail` / `IdeaDocsItem` become folders (`PhaseNav/PhaseNav.tsx`,
`BoardColumn/BoardColumn.tsx`, `IdeaDocs/IdeaDocs.tsx`) because each carries tests (project-structure rule).
`SpecDigest` and `ArchitectureDigest` stay at their current paths (FRD-04 already imports them there).

## REQ → component traceability

FRD-02 numbers most requirements; five bullets carry no id and the FDD labels them FRD-02#U1..U5 (U1 = REQ-02-001,
U2 = REQ-02-004, U3 = REQ-02-007 in the v1 numbering; U4 = the «Descartadas · N» button and dialog; U5 = the
discarded idea's banner and restore).

| REQ | Requirement (abridged) | Component(s) / interface(s) | WO |
|---|---|---|---|
| REQ-02-001 (U1) | Two-axis column derivation, `documented` fallback. | `CMP-02-board-derive`, `IF-02-deriveColumn` | WO-02-001, WO-02-015 (renders) |
| REQ-02-002 | No manual moves; equal-width wide columns; horizontal scroll; wrapping text. | `CMP-02-board-view`, `CMP-02-board-column` | WO-02-015 |
| REQ-02-003 | «Capturar ideas» dialog with the four intake commands; board visible behind. | `CMP-02-intake-dialog` | WO-02-015 |
| REQ-02-004 (U2) | Idea page shows summary, documents navigator and next-step command. | `CMP-02-idea-page`, `CMP-02-idea-docs`, `CMP-02-next-step`, `IF-02-idea-page-read` | WO-02-016, WO-02-003 |
| REQ-02-005 | Category + return chips beside the score; filter by category. | `CMP-02-card`, `CMP-02-board-view` | WO-02-015 |
| REQ-02-006 | Building indicator while `running`. | `CMP-02-card` | WO-02-015 |
| REQ-02-007 (U3) | Discard writes `status: discarded`, rest preserved. | `CMP-02-discard`, `IF-02-discardIdea`, `CMP-02-discard-action` | WO-02-004, WO-02-016 |
| REQ-02-008 | Discard confirmation dialog with optional reason, `status_before_discard`. | `CMP-02-discard-action`, `CMP-02-idea-header` | WO-02-016 |
| FRD-02#U4 | No discarded column; «Descartadas · N» button + dialog. | `CMP-02-board-view`, `CMP-02-discarded-dialog` | WO-02-015 |
| FRD-02#U5 | Discarded idea: full docs, reason banner, restore confirmation. | `CMP-02-idea-header`, `CMP-02-discard-action`, `CMP-02-discard` | WO-02-016 |
| REQ-02-009 | Idea tabs, stage default, persistence, Documentos curated index + reader, in-document links. | `CMP-02-card-detail`, `CMP-02-idea-pitch`, `CMP-02-idea-docs` | WO-02-016 |
| REQ-02-010 | La Campaña: map, phase states, pinned sheet, commands, read-only, forge link. | `CMP-02-campaign-pipeline`, `CMP-02-phase-sheet`, `CMP-02-command-modes`, `CMP-02-phase-from-status`, `IF-02-campaign-props` | WO-02-020, WO-02-011 |
| REQ-02-011 | Spec tab: conditional, three bands, FRD cards + dialog, reused by FRD-04. | `CMP-02-spec-digest`, `CMP-02-report-band`, `IF-02-digest-props` | WO-02-017 |
| REQ-02-012 | Favourite flag write + star toggle on every card and the header. | `CMP-02-favorite`, `IF-02-setFavorite`, `CMP-02-favorite-action`, `CMP-02-card` | WO-02-012, WO-02-015, WO-02-016 (header mount) |
| REQ-02-013 | Arquitectura tab: availability, complete digest, plan mosaic, live ADRs/env, per-FRD dialog. | `CMP-02-architecture-digest`, `CMP-02-report-band`, `IF-02-architecture-artifacts` | WO-02-017 |
| REQ-02-014 | Accessible empty-column marker «Sin ideas en esta fase». | `CMP-02-board-column` | WO-02-015 |
| REQ-02-015 | Shared logical data-model viewer (+ graph-control amendment). | `CMP-02-data-model-viewer`, `CMP-02-graph-controls`, `CMP-02-model-layout`, `IF-02-data-model-viewer-props` | WO-02-018, WO-02-019, WO-02-016 (AC-02-015.14 host width) |
| REQ-02-016 | Board search/phase chips/hide-empty/match count; idea header; Campaña strip + arrows; FRD cards; env grouping. | `CMP-02-board-view`, `CMP-02-phase-nav`, `CMP-02-idea-header`, `CMP-02-campaign-pipeline`, `CMP-02-frd-card`, `CMP-02-report-band` | WO-02-015, WO-02-016, WO-02-020, WO-02-017 |
| REQ-11-005 (AC-11-005.3) | The Construcción sheet offers the build-mode picker. | `CMP-02-phase-sheet` (mounts FRD-11's `BuildModePicker`) | WO-02-020 |

## Contracts

No backend route or API change (map §0.3): no `docs/api/<wo-id>.md` is planned. The contracts below are the
in-app seams between FRD-02 work orders and their consumers.

**C1 · Bounded writes (unchanged, ADR-0002 / ADR-0003).** `discardIdeaAction(slug, reason?)`,
`restoreIdeaAction(slug)`, `toggleFavoriteAction(slug, favorite)` in `src/app/board/actions/actions.ts`.
- Input: the idea's card slug (validated by the lib: empty, traversal or symlink → `not-found`); `reason` optional
  free text; `favorite` boolean.
- Success: `{ ok: true }` (discard/restore), `{ ok: true, favorite }`; revalidation of the board and idea routes.
- Errors: `{ ok: false, reason: "not-found" | "parse-error" }` rendered as the designed inline error state of the
  dialog or star (the star auto-reverts); never thrown.
- Invariants: one frontmatter field set per write (discard: `status`, `discard_reason` when given,
  `status_before_discard`; restore: `status` restored, both bookkeeping fields removed; favourite: `favorite` set or
  removed), body and other fields verbatim; human-triggered only, never during a render; every action authorizes
  nothing beyond its own card (local single-owner tool, `127.0.0.1`).

**C2 · Idea page read (`IF-02-idea-page-read`, WO-02-016).**
- Input: the route's idea navigation slug (FRD-25 resolution) and tab segment.
- Success: one serializable bundle for the open idea: card fields (title, category, return, score, status,
  favourite, discard reason), derived stage and campaign phase, `running`, project link (navigation slug for
  «Abrir en Portafolio» and the forge href), scoped document structure + count, spec digest presence/content,
  architecture bundle (from `readArchitectureArtifacts`), next-step command.
- Errors: unknown idea → the designed «Esta idea no existe» card (state `idea-not-found`), not a framework 404;
  unknown tab → `notFound()`; an unreadable project artifact surfaces through the digest's own error state
  (fail-loud readers, DR-078).
- Invariants: read once per request (`React.cache()`, DR-115); the board page no longer reads project documents for
  every card (only the idea page reads them for one idea); no fs/git outside `src/lib` and `_utils` readers.

**C3 · Digest seam (`IF-02-digest-props`, WO-02-017; consumers WO-02-016 and WO-04-010).**
- `SpecDigest`: the digest markdown, title, "qué es" chips inputs, `frdCount`, the project's campaign phase (FRD
  progress rule) and per-FRD work-order progress, a link resolver. `ArchitectureDigest`: the
  `readArchitectureArtifacts` bundle (narrative, `DataModelResult`, live work orders, env entries with their
  `.env.example` section, ADRs), title, chips inputs, phase, link resolver, and the not-published flag
  (project-linked, both artifacts absent).
- Errors: absent spec digest → the caller omits the Spec tab (board) or shows its honest empty state (workspace);
  model error/none states render inside Modelo de datos without hiding the other bands.
- Invariants: v1 prop names stay accepted (optional) until WO-04-010 rewires the workspace in W5; the per-FRD
  "N WOs" count and the mosaic derive from live work-order frontmatter, never from digest prose (DR-115); the FRD
  kind comes from the digest, else from the FRD's `ui:` frontmatter field.

**C4 · Data-model viewer (`IF-02-data-model-viewer-props`, unchanged).** `DataModelViewer({ result: DataModelResult,
... })` keeps its current props and its URL keys (`model`, `modelQuery`, `entity`, `relationship`, `schemaTable`);
the default view is Diagrama at desktop/tablet and Esquema on phones; `GraphControls` and `useFullscreen` keep the
exports WoDag still imports until WO-05-008 deletes WoDag (W6).

**C5 · Campaña (`IF-02-campaign-props`, WO-02-020; consumer WO-02-016).** `CampaignPipeline({ slug, activePhase,
project?, running?, forgeHref? })`: `slug` interpolates into every `<idea>` command token; `forgeHref` is the Portafolio →
project → Resumen URL built server-side by the idea page (FRD-25 codec); the «Entrar a La Fragua» link renders only
when the build phase is reached and `forgeHref` is present. The pinned phase lives in the `phase` URL key.
Read-only: no write, no Claude call, no build trigger. The mode picker is FRD-11's `BuildModePicker` (WO-11-003),
mounted as is. Optional `project` passes from CardDetail through CampaignPipeline to PhaseSheet, scopes mode memory to the linked project, and enables the picker on every implement command; without a project, show the plain modes disclosure.

**C6 · Browser-local preferences (not factory writes).** «Ocultar columnas vacías» persists in `localStorage` under
one namespaced key, read after hydration without layout shift of the default (all columns shown) state; the build
mode choice is FRD-11's.

## Visual spec per UI work order (DR-054 / DR-056 / DR-130)

Binding: `fdd.md` + `mocks/ideas-board.html#<state>` + the same state id in `oracle-states.json`; reference CSS
under `docs/design/prototype/reference/css/`. The per-FRD gate runs smoke + shell (DR-106, fidelity advisory);
the close-out Visual QA diffs every state in oracle mode (`pnpm dev:oracle`, WO-01-010); the data-model canvas is
compared by computed styles only (owner M1). Recorded ids, class names and `data-*` / `aria-*` hooks stay on the
recorded elements (technical-assumptions §1.3).

| WO | States | Reference CSS |
|---|---|---|
| WO-02-015 | `board`, `board-hide-empty`, `board-search`, `board-category-filter`, `board-favorite`, `board-phase-jump`, `board-capture-dialog`, `board-discarded-dialog` | 06-card, 07-chip, 09-form-field, 12-command, 13-list-row, 23-tablero, 33-dialog, 40-board-pipeline, 41-board-columns |
| WO-02-016 | `idea-pitch`, `idea-documents`, `idea-discard-dialog`, `idea-shipped`, `idea-not-found`, `idea-discarded`, `idea-restore-dialog`, `idea-discarded-reason` | 14-empty-notice, 20-tabs, 24-idea-header, 28-documents, 29-markdown, 33-dialog, 43-idea-layout |
| WO-02-017 | `idea-spec`, `idea-architecture`, `idea-frd-dialog`, `idea-adr-dialog`, `idea-architecture-frd-dialog`, `idea-architecture-missing` | 25-spec, 27-architecture, 11-progress, 33-dialog |
| WO-02-018 | `model-diagram`, `model-entity-selected`, `model-zoomed-out`, `model-schema`, `model-none`, `model-invalid` | 10-segmented, 27-architecture, 14-empty-notice |
| WO-02-020 | `idea-campaign`, `idea-campaign-phase`, `idea-campaign-research`, `idea-campaign-design`, `idea-campaign-build`, `idea-campaign-release` | 42-campana, 12-command, 07-chip |

Assets: the Campaña room art and agent sprites are staged in `public/` as original bytes by WO-13-010
(`image-rendering: pixelated`, plain `<img>`, lazy-loaded off the critical path); icons come from the exported SVG
set through `Icon` (WO-13-010). Widths 1280 / 768 / 375 per the FDD; the model viewer opens on Esquema on phones.

## Removals (v2, map §6.C)

| Removed | Removing WO |
|---|---|
| Board «recomendada» badge and the favourite gold card highlight (AC-02-012.4 Out of v2) | WO-02-015 |
| `BoardLegend` (not drawn by the frozen prototype; chips carry their words) | WO-02-015 |
| v1 empty-column dash + «columna» wording (replaced by «Sin ideas en esta fase») | WO-02-015 |
| The idea detail embedded in `BoardShell` (back button, `DetailActions`, discard banner, `CardDetail` mount) and the per-card project reads of the board page | WO-02-016 |
| Discard quick-tags and the «Descartando…» in-flight state | WO-02-016 |
| `WoDag` import in the Arquitectura plan and the scoped DAG in the FRD dialog (AC-02-013.3/.6) | WO-02-017 |
| Composite-key / isolated / self-relation visual distinction, link attribute mappings, per-connector selection, viewport-filling fullscreen fallback dialog | WO-02-018 |
| Campaña per-phase checklists, inline spec-mode `<select>`, `party/*` imports (`Room`, `StoneBridge`, `AgentSprite`), the no-op `onEnterForge`, the release `deployTarget` line; «Claude Design» wording (change card) | WO-02-020 |

Each removal deletes the code, its now-unused exports and its implementer tests in the same WO (map §0.6).

## Test-side supersession (BL-0051, map §3.3)

Each WO lists its "Derogated tests". Implementer-authored tests of replaced behaviour are updated or deleted in the
same WO; reviewer-authored tests (`*.reviewer.*`) are never edited by the implementer: they are listed as derogated
and the FRD-02 gate reviewer re-blesses or rewrites them (DR-080). Visual baselines are re-blessed only by the
reviewer at the close-out Visual QA. FRD-02 hotspots: `src/app/board/_tests/*.reviewer.*`,
`src/app/board/_components/CardDetail/_tests/*.reviewer*`, `src/app/board/_utils/_tests/readCardProject.reviewer.test.ts`,
`src/app/board/_components/CardDetail/ArchitectureDigest/_tests/usability.reviewer.test.tsx`,
`src/lib/architecture/**/_tests/*.reviewer.test.ts`, `src/components/modules/DataModelViewer/_tests/*.reviewer*`,
`src/components/modules/CampaignPipeline/_tests/CampaignPipeline.wo-02-013.reviewer.test.tsx`.
The FRD's one behaviour e2e spec is `e2e/ideas-board.spec.ts` (created by WO-02-015, extended by WO-02-016:
primary flow plus every dialog's Escape, focus trap and focus return); the data-model specs
`e2e/logical-data-model.spec.ts` (WO-02-019) and `e2e/model-usability.spec.ts` (WO-02-018) stay.

## Dependencies & Risks

- **Upstream:** WO-13-012 (primitives and framing patterns: `PageHead`, `Tabs`, `Dialog` family, `Notice`,
  `Card`, `ListRow`, `Markdown`; leaf primitives via WO-13-011), WO-25-001 (URL codec, every v2 key), WO-11-003
  (`BuildModePicker`), WO-08-003 (`Paper`), FRD-01 readers (`readIdeas`, `readStatus`, docs tree) and the kept
  FRD-02 libs.
- **Downstream:** WO-04-010 mounts `SpecDigest`, `ArchitectureDigest` and `DataModelViewer` in the workspace (W5);
  WO-13-013 (W7) deletes retired primitives once FRD-02 no longer references them.
- **Risk: the idea detail moves out of the board.** WO-02-015 (W3) leaves the v1 detail branch of `BoardShell`
  rendering through its existing props; WO-02-016 (W4) moves the idea to its own route and deletes that branch in
  the same change, so no wave sees a broken route.
- **Risk: shared exports across waves.** `projectMetaChips`, `CATEGORY_LABELS`, `RETURN_LABELS` (IdeaCard),
  `GraphControls`, `useFullscreen`, `IMPLEMENT_MODES` and the digest props keep their signatures while their v1
  consumers exist (tsc green between waves).
- **Risk: the async-layout flake** is investigated before the restyle (WO-02-019 in W0, then WO-02-018 builds on
  the confirmed fix). LESSON-0185 (harness-level Playwright traps) and LESSON-0002 (defective gate test vs wrong
  production code) frame the investigation; the confirmed cause decides whether the fix lands in product code or
  in non-reviewer test timeouts.
- **Risk: host width.** AC-02-015.14 removes the inner panel cap only; LESSON-0364 (remove only the targeted
  max-width, never the shell envelope) applies to the 1180 px content frame of FRD-19.
- **Language:** shown content (idea bodies, ADRs, FRDs, documents) keeps its language; the chrome is Spanish from
  `t()` (LESSON-0490).

## Build Plan

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-02-019 | — | `src/components/modules/DataModelViewer/**`, `e2e/logical-data-model.spec.ts` | false | W0 · (FRD-02 alone in W0; global W0 with WO-13-010, WO-22-001, WO-25-001) |
| WO-02-004 | WO-01-000 | `src/lib/discard/discard.ts`, `src/lib/discard/restore.ts`, `src/lib/discard/_tests/discard.test.ts`, `src/lib/discard/_tests/discard.adversarial.test.ts`, `src/lib/discard/_tests/restore.test.ts`, `src/app/board/actions/actions.ts`, `src/app/board/actions/_tests/actions.test.ts` | false | W1 · kept v1 (VERIFIED) |
| WO-02-012 | WO-01-003, WO-02-004 | `src/lib/favorite/favorite.ts`, `src/lib/favorite/_tests/favorite.test.ts`, `src/components/core/FavoriteButton/FavoriteButton.tsx`, `src/components/core/FavoriteButton/_tests/FavoriteButton.test.tsx`, `src/app/board/actions/actions.ts`, `src/components/modules/IdeaCard/IdeaCard.tsx`, `src/lib/ideas/ideas.ts`, `src/app/board/IdeaBoardView/IdeaBoardView.tsx`, `src/app/board/_components/BoardShell/BoardShell.tsx` | false | W2 · kept v1 (VERIFIED) |
| WO-02-001 | WO-01-003, WO-01-005 | `src/lib/board/board.ts`, `src/lib/board/_tests/board.test.ts`, `src/lib/board/_tests/board.adversarial.test.ts` | false | W3 · kept v1 (VERIFIED) |
| WO-02-003 | WO-01-005 | `src/lib/next-step/next-step.ts`, `src/lib/next-step/_tests/next-step.test.ts`, `src/lib/next-step/_tests/next-step.adversarial.test.ts` | false | W3 · kept v1 (VERIFIED) |
| WO-02-011 | WO-01-003, WO-01-005 | `src/lib/campaign/campaign.ts`, `src/lib/campaign/_tests/campaign.test.ts` | false | W3 · kept v1 (VERIFIED) |
| WO-02-015 | WO-13-012, WO-25-001, WO-02-012 | `src/app/board/page.tsx`, `src/app/board/IdeaBoardView/**`, `src/app/board/_tests/**`, `src/app/board/_components/{BoardShell,IntakeModal,DiscardedModal,PhaseNav,BoardColumn}/**`, `src/components/modules/{IdeaCard,BoardLegend}/**`, `src/components/core/FavoriteButton/**`, `e2e/ideas-board.spec.ts` | false | W3 · WO-02-017, WO-02-018, WO-02-020 |
| WO-02-017 | WO-13-012, WO-25-001 | `src/app/board/_components/CardDetail/{SpecDigest,ArchitectureDigest}/**`, `src/components/modules/{ReportBand,Spec}/**`, `src/lib/{architecture,spec}/**`, `src/app/projects/[slug]/_components/_tests/{spec-tab,architecture-tab}.test.tsx` | false | W3 · WO-02-015, WO-02-018, WO-02-020 |
| WO-02-018 | WO-13-012, WO-02-019, WO-25-001 | `src/components/modules/{DataModelViewer,GraphControls}/**`, `src/hooks/useFullscreen.ts`, `src/hooks/_tests/useFullscreen*.test.ts`, `e2e/model-usability.spec.ts`, `e2e/logical-data-model.spec.ts`, `e2e/persistent-navigation/model.spec.ts` | false | W3 · WO-02-015, WO-02-017, WO-02-020 |
| WO-02-020 | WO-13-012, WO-11-003, WO-25-001 | `src/components/modules/CampaignPipeline/**`, `src/lib/command-modes.ts`, `src/lib/_tests/command-modes*.test.ts`, `src/app/board/_components/CardDetail/CardDetail.tsx`, `src/app/board/_components/CardDetail/_tests/CardDetail.tabs.test.tsx`, `e2e/persistent-navigation/board.spec.ts` | false | W3 · WO-02-015, WO-02-017, WO-02-018 |
| WO-02-013 | WO-02-003, WO-02-011 | `src/components/modules/CampaignPipeline/CampaignPipeline.tsx`, `src/components/modules/CampaignPipeline/_tests/CampaignPipeline.test.tsx` | false | W4 · kept v1 (VERIFIED) |
| WO-02-016 | WO-02-017, WO-02-004, WO-02-012, WO-25-001, WO-02-015, WO-02-020, WO-08-003 | `src/app/board/[...segments]/**`, `src/app/board/_components/CardDetail/CardDetail.tsx`, `src/app/board/_components/CardDetail/CardDetail.styles.ts`, `src/app/board/_components/CardDetail/IdeaPitch/**`, `src/app/board/_components/CardDetail/_tests/**`, `src/app/board/_components/CardDetail/useCardDocument.ts`, `src/app/board/_components/{IdeaHeader,IdeaDocs}/**`, `src/app/board/_utils/**`, `src/components/core/{DiscardButton,RestoreButton}/**`, `src/app/board/page.tsx`, `src/app/board/_components/BoardShell/**`, `src/app/board/IdeaBoardView/**`, `src/app/board/_tests/**`, `src/app/board/actions/read-doc.ts`, `e2e/ideas-board.spec.ts`, `e2e/persistent-navigation/board.spec.ts`, `src/lib/go-party/**` | false | W4 · (FRD-02 v2 alone in W4; global W4 with WO-03-007, WO-17-008, WO-10-016) |

- **Order & parallelism.** W0: WO-02-019 confirms and fixes the async-layout flake on the current viewer. W3: the
  board (WO-02-015), the digests (WO-02-017), the model viewer restyle (WO-02-018, after WO-02-019) and La Campaña
  (WO-02-020) run in parallel; their artifacts are disjoint by design (board page/shell/cards/e2e spec ·
  `CardDetail/{SpecDigest,ArchitectureDigest}` + `modules/{ReportBand,Spec}` + `lib/{architecture,spec}` ·
  `modules/{DataModelViewer,GraphControls}` + `hooks/useFullscreen` · `modules/CampaignPipeline` +
  `lib/command-modes.ts` + the single `CardDetail.tsx` call site and its tabs test). The kept v1 libs of W3
  (WO-02-001, WO-02-003, WO-02-011) own `src/lib/{board,next-step,campaign}` files none of these write. W4: the
  idea page (WO-02-016) composes the W3 outputs, takes the idea detail out of the board and extends the e2e spec.
- **Integration order.** Providers before consumers: `ReportBand`/`DigestHero` (WO-02-017) before the Propuesta
  pitch (WO-02-016); `CampaignPipeline`'s `forgeHref` contract (WO-02-020) before the idea page wires it
  (WO-02-016); `Paper` (WO-08-003) before the Documentos reader (WO-02-016); the board (WO-02-015) before the idea
  page removes the board's embedded detail (WO-02-016).
- **Cross-FRD.** In: WO-13-012 (W2), WO-25-001 (W0), WO-11-003 (W2), WO-08-003 (W3), FRD-01 kept readers. Out:
  WO-04-010 (W5) mounts the digests and the viewer; WO-13-013 (W7) depends on WO-02-015, WO-02-016, WO-02-018,
  WO-02-020.
- **Reconciliation (2026-10-22, binding).** WO-25-001 ships every FRD-02 key listed in the ledger (including the
  legacy `/board?idea=` resolution); WO-02-016 applies `normalizeLegacyNavigation` at the board route boundary. The
  split `e2e/persistent-navigation/board.spec.ts` is written by WO-02-020 (W3, campaign `phase` step) then WO-02-016
  (W4, idea tabs); `model.spec.ts` by WO-02-018 (W3, expanded paste restores the inline viewer; AC-25-011.1 cited,
  owned by WO-25-001). The forge link targets the canonical `summary` tab; `src/lib/go-party/**` (unused v1 helper
  with `?tab=party`) is deleted by WO-02-016. `CampaignPipeline` / `RoamingCast` stop importing
  `src/components/modules/party/**` in WO-02-020 (WO-04-010 depends on it). WO-02-017 keeps the digests' FRD-list
  shape stable in W3 for `listProjectFrds()` and updates only the digest-internal assertions of the workspace
  spec/architecture tab tests (WO-04-010 owns the tab-frame half in W5); WO-04-010 mounts the digests with the C3
  props. WO-05-008 deletes `WoDag/**`; WO-11-004 deletes `mode-selector/**` (last `IMPLEMENT_MODES` consumer).
- **Kept v1 work orders** (VERIFIED, never rebuilt) appear in the table so the waves and AC ownership stay
  consistent project-wide (map §0.5): WO-02-001, WO-02-003, WO-02-004, WO-02-011 (owner of AC-02-010.2),
  WO-02-012 (owner of AC-02-012.1/.2), WO-02-013.

## Work Orders

In build order (v2 work orders `PLANNED`; kept v1 work orders `VERIFIED`):

1. [WO-02-019](work-orders/wo-02-019-data-model-layout-flake.md) · W0 · data-model async layout flake (investigate, then fix).
2. [WO-02-015](work-orders/wo-02-015-board-orbita.md) · W3 · Tablero Órbita (parallel with 3, 4, 5).
3. [WO-02-017](work-orders/wo-02-017-spec-architecture-digests.md) · W3 · Spec and Arquitectura digests.
4. [WO-02-018](work-orders/wo-02-018-data-model-viewer-orbita.md) · W3 · data-model viewer restyle and removals.
5. [WO-02-020](work-orders/wo-02-020-campaign-orbita.md) · W3 · La Campaña Órbita.
6. [WO-02-016](work-orders/wo-02-016-idea-page.md) · W4 · idea page (header, tabs, Propuesta, Documentos, discard/restore).

Kept v1: [WO-02-001](work-orders/wo-02-001-derive-column.md), [WO-02-003](work-orders/wo-02-003-next-step.md),
[WO-02-004](work-orders/wo-02-004-discard-idea.md), [WO-02-011](work-orders/wo-02-011-phase-from-status.md),
[WO-02-012](work-orders/wo-02-012-favorite.md), [WO-02-013](work-orders/wo-02-013-next-step-interpolate-idea-name.md).

## Superseded (v1 history)

- WO-02-005 (board surface) → superseded by WO-02-015.
- WO-02-007 (La Campaña card detail) → superseded by WO-02-016, WO-02-017, WO-02-020.
- WO-02-014 (accessible empty-column marker, «columna» wording) → superseded by WO-02-015 (REQ-02-014 copy «Sin ideas en esta fase»).

## Readiness check (DR-100)

Before this blueprint goes ACTIVE, an independent reviewer confirms: every REQ above maps to a component or
interface; every live FRD-02 AC (56) plus AC-11-005.3 is owned by exactly one live work order and copied verbatim
(see `work-orders/README.md` § AC coverage); `dependsOn` is acyclic and names live work orders only; the W3 and W4
artifacts above are disjoint; the foundation (WO-13-010..012, WO-19-002) supplies every primitive the FRD-02 mocks
use; no open clarification marker survives in FRD-02's documents; no API contract is owed (no backend change).

## Proposal close-out implementation (2026-10-31)

`IdeaPitch` reuses `DigestHero` with an empty title for structured memos; the shared hero omits
an empty heading. The route-scoped CSS module owns proposal typography and responsive grids.
`proposalSummary` selects the first paragraph of a recognized legacy solution section, otherwise
the first prose paragraph, without altering source data or the structured pitch parser. Evidence
uses the shared Markdown renderer and its link policy. Board count tint is scoped to BoardColumn.

### Independent review corrections (2026-10-31)

`PitchDecision.tsx` contains the score row, effort chart and Evidence disclosure, keeping IdeaPitch
below the 500-line ceiling. Evidence accepts and forwards `resolveLink`; CardDetail's existing
resolver remains the only link classifier. Missing prose maps to `idea.pitch.empty` at rendering.
`ReportBand.level` is optional (default 3); structured proposal bands select 2. The board page
requires the Next.js `searchParams` promise; direct test invocations pass an explicit empty query.
