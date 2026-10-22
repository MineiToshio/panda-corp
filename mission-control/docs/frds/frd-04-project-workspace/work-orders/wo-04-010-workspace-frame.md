---
id: WO-04-010
type: work-order
slug: workspace-frame
title: 'WO-04-010 — Workspace frame: eight tabs, heroes, panel contract, Spec/Arquitectura/Cuentas mounts, Party removal'
status: DRAFT
parent: FRD-04
foundation: false
implementation_status: PLANNED
blocked_reason:
difficulty: high
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/page.tsx'
  - 'src/app/projects/[slug]/ProjectWorkspace.tsx'
  - 'src/app/projects/[slug]/workspace-route.ts'
  - 'src/app/projects/[slug]/[...segments]/**'
  - 'src/app/projects/[slug]/_panels/**'
  - 'src/app/projects/[slug]/_components/{tabbar.tsx,workspace-header.tsx,objectives-bar.tsx,WorkspaceNavigation.tsx,tab-spec.tsx,document-links.ts}'
  - 'src/app/projects/[slug]/_components/{ProjectHero,ProjectHeroCompact}/**'
  - 'src/app/projects/[slug]/_components/_tests/{workspace-shell,workspace-navigation,spec-tab,spec-workspace,architecture-tab}*.test.tsx'
  - 'src/app/projects/[slug]/_components/wo-detail/_tests/wo-detail.integration.test.tsx'
  - 'src/app/projects/[slug]/_tests/**'
  - 'src/app/projects/[slug]/_party/**'
  - 'src/components/modules/party/**'
  - 'e2e/{_workspaceTabs.ts,logical-data-model.spec.ts,portfolio-spec.spec.ts,persistent-navigation.spec.ts}'
source_requirements: [REQ-04-001, REQ-04-002, REQ-04-003, REQ-04-012, REQ-04-013, REQ-04-014, REQ-12-006]
dependsOn: [WO-19-002, WO-03-007, WO-02-017, WO-26-001, WO-25-001, WO-13-012, WO-06-013, WO-04-013]
last_updated: 2026-10-22
change_ref: e2e-workspace-tabs-stale.md
---

# WO-04-010 — Workspace frame: eight tabs, heroes, panel contract, Spec/Arquitectura/Cuentas mounts, Party removal

> **`implementation_status` is the build engine's source of truth.** `PLANNED → IN_PROGRESS → IN_REVIEW →
> VERIFIED`; never hand-set `VERIFIED`. Blueprint: [`../blueprint.md`](../blueprint.md) §3, §4.1 to §4.3.

## Summary

Rebuilds the project workspace frame on Órbita: crumbs, `ProjectHero` on Resumen and `ProjectHeroCompact`
on every other tab (both with «Cambiar proyecto»), the eight-tab bar with count badges, the `_panels`
contract with the shared `WorkspaceProject` resolver, the final Spec / Arquitectura / Cuentas panels, the
unknown-tab card, legacy `party` / `work-orders` links landing on Resumen / Observabilidad, and the removal of
the Party tab, its sprite scene, the separate Work orders tab, the objectives bar and the header deploy
target. The other five panels are wired to their current v1 content until their own work orders land.

## In Scope

- `IF-04-workspace-project` (`_panels/workspaceProject.ts`): the request-scoped resolver of blueprint §4.1
  (identity with the stable slug, status, build liveness, progress, counts, last movement, next step), built
  only from `src/lib` readers: `listWorkOrders`/`aggregateProgress`, `listProjectDocs`/`countFrdFolders`,
  `countOpenChanges` (WO-04-013), `countPendingDecisions`, the FRD-26 allocation reader, the WO-03-007
  last-commit resolver, `src/lib/status/liveness.ts`, `nextStep`.
- `IF-04-panel-contract` (`_panels/types.ts` + the eight `_panels/*Panel.tsx`): `PanelProps = { project, route }`.
  Resumen, Observabilidad, Cambios, Documentos and Comandos render the current v1 content (v1 `TabSummary`
  with its current props; v1 work-order list or `WorkOrderDetail` when a work order is selected, then the
  v1 `ObservabilidadTab`; v1 `TabChanges`; v1 `TabDocuments`; v1 `TabCommands`).
- `CMP-04-workspace` (`ProjectWorkspace.tsx`, `page.tsx`, `[...segments]/page.tsx`, `workspace-route.ts`):
  crumbs «Portafolio › <Proyecto>», hero vs compact hero by tab, tab bar, selected panel keyed by the project
  path. Same exported props and helper signatures (the Portafolio page of WO-03-007 hosts it). Tab resolution
  uses the codec's canonical ids and alias table (WO-25-001): `party` → `summary`, `work-orders` and
  `observabilidad` → `observability`, a raw `?tab=Work orders` → `observability`; the canonical URL is written
  back; an alias is never a not-found. An unknown tab renders `SectionNotFound` under the compact header.
- `CMP-04-tabbar` (`tabbar.tsx`): the eight tabs on the shared `Tabs` with icon, hue, count badge
  (Observabilidad = work orders, Cuentas = services, Cambios = open changes, Documentos = documents; none when
  zero or unknown), overflow arrows, arrow keys, selected tab scrolled into view on phones; `tablist`
  accessible name «Secciones de <Proyecto>»; `data-testid="tab-<id>"` plus the prototype's
  `data-tabkey`/`data-tabval` hooks.
- `CMP-04-project-hero` / `CMP-04-project-hero-compact` (`_components/ProjectHero/`,
  `_components/ProjectHeroCompact/`): as drawn; the build chip reads «Construyendo» only while the build is
  live, «Sin señal · último evento hace N» when `running` is not backed by a fresh signal (drawn in FRD-14's
  `build-no-signal` capture; through the restyled `FreshnessBadge` of WO-06-013), «Sin construcción activa»
  otherwise; the no-version, no-plan and no-orders fallbacks use the catalogue keys
  `workspace.hero.noVersion`, `workspace.hero.stats.noPlan`, `workspace.hero.compact.noOrders`; the subtitle is
  clamped to two lines with the `workspace.hero.subtitle.*` toggle past 180 characters; the switcher is
  WO-03-007's `ProjectSwitcher`.
- `CMP-04-panel-spec`: the shared `SpecDigest` (WO-02-017) through `tab-spec.tsx` with
  `readSpecDigest`, `countFrdFolders(listProjectDocs())` and the project-scoped resolver of
  `document-links.ts`; the not-published state («El spec todavía no está publicado.», «Su PRD y sus FRDs
  reales siguen disponibles.», «PRD completo», the project's real `FrdCard`s with the derived-kind tooltip);
  full-bleed bands contained in the panel.
- `CMP-04-panel-architecture`: the shared `ArchitectureDigest` + `DataModelViewer` from
  `readArchitectureArtifacts`, keyed by the project path, with FRD-02's partial, none and single error
  states (`model-invalid`).
- Both digests are mounted with the v2 props of FRD-02's digest seam (`docs/frds/frd-02-ideas-board/blueprint.md`
  Contracts C3: the project's phase for the FRD progress rule, per-FRD work-order progress, the link resolver,
  the not-published flag), no DAG-related prop, and the same `readSpecDigest` / `readArchitectureArtifacts`
  bundles the board reads (one resolver per fact).
- `CMP-04-panel-accounts`: the shared `AccountsTable` (WO-26-001) for this project.
- e2e (`change_ref: e2e-workspace-tabs-stale.md`, absorbs superseded WO-04-009): `e2e/_workspaceTabs.ts`
  becomes the eight labels in order; `portfolio-spec.spec.ts` and `logical-data-model.spec.ts` assert them
  (label text without the badge digits); `persistent-navigation.spec.ts` replaces its Party-tab and
  Work-orders-tab steps with the v2 tabs and the legacy aliases; the workspace behaviour coverage
  (eight tabs in order, default Resumen, compact header on non-Resumen tabs, unknown tab card, legacy
  Work orders link landing on Observabilidad, Spec link opening the same project's Documentos) lives in
  `portfolio-spec.spec.ts`. Every spec starts with `gotoHydrated`.

**Removal list (map §6.C items 5 and 6, §0.6), deleted in this work order:**
- the Party tab entry and `renderPartyTab`; the whole `src/app/projects/[slug]/_party/**` tree (PartyTab,
  PartyScene, FraguaScene v1, DeepRelay, EventFeed, CampaignStrip, AchievementToast, engine, event-vm,
  state-map, layout, sprites hooks) and its tests;
- the whole `src/components/modules/party/**` tree (Room, StoneBridge, Parchment, FlowStrip, MissionBar,
  DemoControls, PowerOffOverlay, SpeechBubble, Tooltip, JudgeSprite, AgentSprite) and its tests (precondition:
  no importer left, see Dependencies);
- the separate Work orders tab entry (`work-orders` stays an alias only) and the `observabilidad` tab id;
- `objectives-bar.tsx` (`ObjectivesBar`) and `workspace-header.tsx` (`WorkspaceHeader`, including the deploy
  target and the old progress line), replaced by the two heroes;
- the now-unused exports (`TabId` members `party`, `work-orders`, `observabilidad`; `VALID_TABS` entries) and
  the `readPending` / build-timeline reads that only fed the Party tab.

## Out of Scope

- The Resumen content (WO-04-011), Cambios and Documentos (WO-04-012), Observabilidad (WO-05-008, which also
  retires `tab-work-orders/`), the work-order detail (WO-05-009), Comandos (WO-11-004): their adapters only.
- `src/app/portfolio/**` (WO-03-007), the codec `src/lib/navigation/**` (WO-25-001), the shell (WO-19-002).
- `FraguaScene` v2 and `src/lib/fragua/**` (WO-06-013); this work order never imports anything WO-06-013 replaced.
- Visual baselines (`e2e/visual.spec.ts-snapshots/**`): the reviewer re-blesses them (map §3.3 rule 4).

## Requirements & Acceptance Criteria

REQ-04-001, REQ-04-002, REQ-04-003, REQ-04-012, REQ-04-013, REQ-04-014 (header and badges), FRD-12
REQ-12-006 (legacy link).

- **AC-04-014.1** — THE workspace SHALL show the full project hero on Resumen only, and on every other tab a one-line header (initials, name, phase, "n/m WO · pct", a compact stepper, "Cambiar proyecto").
- **AC-04-014.2** — EACH workspace tab with countable content SHALL show its count as a badge on the tab.
- **AC-04-012.1** — (REQ-04-012; amended 2026-10-22, v2 plan: split into a plain AC bullet) WHEN a project workspace is opened from the Portafolio or `/projects/<slug>`, THE shell SHALL offer exactly eight tabs in this order: **Resumen · Spec · Observabilidad · Arquitectura · Cuentas · Cambios · Documentos · Comandos**, defaulting to Resumen when no tab is specified.
- **AC-04-012.2** — WHEN the Arquitectura tab is selected, THE workspace SHALL render the complete shared `ArchitectureDigest` and the shared logical-model reader/viewer from FRD-02 REQ-02-013/015, including stack, **Integraciones y operación**, **Modelo de datos**, environment-variable names (in that order), ADRs, implementation plan and per-FRD cards; it SHALL NOT substitute a database-only view.
- **AC-04-012.3** — WHEN navigating with `/portfolio?project=<slug>&tab=architecture` or `/projects/<slug>?tab=architecture`, THE workspace SHALL preserve the selected project and Arquitectura tab, including implementation and released projects.
- **AC-04-012.4** — WHEN architecture narrative or model input is missing/invalid/explicitly none, THE workspace SHALL show the same distinct partial/error states as the board (including the single explicit error notice for a malformed, oversized, unsupported or unreadable model, FRD-02 AC-02-015.7) and SHALL keep the Arquitectura tab reachable without fabricated database data.
- **AC-04-012.5** — WHEN the owner changes selected project, THE Arquitectura view SHALL reset project-local diagram/search/selection state and render only the newly selected project's artifacts.
- **AC-04-013.1** — (REQ-04-013; amended 2026-10-22, v2 plan: split into a plain AC bullet) WHEN a project workspace is opened from the Portafolio or a direct project page, THE shell SHALL offer **Spec** immediately after Resumen and before Observabilidad, with the eight-tab order specified by REQ-04-002 and Resumen still the default.
- **AC-04-013.2** — WHEN `tab=spec` is selected and a nonempty digest is available, THE workspace SHALL reuse the board's complete `SpecDigest` (FRD-02 REQ-02-011), `readSpecDigest`, and live `countFrdFolders(listProjectDocs())`; PRD, research, FRD cards and FRD modal content SHALL NOT be forked or replaced by placeholder prose. Closing the modal SHALL restore keyboard focus to its connected opener.
- **AC-04-013.3** — WHEN the owner selects Spec, follows its deep link or opens a known document link in the digest, THE system SHALL retain the selected project and route context; known document links SHALL open that project's Documentos reader, external links in a new tab and unknown relative targets as plain text.
- **AC-04-013.4** — WHEN no nonempty spec digest is available, THE workspace SHALL retain the tab and state **"El spec todavía no está publicado."** with the second line **"Su PRD y sus FRDs reales siguen disponibles."**, without borrowing another project's digest or inventing specification content.
- **AC-04-013.5** — WHEN the selected project changes, THE Spec view SHALL reset project-local FRD/modal state and read only the new project's digest and real FRD count. Full-bleed digest bands SHALL remain contained in the embedded panel on desktop and mobile.
- **AC-12-006.4** — WHEN a legacy link with `tab=Work orders` opens, THE workspace SHALL show the Observabilidad tab (FRD-05 views).

Fidelity criterion: the frame (crumbs, hero, compact hero, tab bar) and the Spec, Arquitectura and unknown-tab
panels visually match the mock states below on the frozen tokens, verified by the preview smoke gate (DR-055)
and the close-out fidelity diff.

Completeness (DR-100): every count has an unknown state (no badge, no stat, never `0` for a failed read);
the unknown tab, an unknown project (route not-found, unchanged) and a project without work orders have their
drawn fallbacks; no new write; keyboard: `tablist` with arrow keys, focus visible, the switcher and «Ir al
resumen» reachable; tab bar never overflows the page at 320 to 1280 px (overflow arrows); reduced motion
honoured (no tab animation beyond the tokens); all strings through `t()`.

## Visual reference

- **Mock screens:** `docs/frds/frd-04-project-workspace/mocks/project-workspace.html` sections
  `#project-spec`, `#project-spec-empty`, `#project-architecture`, `#project-tab-not-found`, `#model-invalid`,
  and the hero + tab bar of `#project-summary`; FRD-12 `docs/frds/frd-12-observability-dataviz/mocks/observability-dataviz.html#observability-legacy-link`.
  Oracle states: `project-spec`, `project-spec-empty`, `project-architecture`, `project-tab-not-found`,
  `model-invalid`, `observability-legacy-link` (`docs/design/prototype/reference/oracle-states.json`).
- **Token slice:** `--surface`, `--line`, `--text`/`--text-2`/`--text-3`, hues `--violet` `--blue` `--green`
  `--amber` `--teal` `--pink` `--slate` with `--tint`/`--tint-strong`, `--r-lg` (hero, cards), `--r-pill`
  (chips, badge), `--fs-h1` hero title, `--fs-sm`/`--fs-xs`, `--s3`..`--s6`, `--shadow`, `--font-display` for the
  h1, `--font-mono` for paths only.
- **FDD pointer:** `docs/frds/frd-04-project-workspace/fdd.md` (Screens, States, Interaction & flow, Responsive).
  Reference CSS: `docs/design/prototype/reference/css/{19-page-header,20-tabs,21-phase-stepper,25-spec,27-architecture}.css`.

## Components and reuse

Builds `CMP-04-workspace`, `CMP-04-tabbar`, `CMP-04-project-hero`, `CMP-04-project-hero-compact`,
`CMP-04-panel-spec`, `CMP-04-panel-architecture`, `CMP-04-panel-accounts`, `CMP-04-section-not-found`,
`IF-04-workspace-project`, `IF-04-panel-contract`. Reuses `Crumbs`, `Tabs`, `Avatar`, `Chip`, `Ring`,
`PhaseStepper`, `Card`, `Button`, `EmptyState`, `Icon`, `ProjectSwitcher`, `FreshnessBadge`, `SpecDigest`,
`ArchitectureDigest`, `FrdCard`, `DataModelViewer`, `AccountsTable`. Creates only the components.md rows
`ProjectHero` and `ProjectHeroCompact`. Installs: none.

## Tests

- Component/unit (`_components/_tests/`, `ProjectHero/_tests/`, `ProjectHeroCompact/_tests/`, `_panels/_tests/`):
  eight tabs in order with default Resumen; badges per count and none when zero; hero vs compact header by
  tab; build chip three states; alias resolution never a not-found; unknown tab card; Spec published and
  not-published; Arquitectura states; project change resets state; `WorkspaceProject` counts against a
  production-shaped fixture project AND a malformed change file (count unknown, not `0`).
- e2e: as in In Scope (four specs, `gotoHydrated`, `getByRole` first).
- **Derogated tests (map §3.3):** implementer-authored, updated here: `_components/_tests/workspace-shell.test.tsx`,
  `workspace-navigation.test.tsx`, `spec-tab.test.tsx`, `architecture-tab.test.tsx`,
  `wo-detail/_tests/wo-detail.integration.test.tsx` (its `tab=work-orders` renders now resolve through the
  alias to the Observabilidad adapter). Deleted with their whole module: every test under `_party/**` and
  `src/components/modules/party/**`, including the reviewer-authored `_party/_tests/frd-06-*.reviewer.*`,
  `_party/_tests/fragua-snapshot.reviewer.test.ts` and `_party/PartyTab/_tests/PartyTab.integration.reviewer.test.tsx`
  (`git rm`, listed in the Status Note). Reviewer-authored, NOT edited (the FRD-04 gate reviewer re-blesses or
  rewrites them): `_tests/page.reviewer.test.tsx`, `_tests/page.reviewer.integration.test.tsx`,
  `_components/_tests/spec-workspace.reviewer.test.tsx`. Visual baselines: never touched.

## Dependencies

WO-19-002 (shell), WO-03-007 (`ProjectSwitcher`, last-commit resolver, Portafolio host), WO-02-017 (digests),
WO-26-001 (`AccountsTable`), WO-25-001 (codec, aliases), WO-13-012 (primitives), WO-06-013 (`FreshnessBadge`,
and the v2 scene that makes `_party/**` removable), WO-04-013 (`countOpenChanges`). Before this work order
deletes `src/components/modules/party/**`, `CampaignPipeline`/`RoamingCast` (WO-02-020) and the two FRD-13
reviewer tests under `src/app/_design/tokens/_tests/` must no longer import it (ledger requests); if an importer
remains, stop and report instead of editing a file outside `artifacts`.

## Definition of done

The ACs above met with tests that fail without the change; the removal list fully gone (knip, madge, tsc
clean); `.pandacorp/verify.sh` green; Status Note filled.

## Status Note
