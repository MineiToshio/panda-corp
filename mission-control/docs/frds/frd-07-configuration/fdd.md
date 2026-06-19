---
id: FDD-07
type: fdd
title: FDD-07 — Configuration (feature design)
parent: frds/frd-07-configuration/frd.md
ui: true
visual_source: docs/design/prototype/index.html
mock: docs/design/prototype/index.html
status: ACTIVE
last_updated: '2026-06-19'
---
# FDD-07 — Configuration (feature design)

The feature's design **on the frozen tokens** (`docs/design/design-tokens.json`, root `DESIGN.md`),
sharded from the owner-approved whole-app prototype. This document is **fidelity, not novelty**: it
describes the Configuración surface exactly as the prototype renders it, mapped to the frozen design
system (the PDD) and the FRD's acceptance criteria.

**Visual source:** the Configuración view of `docs/design/prototype/index.html`.
**Exact render functions:** `configView()` (the section landing + grid, lines ~859–884),
`configDetail()` (the per-item detail with Resumen/Detalle tabs, lines ~885–912), and the per-kind
card builders `gxSkillCard` / `gxAgentCard` / `gxRuleCard` / `gxStdCard` (lines ~845–858), the
`gxHero` section banner (line ~844), `cfgTabs` (line ~843), `flowDiagram` / `flowNode` / `agentChips`
(lines ~834–842), `secthead` (line ~444), `avatar` (line ~557), `sevBadge` / `enfBadge` (lines
~831–832). Reference data lives in the `CONFIG.{skills,agents,rules,estandares}` arrays + `AGMETA`
(agent level/XP) + `AVCOL` (per-agent color).

> The design contract (palette, typography, surfaces, the **app-wide RPG embossed skin**, the
> pixel-art sprite spec) is the global PDD — it is NOT redefined here. This FDD only assembles the
> Configuración screens on top of it. Every named value comes from a token, never a hardcoded literal.
> **In the real app the four Reference catalogs are read live from the factory** (`plugin/skills/`,
> `plugin/agents/`, `factory/decisions/registry.yaml`, `factory/standards/`) — the prototype's
> `CONFIG.*` arrays are a hand-kept stand-in for that derivation (DR-046); read-only either way
> (`AC` "to edit, you do it in the files / Claude Code").

## 1. Layout

Configuración is a single `.rpghall` column inside the app shell. Top → bottom:
- **Section hero** (`gxHero`) — a `rpgpanel rpggrid anim` banner: a 46px accent `itemslot` icon
  tile + an `.ttl` title + a `{text.t2}` sub-line. One per section, restating what that section is.
- **Section switcher** — a row of four `.stab` sub-tabs (**Skills · Agentes · Reglas · Estándares**),
  each an icon + label; the active one carries the `.stab.on` fill (`{surfaces.card2}` + `{text.t1}`).
- **Body** — a responsive **card grid** (`repeat(auto-fill, minmax(290px, 1fr))`, gap 9px), grouped by
  `secthead` section headers (a `display`-font label + a trailing 1px rule + an optional count).

Clicking a card opens **`configDetail()`** in place (replacing the grid; `ST.configItem` set). The
detail is a **back button** (`← Volver`) + a `panel` header + a **Resumen / Detalle** tab pair
(`cfgTabs`) + the active tab's `panel`. Mobile: the `minmax(290px,1fr)` grid collapses to a single
column; the section switcher and the detail tabs wrap.

## 2. The four sections (per `AC`)

**Skills** (`AC` "Skills"). Cards (`gxSkillCard`) are grouped by where they run via `secthead`:
**En la fábrica** vs **En el proyecto** (`s.corre`). Each card: a wand `itemslot` tile, the
`/<command>` in the `pixel` accent color (with an "interno" chip when `s.interno`), the first sentence
of its description, a footer with the run location (📍 `s.corre`) and up to 5 **party sprite
thumbnails** (`mcSprite(id)`, 22px pixel images) of the agents it invokes. Detail header shows
`/pandacorp:<id>`, **Corre en** and **Produce**; **Resumen** renders the full description, the
**agent chips** (`agentChips`, clickable → jump to the agent), and the **mini-flow graph**
(`flowDiagram`): rows of `flowNode`s (agent / action / gate / safe / io, colored per kind; agent nodes
colored per `AVCOL` and clickable), `↓` arrows between rows, an optional loop chip — exactly the
"graph of how the skill works" the FRD requires. **Detalle** lists the flow step-by-step (`<ol>`) plus
the orchestrated agents as rows.

**Agentes** (`AC` "Agents"). Cards (`gxAgentCard`): a **pixel-art avatar** (`avatar(id)`), the agent
id in `mono` + its model chip (`opus`/`sonnet`), its role, and — when `AGMETA[id]` exists — a warn-
colored **NV `<level>` · `<title>`** line (Apprentice → Engineer → Senior → Architect). Detail
**Resumen** shows the avatar header + description + Produce, then the **XP bar to the next level**
(`{accent.accent}` fill on a `{surfaces.card2}` track) with `Nv N · <title> · XP al siguiente` and the
`m[2]/m[3]` count, and the explanation that an agent **levels up by completing work orders**
(`AC`, FRD-09 gamification). **Detalle** lists which skills use it (clickable chips) + a note on what
its model is for.

**Reglas** (decision rules, `AC` "Decision rules"). A **"+ Nueva regla de decisión"** button copies
`/pandacorp:learn`. Cards (`gxRuleCard`) are split by `secthead` into **Requieren tu fallo** vs
**Auto-aprobadas** (`r.h`): a gavel/check `itemslot` in danger (asks you) or ok (auto) color, the DR
id (`pixel`), the title, and a **REQUIERE TU FALLO / LA IA DECIDE SOLA** line. This is the
**auto-approves (●) / asks-you (●)** indicator the FRD requires — conveyed by **icon + text + color**,
not color alone. Detail header carries a "● te pregunta / ● auto-aprueba" chip; **Resumen** shows the
**pre-approved default** (`r.def`); **Detalle** explains how the rule applies (escalates to you with
`/pandacorp:decide`, or the AI applies it, verified by script/CI) and where it lives
(`factory/decisions/registry.yaml`).

**Estándares** (`AC` "Standards"). A **"+ Nuevo estándar"** button copies `/pandacorp:learn`. Cards
(`gxStdCard`) are **grouped by domain** (`secthead` per `s.dom`: Programming, Architecture, Design,
Technology, Quality, Security, Operation, Data/Privacy, Product/Docs) — a book `itemslot`, the name, a
**severity** badge (MUST danger / SHOULD warn / MAY neutral, `sevBadge`) and an **enforcement** badge
(lint/CI/checklist/human gate, `enfBadge`). Detail header carries the domain + severity + enforcement
chips; **Resumen** = the "why" + the real key bullets; **Detalle** = the markdown (`md()`), with a
pointer to the full `factory/standards/<id>.md`. The two views match the FRD's required
**Summary / Detail** pair.

## 3. Components used (all on the frozen tokens / PDD)

| On screen | Component (see `docs/design/components.md`) | Notes |
|---|---|---|
| Section banner | `SectionHero` (`gxHero`) | `rpgpanel rpggrid` + 46px accent `itemslot` |
| Skills/Agentes/Reglas/Estándares switch | `SubTabs` (`.stab`) | active = `.stab.on` |
| Skill card | `SkillCard` (`gxSkillCard`) | wand tile, `/cmd`, run-location, party thumbnails |
| Agent card | `AgentCard` (`gxAgentCard`) | pixel avatar, model chip, NV/title line |
| Rule card | `RuleCard` (`gxRuleCard`) | gavel/check tile, asks-you vs auto split |
| Standard card | `StandardCard` (`gxStdCard`) | book tile, severity + enforcement badges |
| Detail Resumen/Detalle toggle | `DetailTabs` (`cfgTabs`) | `.stab` pair |
| Skill mini-flow graph | `FlowDiagram` (`flowDiagram` + `flowNode`) | agent/action/gate/safe/io nodes, `↓` arrows, loop chip |
| Clickable agent chips | `AgentChips` (`agentChips`) | jump-to-agent pills |
| Pixel-art agent avatar | `Avatar` (`avatar`) | per-agent `AVCOL` color |
| XP-to-next bar | `XpBar` (PDD `.xpbar`) | accent fill on `card2` track |
| Severity / enforcement badges | `SeverityBadge` / `EnforcementBadge` | MUST/SHOULD/MAY · lint/CI/… |
| Section header w/ rule + count | `SectionHead` (`secthead`) | `display` label + 1px `.ln` |
| Copy-command chip | `CmdRow` (`.cmd`) | the `/pandacorp:learn` buttons / detail commands |
| Card grid | `CardGrid` | `auto-fill minmax(290px,1fr)` |

Primitives reuse the PDD's `panel` / `rpgpanel` surfaces, `chip`, `button`, the `pixel` / `mono` /
`display` families, the 3 elevation shadows and the `2px accent` focus ring. No new visual language;
the RPG embossed skin and `anim` entrance apply app-wide.

## 4. Designed states (empty / loading / error)

- **Empty** — a section with no items renders its hero + an empty grid; in practice the four catalogs
  are always populated from the factory, so the realistic "empty" is a **section the factory could not
  read** → show the hero + a `panel` note (`{text.t3}`) "No se pudo leer `<source path>`" with the file
  it reads, never a blank screen (consistent with read-only FRD-01). The Reglas/Estándares **"+ Nuevo"
  buttons stay visible** so the surface is still actionable.
- **Loading** — the catalogs are server-read from the filesystem in the same navigation (Server
  Components reading `plugin/`/`factory/`); no fake client skeleton over content the server already
  delivers. A `secthead` placeholder may show while a large standards body parses.
- **Error** — a malformed source file (e.g. unreadable registry) degrades to the empty-state note for
  that section, with the danger color + icon, rather than crashing the view; other sections still
  render. The detail view falls back to its header if a body fails to parse.

## 5. This is read-only (no demo-only controls)

Configuración has **no demo-only affordances** (DR-061 N/A here): every control is real and read-only.
The **"+ Nueva regla / Nuevo estándar"** buttons and the detail command chips do exactly one thing —
**copy a `/pandacorp:*` command** to the clipboard for the owner to paste into Claude Code; they never
mutate the factory. The agents' **level/XP is honest** (real work orders completed, FRD-09): it is
read-only data, not a control. There is nothing here that previews a state the real app lacks, so no
dashed `SOLO DEMO` block is needed.

## 6. Accessibility & motion

- State is conveyed by **icon + text** in addition to color — the rule cards carry the
  REQUIERE TU FALLO / LA IA DECIDE SOLA label *and* a robot/gavel icon (never the ● color alone); the
  standard severity carries the MUST/SHOULD/MAY text *and* the badge color.
- `tabular-nums` on the XP counts and levels (PDD base). The `anim` entrance is `transform`/`opacity`
  only and honors `prefers-reduced-motion` (PDD). Focus ring `2px solid {accent.accent}`.
- Cards are real interactive elements (`data-act="cfgitem"`) — keyboard-reachable, `≥44px` touch
  targets via the card padding; the clickable agent/skill chips jump to the related detail.
- WCAG AA contrast on both themes (the tokens are pre-checked); exactly one `<h1>` lives in the app
  shell, the hero titles are sub-headings.

## Traceability

Maps `frd.md` ACs → this design: **Skills / Agents / Decision rules / Standards sections** → §1, §2;
**name + real description per item** → §2 (all four cards); **click → detail** → §1 (`configDetail`);
**skill what-for / where / produces / mini-flow graph** → §2 Skills (`flowDiagram`); **decision rules
what-it-is + ●/● indicator + default + "New rule" button** → §2 Reglas; **standards categorized by
domain + severity + enforcement + Summary/Detail + "New standard" button** → §2 Estándares; **agent
pixel avatar + level + title** → §2 Agentes; **XP bar + levels-up-by-WOs** → §2 Agentes; **read from
the plugin, read-only** → §5 + the header note.
