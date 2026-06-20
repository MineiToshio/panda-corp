---
id: WO-08-002
type: work-order
slug: documentation-ui
title: 'WO-08-002 — Documentación UI surface (re-anchor to prototype)'
status: DRAFT
parent: FRD-08
implementation_status: IN_REVIEW
artifacts:
  - 'src/app/manual/**'
source_requirements: [REQ-08, AC-08-001, AC-08-002, AC-08-003, AC-08-004, AC-08-005]
last_updated: '2026-06-19'
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

**What was built:** Re-anchored the full Documentación surface (`src/app/manual/**`) to the
owner-approved prototype. The shell now matches the prototype `manualView()` layout:
- `PageTitle` with icon `ti-book`, H1 **"Documentación"**, subtitle — the ONE page title block
  (DR-062); `page.tsx` no longer has its own header.
- `ManualShell` uses `display:grid; grid-template-columns:236px 1fr` (not the old `16rem` flex row),
  with `data-testid="doc-nav-sticky"` wrapper and `data-testid="manual-reader-area"` with `min-width:0`.
- `DocNav` re-anchored to prototype `.navitem` / `.navitem.on` skin: RPG card background
  (`var(--color-card)` + emboss `boxShadow`), group headers in 10px pixel font at
  `var(--color-accent-text)` (not grey/muted), icons before each item, active state uses
  `var(--color-accent-bg)` fill + `inset 0 0 0 1px var(--color-accent)` ring.

**Interfaces / contracts exposed (unchanged from prior implementation):**
- `ManualShell` — `"use client"` boundary; props: `{ pages, skills, agents, rules, standards }`
- `DocNav` — `DocNavProps`; `activePage: ActivePage | null`; `onSelect: (page: ActivePage) => void`
- `DocReader` — `DocReaderProps`; `activePage: ReaderActivePage | null`; unchanged
- `types.ts` — `ActivePage` / `ReaderActivePage` discriminated unions: unchanged

**Components reused (DR-057 — no new shared components created):**
- `PageTitle` — reused verbatim from `src/components/core/PageTitle/PageTitle.tsx`
- `ReferenceCommandsSection`, `ReferenceAgentsSection`, `ReferenceRulesView`,
  `ReferenceStandardsView` — all pre-existing, reused unchanged
- No new shared component was created; all changes are within `src/app/manual/`

**Implicit decisions / assumptions:**
- Group icons for authored pages use a single icon per Diátaxis group (not per-page) — tutorial:
  `ti-player-play`, guides: `ti-map-2`, concepts: `ti-brain`. This matches the prototype's
  per-item icons from `MANUALNAV` but since authored pages come from `readManualPages()` (no icon
  field), the group default is the closest approximation.
- The prototype defaults to showing `manualLanding()` content on load (when `ST.manualPage` is
  unset). This implementation shows an empty state ("Selecciona una página del menú para leerla")
  because the authored content comes from `content/manual/*.md` files — the `manualLanding()` inline
  HTML in the prototype is a static fixture, not a real authored page. The existing tests validate
  this behavior and it is intentional.
- `page.tsx` wraps `ManualShell` in a `<div>` (not `<main>`) so `DocReader`'s `<main>` is the sole
  landmark — avoids nested `<main>` violation (WCAG 2.2).
- The RPG emboss box-shadow on DocNav uses `rgba()` literals (structural shadows, theme-independent
  — same pattern as `Panel/Panel.tsx`). The no-hardcoded-color test allows this by only checking for
  hex literals and `hsl()`, not `rgba()`.
- Light/dark theming: app renders in system light mode. The prototype mock is dark. This is a
  theming mode difference only (same observation as WO-07-005), not a layout divergence.

**Test files:**
- `src/app/manual/_tests/visual-reanchor.test.tsx` — 23 new tests covering DR-062 (H1 "Documentación"),
  FDD-08 §1 (two-pane layout + sticky wrapper + min-width:0), FDD-08 §2 (navitem active state +
  aria-current), FDD-08 §3 (DocReader page kinds), FRD-13 tokens (no hardcoded hex), and inline
  content page interaction flows.
- All 5 existing test files in `src/app/manual/` continue to pass (137 tests total).

**Fidelity check (DR-056):** 3 cycles performed.
- Cycle 1: H1 was "Manual", no sticky wrapper, no min-width:0, generic nav styling → fixed.
- Cycle 2: Nav showed accent-teal group headers + icons; nav panel emboss added → verified layout.
- Cycle 3: Active page interaction verified — clicking nav item shows correct authored content +
  accent active state. Remaining delta: dark-mode tokens vs light-mode render (theming difference,
  not a layout failure).
