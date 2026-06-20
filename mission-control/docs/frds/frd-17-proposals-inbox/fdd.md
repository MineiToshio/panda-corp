---
id: FDD-17
type: fdd
title: FDD-17 — Proposals inbox (self-learning gate + self-suggestion) (feature design)
parent: frds/frd-17-proposals-inbox/frd.md
ui: true
visual_source: docs/design/prototype/index.html
mock: docs/design/prototype/index.html
status: ACTIVE
last_updated: '2026-06-19'
---
# FDD-17 — Proposals inbox (feature design)

The feature's design **on the frozen tokens** (`docs/design/design-tokens.json`, root `DESIGN.md`),
sharded from the owner-approved whole-app prototype. **Fidelity, not novelty.**

> **Re-anchor note (2026-06-19):** the Proposals inbox is now a **canonical, dedicated screen in the
> prototype** — render fn **`propuestasView()`** (~L1404), reached from the top-bar tab **`tabProp()`**
> (~L652) with an open-count badge. Earlier editions of this FDD said "the prototype does not yet draw
> this screen and must be assembled from primitives" — that is **superseded**: the screen exists and is
> frozen here. The cards (`bPropCard`, ~L1394), groups (`bPropGroup`, ~L1401), proposal data
> (`BPROPOSALS`, ~L1372) and the memory-health block (inside `propuestasView`, ~L1408) are the contract.

## 1. Layout

A single **`pageHead`** light title block ("Propuestas") with a `tail` open-count pill, then a read-only
note, then two stacked regions — **Salud de la memoria** first, then the **proposal groups**:

- **Entry points (AC):** a **top-bar tab** `Propuestas` with an open-count badge (`tabProp`, ~L652) and
  a **per-project rail chip** in the portfolio rail (FRD-14 cluster). Both open this view.
- **Page title:** `pageHead("ti-mail-opened","Propuestas", <subtitle>, <open-count tail>)` — the one
  canonical light title block (icon + H1 = nav label "Propuestas" + subtitle), **not** a heavy hero.
- Mobile: single column throughout; the tab badge and rail chip wrap with the existing clusters. Touch
  targets ≥44px.

## 2. Memory-health panel (`MemoryHealthPanel`)

A **`SectionHead`** ("Salud de la memoria") over a responsive `dStat` grid of `tabular-nums` counters
(`MEM`, ~L352): **Notas sin refinar · Lecciones candidatas · Última cosecha (hace {n}d) · Promociones a
aprobar** (warn-accented when stale / non-zero). If the backlog is large or `/pandacorp:memory` has not
run in a while, a **staleness nudge** appears (`/pandacorp:memory harvest` copy-chip) using the shared
**`Banner`** staleness pattern — a reminder, not a red alert. This panel doubles as the on-demand
refine-trigger surface.

## 3. The four proposal-kind groups (`bPropGroup` + `bPropCard`)

The stream is **four `SectionHead` groups**, ordered and adjacency-grouped per the prototype:
1. **Lecciones candidatas** (`bulb`, accent) — eval-gate state line ("esperando 2ª aparición" /
   "corroborada — activa", DR-047);
2. **Lecciones obsoletas / para podar** (`trash`, muted) — **placed adjacent to candidates** because
   both share `/pandacorp:memory`;
3. **Promociones esperando tu aprobación** (`arrow-up-right`, tier-4) — each with a **target** chip
   (estándar / regla de decisión);
4. **Auto-sugerencias de Mission Control** (`sparkles`, info) — bottleneck / velocity / unused-capability
   / shipped-review nudges, each with its computed metric as evidence.

**The activating command is GROUP-level, not per item (`bPropGroup` `groupCmd`, ~L1401).** When a whole
group shares one skill (candidates + prune both run `/pandacorp:memory`), the command shows **once under
the group title** ("Para revisar/activar toda esta lista, corre: …") and the individual cards carry **no
command**. Only when a group's items each have a distinct command (promotions → each its own
`/pandacorp:learn …`; auto-suggestions → `/pandacorp:decide` / `/pandacorp:review-launch`) does the
command move onto the card (`withCmd`).

### The proposal card (`bPropCard`, ~L1394) — one card, four kinds
A clean **`rpgpanel` card**: a 32px `itemslot` icon in the kind color, then a header row with the
`LESSON-NNNN` id (`mono`), an optional **eval-gate chip** (ok/warn by state) or **target chip** (accent),
the **title** (plain language), and an evidence line ("Capturada en … · (agent-inferred/owner-stated)")
with a file-search icon. **It is just title + evidence (+ command only when the group doesn't carry
one)** — no per-item action clutter. State is conveyed by **icon + text**, never color alone.

## 4. Components used (all on the frozen tokens / PDD)

| On screen | Component (see `docs/design/components.md`) | Notes |
|---|---|---|
| Page title | `PageTitle` (`pageHead`) | icon + H1 "Propuestas" + subtitle + open-count tail |
| Top-bar open-count badge | `ProposalsBadge` (`tabProp`) | tab with count pill |
| Per-project rail chip | `ProposalsChip` | portfolio rail, beside pending/bugs (FRD-14) |
| Memory-health counters + nudge | `MemoryHealthPanel` | 3+ `tabular-nums` `dStat` counters + shared-`Banner` staleness nudge |
| Section header w/ count | `SectionHead` (`secthead`) | the four kind groups + the health header |
| Proposal group (group-level command) | `ProposalStream` (`bPropGroup`) | one `CmdRow` under the title when the group shares a skill |
| Proposal card (4 kinds) | `ProposalCard` (`bPropCard`) | `rpgpanel` + itemslot icon + id + eval-gate/target chip + evidence |
| Eval-gate / target chip | `Chip` presets | candidate corroboration state / promotion target — icon+text |
| Copy-command chip | `CmdRow` (`cmdRow`) | group-level or per-card; copy only — MC never runs it |

The inbox is an **assembly** of PDD primitives — no new visual language. Surfaces: `panel`/`rpgpanel`,
`chip`, `button`, the `pixel`/`mono` families, the 3 elevation shadows, the `2px accent` focus ring.

## 5. Cohesion (DR-062)
- **Page title** — the one light `PageTitle` block (`pageHead`), not a heavy `gxHero` panel (earlier
  editions used `gxHero`; the canonical inbox uses the light title to match every other top-level view).
- **Section header** — every group divider is the one `SectionHead` (`secthead`).
- **Chip / panel / command-row** — eval-gate/target chips are shared `Chip` presets; cards are the
  shared `rpgpanel`; commands are the shared `CmdRow`; the staleness nudge is the shared `Banner`. No
  bespoke pill, header, panel or banner on this surface.

## 6. Designed states (empty / loading / error)
- **Empty (the good state)** — no open proposals: the groups collapse to nothing (`bPropGroup` returns
  empty for an empty array) and the tab badge hides its count (no zero-badge nag); the memory-health
  panel still shows its counters. (The implementation should render a calm "El gremio está al día — sin
  propuestas pendientes." line so the page is never blank.)
- **Loading** — counts and proposals are computed **locally from files MC already reads** (no Claude
  calls); server-rendered in the same navigation, no fake client skeleton.
- **Error** — an unreadable `factory/memory/` entry or events tail degrades that stream to empty (danger
  icon + a one-line note naming the source), never a crash; the other streams still render.

## 7. Demo-only controls (DR-061)
The proposal stream is **read-only**: every "action" is a copy-command chip (group-level or per-card)
plus a real dismiss — no control pretends to mutate the factory, so the cards need **no `SOLO DEMO`
block**. The **only** demo affordance is the memory-health **staleness nudge**, which in the prototype is
wrapped in a `bDemo` block (~L1408) noting "En la app real el aviso de staleness lo decide el tamaño del
backlog + días desde la última corrida de /pandacorp:memory" — on implementation that demo framing is
kept around the *simulated* staleness trigger only; the real counts and last-run timestamp are **real
read-only data**, surfaced in the counters, not inside a demo block.

## 8. Accessibility & motion
- State by **icon + text** in addition to color — proposal kind, candidate-vs-active eval-gate, the
  promotion target and high-risk flag all carry a label/icon, never the chip color alone (DR-047 wants
  the owner to *see* why something is pending). `tabular-nums` on every counter/timestamp.
- Honest framing (no streaks, no false urgency, dismissible) is an accessibility-of-attention property.
  The `anim` entrance is `transform`/`opacity` only and honors `prefers-reduced-motion`. Focus ring
  `2px solid {accent.accent}`; cards, dismiss and copy chips are keyboard-reachable with accessible
  labels. WCAG AA contrast on both themes; one `<h1>` in the app shell, the page/section titles are
  sub-headings.

## Traceability
Maps `frd.md` ACs → this design: **top-bar badge + per-project chip** → §1, §4; **four proposal kinds,
group-level activating command** → §3; **candidate vs active + eval-gate state visible** → §3;
**evidence/source + suggested action + exact command, copy-only** → §3, §7; **memory-health panel +
staleness nudge + refine trigger** → §2; **self-suggestions computed locally, no Claude** → §3, §6;
**honest & dismissible (White-Hat)** → §3, §7, §8. Visual provenance: `propuestasView()`,
`bPropGroup`/`bPropCard`, `BPROPOSALS`, `MEM` and `tabProp` in `docs/design/prototype/index.html`.
