---
id: WO-03-007
type: work-order
slug: portafolio-overview
title: 'WO-03-007 — Portafolio overview: cards, Lista, Cuentas view switch, project picker, empty and missing-path states'
status: DRAFT
parent: FRD-03
foundation: false
implementation_status: PLANNED
difficulty: high
reopen_count: 0
artifacts:
  - 'src/app/portfolio/**'
  - 'src/components/modules/ProjectCard/**'
  - 'src/components/modules/ProjectSwitcher/**'
  - 'src/components/modules/ProjectRail/**'
  - 'src/components/modules/ServicesDirectory/PortfolioViews.tsx'
  - 'src/lib/portfolio/**'
  - 'src/lib/_tests/active-projects.test.ts'
  - 'e2e/portafolio.spec.ts'
  - 'e2e/cuentas.spec.ts'
  - 'e2e/persistent-navigation.spec.ts'
source_requirements: [REQ-03-001, REQ-03-002, REQ-03-003, REQ-03-004, REQ-03-005, REQ-03-006, REQ-03-007, REQ-03-008, REQ-03-009]
dependsOn: [WO-13-012, WO-25-001, WO-26-001, WO-01-010, WO-01-004]
last_updated: 2026-10-22
---

# WO-03-007 Portafolio overview: cards, Lista, Cuentas view switch, project picker, empty and missing-path states

## Summary

Builds the v2 Portafolio: one overview of **every** project, ordered by last commit, as cards (default) or
the «Comparativa» list, with a three-way view switch **Tarjetas / Lista / Cuentas** (Cuentas mounts the
global directory of WO-26-001), the «Cambiar de proyecto» dialog for the project header, and the designed
states: first-action card for an empty factory, «Ruta no encontrada» with its recovery commands, «Sin señal»
instead of «Construyendo», and the unknown-project card. Picking a project shows its workspace across the
full width. It also **removes the v1 rail** (the left vertical project list, its collapse layout, the
last-sync chip, the rail decision / bug / rethink chips, the business-snapshot placeholder, the
`PortfolioViews` sub-tabs) in the same work order, with their tests.

## In Scope

**Data (`src/lib/portfolio/`).**

- `allProjects(content?)`: the existing compose helper without the phase filter, so every project is
  listed whatever its phase (REQ-03-001) and `product` / `design` phases resolve (the advisory-cell map gains
  `product` and `design`, in English and Spanish). `activeProjects()` keeps its signature and its
  `architecture` / `implementation` / `release` set (its callers, Inicio, self-suggest and the standalone
  route, move in later work orders). `railProjects()`, `formatLastSync` and the rail-only parts are deleted.
- `src/lib/portfolio/overview.ts`: `getProjectOverview(): ProjectOverviewItem[]`, wrapped in `React.cache`
  and the **single derivation** every card, row, picker entry, sidebar entry (WO-19-003) and Inicio card
  (WO-18-002) reads (DR-115). It builds on `allProjects()` (no second status / existence derivation) and adds:
  - `id`: the public navigation slug (`getProjectNavigation`); `name`, `path`, `repo?`.
  - `phase?` and `stageIndex` (`product` 2, `design` 3, `architecture` 4, `implementation` 5, `release` 6;
    stage 1, Investigación, is complete for any existing project; `phase` undefined when neither source
    supplies one, and the stepper then shows every segment pending).
  - `build`: `idle`, `live` or `noSignal` with the last signal, from `status.running` and the freshness of
    `lib/status/liveness` (the same resolver Inicio and La Fragua use; never stale shown as live).
  - `lastCommit`: `{ at }` or `{ at: null, reason: "no-repository" | "unreadable" }`, read through
    `runGit` (WO-01-010) with `cwd` the project folder; never silently empty.
  - `pathMissing`: the existence flag inverted; the row is kept, never dropped.
  - `counts`: `ordersVerified`, `ordersTotal` (`listWorkOrders` / `aggregateProgress`), `frds` and `docs`
    (the same list the Documentos tab shows, `listProjectDocs`), `adrs`, `openChanges` (`readChangeQueue`
    items not done or discarded), `pendingDecisions` (`readStatusWithLiveInboxCounts`). `null` when the
    folder is missing (nothing can be read honestly).
  - `nextCommand`: FRD-18 REQ-18-021, derived from the phase and never from a fixture: an
    `implementation` project with any work order not verified maps to `/pandacorp:implement`; a `release`
    project to `/pandacorp:review-launch`; otherwise the phase's natural next step (`nextStep({ phase })`).
  - Order: `lastCommit.at` descending, projects without a date last, ties by name.
  - A relative-time helper `formatAgo(then, now)` over `common.relativeTime` (`hace menos de 1 h`, `hace N h`
    up to 48 h, then `hace N días`), `now` from `now()` (WO-01-010). The «hace N meses» bucket of the project
    header belongs to FRD-04 and is not in the catalogue (reported).

**Page (`src/app/portfolio/`).** `page.tsx` and `[...segments]/page.tsx` keep the persistent-URL adapters
and add the v2 behaviour: legacy links are passed through `normalizeLegacyNavigation` (WO-25-001) and
`NavigationCanonical` (a replace); `view` is validated (`tarjetas` default, `lista`, `cuentas`; any other
value is `notFound`); with **no project selected the overview shows** (REQ-03-006), never a default
project's workspace; with a project selected the page renders `ProjectWorkspace` (its v1 props
`item`, `selection`, `headingLevel`, `navigationBaseHref` are a stable seam until WO-04-010) across the full
content width and no Portafolio title block; an unknown project is a segment `not-found.tsx` rendering the
designed card (`portafolio.notFoundProject.*`: «Este proyecto no existe», «No hay ningún proyecto «{id}».»,
button «Ver todos los proyectos»), HTTP 404.

- Overview chrome: `PageHead` (H1 «Portafolio» equal to the nav label, subtitle), then the `Segmented`
  switch named «Vista del portafolio» (neutral selected state, `aria-pressed`, choice in the URL) with, on
  the right, the faint label «Ordenados por último cambio» (Tarjetas, Lista) or «Directorio de cuentas de la
  fábrica» (Cuentas).
- **Tarjetas**: `ProjectCard` per project in a three-column grid at 1280 (fewer below, one at 375).
- **Lista**: a `Card` with `CardHeader` «Comparativa» holding a `Table` (Proyecto, Fase, Work orders as a
  `ProgressBar` with `n/m`, FRDs, Docs, ADRs, Cambios abiertos, Decisiones), one card per row below 1024 px
  (one DOM, `data-label` captions from `portafolio.compare.mobileLabels`); the decisions count is the column
  that replaces the retired rail badge (REQ-03-004 Out of v2).
- **Cuentas**: mounts `AccountsDirectory` (WO-26-001) with `getServicesDirectory()`; works with no project
  and with an empty portfolio.
- **Empty factory**: `FirstProjectCard` (an `EmptyState` composition exported from the `ProjectCard` folder,
  also reused by Inicio): «Tu fábrica todavía no tiene proyectos», «Un proyecto nace de una idea.», the
  capture step with the `/pandacorp:new-idea` command box, the convert step with `/pandacorp:spec <idea>`;
  the view switch stays so Cuentas is reachable.

**`ProjectCard` (`src/components/modules/ProjectCard/`).** Props `{ project: ProjectOverviewItem; compact?:
boolean }` (the `compact` variant is the Inicio «Tu cartera» card, WO-18-002 places it). Keeps the recorded
hooks (`.proj-card`, `data-tone` by phase hue, `.pav`, `.ring`, `.stepper.compact`, `.facts`). Content:
avatar with initials in the phase hue; title; phase chip with dot; **ring of verified work orders** with its
percentage numeral and text alternative («{n} de {m} work orders verificadas», focusable tooltip) or, with no
work orders, the plain chip «Sin WOs»; the six-segment compact `PhaseStepper` (tooltip and visually hidden
state per segment, «Investigación» to «Lanzamiento»); «Etapa N de 6 del pipeline · último cambio hace …»;
the facts (`n/m WO verificadas`, `FRDs`, `docs`) and, only while running, the chip «Construyendo» or, when
the running claim is not live, «Sin señal · último evento hace …» (REQ-03-003; the v1 «stopped» indicator is
gone); «Siguiente · `<command>`». The whole card is one link to the workspace. The **missing-folder** card
(`article.proj-card.is-missing`, coral tint) keeps its title as the only link and shows the `Notice`
«Ruta no encontrada» with the sentence and two `CommandBox`es, `git clone <repo> <path>` then
`/pandacorp:sync-portfolio`; with no `repo` the warning (reported: the FRD wording and the catalogue's
`inicio.pathMissing.bodyNoRepo` differ and the state is not captured; the catalogue key is used). Counts
and age are omitted when the folder is missing. Detection is read-only: the app never clones, writes the
portfolio or calls Claude.

**`ProjectSwitcher` (`src/components/modules/ProjectSwitcher/`).** Props `{ projects: ProjectOverviewItem[];
currentId: string }`. A client «Cambiar proyecto» button (`workspace.hero.switcher`) opening a native
`Dialog` (kicker «Portafolio», title «Cambiar de proyecto») with a focused `SearchField` («Buscar
proyecto…»), `ListRow`s in the overview order (Avatar, name, «{fase} · {n} FRDs · {n} documentos · {done}/{total}
WO» or «sin WOs», `ProgressBar`, the «Actual» chip on the open project); typing narrows; Escape closes and
focus returns to the button; a row navigates to that project's workspace. WO-04-010 mounts it in
`ProjectHeroCompact` and the Resumen hero.

**Removals (owner clarification 2026-10-22, map §6.C item 4), in this work order.**

- Delete `src/components/modules/ProjectRail/**` (`ProjectRail`, `LastSyncChip`, their tests).
- Delete from `src/app/portfolio/`: `PortfolioLayout.tsx`, `SelectableProjectRail.tsx`, `WorkspaceSlot.tsx`,
  `selection.ts`, `_components/{status-chips,BusinessSnapshot,PortfolioEmpty,RecoveryHint}/**`.
- Delete `src/lib/portfolio/formatLastSync.ts` and `railProjects()`; delete
  `src/components/modules/ServicesDirectory/PortfolioViews.tsx` (the view switch is the `Segmented`).
- Remove the rail decision / bug / rethink chips (AC-14-003.1, AC-14-003.2), the invalid-date chip and the
  business snapshot; nothing is kept behind a flag (PRD A-2).
- `ProjectListItem.snapshot` and `.lastSync` lose their only readers here; their removal touches fixtures in
  other FRDs' tests and is left to the dead-code sweep (reported), not done silently.

## Out of Scope

- The workspace itself, its hero and tabs (WO-04-010); this work order only mounts it.
- Where the sidebar and Inicio read the project list (WO-19-003, WO-18-002): they consume
  `getProjectOverview()`.
- `AccountsDirectory` internals (WO-26-001) and the `Segmented` primitive (WO-13-011).
- The «hace N meses» header string and the no-remote wording (design, reported).

## Requirements & Acceptance Criteria

REQ-03-001 to REQ-03-007 and REQ-03-009 are EARS bullets without ids in the FRD; the ACs below are the id-ed
ones. REQ-03-004, the stopped indicator of REQ-03-003, the invalid-date chip of REQ-03-007 and the rail
chips of REQ-14-003 are **Out of v2**: they are verified by their removal.

- **AC-03-008.1** — THE Portafolio overview SHALL show one card per project, ordered by last commit, each with the project avatar, its phase chip, a six-segment stepper with a tooltip per phase, a progress ring of verified work orders with its tooltip, "Etapa N de 6 del pipeline · último cambio hace …", its counts, and "Siguiente · `<command>`" (the next command, FRD-18 REQ-18-021).
- **AC-03-008.2** — WHEN the owner picks "Lista" in the Tarjetas / Lista switch, THE system SHALL show a comparison table (Fase, FRDs, Docs, ADRs, Cambios abiertos, Decisiones) instead of the cards, SHALL keep the choice in the URL (`view=lista`), and SHALL render one card per row below 1024 px.
- **AC-03-008.3** — WHEN the owner activates "Cambiar de proyecto", THE system SHALL open a dialog (kicker "Portafolio") with a searchable list of projects, in the same order as the overview (last commit first).
- **AC-14-003.1** — **Out of v2 (owner decision 2026-10-21; the rail is gone, the decisions count is a column of the Lista view, FRD-03 AC-03-008.2):** EACH project in the portfolio rail SHALL show **chips** with the number of **pending decisions** (amber) and **bugs in the inbox** (red), derived live from the project's inbox (`readStatusWithLiveInboxCounts` — DR-092/DR-115), never a status.yaml counter.
- **AC-14-003.2** — **Out of v2 (owner decision 2026-10-21; the rail is gone):** IF a project has `rethink_pending: true`, it SHALL indicate it (the build is going to pause for a major change).

**Where each is proven.** 008.1: component tests of `ProjectCard` over a committed overview fixture (every
fact, tooltips, ring text alternative, «Sin WOs», «Sin señal», order by last commit, the next-command rule
per phase) and the overview resolver tests (last commit through the fixture git, `lastCommit` reasons,
counts). 008.2: the Lista table, `view=lista` in the URL after reload, the one-card-per-row layout below
1024 px, and a Decisiones column that equals `pendingDecisions`. 008.3: dialog open, search, order, «Actual»,
focus return. AC-14-003.1 / .2: the rail module, its chips, `railProjects` and the tests that pinned them are
gone (a repository scan test asserts no remaining import of the deleted modules), and the Decisiones column
carries the count. REQ-03-001/006: a project of every phase listed once, no default project selected.
REQ-03-005: a card opens the workspace at full width. U1/U2: factory-empty and path-missing states.

## Components & Interfaces

`CMP-03-overview` with `IF-03-projectOverview`; `CMP-03-portfolio-page`; `CMP-03-project-card` (with
`FirstProjectCard`); `CMP-03-compare-list`; `CMP-03-project-switcher`; `CMP-03-view-switch`;
`CMP-03-removals`. See `../blueprint.md`.

## Reuse

Check-before-create (DR-057): `PageHead`, `Segmented`, `Card` / `CardHeader`, `Table`, `Chip`, `Avatar`,
`Ring`, `PhaseStepper`, `ProgressBar`, `CommandBox`, `Notice`, `EmptyState`, `Dialog`, `SearchField`, `ListRow`
come from WO-13-011 / WO-13-012; `AccountsDirectory` from WO-26-001; `NavigationCanonical` and the
normalizer from WO-25-001. `ProjectCard` and `ProjectSwitcher` are `new` rows of `components.md`; the paths
`src/app/portfolio/_components/ProjectCard.tsx` and `…/projects/[slug]/_components/ProjectSwitcher.tsx` of the
inventory are **relocated** to `src/components/modules/ProjectCard/` and `…/ProjectSwitcher/` because each is
consumed by several routes (Portafolio, Inicio, sidebar, workspace); names and props are unchanged
(`project`, `compact`; `projects[]`).

## Installs

None.

## Visual reference

- **Mock screen(s) to reproduce:** `docs/frds/frd-03-portfolio/mocks/portfolio.html` states
  `#portfolio-cards`, `#portfolio-list`, `#portfolio-project-picker`, `#portfolio-project-picker-search`,
  `#portfolio-project-not-found`, `#portfolio-path-missing`, `#factory-empty`, `#build-no-signal`; the host
  frame of `docs/frds/frd-26-services-accounts/mocks/services-accounts.html#portfolio-accounts`. Oracle
  states: `portfolio-cards`, `portfolio-list`, `portfolio-project-picker`, `portfolio-project-picker-search`,
  `portfolio-project-not-found`, `portfolio-path-missing`, `factory-empty`, `build-no-signal`,
  `portfolio-accounts`. Captured at 1280, 768 and 375 (the picker at 375 and 1280), light and dark.
- **Token slice:** phase hues (`teal`, `blue`, `pink`, `amber`, `violet`, `green`) for avatar, chip and
  stepper; coral for the missing-folder card; card, chip, ring, progress, table and dialog surfaces; radius and
  spacing of `Card` and `ListRow`. References: `docs/design/prototype/reference/css/` files `06-card`,
  `07-chip`, `10-segmented`, `11-progress`, `12-command`, `13-list-row`, `14-empty-notice`, `16-table`,
  `21-phase-stepper`, `22-inicio`, `56-freeze-additions` (ProjectCardMissing, FirstActionCard).
- **FDD pointer:** `docs/frds/frd-03-portfolio/fdd.md`.
- **Fidelity acceptance criterion:** the built screens match the mocks (layout, structure, components,
  density) on the frozen tokens, not an approximation; verified by the preview smoke gate (DR-055) and the
  close-out Visual QA in oracle mode.
- Copy keys: `portafolio.*`, `dialogs.projectPicker.*`, `inicio.pathMissing.*`, `inicio.firstProject.*`,
  `common.build.*`, `common.relativeTime.*`, `workspace.hero.switcher.*`, `shell.projects.toggleTitle`.
  The button «Cambiar proyecto» is drawn in FRD-04's `project-summary` state (the picker states of this FRD
  show the dialog it opens); the no-remote warning is not drawn in any captured state (key only, reported).

## Tests this WO owns

- `src/lib/portfolio/_tests/overview.test.ts` and updates to `portfolio.test.ts` helpers: order, counts,
  next command, `lastCommit` reasons, `pathMissing`, every phase listed once, `activeProjects` unchanged.
- `src/components/modules/ProjectCard/_tests/`, `ProjectSwitcher/_tests/`, `src/app/portfolio/_tests/`
  (page assembly: overview default, `view` values, unknown project 404, legacy link normalization, empty
  factory, Cuentas with no project).
- One behaviour e2e spec `e2e/portafolio.spec.ts` (hydration-safe): overview lists the fixture projects,
  Lista via the switch with `view=lista` surviving reload and Back, Cuentas view opens, unknown project is
  404 with the designed card.
- A scan test: no source file imports a deleted rail module.

## Derogated tests (BL-0051, same work order)

- Implementer-authored, **deleted or rewritten here**: `src/app/portfolio/_tests/{PortfolioLayout,wo-03-004,
  portfolio-last-sync,wo-03-002-portfolio-surface}.test.tsx`; `src/app/portfolio/_components/{status-chips,
  BusinessSnapshot,PortfolioEmpty,RecoveryHint}/_tests/**`; `src/components/modules/ProjectRail/_tests/**`;
  `src/lib/portfolio/_tests/{railProjects,activeProjects.lastSync,formatLastSync}.test.ts`;
  `src/lib/_tests/active-projects.test.ts` (rail and `lastSync` assertions removed, `activeProjects`
  behaviour kept).
- Reviewer-authored, **`git rm`** (the whole module they exercise is removed): `src/app/portfolio/_tests/
  frd-03-integration.reviewer.test.tsx`, `frd-03-nested-interactive.reviewer.test.tsx`,
  `frd-03-integration.gate.reviewer.test.tsx`, `frd-03-rail-reuse.gate.reviewer.test.tsx`,
  `frd-03-gate-opus.reviewer.test.tsx`, `src/lib/portfolio/_tests/formatLastSync.reviewer.test.ts`; listed in
  the Status Note.
- Reviewer-authored, **derogated, not edited**: `src/app/portfolio/_tests/frd-03-page-assembly.reviewer.test.tsx`
  (it exercises `../page`, which this WO rewrites); the FRD-03 gate reviewer rewrites it (DR-080).
- `e2e/persistent-navigation.spec.ts` (core): the `/portfolio` root step (it expected an auto-selected
  `mission-control/summary`) now expects the overview; the legacy-link steps still pass through
  normalization. `e2e/cuentas.spec.ts` (WO-26-001): `portfolioView=accounts` becomes `view=cuentas`.
- Visual baselines: untouched (reviewer-only, DR-080).

## Definition of done

- Tests first (RED, then GREEN); `.pandacorp/verify.sh` green: biome, `tsc --strict`, vitest, knip, madge,
  smoke and shell; the removal list above is entirely gone (reviewer checks it).
- Error path per failure mode: unreadable git (`lastCommit` reason, card still listed), missing folder,
  malformed `status.yaml` (partial data), unknown project, unsupported `view`, factory with no projects.
- Non-functional: no request waterfall (`Promise.all` across independent reads, one cached resolver);
  nothing unbounded rendered (≤ a few dozen projects); the page is a Server Component, only the switch,
  the switcher and copy buttons are client; keyboard operable; WCAG AA both themes; 44 px design target;
  phase and signal never by colour alone; reduced motion honoured; read-only invariant intact.
- Cite the `LESSON-NNNN` that shapes a choice in the commit or the Status Note (rule 8).

## Dependencies

WO-13-012 (primitives), WO-25-001 (codec, normalizer, keys), WO-26-001 (`AccountsDirectory`), WO-01-010
(`runGit`, `now`), WO-01-004 (`readPortfolio`). Consumers: WO-04-010 (mounts `ProjectSwitcher`, reads the
overview for the hero), WO-18-002 (`ProjectCard` compact, `FirstProjectCard`), WO-19-003 (sidebar projects).

## Status Note
