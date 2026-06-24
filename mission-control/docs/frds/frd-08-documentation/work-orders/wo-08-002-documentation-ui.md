---
id: WO-08-002
type: work-order
slug: documentation-ui
title: 'WO-08-002 — Documentación UI surface (re-anchor to prototype)'
status: DRAFT
parent: FRD-08
implementation_status: VERIFIED
reopen_count: 0
artifacts:
  - 'src/app/manual/**'
source_requirements: [REQ-08, AC-08-001, AC-08-002, AC-08-003, AC-08-004, AC-08-005]
dependsOn: [WO-07-005, WO-08-001]
last_updated: '2026-06-21'
---
# WO-08-002 — Documentación UI surface (re-anchor to prototype)

Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-08-*`](../blueprint.md#5-components--interfaces) · FDD: [`fdd.md`](../fdd.md).

## Goal
Re-implement the **whole Documentación surface** (`src/app/manual/**`) so it matches the
owner-approved prototype on the frozen tokens (the RPG embossed skin). Presentational re-anchor: the
authored-content index `lib/manual.ts` (WO-08-001) and FRD-07's catalog readers are VERIFIED and
**consumed as-is**. One coarse UI WO collapses the former shell + two Reference WOs + the concept
content WO so the Diátaxis surface is built and reviewed as one cohesive screen.

> Route folder is `src/app/manual/**`, but the nav-tab label and the page **H1 are "Documentación"**
> (not "Manual"/"Códice"; "el códice del gremio" is subtitle flavor only).

## Scope
Build/adapt per `docs/design/components.md` (reuse → adapt → create; never fork a near-duplicate):

- **`PageTitle`** (`pageHead`) — the ONE light page-title block: icon + H1 **"Documentación"** +
  subtitle. The Referencia `SectionHero` (`gxHero`) titles **delegate to `PageTitle`** (DR-062).
- **`ManualShell`** + **`DocNav`** — the navigable two-pane shell (`236px 1fr`): a `sticky` side
  menu grouping every page under the four **Diátaxis** headers (Empezar aquí · Guías · Referencia ·
  Conceptos), `.navitem.on` for the active page; a `min-w-0` reading area.
- **`DocReader`** (`manualContent` router) + the page kinds: `ManualLanding`, `Quickstart`,
  `GuideDoc`, `DocPage`, with `DocHeading` (`docH`) titles and `CmdRow`/`DocCmd` copy chips.
- **Concept diagrams** (data + tokens, no images): **`PipelineDiagram`**, **`TeamDiagram`**,
  **`ChannelsDiagram`**, **`ArchDiagram`**, **`CockpitDataDiagram`**, **`SnapshotMini`** — including
  the Autoaprendizaje concept page.
- **Referencia (`RefSection`)** — **REUSES Configuración's `SkillCard`/`AgentCard`/`RuleCard`/
  `StandardCard` + the shared detail VERBATIM** (do NOT fork them). The four catalogs are **derived
  live from the factory** via FRD-07's readers — never a static array (DR-046).

Reuse foundation primitives: `PageTitle`, `SectionHead`, `Panel`, `Chip`, `CmdRow`, `Button`,
`ItemSlot`.

## Acceptance criteria (FRD-08 EARS)
- Labelled **"Documentación"** in the top nav and as the page H1; never "Manual"/"Códice" as the name.
- Side menu of pages + a reading area that renders each page; pages organized by the full **Diátaxis**
  taxonomy (tutorials/how-to/reference/explanation), every page in one bucket.
- Pages cover at minimum: what Pandacorp is, the flow, the stages, the commands, the implementation
  modes, the standards, and how to operate / hand off — sufficient for a no-context reader.
- Reference catalogs **derived dynamically from the factory** (DR-046) — a new/renamed/removed
  skill/agent/rule/standard appears automatically with no Manual-file edit.
- Reference catalogs **reuse the FRD-07 card components** (no re-implementation).
- Tutorial/Guides/Concepts reflect the **current** v2 workflow; structure pages reflect the
  **feature-centric DR-049** layout + ID spine + source-of-truth hierarchy.
- Inline command chips copy strings, never execute; AA contrast both themes;
  `prefers-reduced-motion` honored; sticky menu must not obscure focus (WCAG 2.2 SC 2.4.11).

## Dependencies
- **Foundation (FRD-13)** — **WO-13-006** (`PageTitle`/`SectionHead`/`Tabs`), **WO-13-007**
  (`Panel`/`Chip`/`CmdRow`/`Button`/`DocHeading`), **WO-13-008** (`ItemSlot`). Build foundation-first.
- **FRD-07** — REUSES `SkillCard`/`AgentCard`/`RuleCard`/`StandardCard` + the shared catalog detail
  (the Referencia must be built **after** FRD-07's WO-07-005 so it consumes those cards, not forks).
- **Readers (VERIFIED, consume as-is)** — WO-08-001 (`readManualPages`), FRD-07 WO-07-001/003/004
  (`readSkills`/`readAgents`/`readDecisionRules`/`readStandards`).
- **FRD-13** — design tokens; zero hardcoded colors.

## Visual reference
`docs/design/prototype/index.html` — the **Documentación** view (`manualView()` + `manualContent()`
and the reader kinds `manualLanding`/`manualQuickstart`/`manualGuide`/`refSection`/`docPage` plus the
diagram builders). The in-loop fidelity gate renders `src/app/manual` against this mock.

## Status Note

**What was built (this cycle — reopen_count 1, both blocking fixes applied):**

This cycle resolves both violations from the prior gate reject verdict:

1. **DR-046/DR-057 reuse fix (gate blocker):** `DocReader.tsx` no longer forks its own
   `Reference*` catalog views. It now imports and renders the canonical FRD-07 primitives verbatim:
   `SkillsSection` (commands), `AgentList` + `AgentDetail` (agents), `DecisionRulesSection` (rules),
   `StandardsSection` (standards). This was applied in the baseline repair commit `1ca07aa` as part
   of the global DR-057 consolidation wave. The 4 anchor gate tests in
   `frd-08-reuse.gate.reviewer.test.tsx` all pass GREEN.

2. **Empty-pane-on-load fix (DR-072 structural finding):** `ManualShell` no longer initializes with
   `useState(null)`. It now derives the default page at mount via `deriveDefaultPage(pages)`, which
   returns `{ type: "authored", group: "tutorial", slug: <first-slug> }` — the first authored
   tutorial page sorted by `order` — or `null` only when there are zero authored pages (empty
   content tree). This mirrors the prototype's `ST.manualPage || MANUALNAV[0].items[0].id` fallback
   at `manualView()` ~L1362.

**Exact changes (this implementer cycle):**
- `src/app/manual/ManualShell.tsx` — added `deriveDefaultPage(pages: ManualPage[]): ActivePage | null`
  (private, not exported; priority: tutorial → guides → concepts, sorted by `order`). Changed
  `useState<ActivePage | null>(null)` to `useState<ActivePage | null>(() => deriveDefaultPage(pages))`.
- `src/app/manual/_tests/visual-reanchor.test.tsx` — added 5 new tests in the
  `"FDD-08 §4 — first authored page shown on load (deriveDefaultPage)"` describe group:
  (a) `doc-reader-authored` present on load with pages, (b) `doc-reader-empty` absent when pages
  exist, (c) first tutorial nav item carries `data-active="true"` on load, (d) first page heading
  visible without user interaction, (e) empty-pages fallback renders `doc-reader-empty` (not a throw).

**Interfaces / contracts exposed:**
- `ManualShell` — `"use client"` boundary; props: `{ pages, skills, agents, rules, standards }`;
  initial `activePage` derived from `pages` (observable: first page renders immediately on load).
- `DocNav` — `DocNavProps`; `activePage: ActivePage | null`; `onSelect: (page: ActivePage) => void`.
- `DocReader` — `DocReaderProps`; `activePage: ReaderActivePage | null`; reuses FRD-07 primitives:
  `SkillsSection`, `AgentList`, `AgentDetail`, `DecisionRulesSection`, `StandardsSection` verbatim.
- `types.ts` — `ActivePage` / `ReaderActivePage` discriminated unions: unchanged.

**Components reused (DR-057):**
- `DocReader` reuses `SkillsSection`, `AgentList`, `AgentDetail`, `DecisionRulesSection`,
  `StandardsSection` from `src/app/configuration/`. No new shared components created.
- `ManualShell` reuses `PageTitle` (DR-062), `DocNav`, `DocReader`. No new components.

**Implicit decisions / assumptions:**
- `deriveDefaultPage` priority: tutorial → guides → concepts (matches `DIATAXIS_GROUPS` order in
  `DocNav` and the prototype `MANUALNAV` order). Falls through to guides if no tutorial pages exist.
- `doc-reader-empty` remains a valid state when `pages=[]`. The empty-state path in `DocReader`
  is retained and tested via the "empty pages" test.
- `page.tsx` wraps `ManualShell` in a `<div>` (not `<main>`) so `DocReader`'s `<main>` is the sole
  landmark — no nested `<main>` WCAG 2.2 violation.
- `ZERO_AGENT_LEVEL` constant in `DocReader` is used for the Manual's agent catalog (the Manual has
  no computed XP; the FRD-07 `AgentDetail` accepts a level object).
- RPG emboss box-shadow on `DocNav` uses `rgba()` (structural, theme-independent).
- Theming: app renders in system light mode; prototype mock is dark — theming difference only, not
  a layout failure. Both themes are first-class (token-based styling throughout).

**Test files:**
- `src/app/manual/_tests/visual-reanchor.test.tsx` — 28 tests (23 prior + 5 new for §4). All pass.
- `src/app/manual/_tests/frd-08-reuse.gate.reviewer.test.tsx` — 4 gate tests. All GREEN.
- `src/app/manual/_tests/manual.reviewer.integration.test.tsx` — 9 integration tests. All pass.
- `src/app/manual/_tests/page.test.tsx` — 34 tests. All pass.
- Total: 75 tests across 4 files. All GREEN.

**Fidelity check (DR-072 — single light cycle):**
Rendered `http://localhost:3100/manual` via Playwright. Screenshot confirms:
- H1 "Documentación" with book icon (PageTitle — correct, DR-062)
- First page "Cómo empezar" rendered in the reading area on load — no empty pane
- First nav item "Cómo empezar" has accent fill (`data-active="true"`, `.navitem.on` active state)
- Two-pane 236px/1fr layout visible; EMPEZAR AQUÍ / GUÍAS / CONCEPTOS groups in left nav
- Referencia group is below fold (as in prototype — 4 Reference nav items present, selectable)
- No gross structural divergence from prototype `manualView()`. Recognizable, faithful match.

**Pre-existing failures (not introduced by this cycle):**
- 2 tests in `src/app/configuration/_tests/frd07.cross-nav-reverse.gate-opus.reviewer.test.tsx` are
  RED — these are the anchor gate tests from the FRD-07 WO-07-005 reopen (reverse Skills↔Agents
  cross-navigation; a separate WO's blocker, unrelated to FRD-08).
