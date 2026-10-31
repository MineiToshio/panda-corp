---
id: WO-03-007
type: work-order
slug: portafolio-overview
title: 'WO-03-007 — Portafolio overview: cards, Lista, Cuentas view switch, project picker, empty and missing-path states'
status: ACTIVE
parent: FRD-03
foundation: false
implementation_status: IN_REVIEW
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
dependsOn: [WO-13-012, WO-25-001, WO-26-001, WO-01-010, WO-01-004, WO-04-013, WO-06-013]
last_updated: 2026-10-30
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
  - `build`: the value of `buildSignal()` (`src/lib/fragua/build-signal.ts`, WO-06-013): `idle`, `live` or
    `noSignal` with the last signal age (the one resolver Inicio, La Fragua, the workspace hero and this card
    share, AC-06-019.7; never stale shown as live); the card renders it through the restyled
    `FreshnessBadge` (WO-06-013).
  - `lastCommit`: `{ at }` or `{ at: null, reason: "no-repository" | "unreadable" }` from the callable
    resolver `getLastCommit(projectPath)` (`src/lib/portfolio/lastCommit.ts`, `React.cache`, `runGit`
    (WO-01-010) `log -1 --format=%cI` with `cwd` the project folder; never silently empty). It is published
    for every other surface that shows the project's last movement: the workspace hero and «último
    movimiento» (WO-04-010) and La Fragua's foot chip (passed by WO-04-011); nobody calls git for it again.
  - `pathMissing`: the existence flag inverted; the row is kept, never dropped.
  - `counts`: `ordersVerified`, `ordersTotal` (`listWorkOrders` / `aggregateProgress`), `frds` and `docs`
    (the same list the Documentos tab shows, `listProjectDocs`), `adrs`, `openChanges` (the value of
    `countOpenChanges(projectPath)`, `src/lib/changes/openChanges.ts`, WO-04-013: the one open-changes count;
    no second filter over `readChangeQueue` here), `pendingDecisions` (`readStatusWithLiveInboxCounts`).
    `null` when the folder is missing or the source failed (nothing can be read honestly). The sidebar's
    «<Fase> · <pct>%» (WO-19-003) reads `phase` and `ordersVerified` / `ordersTotal` from this item.
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
`/pandacorp:sync-portfolio`; with no `repo` the same drawn title and body are kept and only the
`/pandacorp:sync-portfolio` command box is shown (no clone command can be built). The dedicated no-remote
warning («Sin remoto registrado …») is **Out of v2** (the PM marks it in FRD-03): no captured state draws it
and the frozen catalogue has no key for it, so building it would invent copy (DR-130); it is not built.
Counts and age are omitted when the folder is missing. Detection is read-only: the app never clones, writes the
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
  other FRDs' tests, so WO-13-013 (W7) removes both fields and fixes those fixtures (reconciliation
  2026-10-22); this work order only stops reading them.

## Out of Scope

- The workspace itself, its hero and tabs (WO-04-010); this work order only mounts it.
- Where the sidebar and Inicio read the project list (WO-19-003, WO-18-002): they consume
  `getProjectOverview()`.
- `AccountsDirectory` internals (WO-26-001) and the `Segmented` primitive (WO-13-011).
- The «hace N meses» header string (design, reported) and the no-remote warning (Out of v2, see In Scope).

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
  show the dialog it opens); the no-remote warning is Out of v2 and not built (no captured state, no key).

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
(`runGit`, `now`), WO-01-004 (`readPortfolio`), WO-04-013 (`countOpenChanges`), WO-06-013 (`buildSignal()`,
`FreshnessBadge`). Consumers: WO-04-010 (mounts `ProjectSwitcher`, reads the
overview for the hero), WO-18-002 (`ProjectCard` compact, `FirstProjectCard`), WO-19-003 (sidebar projects).

## Status Note

### 2026-10-30 — S3A round 2 review patches

- Kept `implementation_status: IN_REVIEW`; no blocked reason is present. No commit or staging was performed.
- Passed the server-resolved overview view into the client. The legacy accounts URL uses that selection
  until canonical navigation takes over; returning to the root through history still selects Tarjetas.
  Added a jsdom regression with the raw legacy URL and a popstate transition; `useUrlState` is unchanged.
- Repository cells are parsed into bare clone URLs at the portfolio reader. Malformed cells become
  undefined, selecting the existing no-repository recovery branch. Added malformed-cell coverage and
  updated the non-reviewer escaped-pipe test to reject its truncated URL instead of preserving it.
- Missing-folder cards retain their phase tone, six-step stepper and stage label. Recovery commands
  are inside the Notice. Added card assertions for phase tone, steps, stage and command containment.
- Unsupported overview views no longer produce an empty quoted identifier in the 404 card. Comparison
  mobile labels come from the catalogue through the shared Table's optional mobileLabel. Corrected
  the compact stepper class separation, component inventory paths and stale consumer/rail comments.
- No reviewer test, blessed baseline, decision log or `.pandacorp` file was modified.

Verification ran from `mission-control/` with `export PORT=3961 PANDACORP_E2E_PORT=3961`:

```sh
pnpm exec knip
# PASS (exit 0); 9 configuration hints remain.
pnpm exec tsc --noEmit --incremental false
# PASS (exit 0), no diagnostics.
pnpm exec biome check .
# PASS (exit 0), 1199 files; informational schema-version mismatch (2.5.1 vs CLI 2.5.2).
pnpm exec biome check --write src/app/portfolio/not-found.tsx src/components/modules/ProjectCard/_tests/ProjectCard.test.tsx src/lib/portfolio/_tests/portfolio.adversarial.test.ts
# PASS, final 3 edited files checked; no fixes applied.
pnpm exec vitest run src/app/portfolio src/components/modules/ProjectCard src/lib/portfolio src/components/core/PhaseStepper --maxWorkers=2
# PASS, 11 files / 139 tests, including the unchanged reviewer suites in these paths.
git diff --check
# PASS (run from the worktree root).
```

Initial scoped baseline: 2 failures / 132 tests (repository Markdown and missing-folder stepper).
An intermediate run caught the old truncated-URL expectation and an incorrect tone in the newly added
implementer assertion; both were corrected before the final green run. Two pnpm invocations accidentally
ran from the factory root and failed with ERR_PNPM_RECURSIVE_EXEC_NO_PACKAGE; the commands were then run
from Mission Control as recorded above. Vitest reports Node's experimental localStorage warning.
No checks remain red in the requested scope. Browser hydration, HTTP 404 rendering, responsive/visual
fidelity and Playwright remain unverified; no full verify.sh was run.



### 2026-10-30 — S3A implementation; independent review pending

- Built the all-phase overview, cached `getProjectOverview()` and callable `getLastCommit()` through
  `runGit`, frozen-clock relative ages, shared build liveness, canonical work-order/document/FRD/open-change
  counts, and phase-derived next commands. Missing paths stay visible and failed sources stay unknown.
  `countFrdFolders()` also counts a feature represented only by its blueprint, avoiding a second FRD-count rule.
- Built Tarjetas / Lista / Cuentas with URL-owned selection, the empty-factory composition, missing-path
  recovery commands, project 404 boundary, and the searchable native project picker. Explicit selection
  mounts the existing workspace at full width; root selection remains the overview. The persistent path
  adapter remains compatible. `source` carries the existing `ProjectListItem` only for the stable workspace
  mount seam until WO-04-010; `nowIso` is the server instant consumed by freshness and age presentations.
- Removed v1 production rail/layout/slot/selection/chips/snapshot/recovery/last-sync/view-switch modules
  and their implementer tests. Kept `ProjectListItem.snapshot` / `.lastSync` compatibility fields for W7.
  No core primitives, reviewer suites, blessed baselines, decision log or `.pandacorp` state were edited.
- Added `e2e/portafolio.spec.ts`, updated the persistent-navigation root expectations, and moved the
  Cuentas fixture restoration into `test.afterEach`. No browser was launched.
- Acceptance citations: AC-03-008.1 in overview composition/resolver/real-fixture/git-fixture and ProjectCard
  tests; AC-03-008.2 in overview/table/history and authored e2e tests; AC-03-008.3 in ProjectSwitcher tests;
  AC-14-003.1 and AC-14-003.2 in the production-import removal scan. REQ-03-001/003/005/006 and U1/U2
  are also exercised in those suites. Responsive CSS reuse is inspected in unit tests; browser rendering,
  HTTP 404 delivery, reload/Back e2e, native-browser dialog behavior and visual fidelity remain unverified.
- TDD evidence: the first overview test run failed resolving the not-yet-built `formatAgo` module; targeted
  repairs led to 39 passing tests. Existing compatibility tests were retained where their source still exists.

All commands below ran from `mission-control/` with `export PORT=3961 PANDACORP_E2E_PORT=3961`:

```sh
pnpm exec vitest run src/app/portfolio/_tests/overview.test.tsx src/lib/portfolio/_tests/overview.test.ts src/lib/portfolio/_tests/overview-resolver.test.ts src/lib/portfolio/_tests/lastCommit.fixture.test.ts src/lib/portfolio/_tests/overview.integration.test.ts src/components/modules/ProjectCard src/components/modules/ProjectSwitcher --maxWorkers=2
# PASS: 7 files, 39 tests.
pnpm exec biome check src/app/portfolio src/components/modules/ProjectCard src/components/modules/ProjectSwitcher src/lib/portfolio e2e/portafolio.spec.ts e2e/cuentas.spec.ts e2e/persistent-navigation.spec.ts
# PASS: 35 files, no fixes applied (the additional integration suite was included).
pnpm exec tsc --noEmit --incremental false
# FAIL: 8 TS2307 imports in preserved legacy suites; no implementation diagnostics.
pnpm exec knip
# FAIL: the same 8 unresolved imports; also reports 9 configuration hints.
pnpm exec vitest run src/app/portfolio src/lib/portfolio src/components/modules/ProjectCard src/components/modules/ProjectSwitcher src/components/modules/ServicesDirectory src/lib/_tests/active-projects.test.ts --maxWorkers=2
# FAIL: 9 files failed, 11 passed; 8 tests failed, 162 passed. Failures are the preserved v1 suites below.
pnpm exec vitest run 'src/app/projects/[slug]/_tests/page.reviewer.test.tsx' 'src/app/projects/[slug]/_tests/page.reviewer.integration.test.tsx' 'src/app/projects/[slug]/_components/_tests/spec-workspace.reviewer.test.tsx' src/lib/navigation/_tests/identity-cli.adversarial.reviewer.test.ts src/lib/_tests/active-projects.adversarial.test.ts src/lib/_tests/active-projects.test.ts --maxWorkers=2
# FAIL: spec-workspace's 3 tests mock railProjects without allProjects; 5 other files / 79 tests pass.
git diff --check
# PASS.
```

Reviewer reconciliation required; all listed suites were left unchanged per the task:

- Retire the removed-subject suites: `src/app/portfolio/_tests/frd-03-integration.reviewer.test.tsx`,
  `src/app/portfolio/_tests/frd-03-nested-interactive.reviewer.test.tsx`,
  `src/app/portfolio/_tests/frd-03-integration.gate.reviewer.test.tsx`,
  `src/app/portfolio/_tests/frd-03-rail-reuse.gate.reviewer.test.tsx`,
  `src/app/portfolio/_tests/frd-03-gate-opus.reviewer.test.tsx`,
  `src/lib/portfolio/_tests/formatLastSync.reviewer.test.ts`, and the header-marked
  `src/app/portfolio/_components/status-chips/_tests/status-chips.adversarial.test.tsx`.
- Rewrite `src/app/portfolio/_tests/frd-03-page-assembly.reviewer.test.tsx`: it mocks the removed rail
  resolver and expects automatic first-project selection and rail recovery UI.
- Update `src/app/projects/[slug]/_components/_tests/spec-workspace.reviewer.test.tsx`: its portfolio mock
  exports the retired `railProjects` contract, so the real overview cannot resolve `allProjects`.
- Update `e2e/frd25-gate-regressions.reviewer.spec.ts` lines 13–24: it pins the retired `portfolio-page`
  root hook. It was inspected but not executed.
- Reconcile the implementer suite `src/components/modules/ServicesDirectory/_tests/ServicesDirectory.test.tsx`
  through its owner: it still imports `PortfolioViews` and tests its removed sub-tabs. That test file is
  outside S3A's permitted paths, so it was left unchanged; its unrelated AccountsDirectory/ProjectAccounts
  coverage should remain.

No commit, staging, merge, push, merge-queue invocation or full verify.sh / Playwright run was performed.
The work order is built and handed off as IN_REVIEW with the above red reconciliation work explicit.

### Explicit path list — WO-03-007 only

Paths are relative to the factory worktree; D = deleted, M = modified, A = new/untracked.

- M: `mission-control/docs/frds/frd-03-portfolio/work-orders/wo-03-007-portafolio-overview.md`
- M: `mission-control/e2e/cuentas.spec.ts`
- M: `mission-control/e2e/persistent-navigation.spec.ts`
- A: `mission-control/e2e/portafolio.spec.ts`
- D: `mission-control/src/app/portfolio/PortfolioLayout.tsx`
- A: `mission-control/src/app/portfolio/PortfolioOverview.module.css`
- A: `mission-control/src/app/portfolio/PortfolioOverview.tsx`
- D: `mission-control/src/app/portfolio/SelectableProjectRail.tsx`
- D: `mission-control/src/app/portfolio/WorkspaceSlot.tsx`
- D: `mission-control/src/app/portfolio/_components/BusinessSnapshot/BusinessSnapshot.tsx`
- D: `mission-control/src/app/portfolio/_components/BusinessSnapshot/_tests/BusinessSnapshot.test.tsx`
- D: `mission-control/src/app/portfolio/_components/PortfolioEmpty/PortfolioEmpty.tsx`
- D: `mission-control/src/app/portfolio/_components/PortfolioEmpty/_tests/PortfolioEmpty.test.tsx`
- D: `mission-control/src/app/portfolio/_components/RecoveryHint/RecoveryHint.tsx`
- D: `mission-control/src/app/portfolio/_components/RecoveryHint/_tests/RecoveryHint.reuse.test.tsx`
- D: `mission-control/src/app/portfolio/_components/RecoveryHint/_tests/RecoveryHint.test.tsx`
- D: `mission-control/src/app/portfolio/_components/status-chips/_tests/proposals-chip.test.tsx`
- D: `mission-control/src/app/portfolio/_components/status-chips/_tests/status-chips.reuse.test.tsx`
- D: `mission-control/src/app/portfolio/_components/status-chips/_tests/status-chips.test.tsx`
- D: `mission-control/src/app/portfolio/_components/status-chips/status-chips.tsx`
- D: `mission-control/src/app/portfolio/_tests/PortfolioLayout.test.tsx`
- A: `mission-control/src/app/portfolio/_tests/overview.test.tsx`
- D: `mission-control/src/app/portfolio/_tests/portfolio-last-sync.test.tsx`
- D: `mission-control/src/app/portfolio/_tests/wo-03-002-portfolio-surface.test.tsx`
- D: `mission-control/src/app/portfolio/_tests/wo-03-004.test.tsx`
- A: `mission-control/src/app/portfolio/not-found.tsx`
- M: `mission-control/src/app/portfolio/page.tsx`
- D: `mission-control/src/app/portfolio/selection.ts`
- A: `mission-control/src/components/modules/ProjectCard/FirstProjectCard.tsx`
- A: `mission-control/src/components/modules/ProjectCard/ProjectCard.module.css`
- A: `mission-control/src/components/modules/ProjectCard/ProjectCard.tsx`
- A: `mission-control/src/components/modules/ProjectCard/_tests/ProjectCard.test.tsx`
- A: `mission-control/src/components/modules/ProjectCard/_tests/fixture.ts`
- D: `mission-control/src/components/modules/ProjectRail/LastSyncChip.tsx`
- D: `mission-control/src/components/modules/ProjectRail/ProjectRail.tsx`
- D: `mission-control/src/components/modules/ProjectRail/_tests/ProjectRail.lastSync.test.tsx`
- D: `mission-control/src/components/modules/ProjectRail/_tests/ProjectRail.selectable.test.tsx`
- A: `mission-control/src/components/modules/ProjectSwitcher/ProjectSwitcher.module.css`
- A: `mission-control/src/components/modules/ProjectSwitcher/ProjectSwitcher.tsx`
- A: `mission-control/src/components/modules/ProjectSwitcher/_tests/ProjectSwitcher.test.tsx`
- D: `mission-control/src/components/modules/ServicesDirectory/PortfolioViews.tsx`
- D: `mission-control/src/lib/portfolio/_tests/activeProjects.lastSync.test.ts`
- D: `mission-control/src/lib/portfolio/_tests/formatLastSync.test.ts`
- A: `mission-control/src/lib/portfolio/_tests/lastCommit.fixture.test.ts`
- A: `mission-control/src/lib/portfolio/_tests/overview-resolver.test.ts`
- A: `mission-control/src/lib/portfolio/_tests/overview.integration.test.ts`
- A: `mission-control/src/lib/portfolio/_tests/overview.test.ts`
- D: `mission-control/src/lib/portfolio/_tests/railProjects.test.ts`
- A: `mission-control/src/lib/portfolio/formatAgo.ts`
- D: `mission-control/src/lib/portfolio/formatLastSync.ts`
- A: `mission-control/src/lib/portfolio/lastCommit.ts`
- A: `mission-control/src/lib/portfolio/overview.ts`
- M: `mission-control/src/lib/portfolio/portfolio.ts`
