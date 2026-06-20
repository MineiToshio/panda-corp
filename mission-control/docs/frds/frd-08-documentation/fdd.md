---
id: FDD-08
type: fdd
title: FDD-08 — Documentation · the Manual ("Códice del gremio") (feature design)
parent: frds/frd-08-documentation/frd.md
ui: true
visual_source: docs/design/prototype/index.html
mock: docs/design/prototype/index.html
status: ACTIVE
last_updated: '2026-06-19'
---
# FDD-08 — Documentation · the Manual (feature design)

The feature's design **on the frozen tokens** (`docs/design/design-tokens.json`, root `DESIGN.md`),
sharded from the owner-approved whole-app prototype. This document is **fidelity, not novelty**: it
describes the Manual ("Códice del gremio") exactly as the prototype renders it, mapped to the frozen
design system (the PDD) and the FRD's acceptance criteria.

**Visual source:** the Manual view of `docs/design/prototype/index.html`.

> **Re-anchor note (2026-06-19):** the section is **renamed "Documentación"** — the nav tab label is
> "Documentación" (`topbar()` ~L649) and the page H1 matches it (`manualView` uses
> `pageHead("ti-book","Documentación", …)`, ~L1364). The internal "Códice del gremio" stays as the
> subtitle/flavor, not the title. The Referencia catalogs are **derived dynamically from the factory**
> (plugin skill/agent frontmatter + `registry.yaml` + `factory/standards/`, DR-046); the Guías reflect
> the **current** workflow (capture → handoff → design/blueprint → implement → test-without-stopping →
> hand-off → update-plugin).

**Exact render functions:** `manualView()` (the navigable shell — light page title + sticky side nav +
reader, ~L1361), `manualContent(id)` (the router that picks the page kind, ~L1352), and the reader kinds
it routes to:
- **Empezar aquí** → `manualLanding()` (Qué es Pandacorp, ~L1279) and `manualQuickstart()` ("Tu primera
  misión", ~L1289);
- **Guías** → `manualGuide(id)` + `guiaDoc()` (~L1300–1350) — the current-workflow how-tos;
- **Referencia** → `refSection(sec)` (~L1256), which reuses the Configuración cards/detail
  (`gxSkillCard` / `gxAgentCard` / `gxRuleCard` / `gxStdCard` / `configDetail`) — the same catalogs as
  FRD-07, **derived from the factory** and surfaced read-only inside the Manual;
- **Conceptos** → `docPage(p)` (~L1075), the long explanation pages incl. the diagrams
  `pipelineDiagram`, `teamDiagram`, `channelsDiagram`, `archDiagram`, `cockpitDataDiagram`,
  `snapshotMini` and the **Autoaprendizaje** concept page (`docPage` p=14).

Page/nav data: `MANUALNAV` (the four Diátaxis groups + items, ~L1223). Headings via `docH`,
copy-command chips via `docCmd`, the Manual page title via `pageHead`, the Referencia section heroes via
`gxHero` (which itself delegates to `pageHead`).

> The design contract (palette, typography, surfaces, the **app-wide RPG embossed skin**, the
> pixel-art spec) is the global PDD — it is NOT redefined here. This FDD only assembles the Manual on
> top of it. Every named value comes from a token, never a hardcoded literal.

## 1. Layout — a navigable shell + a reader (`AC`)

The Manual is one `.rpghall` column: the one light **`pageHead`** title block on top
(`pageHead("ti-book","Documentación", "El códice del gremio · …")` — icon + H1 = nav label
"Documentación" + subtitle, **not** a heavy hero panel), then a **two-pane grid** (`236px 1fr`, gap 14px,
align start):
- **Side menu** (`AC` "side menu with pages") — a `panel` that is **`position: sticky; top: 14px`**,
  listing every page as a `.navitem` (icon + label), grouped under four uppercase **Diátaxis group
  headers** in the `pixel` accent color: **Empezar aquí · Guías · Referencia · Conceptos**. The active
  page carries `.navitem.on` (`{accent.accentBg}` fill + `1px` inset accent ring from the RPG skin).
- **Reading area** (`AC` "renders each page", `min-width:0`) — renders the selected page via
  `manualContent(id)`. Each page opens with a `docH` title (a 6px accent ledge + the title) and lays
  content into `panel` cards and `.doc` prose.

Mobile: the `236px 1fr` grid collapses to a single column (the nav stacks above the reader and is no
longer sticky); `panel`s and diagram rows wrap. Touch targets ≥44px via `.navitem` padding.

## 2. The four Diátaxis page kinds

**Empezar aquí (tutorial).** `manualLanding()` = the "Qué es Pandacorp" overview: a `panel` intro, a
three-up `rpgpanel` feature row (Solo-lectura · Estado en vivo · Te da el comando) and the
`pipelineDiagram`, plus a CTA card into "Tu primera misión". `manualQuickstart()` = a 5-step
numbered walkthrough (`rpgpanel` step cards with an accent `itemslot` numeral + a `docCmd` copy-chip
per step) ending in the first build. Together they satisfy "sufficient for someone with no prior
context".

**Guías (how-to).** `manualGuide(id)` renders task recipes via `guiaDoc(title, intro, steps, tip)`:
a `docH` title + intro + a `panel` of numbered steps (each an accent `pixel` numeral + the step text
with inline `<code>` commands) + an optional warn-bulb tip card. Covers capturing an idea, the
handoff, choosing a build mode, reporting a bug / deciding, testing without stopping the agent,
handing the project to another person, updating the plugin (`AC` "how to operate / hand off").

**Referencia (reference) — AUTO-DERIVED (DR-046).** `refSection(sec)` renders the four catalogs —
**Comandos (skills) · Agentes (party) · Reglas de decisión · Estándares** — reusing the exact
Configuración cards and the shared `configDetail`. **Per `AC` + DR-046 these catalogs are NOT
hand-maintained: in the real app they are derived at build/read time** from the canonical source —
the plugin skill+agent frontmatter (`name` + `description`) under `plugin/skills/` and
`plugin/agents/`, `factory/decisions/registry.yaml`, and `factory/standards/` — so a new, renamed or
removed skill/agent/rule/standard appears automatically with no drift. The prototype's `CONFIG.*`
arrays are the hand-kept stand-in for that derivation (see the FRD's "Prototype note"). The **design**
of this page is therefore the navigable shell + the reader + the **derived** catalog cards; the cards
themselves are FRD-07's components, reused here, not re-styled.

**Conceptos (explanation).** `docPage(p)` renders the long "why" pages, several anchored to a diagram
built from data + tokens (no images): `pipelineDiagram` (the 6 stages), `teamDiagram` (the agent
roster grouped by phase, each clickable), `channelsDiagram` (bug/iterate/decide), `archDiagram`
(factory ↔ products), `cockpitDataDiagram` (the files MC reads → Mission Control), `snapshotMini` (the
git-worktree testing model). Includes the **Autoaprendizaje / self-learning** concept page
(`docPage` p=14, surfaced as `c-autoaprendizaje`) required by DR-046 — the loop, the 3 actors, the
captures/protections, the promotions queue — which is also where FRD-17's surface is forward-referenced.

## 3. Components used (all on the frozen tokens / PDD)

| On screen | Component (see `docs/design/components.md`) | Notes |
|---|---|---|
| Manual page title | `PageTitle` (`pageHead`) | light icon + H1 "Documentación" + subtitle — the one canonical title block |
| Referencia section hero | `SectionHero` (`gxHero`) | per-catalog section title; **delegates to `pageHead`** — same light title shape |
| Sticky side menu | `DocNav` (`manualView` nav) | grouped `.navitem`s, `sticky top:14px`, `pixel` group headers |
| Page heading | `DocHeading` (`docH`) | accent ledge + title |
| Tutorial / landing | `ManualLanding` (`manualLanding`) | intro + feature row + pipeline + CTA |
| Quickstart walkthrough | `Quickstart` (`manualQuickstart`) | numbered `rpgpanel` step cards + `docCmd` |
| How-to recipe | `GuideDoc` (`guiaDoc` / `manualGuide`) | numbered steps + tip card |
| Reference catalog (derived) | `RefSection` (`refSection`) | **reuses** FRD-07's `SkillCard`/`AgentCard`/`RuleCard`/`StandardCard` + `configDetail` |
| Concept page | `DocPage` (`docPage`) | `panel`/`.doc` prose + a diagram |
| Pipeline diagram | `PipelineDiagram` (`pipelineDiagram`) | 6 stage rows + `↓` + `docCmd` |
| Team diagram | `TeamDiagram` (`teamDiagram`) | roster grouped by phase, clickable avatars |
| Channels diagram | `ChannelsDiagram` (`channelsDiagram`) | bug/iterate/decide panels |
| Data-flow diagrams | `ArchDiagram` / `CockpitDataDiagram` / `SnapshotMini` | factory↔products, files→MC, worktree |
| Copy-command chip | `CmdRow` / `DocCmd` (`.cmd` / `docCmd`) | the `/pandacorp:*` commands |
| Section header w/ rule | `SectionHead` (`secthead`) | inside Referencia card groups |

The Reference catalog reuses FRD-07's card primitives verbatim (reuse-before-create, DR-057) — this
page adds the **navigable shell, the tutorial/how-to/concept readers and the diagrams**, not new
catalog cards. All on the PDD's `panel`/`rpgpanel` surfaces, `chip`, `button`, the `pixel`/`mono`/
`display` families, the 3 elevation shadows, the `2px accent` focus ring.

## 4. Designed states (empty / loading / error)

- **Empty** — a not-yet-written hand-authored Guide/Concept renders a `docH` title + a `panel`
  **"Próximamente."** (this is the prototype's `manualGuide` fallback) rather than a blank reader. A
  Reference section whose **source could not be read** shows the hero + a `panel` note naming the
  source path (consistent with FRD-07's read-error state), never an empty catalog.
- **Loading** — pages are server-rendered from the filesystem (the Reference is read live from
  `plugin/`/`factory/`); no fake client skeleton over content the server already delivers. The default
  page (`MANUALNAV[0].items[0]`, "Qué es Pandacorp") renders immediately.
- **Error** — a malformed source file for a derived Reference section degrades to the read-error note
  for that section (danger color + icon), with the rest of the Manual still navigable; an unknown
  `?page` id falls back to the default page (`manualContent` guard).

## Cohesion (DR-062)
The Manual uses the app-wide framing: the one light **`PageTitle`** block (`pageHead`) for the page
title, and the Referencia **`gxHero`** section titles **delegate to `pageHead`** so a section header is
the same light icon + title shape, never a heavy bespoke banner. Section dividers inside Referencia card
groups are the one **`SectionHead`** (`secthead`); the four Diátaxis nav groups are the one `.navitem`
nav (a distinct primitive from `.tab`/`.rail`, picked deliberately). Cards, chips and command-rows are
the shared `Panel`/`Chip`/`CmdRow`. No surface re-invents a title, header, chip or command-row.

## 5. Demo-only controls — none

The Manual is **read-only navigation + a reader**: every control either **navigates** to a page or
**copies a `/pandacorp:*` command** (`docCmd` / the CTA chips). There is no affordance that previews a
state the real app lacks, so **no DR-061 `SOLO DEMO` block is needed** here. The diagrams are static
data renders (not interactive simulators), and the team diagram's clickable avatars only jump to the
agent's Reference detail.

## 6. Accessibility & motion

- Landmarks: the side menu is the page's local navigation; exactly one `<h1>` lives in the app shell,
  the `docH` titles and group headers are sub-headings (no skipped levels). The nav is keyboard-
  reachable and focus-visible; the sticky menu must not obscure focus (WCAG 2.2 SC 2.4.11 →
  `scroll-margin`).
- State by **icon + text** (the channel/standard/severity references carry their label, never color
  alone). `tabular-nums` on any counts. The `anim` entrance is `transform`/`opacity` only and honors
  `prefers-reduced-motion` (PDD). Focus ring `2px solid {accent.accent}`.
- WCAG AA contrast on both themes (pre-checked tokens). Copy-command chips have an explicit copy button
  with an accessible label.

## Traceability

Maps `frd.md` ACs → this design: **side menu + reading area** → §1; **pages cover what/flow/stages/
commands/modes/standards/operate-handoff** → §2 (all four kinds); **sufficient for a no-context
reader** → §2 (Empezar aquí + Guías); **Reference catalogs auto-derived from the canonical source
(DR-046)** → §2 Referencia + the design note; **Manual stays in sync (derived Reference + disciplined
hand-authored pages)** → §2 (the derivation is the design, not a hand-copy); **Concept/Guide reflects
the feature-centric DR-049 layout** → §2 Conceptos (the "Estado y archivos" / structure pages render
the feature-centric model). The self-learning Concept page (DR-046) → §2 Conceptos
(`docPage` p=14).
