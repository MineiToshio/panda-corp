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
on top of the owner-approved whole-app prototype. This document is **fidelity, not novelty** — but
FRD-17 is a **special case for fidelity**: the prototype does **not yet draw a dedicated Proposals
inbox screen**. Its only prototype presence is the **Autoaprendizaje concept page** (`docPage` p=14,
surfaced in the Manual as `c-autoaprendizaje`), which describes the self-learning loop and **explicitly
forward-references this surface** — line ~1001: *"Dónde lo ves: hoy con `/pandacorp:memory status`;
mañana, en el buzón de Propuestas de Mission Control (FRD-17), que mostrará la cola de ascensos, las
autosugerencias de la app y un recordatorio de cuándo correr memory."*

Therefore the inbox screen is designed by **assembling the frozen PDD primitives the prototype already
provides** (it extends FRD-14's chips/feedback channels and FRD-12's event tail) — not by inventing a
new visual language. **Every surface below is built from existing, already-extracted PDD components**;
nothing here relaxes or re-styles the contract.

**Visual source / the components to reproduce from `docs/design/prototype/index.html`:**
- the **self-learning vocabulary, palette mapping and loop framing** from `docPage` p=14
  (lines ~970–1001): the loop chips (Capturar / Refinar / Cuaderno / Recuperar; Revisar / Tú decides /
  Promover), the 3-actor `panel` rows (cronista `librarian` / `/pandacorp:memory` / `/pandacorp:learn`),
  the **proposed → tú revisas → approved · rejected** promotion-state chip row, the **lesson-type**
  chips (problema→solución · veredicto de librería · patrón · gotcha · anti-patrón), and the protections
  list — this is the exact visual language for the proposals;
- the **top-bar badge** pattern from `topbar()` (lines ~577–580) — where the guild-level open-count
  badge lives (extending the NV/title cluster), matching the existing `pluginBanner`/chip vocabulary;
- the **portfolio rail chip** + **pending-decisions / bugs chips** of FRD-14 (`snapshotPanel` /
  `decisionesBox`) that this inbox extends with a third "proposals" stream;
- the **staleness-banner** pattern from `pluginBanner()` (lines ~573–576) for the memory-health nudge;
- the **copy-command chip** `cmdRow` / `docCmd` for the exact `/pandacorp:*` command per proposal.

> The design contract (palette, typography, surfaces, the app-wide RPG embossed skin, the pixel-art
> spec) is the global PDD — NOT redefined here. This FDD assembles the inbox on top of it. Every named
> value is a token, never a hardcoded literal.

## 1. Layout

**Two entry points** (`AC`): a **guild-level badge** in the top bar showing the open proposal count
(extending FRD-14's pending/bugs chips with a third stream), and a **per-project chip** in the
portfolio rail. Both open the **Proposals inbox** ("Propuestas / Crónica del gremio"), a `.rpghall`
column:
- a `gxHero` banner ("Crónica del gremio") framing the cronista's chronicle (guild theme, FRD-09);
- the **memory-health panel** (§4) up top;
- the **proposal stream** below — a single-column list of **proposal cards** grouped by `secthead` into
  the four kinds (candidate lessons · promotions · prune · self-suggestions). The **promotions queue**
  (§3) is its own durable `secthead` group.

Mobile: single column throughout (it already is); the top-bar badge and rail chip wrap with the
existing clusters. Touch targets ≥44px.

## 2. The proposal card (one component, four kinds)

Each proposal is a **`rpgpanel` card** (`ProposalCard`) carrying, per `AC`:
- a **kind tag** (chip) + an **icon** — candidate lesson (book), promotion (school/▲), prune (broom),
  self-suggestion (bulb/brain) — **icon + text, never color alone**;
- the **evidence/source**: the `LESSON-NNNN` id (`mono`), or the project + capture point, or the metric
  (for self-suggestions) — `tabular-nums`;
- the **suggested action** in plain language;
- the **exact command** as a copy-chip (`cmdRow`): `/pandacorp:memory review`, `/pandacorp:learn …`,
  `/pandacorp:decide`, or `/pandacorp:review-launch` — **copy only; MC never runs it** (read-only, like
  FRD-15/16);
- a **dismiss** affordance (honest, no nagging — White-Hat, FRD-09); dismissing is remembered.

**Candidate vs active lessons are visually distinct** (`AC`): a candidate carries a muted
`{surfaces.card2}` / dashed-accent treatment + an **eval-gate state** line (corroborated / awaiting a
2nd occurrence, DR-047), so the owner sees *why* something is auto-active vs pending. **High-risk
proposals** (promote to a MUST standard, create/edit a skill/agent, change a DR, delete) are **display-
only** — their card shows the command but routes action to the owner running the skill; MC never applies
them (DR-047 human gate). The four self-suggestion families (bottlenecks, velocity, unused capability,
policy friction, recurring lesson, shipped-project review) each render as a self-suggestion
`ProposalCard` with its computed metric as evidence.

## 3. The promotions queue (durable, reviewable)

A dedicated `secthead` group lists **every `factory/memory/` lesson with `promotion: proposed`**
(`AC`): each row shows the **target** (standard / decision-rule / skill) as a chip, the **rationale**,
and the **evidence**. The state lives on the lesson (single source of truth); this page and
`/pandacorp:memory status` are both views of it. **Approve** surfaces the `/pandacorp:learn` copy-chip
that promotes it; **reject** is shown as the action that marks `promotion: rejected` (the lesson stays).
No in-the-moment pressure — the **proposed → tú revisas → approved · rejected** state row from
`docPage` p=14 is the exact visual the queue reuses.

## 4. The memory-health panel

A `panel` (the `MemoryHealthPanel`) for the self-learning loop (`AC`): three `tabular-nums` counters —
**pending raw notes** awaiting refinement (`.pandacorp/run/lessons.md` per project +
`factory/memory/_inbox.md`), **candidate lessons** awaiting corroboration/promotion (`status:
candidate`), and **when `/pandacorp:memory` last ran** (harvest/review). If the backlog is large or it
has not run in a while, it **nudges** with the exact command (`/pandacorp:memory harvest` / `review`)
using the **`pluginBanner` staleness-banner pattern** (warn surface + copy-chip) — a reminder, not a
red alert. This panel doubles as the on-demand **refine-trigger surface** (the owner runs refinement
when it says there is something to consolidate).

## 5. Components used (all on the frozen tokens / PDD)

| On screen | Component (see `docs/design/components.md`) | Notes |
|---|---|---|
| Inbox banner | `SectionHero` (`gxHero`) | guild chronicle framing |
| Guild-level open-count badge | `ProposalsBadge` | top-bar chip extending the FRD-14 cluster (`topbar`) |
| Per-project rail chip | `ProposalsChip` | portfolio rail, beside pending/bugs (FRD-14) |
| Proposal card (4 kinds) | `ProposalCard` | `rpgpanel` + kind tag + icon + evidence + command + dismiss |
| Candidate / eval-gate treatment | `CandidateBadge` | muted `card2` + dashed-accent + corroboration line |
| Promotion state row | `PromotionState` | proposed → revisas → approved · rejected (from `docPage` p=14) |
| Memory-health counters + nudge | `MemoryHealthPanel` | 3 `tabular-nums` counters + `pluginBanner`-style staleness nudge |
| Lesson-type chips | `LessonTypeChips` | problema→solución · veredicto · patrón · gotcha · anti-patrón |
| Loop / actor framing | `LoopDiagram` / `ActorRows` | reused from the Autoaprendizaje concept page |
| Copy-command chip | `CmdRow` (`cmdRow` / `docCmd`) | the exact `/pandacorp:*` per proposal — copy only |
| Section header w/ count | `SectionHead` (`secthead`) | the four kind groups + the promotions queue |

Everything is built from PDD primitives already extracted for FRD-07/08 and the FRD-14 chips — the
inbox is an **assembly**, no new visual language. Surfaces: `panel`/`rpgpanel`, `chip`, `button`, the
`pixel`/`mono` families, the 3 elevation shadows, the `2px accent` focus ring.

## 6. Designed states (empty / loading / error)

- **Empty (the good state)** — **no open proposals**: a calm `panel` with a check icon and the
  cronista line *"El gremio está al día — sin propuestas pendientes."* (honest, no false urgency,
  White-Hat). The badge/chip hide their count (no zero-badge nag). The memory-health panel still shows
  its counters.
- **Loading** — counts and proposals are computed **locally from files MC already reads** (no Claude
  calls, `AC`); server-rendered in the same navigation, no fake client skeleton over delivered content.
- **Error** — an unreadable `factory/memory/` entry or events tail degrades to the empty state for that
  stream (danger icon + a one-line note naming the source), never a crash; the other streams still
  render. Stale/missing `~/.claude/dashboard-events.ndjson` falls back gracefully (FRD-12 behavior).

## 7. Demo-only controls — none (read-only, no fake actions)

The inbox is **read-only** (`AC`, like FRD-15/16): MC **never harvests, promotes, prunes or runs any
skill** — every "action" on a proposal is a **copy-command chip** (approve = copy `/pandacorp:learn`;
reject = the command that marks `rejected`) plus a real **dismiss** (remembered). Because no control
*pretends* to mutate the factory, **no DR-061 `SOLO DEMO` block is needed**: the affordances are
honestly "copy this command" / "dismiss", not simulated factory actions. Any value the real app
surfaces (the counts, the last-run timestamp, the eval-gate state) is **real read-only data**, not a
preview toggle.

## 8. Accessibility & motion

- State conveyed by **icon + text** in addition to color — proposal kind, candidate-vs-active, the
  promotion state and high-risk flag all carry a label/icon, never the chip color alone (DR-047 wants
  the owner to *see* why something is pending). `tabular-nums` on every counter/timestamp.
- Honest framing (no streaks, no false urgency, dismissible) is an accessibility-of-attention property
  as much as a White-Hat one (FRD-09). The `anim` entrance is `transform`/`opacity` only and honors
  `prefers-reduced-motion`. Focus ring `2px solid {accent.accent}`; cards, dismiss and copy chips are
  keyboard-reachable with accessible labels.
- WCAG AA contrast on both themes (pre-checked tokens); one `<h1>` in the app shell, the hero/section
  titles are sub-headings.

## Traceability

Maps `frd.md` ACs → this design: **guild badge + per-project chip extending FRD-14** → §1, §5;
**four proposal kinds** → §2; **evidence/source + suggested action + exact command, copy-only** → §2;
**self-suggestions computed locally, no Claude** → §2, §6; **memory-health panel + staleness nudge +
refine trigger** → §4; **durable promotions queue (promotion state on the lesson)** → §3; **candidate
vs active + eval-gate state visible** → §2; **honest & dismissible (White-Hat)** → §2, §7, §8;
**high-risk display-only, routed to the skill** → §2, §7. Visual provenance: the Autoaprendizaje
concept page (`docPage` p=14) + the FRD-14 chips + `pluginBanner`, all in
`docs/design/prototype/index.html`.

> **Note for the build.** Because the prototype does not yet draw this screen, the visual-fidelity
> gate's baseline for FRD-17 must be captured from the **assembled inbox** (built from the PDD
> primitives above) rather than from an existing render function — see `mocks/README.md`. This is the
> one FDD in this re-anchor where the fidelity target is "the PDD primitives + the p=14 concept-page
> vocabulary", not a single dedicated render function. Flagged so the gate does not expect a
> prototype screen that does not exist.
