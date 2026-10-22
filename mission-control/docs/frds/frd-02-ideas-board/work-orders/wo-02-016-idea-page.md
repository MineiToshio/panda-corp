---
id: WO-02-016
type: work-order
slug: idea-page
title: WO-02-016 Idea page (header, tabs, Propuesta, Documentos, discard and restore)
status: DRAFT
parent: FRD-02
foundation: false
implementation_status: PLANNED
difficulty: high
reopen_count: 0
artifacts:
  - 'src/app/board/[...segments]/**'
  - 'src/app/board/_components/CardDetail/CardDetail.tsx'
  - 'src/app/board/_components/CardDetail/CardDetail.styles.ts'
  - 'src/app/board/_components/CardDetail/IdeaPitch/**'
  - 'src/app/board/_components/CardDetail/_tests/**'
  - 'src/app/board/_components/CardDetail/useCardDocument.ts'
  - 'src/app/board/_components/{IdeaHeader,IdeaDocs}/**'
  - 'src/app/board/_utils/**'
  - 'src/components/core/{DiscardButton,RestoreButton}/**'
  - 'src/app/board/page.tsx'
  - 'src/app/board/_components/BoardShell/**'
  - 'src/app/board/IdeaBoardView/**'
  - 'src/app/board/_tests/**'
  - 'src/app/board/actions/read-doc.ts'
  - 'e2e/ideas-board.spec.ts'
  - 'e2e/persistent-navigation/board.spec.ts'
  - 'src/lib/go-party/**'
source_requirements: [REQ-02-004, REQ-02-007, REQ-02-008, REQ-02-009, REQ-02-012, REQ-02-015, REQ-02-016]
dependsOn: [WO-02-017, WO-02-004, WO-02-012, WO-25-001, WO-02-015, WO-02-020, WO-08-003]
last_updated: '2026-10-22'
---

# WO-02-016 Idea page

## Summary

Make the idea its own page at `/board/:idea/:tab`: the Órbita idea header (stage line or «Descartada», «Volver al
tablero», favourite, «Abrir en Portafolio», discard or «Restaurar» on one row), the five icon tabs with the
stage-derived default and the URL-persisted pick, the Propuesta memo-pitch on `ReportBand` / `DigestHero`, the
Documentos curated index + reader with in-document links, the discard confirmation with an optional reason and the
restore confirmation without one, the discarded banner, the shipped idea without discard and the unknown idea card.
It also takes the v1 idea detail out of the board and extends the FRD's e2e spec.

## In Scope

- **Route** `src/app/board/[...segments]/page.tsx`: keep the FRD-25 identity resolution and canonical redirect; render
  the idea page instead of the board. Tab segment ∈ `proposal · spec · architecture · documents · campaign`, plus
  `/board/:idea/documents/:doc`; unknown tab → `notFound()`; unknown idea → the designed card «Esta idea no existe»
  with «Volver al tablero» (state `idea-not-found`), not a framework 404. A legacy `/board?idea=<slug>` link resolves
  to the idea route: this work order applies WO-25-001's `normalizeLegacyNavigation` at the board route boundary
  (keeping `boardTab`, `doc`, `expanded` and the other FRD-02 keys) and feeds `NavigationCanonical`.
- **Idea read** (`IF-02-idea-page-read`, blueprint Contracts C2) in `src/app/board/_utils/`: one `React.cache()`
  resolver per request for the open idea (card fields, stage, campaign phase, `running`, project navigation slug,
  scoped document structure and count, spec digest, `readArchitectureArtifacts` bundle, next-step command,
  `forgeHref` = Portafolio → project → Resumen URL, built through the codec with the canonical `summary` tab
  directly, never the legacy `party` alias, AC-06-020.1). `readCardProject` is refactored here, not duplicated.
  The v1 host-navigation helper `src/lib/go-party/**` (`goToParty`, `partyUrl`, `?tab=party`; no product importer
  left once the forge action is a plain link) is deleted here with its tests (map §0.6; reconciliation 2026-10-22).
- **`IdeaHeader`** (`PageHead` drill-in pattern, h1 = idea title): category and return chips, «Score N/100»,
  «Etapa: <fase>» or «Descartada» (no stepper), «Volver al tablero» link, the `FavoriteButton` star (WO-02-015),
  «Abrir en Portafolio» (project-linked ideas; link to the FRD-04 workspace), «Descartar idea» (`Button` danger sm;
  never for a shipped idea) or «Restaurar» (discarded idea), all on one row that wraps on phones. A discarded idea
  shows the `Notice` banner «Idea descartada» with «Motivo: …» or the no-reason sentence as drawn.
- **`CardDetail` tab frame** on the shared `Tabs` (46 px, icon per tab: Propuesta bulb, Spec layers, Arquitectura
  cube, Documentos file with its count, Campaña flag): availability (Spec when a spec digest exists; Arquitectura
  and Documentos whenever a project is linked; no project → Propuesta · Campaña only); default by stage with the
  fallback chain; the pick lives in the URL tab segment (FRD-25) and survives re-renders; mounts `SpecDigest` /
  `ArchitectureDigest` (WO-02-017) and `CampaignPipeline` (WO-02-020, passing `slug`, `activePhase`, `running`,
  `forgeHref`). The content panels use the host width (no inner panel cap; long prose keeps its line length,
  LESSON-0364).
- **Propuesta** (`IdeaPitch`, restyle): «De un vistazo · el sueño», «Profundizar · el criterio», «El tablero de
  decisión» with the scorecard and «Esfuerzo vs. valor» cards on `DigestHero` + `ReportBand` (WO-02-017); "qué es"
  chips via `projectMetaChips` (no verdict badge).
- **Documentos** (`IdeaDocsRail` / `IdeaDocsItem` in `src/app/board/_components/IdeaDocs/`): reader on `Paper`
  (WO-08-003) + `Markdown`, index on the right from 900 px and a folded list below; always «Resumen» (the reader shows
  «Tarjeta de la idea», the card's pitch) then the project documents by purpose («PRD», «Investigación», per FRD
  «Contrato (frd.md)» and «Implementación (blueprint.md)»); a document click anywhere lands on Documentos with that
  document; in-document relative links to a surfaced document select it in the same reader (client-state), off-app
  URLs open in a new tab, other relative links render as plain text (existing `classifyDocLink`); building/release
  ideas add the project-command box (`workspaceCommands`, WO-02-003). The document body loads through the existing
  read-only `readBoardDoc` action or a server read from the route; remove whichever path ends unused.
- **Discard / restore** (`DiscardButton`, `RestoreButton` restyled onto `DialogConfirm`): discard dialog (kicker
  «Confirmar», title «Descartar idea», the sentence naming the idea and «Podrás restaurarla después.», «Motivo
  (opcional)» with placeholder «Por qué…», «Cancelar» / «Descartar»); restore dialog (kicker «Confirmar», title
  «Restaurar idea», sentence naming the idea and its column, no reason field, «Cancelar» / «Restaurar»). The form
  posts to the existing Server Action (progressive enhancement, inert before hydration); the dialog closes
  synchronously on submit and the header reflects the new state optimistically (`useOptimistic`), reverting on
  `{ ok: false }`. Writes stay exactly those of ADR-0002 (`lib/discard`, untouched).
- **Detach the idea from the board** (W4, after WO-02-015): delete the v1 idea-detail branch of `BoardShell` (back
  button, `DetailActions`, discard banner, `CardDetail` mount, the `idea` / `boardTab` selection handling); `page.tsx`
  stops reading project documents and digests for every card and stops passing the discard/restore/read-doc actions
  the board no longer uses; `BoardCardEntry` keeps only the fields the board renders (no dead detail fields).
- **E2E** (extend `e2e/ideas-board.spec.ts`): open an idea from the board, default tab by stage, switch tabs and
  reload (pick kept), document click lands on Documentos, discard dialog (Escape, focus trap, focus return to
  «Descartar idea»), restore dialog likewise, the Spec FRD dialog and the ADR dialog of WO-02-017 likewise, the
  Campaña phase arrows, unknown idea card; one pre-hydration check that the discard reason never reaches the URL.

**Removals (map §6.C item 13 and the board detach, §0.6):** the discard quick-tags and the «Descartando…» in-flight
state (with their tests); the board's embedded idea detail and its now-unused props, styles and tests; the no-op
`onEnterForge` / `deployTarget` props of `CardDetail` and `BoardShell`; v1 `CardDetail.styles.ts` constants the Órbita
frame no longer uses.

## Out of Scope

- The digests' content (WO-02-017), the data-model viewer (WO-02-018), La Campaña's map and sheet (WO-02-020).
- The bounded writes and their actions (`src/app/board/actions/actions.ts`, `src/lib/discard/**`, unchanged).
- The board's own surface (WO-02-015, done in W3).
- A drawn error message for a failed write: none is drawn; the optimistic revert is the designed behaviour (recorded
  in the architecture ledger for design).

## Requirements & Acceptance Criteria

Delivers REQ-02-004, REQ-02-008, REQ-02-009, FRD-02#U5, the idea-page part of REQ-02-016 and AC-02-015.14 of
REQ-02-015; mounts the favourite star of REQ-02-012 in the header (AC-02-012.3 is owned by WO-02-015) and the
discard write of REQ-02-007 (owned by the kept WO-02-004).

- **AC-02-009.1** — WHEN the owner opens a card, THE system SHALL render the card detail with **three
  horizontal tabs** — **Propuesta · Documentos · Campaña** (in that order) — using the **same tab
  pattern** as the Portfolio project pane (the `stab` selector row), and SHALL default the active tab
  **by the project's stage** (campaign phase): research → **Propuesta**; product or design → **Spec**;
  architecture, implementation or release (incl. shipped) → **Arquitectura**. When the stage's tab is
  not rendered (the corresponding artifacts are absent), the default falls back to the previous available stage tab
  (Arquitectura → Spec → Propuesta); Documentos and Campaña are never the default. Only the initial tab
  is derived: the owner's later pick persists (AC-02-009.4). (Owner decision, discover redesign 2026-06-26; the Comandos tab was folded into the
  campaign ficha earlier.) A **Spec** tab is inserted **between Propuesta and Documentos** when the
  project has a spec digest (REQ-02-011), and an **Arquitectura** tab **after Spec** (and a **Documentos** tab with its document count) whenever the idea is linked to a project (REQ-02-013); an idea with no linked project shows Propuesta · Campaña only. Full order when all exist: Propuesta · Spec · Arquitectura · Documentos · Campaña.
- **AC-02-009.5** — WHEN the **Propuesta** tab is active, THE system SHALL render the idea's **memo-pitch**
  (the card's hot→cold body produced by `/discover`/`/new-idea`, plugin v9.9.0) natively via the
  `IdeaPitch` component (CMP-02-idea-pitch) using the design tokens — the on-brand pitch that makes the
  owner decide. The card `.md` is the source of truth; this is its native rendering inside the board.
  The hero badges SHALL include **"qué es" chips** — the app type (`project_type`: web / mobile / api …)
  and, when an in-pipeline project declares it, the web target platform (`target_platforms`: desktop /
  mobile / responsive) — and SHALL **omit the opaque verdict ("build") badge** (it conveys the kill/build
  decision, not what the product is). The same chips appear in the Spec hero (AC-02-011.2); both reuse a
  single `projectMetaChips` helper so they never drift.
- **AC-02-009.2** — WHEN the owner clicks a tab, THE system SHALL show that tab's body and mark only that
  tab active; **Propuesta** SHALL render the idea's memo-pitch (AC-02-009.5), **Documentos** SHALL
  render the existing document navigator (summary + key points + the idea's docs, unchanged behavior of
  REQ-02-004), and **Campaña** SHALL render La Campaña (REQ-02-010).
- **AC-02-009.3** — WHEN the owner clicks a document entry (in any tab context that exposes a document),
  THE system SHALL switch the active tab to **Documentos** and show that document, so a document
  click always lands the owner on **Documentos**.
- **AC-02-009.4** — THE system SHALL **persist the active tab choice** for the open card across
  re-renders of the card detail (the tab selection survives interactions that re-render the detail
  without navigating away from the card).
- **AC-02-009.6** — (amended 2026-10-22, v2 plan: renumbered from the fidelity-pass restatement of "AC-02-009.1", so each id is defined once) every rendered tab carries an inline SVG icon (Propuesta bulb, Spec layers, Arquitectura cube, Documentos file, Campaña flag); the tab for the current location is the only one marked active.
- **AC-02-009.7** — (amended 2026-10-22, v2 plan: renumbered from the fidelity-pass restatement of "AC-02-009.2/.3", so each id is defined once) **Documentos** is a **curated index + reader**: the index sits on the **RIGHT** of the
  reader (folded behind a list below 900 px) and always lists **Resumen** (the summary reader) plus one
  item per project document, grouped by purpose; selecting an item shows it in the reader (a board
  card defers the full document read to the project workspace). Commands live in the Campaña ficha
  (the `Comandos` tab no longer exists), through the shared `CmdRow`; building/release cards add a
  project-command box (`workspaceCommands`).
- **AC-02-009.8** — (amended 2026-10-22, v2 plan: renumbered from the fidelity-pass restatement of "AC-02-009.4", so each id is defined once) **In-document links open in the reader**: a relative link inside a document to another
  document the reader surfaces (e.g. the PRD linking an FRD) SHALL open that document in the SAME
  card-detail reader (it selects it in the rail — client-state navigation, not a page nav); an off-app
  URL SHALL open in a new tab; any other relative link SHALL render as plain text (never a broken link).
- **AC-02-015.14** — WHEN Propuesta, Spec or Arquitectura is displayed, THE content panels SHALL use the available host width without a fixed inner panel-width cap; long introductory prose MAY retain its readable line-length limit.
- **AC-02-016.5** — THE idea page SHALL show a header with the idea's stage line ("Etapa: <fase>", or "Descartada" for a discarded idea; no phase stepper), a "Volver al tablero" link, and its favorite, open-project and discard actions on one row.

AC-02-009.1's "three horizontal tabs" baseline is read with its own last sentence: Spec, Arquitectura and Documentos
join when their artifacts exist; the `stab` row is the shared `Tabs` pattern (AC-02-009.6 adds the icons).

**Completeness (DR-100):** idea without documents (Resumen only, zero items); idea without a project (Propuesta and
Campaña only, no «Abrir en Portafolio»); shipped idea (no discard, state `idea-shipped`); discarded idea with and
without a reason (`idea-discarded-reason`, `idea-discarded`); unreadable project artifacts surface through the
digest's error states, never a blank tab; a missing document key in the URL falls back to Resumen. **NFRs:**
accessibility (one h1, `role="tablist"` with arrow keys, `aria-current`/`aria-selected` on the active tab only,
dialogs trap focus, close on Escape and return focus to the opener still present, the reason field labelled,
44 px targets, state by word and icon), privacy (the discard reason is posted to the Server Action, never put in the
URL; pre-hydration submit is inert), performance (the idea read happens once per request; the board page drops the
per-card document reads; Campaña art lazy-loaded), security (only the existing bounded actions are called; no new
write path).

## Components

Builds `CMP-02-idea-page`, `CMP-02-idea-header`, `CMP-02-card-detail`, `CMP-02-idea-pitch`, `CMP-02-idea-docs`,
`CMP-02-discard-action`, `IF-02-idea-page-read`. Reuse first: `PageHead`, `Tabs`, `Card`, `Notice`, `Button`,
`Chip`, `DialogConfirm`, `Markdown`, `Paper` (WO-08-003), `CommandBox`, `FavoriteButton` (WO-02-015), `ReportBand`
/ `DigestHero` (WO-02-017), `SpecDigest`, `ArchitectureDigest` (WO-02-017), `CampaignPipeline` (WO-02-020). Restyle in
place: `CardDetail`, `IdeaPitch`, `DiscardButton`, `RestoreButton`. Create `IdeaHeader` (the FDD's "PageHead pattern
with a «Volver al tablero» link", composed from the framing patterns, not a new inventory primitive) and the
components.md row `IdeaDocsRail` / `IdeaDocsItem` (folder `IdeaDocs/`). Installs: none.

## Visual reference

- **Mock screens:** `docs/frds/frd-02-ideas-board/mocks/ideas-board.html#idea-pitch`, `#idea-documents`,
  `#idea-discard-dialog`, `#idea-shipped`, `#idea-not-found`, `#idea-discarded`, `#idea-restore-dialog`,
  `#idea-discarded-reason` (oracle states of the same ids; screenshots under `mocks/screenshots/`). The Spec,
  Arquitectura and Campaña tab bodies are WO-02-017's and WO-02-020's states.
- **Token slice:** `--surface`, `--surface-2`, `--line`, `--text`..`--text-3`, tab hues via `data-tone`
  (`--tone`, `--tint-strong`, `--rule` bar), `--coral` (danger button outline, never a primary), `--r-lg`, `--r-xl`
  (dialog), `--shadow-dialog`, `--backdrop`, `--fs-h1` (title), `--fs-sm`/`--fs-xs` (meta), `--font-mono` for paths
  in `Paper`; reading width from the platform prose cap only.
  Reference CSS: 14-empty-notice, 20-tabs, 24-idea-header, 28-documents, 29-markdown, 33-dialog, 43-idea-layout.
- **FDD pointer:** `docs/frds/frd-02-ideas-board/fdd.md` (Screens: Idea, Propuesta tab; Idea, Documentos tab; States:
  discard confirmation, shipped idea, unknown idea, discarded idea, discarded idea with a reason, restore
  confirmation; Interaction & flow; Responsive & accessibility).
- **Fidelity criterion:** the built idea page matches `mocks/ideas-board.html` for the states above (layout,
  structure, components, density, both themes, 1280/768/375) on the frozen tokens, keeping the recorded ids, classes
  and `data-*` / `aria-*` hooks; verified by the preview smoke gate (DR-055) and the close-out Visual QA.

## Tests

- Unit: the idea read (stage, availability, default-tab chain, project slug and forge href, unknown idea), tab
  availability/default as a pure helper.
- Component (`getByRole`): header variants (active, shipped, discarded with/without reason, no project), tab frame
  (icons, single active, URL persistence, document click lands on Documentos), `IdeaDocs` (Resumen first, grouping,
  folded list below 900 px, link classification), discard/restore dialogs (reason optional, no quick-tags, optimistic
  revert).
- E2E: extend `e2e/ideas-board.spec.ts` as in scope; update the idea-tab and document-reader steps of
  `e2e/persistent-navigation/board.spec.ts` (split out by WO-25-001; the campaign `phase` step was WO-02-020's in W3)
  that the idea route breaks (AC-25-001.1, AC-25-002.1 re-verified, BL-0051).
- `src/lib/go-party/_tests/*` are deleted with the module.

### Derogated tests (BL-0051)

- Implementer tests updated or deleted here: `src/app/board/_components/CardDetail/_tests/{CardDetail.test.tsx,CardDetail.tabs.test.tsx,CardDetail.navigation.test.tsx,CardDetail.adversarial.test.tsx}`,
  `src/app/board/_components/CardDetail/IdeaPitch/_tests/IdeaPitch.test.tsx`, `src/app/board/_utils/_tests/readCardProject.test.ts`,
  `src/components/core/DiscardButton/_tests/DiscardButton.test.tsx`, `src/components/core/RestoreButton/_tests/RestoreButton.test.tsx`,
  the idea-detail assertions of `src/app/board/_tests/wo-02-005-board-surface.test.tsx` and of
  `src/app/board/IdeaBoardView/_tests/*`.
- Reviewer-authored, derogated for the FRD-02 gate reviewer (never edited here):
  `src/app/board/_components/CardDetail/_tests/CardDetail.frd02-integration.reviewer.test.tsx`,
  `src/app/board/_components/CardDetail/_tests/CardDetail.cohesion.reviewer.test.tsx`,
  `src/app/board/_utils/_tests/readCardProject.reviewer.test.ts`, `src/app/board/_tests/frd-02.stage-default-tab.reviewer.test.tsx`,
  `src/app/board/_tests/frd-02.integration.reviewer.test.tsx`, `src/app/board/_tests/frd-02.shell-integration.reviewer.test.tsx`,
  `src/app/board/_tests/discard-write.integration.reviewer.test.ts` (the flows they drive move from the board to the
  idea route).
- New route: its visual baselines are blessed at the FRD gate (none exist).

## Dependencies

WO-02-017 (digests, `ReportBand` / `DigestHero`), WO-02-004 and WO-02-012 (kept bounded writes), WO-25-001 (URL
codec), WO-02-015 (the board it detaches the idea from; `FavoriteButton`), WO-02-020 (`CampaignPipeline` with
`forgeHref`), WO-08-003 (`Paper`). W4; disjoint from the other W4 work orders (portfolio, proposals, achievements,
kept WO-02-013 in `CampaignPipeline`).

## Definition of done

The ACs above pass with tests that fail without the change; the board no longer embeds the idea; the removals are gone
(code, exports, tests); the extended e2e spec passes hydrated; `.pandacorp/verify.sh --since <ref>` green; tokens
only; every string from `t()`; shown content keeps its language (LESSON-0490).

## Status Note
