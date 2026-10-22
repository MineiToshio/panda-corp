---
id: FRD-03-blueprint
type: blueprint
parent: FRD-03
status: DRAFT
implementation_status: PLANNED
readiness_gate:
grounding_gate:
consistency_gate:
last_updated: '2026-10-22'
---
# FRD-03 — Portfolio and project navigation — Feature blueprint (v2 «Órbita»)

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **feature blueprint** (DR-049): how the Portafolio overview and the project picker are built
> on top of the platform. It references the platform architecture
> ([`../../product/architecture.md`](../../product/architecture.md)): § 6 (`portfolio/`), § 7 (read-only
> invariant, copy accessor, URL as state, fixture seams), § 11 and the Route map (`/portfolio`,
> `/portfolio?view=…`). It builds on the FRD-01 readers
> ([`../frd-01-data-reading/blueprint.md`](../frd-01-data-reading/blueprint.md)), the FRD-25 codec and the FRD-26
> directory. The visual spec is `fdd.md` and `mocks/portfolio.html` (shards of the frozen prototype).

## Purpose

v1 was a left **rail** of building and shipped projects hosting one project's workspace on its right. The
frozen design replaces it (contradiction C-06): the Portafolio is **an overview of every project**, as cards
or as the «Comparativa» list, with a third view, **Cuentas**; picking a project opens its workspace across
the full width, and the same list powers the sidebar's recent projects and the «Cambiar de proyecto» dialog.
One work order, **WO-03-007** (W4), builds all of it and **removes the rail** with its tests. The three v1
work orders (the compose helper, the rail surface, the last-sync chip) are superseded by it.

## Components & Interfaces

| ID | Kind | Artifact | Responsibility | Traces |
|---|---|---|---|---|
| `CMP-03-overview` | resolver (lib) | `src/lib/portfolio/overview.ts` (+ `allProjects` in `portfolio.ts`) | The single, request-cached derivation of every project's card facts: phase, build signal, last commit, counts, next command, path-missing; ordered by last commit. | REQ-03-001, REQ-03-002, REQ-03-003, REQ-03-006, REQ-03-007, AC-03-008.1 |
| `CMP-03-portfolio-page` | page (Server) | `src/app/portfolio/page.tsx`, `[...segments]/page.tsx`, `not-found.tsx` | Overview vs workspace by selection, the `view` switch, legacy-link normalization, the unknown-project card. | REQ-03-005, REQ-03-006, REQ-03-009, AC-03-008.2 |
| `CMP-03-view-switch` | UI (client) | `src/app/portfolio/_components/PortfolioViewSwitch/` | The `Segmented` Tarjetas / Lista / Cuentas, choice in the URL. | AC-03-008.2, REQ-03-009 |
| `CMP-03-project-card` | UI | `src/components/modules/ProjectCard/` | The card (default and `compact`), the missing-folder variant, the build-without-signal chip, `FirstProjectCard`. | REQ-03-001..003, REQ-03-007, AC-03-008.1, U1, U2 |
| `CMP-03-compare-list` | UI | `src/app/portfolio/_components/ProjectCompareTable/` | The «Comparativa» table; one card per row below 1024 px; the Decisiones column. | REQ-03-004, AC-03-008.2 |
| `CMP-03-project-switcher` | UI (client) | `src/components/modules/ProjectSwitcher/` | «Cambiar proyecto» button and the searchable dialog. | AC-03-008.3, REQ-03-005 |
| `CMP-03-removals` | deletions | the rail module and its helpers (see WO-03-007) | Removes the v1 rail, last-sync chip, rail chips, business-snapshot placeholder, `PortfolioViews`. | REQ-03-004, REQ-03-007 (Out of v2), AC-14-003.1, AC-14-003.2 |
| `IF-03-projectOverview` | interface | `getProjectOverview(): ProjectOverviewItem[]` | The list every surface reads (page, picker, sidebar, Inicio). | all of the above |
| `IF-03-allProjects` | interface | `allProjects(content?): ProjectListItem[]` | Every portfolio row enriched with status and existence, any phase; `activeProjects()` is its filtered subset. | REQ-03-001 |

## Contracts

All shapes are at contract altitude; WO-03-007 owns the code.

**`ProjectOverviewItem` (read model, serializable).**

| Field | Meaning |
|---|---|
| `id` | the public navigation slug (`getProjectNavigation`), the key used in URLs and the picker |
| `name`, `path`, `repo?` | the portfolio row, verbatim (`path` may be relative or `~/…`) |
| `phase?`, `stageIndex` | resolved phase (status.yaml authoritative, the table cell as advisory fallback) and its position in the six-stage pipeline (`product` 2 … `release` 6; stage 1 is always complete) |
| `build` | `idle`, `live`, or `noSignal` with the last signal (from `status.running` and `lib/status/liveness`) |
| `lastCommit` | `{ at }` or `{ at: null, reason: "no-repository" \| "unreadable" }`, read through `runGit` |
| `pathMissing` | the folder does not resolve; the row is kept |
| `counts` | `ordersVerified`, `ordersTotal`, `frds`, `docs`, `adrs`, `openChanges`, `pendingDecisions`; `null` when the folder is missing |
| `nextCommand` | FRD-18 REQ-18-021: `implementation` with open work orders is `/pandacorp:implement`, `release` is `/pandacorp:review-launch`, otherwise `nextStep({ phase })` |

Order: last commit descending, no date last, ties by name. The facts are derived once per request
(`React.cache`, DR-115); the card, the list, the picker, the sidebar and Inicio never recompute them.

**`ProjectCard`.** `{ project: ProjectOverviewItem; compact?: boolean }`. Whole-card link for a normal
project; for a missing folder an `article` whose title is the only link and which holds the recovery
`CommandBox`es (no nested interactive content inside a link). **`ProjectSwitcher`.** `{ projects:
ProjectOverviewItem[]; currentId: string }`. **`FirstProjectCard`.** No props; exported from the `ProjectCard`
folder and reused by Inicio's empty state (WO-18-002).

**URL (keys shipped by WO-25-001).** `/portfolio` is the overview; `/portfolio?view=<tarjetas · lista ·
cuentas>` selects the view (`portfolioView=accounts` is accepted and normalized to `view=cuentas`);
`/portfolio/:project[/:tab…]` is the workspace (both `portfolio` and `projects` surfaces render the same
workspace). An unsupported `view`, an unknown project or tab is a bounded 404, never the first project. Search
typing replaces history. No URL write runs a mutation.

**Seams.**
- `ProjectWorkspace({ item, selection, headingLevel, navigationBaseHref })` (WO-04-010) keeps its v1 props
  as the stable seam this page mounts; WO-04-010 may rewrite its inside, not its signature, without
  also amending the Portafolio page.
- `AccountsDirectory({ services })` (WO-26-001) is mounted for `view=cuentas`.
- `getProjectOverview()` is read by WO-04-010 (hero stats and the switcher's list), WO-19-003 (five most
  recent projects, phase hue, percentage) and WO-18-002 (`ProjectCard` compact).

## Requirement → component traceability

The FRD names `REQ-03-001` to `REQ-03-009`; two unnumbered EARS bullets are referred to as `U1` (empty
portfolio) and `U2` (folder missing), as in the FDD.

| REQ | Requirement (abridged) | Component(s) / interface(s) |
|---|---|---|
| REQ-03-001 | Overview of ALL projects, cards or list, each once whatever its phase; the sidebar lists five. | `CMP-03-overview`, `IF-03-allProjects`, `CMP-03-project-card`, `CMP-03-compare-list` |
| REQ-03-002 | A re-versioned project back in `implementation` shows the Construcción chip and keeps its place. | `CMP-03-overview` (phase from status.yaml), `CMP-03-project-card` |
| REQ-03-003 | Each card: title, phase, «Construyendo» if running (the stopped indicator is Out of v2); «Sin señal» when the claim is not live. | `CMP-03-project-card`, `CMP-03-overview` (`build`) |
| REQ-03-004 | **Out of v2.** Decision and bug badges on rail rows; the decisions count is the Lista column. | `CMP-03-compare-list`, `CMP-03-removals` |
| REQ-03-005 | Selecting a project (card, Lista row, sidebar entry, picker) shows its workspace across the full width. | `CMP-03-portfolio-page`, `CMP-03-project-switcher` |
| REQ-03-006 | No project selected: the overview (cards), not a default project's workspace. | `CMP-03-portfolio-page` |
| REQ-03-007 | Relative time of the last commit: «hace N h» on cards (header wording is FRD-04); the invalid-date chip is Out of v2. | `CMP-03-overview` (`formatAgo`), `CMP-03-project-card`, `CMP-03-removals` |
| REQ-03-008 | Cards, Lista and the project picker (AC-03-008.1 to .3). | `CMP-03-project-card`, `CMP-03-compare-list`, `CMP-03-project-switcher`, `CMP-03-view-switch` |
| REQ-03-009 | Cuentas as the third view, working with no project and with an empty portfolio. | `CMP-03-view-switch`, `CMP-03-portfolio-page`, `AccountsDirectory` (FRD-26) |
| U1 | No projects: a designed first-action empty state. | `CMP-03-project-card` (`FirstProjectCard`), `CMP-03-portfolio-page` |
| U2 | Folder missing: «Ruta no encontrada» chip, recovery command or no-remote warning, read-only. | `CMP-03-project-card` (missing variant), `CMP-03-overview` (`pathMissing`) |

## Dependencies & Risks

- Upstream: FRD-13 primitives (WO-13-012), FRD-25 codec (WO-25-001), FRD-26 directory (WO-26-001), FRD-01
  readers and seams (WO-01-004, WO-01-010), and the existing readers `lib/work-orders`, `lib/docs/tree`,
  `lib/changes`, `lib/status/liveness`, `lib/next-step`. Downstream: WO-04-010, WO-18-002, WO-19-003.
- Risk, shared derivation: three FRDs show the same counts and next command; if any recomputes them the
  copies drift (DR-115). `getProjectOverview()` is the only source; reviewers check it.
- Risk, oracle versus honesty: the captured `portfolio-path-missing` card still draws counts and an age for
  a folder that does not resolve, which the app cannot read; the work order omits them and reports it.
- Risk, git cost: one last-commit read per project per request; bounded by the portfolio size and by the
  `runGit` timeout, and one unreadable repository degrades only its own card.
- Risk, cross-FRD seam: `ProjectWorkspace` and `activeProjects()` callers (Inicio, self-suggest, the
  standalone route) are changed by other work orders in later waves; this plan keeps both compatible.

## Build Plan

> The build engine reads this table; it does not infer dependencies.

| WO | Depends on | Artifacts | Foundation | Parallel with |
|---|---|---|---|---|
| WO-03-007 | WO-13-012, WO-25-001, WO-26-001, WO-01-010, WO-01-004 | `src/app/portfolio/**`, `src/components/modules/ProjectCard/**`, `src/components/modules/ProjectSwitcher/**`, `src/components/modules/ProjectRail/**`, `src/components/modules/ServicesDirectory/PortfolioViews.tsx`, `src/lib/portfolio/**`, `src/lib/_tests/active-projects.test.ts`, `e2e/portafolio.spec.ts`, `e2e/cuentas.spec.ts`, `e2e/persistent-navigation.spec.ts` | false | W4; with WO-17-008, WO-10-016, WO-02-016 |

- **Order and parallelism.** One coarse work order: the overview resolver, the page, the cards, the list and
  the switcher share one read model and one removal list; splitting would put two writers on
  `src/lib/portfolio/**` and on the page. It is the only work order of the FRD.
- **Artifacts, disjoint within a wave (DR-060).** In W4 the other work orders write
  `src/app/{proposals,achievements,board}`, `src/lib/{proposals,self-suggest,memory}` and their modules; none
  writes these paths. `src/components/modules/ServicesDirectory/PortfolioViews.tsx` is also in WO-26-001's
  glob (W3) and `e2e/cuentas.spec.ts` / `e2e/persistent-navigation.spec.ts` are shared with WO-26-001 (W3),
  WO-25-001 (W0) and WO-04-010 (W5): serialized by wave, never parallel.
- **Integration order.** After WO-26-001 (the directory it mounts) and WO-25-001; before WO-04-010 (which
  mounts `ProjectSwitcher` and reads the overview), WO-18-002 and WO-19-003.
- **Cross-FRD dependencies.** WO-13-012 (FRD-13), WO-25-001 (FRD-25), WO-26-001 (FRD-26), WO-01-010 and
  WO-01-004 (FRD-01).
- **Visual spec.** `mocks/portfolio.html`: `#portfolio-cards`, `#portfolio-list`, `#portfolio-project-picker`,
  `#portfolio-project-picker-search`, `#portfolio-project-not-found`, `#portfolio-path-missing`,
  `#factory-empty`, `#build-no-signal`; host of `frd-26-services-accounts/mocks/services-accounts.html#portfolio-accounts`.
  Assets: the exported icons only; no image.

## Superseded (v1 history)

- WO-03-001 `active-projects` (the `activeProjects` compose helper; its behaviour lives on inside the new
  resolver and `allProjects`) superseded by WO-03-007.
- WO-03-002 `project-rail` (rail, table, rows, empty state, recovery, status chips) superseded by WO-03-007.
- WO-03-006 `last-sync-chip` (relative last-sync chip on the rail row) superseded by WO-03-007.

## Work Orders

[`WO-03-007`](work-orders/wo-03-007-portafolio-overview.md): the only live one. Index:
[`work-orders/README.md`](work-orders/README.md).
