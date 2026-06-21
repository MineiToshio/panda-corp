---
id: WO-08-002
type: work-order
slug: documentation-ui
title: 'WO-08-002 — Documentación UI surface (re-anchor to prototype)'
status: DRAFT
parent: FRD-08
implementation_status: PLANNED
reopen_count: 1
artifacts:
  - 'src/app/manual/**'
source_requirements: [REQ-08, AC-08-001, AC-08-002, AC-08-003, AC-08-004, AC-08-005]
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

**What was built (this cycle — blocker fix):**
Applied the concrete fix from the previous review verdict: `ManualShell` no longer initializes with
`useState(null)`. It now derives the default page at mount via `deriveDefaultPage(pages)`, which
returns `{ type: "authored", group: "tutorial", slug: <first-page-slug> }` — the first authored
tutorial page by `order` — or `null` only when there are zero authored pages.

**Exact change:**
- `src/app/manual/ManualShell.tsx` — added `deriveDefaultPage(pages: ManualPage[]): ActivePage | null`
  (priority: tutorial → guides → concepts, sorted by `order`; mirrors prototype
  `MANUALNAV[0].items[0].id` fallback at line ~1362). Changed `useState<ActivePage | null>(null)` to
  `useState<ActivePage | null>(() => deriveDefaultPage(pages))`.
- `src/app/manual/_tests/visual-reanchor.test.tsx` — added 4 new tests in
  `"FDD-08 §4 — first authored page shown on load"` group verifying: (a) `doc-reader-authored` is
  present on load with pages, (b) `doc-reader-empty` is absent when pages exist, (c) first nav item
  carries `data-active="true"` on load, (d) first page content visible without user interaction.
  No existing tests were removed; the prior tests that check `doc-reader-empty` directly on DocReader
  with `activePage={null}` remain valid (DocReader still renders empty when null is passed).

**Interfaces / contracts exposed (unchanged):**
- `ManualShell` — `"use client"` boundary; props: `{ pages, skills, agents, rules, standards }`;
  initial `activePage` now derived from `pages` (observable change: first page renders on load).
- `DocNav` — `DocNavProps`; `activePage: ActivePage | null`; `onSelect: (page: ActivePage) => void`
- `DocReader` — `DocReaderProps`; `activePage: ReaderActivePage | null` (null → empty state, unchanged)
- `types.ts` — `ActivePage` / `ReaderActivePage` discriminated unions: unchanged

**Components reused (DR-057 — no new shared components created):**
- All changes are within `src/app/manual/ManualShell.tsx` and its test file.
- No new shared components; existing components reused verbatim.

**Implicit decisions / assumptions:**
- Priority order for `deriveDefaultPage`: tutorial → guides → concepts (matches `DIATAXIS_GROUPS`
  in `DocNav` and prototype `MANUALNAV` order). If only guides pages exist, first guide is shown.
- `doc-reader-empty` is still a valid state when `pages=[]` (empty content tree). The empty state
  path in `DocReader` is retained and covered by the "with no pages" test.
- `page.tsx` wraps `ManualShell` in a `<div>` (not `<main>`) so `DocReader`'s `<main>` is the sole
  landmark — avoids nested `<main>` violation (WCAG 2.2). Unchanged from prior cycle.
- RPG emboss box-shadow on DocNav uses `rgba()` (structural, theme-independent). Unchanged.
- Light/dark theming: app renders in system light mode; prototype mock is dark (theming mode
  difference only, not a layout failure). Unchanged.

**Test files:**
- `src/app/manual/_tests/visual-reanchor.test.tsx` — 27 tests total (23 prior + 4 new for §4
  default-page-on-load). All 27 pass.
- All 5 test files in `src/app/manual/` pass: 141 tests total.
- Integration test anti-orphan check (`reference-commands-section` absent before selection) still
  passes — initial page is the tutorial page, not the commands reference.

**Fidelity check (DR-072 — single light cycle):**
Rendered `http://localhost:3100/manual` via Playwright. Screenshot shows:
- H1 "Documentación" (correct)
- "Cómo empezar" rendered in the reading area on load (no empty pane — blocker fixed)
- First nav item "Cómo empezar" has accent fill (`.navitem.on` active state)
- Two-pane 236px/1fr layout, EMPEZAR AQUÍ / GUÍAS / CONCEPTOS groups visible, Referencia below fold
- No gross structural divergence from prototype `manualView()`.

**Previous review verdict (2026-06-20) — RESOLVED:**
Blocking finding: empty pane on load (`useState(null)`). Fixed: `deriveDefaultPage` initializes to
first tutorial page. The Status-Note rationale from the prior cycle ("`manualLanding()` is a static
fixture so empty is intentional") is now superseded — the correct behavior is the first *authored*
page, matching the prototype's `MANUALNAV[0].items[0].id` fallback.

**FRD gate verdict (2026-06-21, reviewer/opus, DR-072) — REJECTED → PLANNED (reopen_count 1):**
BLOCKING CORRECTION (DR-046 AC + DR-057 reuse — the same defect class that rejected FRD-05/07/10).
The Referencia catalogs are **forked, not reused**. The FRD-08 contract is explicit ("The Reference
catalogs SHALL **reuse the Configuración (FRD-07) card components** … rather than re-implementing
them") and this WO's own Scope says "REUSES Configuración's SkillCard/AgentCard/RuleCard/StandardCard
+ the shared detail VERBATIM (do NOT fork them)"; the living inventory `docs/design/components.md`
:104-107,112,142-143 says the Manual Referencia reuses Config's cards verbatim. Instead:
- `src/app/manual/DocReader.tsx` renders four BESPOKE catalog views — `ReferenceCommandsSection`,
  `ReferenceAgentsSection`, `ReferenceRulesView`, `ReferenceStandardsView` — each a hand-rolled flat
  `<ul>/<li>` list with its own private style constants. They import nothing from `configuration/`
  (`grep configuration src/app/manual/` → no matches).
- FRD-07 ALREADY exposes the canonical, reusable primitives that must be used instead:
  `SkillList` (stamps `skill-card-<slug>` = Panel + ItemSlot wand tile),
  `AgentList` (`agent-card`), `DecisionRulesSection` (`rules-list`/`rules-section`),
  `StandardsSection` (`standards-section`).
**Fix:** delete the four `Reference*` fork files and render the FRD-07 `SkillList`/`AgentList`/
`DecisionRulesSection`/`StandardsSection` (+ shared detail) inside `DocReader`'s reference branch,
passing the already-read `skills`/`agents`/`rules`/`standards` props through. Keep the live DR-046
derivation (page.tsx already reads from the canonical readers). Build AFTER FRD-07 WO-07-005 lands so
the cards are the verified shared primitives. Note: the headers on the fork files still cite the
retired WO-08-003/WO-08-004 (collapsed into WO-08-002) — remove on rebuild.
**Anchor gate test (RED against the fork, mutation-killing — goes GREEN once the FRD-07 cards are
reused):** `src/app/manual/_tests/frd-08-reuse.gate.reviewer.test.tsx` (4 RED). A correct
reuse implementation stamps the FRD-07 card testids and the four assertions pass.
**DR-070:** the WO's two cycle-changed files (`ManualShell.tsx` default-page fix + the
`visual-reanchor.test.tsx` additions) were reverted to last green `d37fa48` so HEAD does not carry a
half-built reopened WO into siblings' global gate. The four `Reference*` forks + `DocReader`/`DocNav`
were already byte-identical to `d37fa48` (no new files created), so nothing else to revert.
NON-BLOCKING (advisory, NOT a reason for the reject — on the visual punch-list): the reading area is
a flat markdown render with no concept diagrams (PipelineDiagram/TeamDiagram/… per inventory
:111), light-mode skin vs the dark prototype, and px/arbitrary inline style values. These do not
gate VERIFIED; the reuse violation does.
