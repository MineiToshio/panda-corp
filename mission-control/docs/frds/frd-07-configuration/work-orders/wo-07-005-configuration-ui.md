---
id: WO-07-005
type: work-order
slug: configuration-ui
title: 'WO-07-005 — Configuración UI surface (re-anchor to prototype)'
status: DRAFT
parent: FRD-07
implementation_status: IN_REVIEW
artifacts:
  - 'src/app/configuration/**'
source_requirements: [REQ-07, AC-07-001, AC-07-002, AC-07-003, AC-07-004, AC-07-005]
last_updated: '2026-06-19'
---
# WO-07-005 — Configuración UI surface (re-anchor to prototype)

Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-07-*`](../blueprint.md#3-components--interfaces) · FDD: [`fdd.md`](../fdd.md).

## Goal
Re-implement the **whole Configuración surface** (`src/app/configuration/**`) so it matches the
owner-approved prototype pixel-for-pixel on the frozen tokens (the RPG embossed skin). This is a
**presentational re-anchor** — the `lib/**` readers (`readSkills`/`readAgents` WO-07-001,
`readDecisionRules` WO-07-003, `readStandards` WO-07-004) are VERIFIED and **consumed as-is**, not
re-planned. One coarse UI WO collapses the former page-shell + four section WOs so the surface is
built and reviewed as one cohesive screen.

## Scope
Build/adapt the components below per `docs/design/components.md` (reuse → adapt → create; do NOT fork
a near-duplicate of a foundation primitive):

- **`SectionHero`** (`gxHero`) — the section banner; per DR-062 it **delegates to `PageTitle`** (the
  ONE light title block) for the icon + H1, never a bespoke heavy panel. The page H1 is
  **"Configuración"** (= nav label) via `PageTitle`.
- **`SkillCard`** (`gxSkillCard`) — wand tile, `/cmd` accent, run-location footer, party sprite
  thumbnails; grouped **En la fábrica / En el proyecto** by `SectionHead`; "interno" chip.
- **`AgentCard`** (`gxAgentCard`) — pixel-art avatar + model chip (`opus`/`sonnet`) + NV/title line.
- **`RuleCard`** (`gxRuleCard`) — gavel/check tile, **Requieren tu fallo / Auto-aprobadas** split,
  ●/● conveyed by **icon + text + color**.
- **`StandardCard`** (`gxStdCard`) — book tile grouped by domain via `SectionHead`, `SeverityBadge`
  (MUST/SHOULD/MAY) + `EnforcementBadge` (lint/CI/checklist/human gate).
- **`FlowDiagram`** (`flowDiagram`/`flowNode`) — the skill mini-flow graph: agent/action/gate/safe/io
  nodes, `↓` arrows, optional loop chip; agent nodes colored per `AVCOL` (FRD-13) and clickable.
- **`AgentChips`** (`agentChips`) — clickable jump-to-agent pills in skill detail.
- Detail surface (`configDetail`): back button + `Panel` header + **Resumen / Detalle** `SubTabs`
  pair; skill detail shows what-for / Corre en / Produce + agent chips + FlowDiagram; agent detail
  shows XP bar to next level + "levels up by completing work orders"; standard detail shows
  Summary + rendered markdown.

Reuse the foundation primitives — do not re-create: `PageTitle`, `SectionHead`, `SubTabs`/`Tabs`,
`Panel`, `Chip`, `CmdRow` (the `/pandacorp:learn` and detail copy chips), `Button`, `ItemSlot`,
`Avatar`/`XpBar`. The four Reference catalogs are **derived live from the factory** via the VERIFIED
readers — never a static array.

## Acceptance criteria (FRD-07 EARS)
- Four sections **Skills · Agentes · Reglas · Estándares**, each listing items with a name + real
  description; click → detail. (FRD-07 ACs "sections", "list items", "click → detail")
- Skill detail: what-for, where it runs, what it produces, and the **mini-flow graph** of colored
  agent chips with arrows; Skills/Agents **cross-navigation** works both ways.
- Skills **grouped by run-location** with counts; **interno** flag on internal skills.
- `/pandacorp:<slug>` chip + the "+ Nueva regla / + Nuevo estándar" buttons **copy to clipboard**
  only (never run / never call Claude).
- Decision rules: explainer + ALL DRs with **auto-aprueba (●) / te pregunta (●)** indicator
  (icon+text+color) + detail (pre-approved default).
- Standards **categorized by domain** + **severity** + **enforcement** badges + Summary/Detail pair.
- Agents: pixel-art avatar + level + title + model chip; detail XP bar + "levels up by completing
  work orders" + model-assignment explanation.
- Read-only throughout; AA contrast on both themes; `prefers-reduced-motion` honored.

## Dependencies
- **Foundation (FRD-13)** — **WO-13-006** (`PageTitle`/`SectionHead`/`Tabs`/`SubTabs`),
  **WO-13-007** (`Banner`/`Chip`/`CountBadge`/`Panel`/`CmdRow`/`Button`), **WO-13-008**
  (`ItemSlot` for the tiles). Build foundation-first.
- **Readers (VERIFIED, consume as-is)** — WO-07-001 (`readSkills`/`readAgents`), WO-07-003
  (`readDecisionRules`), WO-07-004 (`readStandards`).
- **FRD-09** — `IF-09-agent-xp` + the pixel-art `Avatar`/`XpBar` for agent level/title/XP.
- **FRD-13** — design tokens + per-agent accent (`AVCOL`); zero hardcoded colors.

## Visual reference
`docs/design/prototype/index.html` — the **Configuración** view (`configView()` + `configDetail()`
and the `gxSkillCard`/`gxAgentCard`/`gxRuleCard`/`gxStdCard` builders). The in-loop fidelity gate
renders `src/app/configuration` against this mock.

## Status Note

**What was built:** Re-anchored the full Configuración surface (`src/app/configuration/**`) to the
owner-approved prototype. All four tabs are live and served from real factory data (VERIFIED lib
readers consumed as-is). The duplicate `<h1>` header in `page.tsx` was removed — `PageTitle` inside
`ConfigurationShell` is now the sole H1 (DR-062).

**Interfaces / contracts exposed:**
- `ConfigurationShell` — `"use client"` boundary; props: `{ skills, agentsData, rules, standards }` (unchanged from WO-07-006/007/008/009)
- `AgentList` — `AgentListProps` with horizontal `gxAgentCard` layout (avatar-left row)
- `SkillList` — groups by `runsIn` with `SectionHead`
- `DecisionRulesSection` — groups rules into "Requieren tu aprobación" / "Auto-aprobadas" via `RuleGroupedList` + `RuleItem`; `data-testid="rules-list"` always present on outer wrapper
- `StandardsSection` / `DomainGroup` — book `ItemSlot` + severity/enforcement badges

**Components reused (DR-057, no new shared components created):**
- `Panel variant="rpgpanel"` — embossed skin on all four card types
- `ItemSlot` — wand (accent) for skills, check (ok) / gavel (danger) for rules, book (accent) for standards
- `SectionHead` — group headings for skill run-location groups and rule human/auto groups
- `PageTitle` — single page H1 in `ConfigurationShell` header
- `Avatar` — pixel-art per agent id in `AgentList`

**Implicit decisions / assumptions:**
- `agent-card-name` testid carries the display name (`agent.name ?? agent.id`), placed on the subtitle row (text2 color); the mono id is on row 1 without its own testid
- Agent level label uses `Nv N` (capital N, lowercase v) to match existing tests
- Rules section always mounts a `data-testid="rules-list"` wrapper (even when empty) to satisfy `getByTestId` in gate tests
- `page.tsx` no longer has its own `<h1>` or header wrapper — `ConfigurationShell` owns the full layout
- `StandardCard` uses `ti-book` icon (not `ti-book-2` as in prototype) — `ti-book-2` is not in the installed Tabler set

**Test files:**
- `src/app/configuration/_tests/visual-structure.test.tsx` — 18 new tests covering Panel/ItemSlot/SectionHead/PageTitle structural requirements (WO-07-005 acceptance)
- Existing tests in `_tests/agents.test.tsx`, `_tests/frd07.gate.reviewer.test.tsx`, `_rules/DecisionRulesSection/_tests/`, `StandardsSection/_tests/` all green

**Fidelity check (DR-056):** 2 cycles performed; all four tabs screenshotted at 1280×800 against `configView()`. Remaining minor delta: prototype uses dark theme (`--canvas:#0F1517`) while app renders in light mode (tokens map to light values) — this is a theming mode difference, not a layout divergence.
