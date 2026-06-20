---
id: WO-08-002
type: work-order
slug: documentation-ui
title: 'WO-08-002 — Documentación UI surface (re-anchor to prototype)'
status: DRAFT
parent: FRD-08
implementation_status: PLANNED
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
