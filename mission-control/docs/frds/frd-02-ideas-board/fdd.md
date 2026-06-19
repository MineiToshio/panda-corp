---
id: FDD-02
type: fdd
title: FDD-02 — Ideas board · La Campaña (card-detail design)
parent: frds/frd-02-ideas-board/frd.md
ui: true
visual_source: docs/design/prototype/party-pipeline.html
mock: docs/frds/frd-02-ideas-board/mocks/la-campana.html
status: ACTIVE
last_updated: '2026-06-19'
---
# FDD-02 — Ideas board · La Campaña (card-detail design)

The design of the board card-detail extension **on the frozen tokens**
(`docs/design/design-tokens.json`, root `DESIGN.md`), sharded from the owner-approved prototype.
Fidelity, not novelty: this describes La Campaña (the **Campaña** tab of the card detail) exactly as
the prototype renders it, mapped to the frozen design system and the FRD-02 acceptance criteria.
**Visual source:** `docs/design/prototype/party-pipeline.html`. **Mock (scoped slice):**
`mocks/la-campana.html` (self-contained; shared pixel-art assets referenced from
`docs/design/prototype/assets/`, not duplicated).

> This FDD covers **only** the Campaña tab and its placement in the card detail. The board
> derivation, intake modal, category filter and discard (REQ-02-001…008) keep their existing design.
> The global PDD (palette, typography, surfaces, the app-wide RPG skin, the Party pixel-art spec) is
> not redefined here; La Campaña is assembled on top of it.

## 1. Placement — the three-tab card detail

Clicking a card opens its detail with **three horizontal tabs** — **Campaña · Documentos · Comandos**
— using the **same `tab` pattern as the Portfolio project pane** (`AC-02-009.1`), default **Campaña**.
The active tab persists across re-renders of the detail (`AC-02-009.4`); a document click anywhere
switches to **Documentos** (`AC-02-009.3`). **Documentos** and **Comandos** keep their existing
bodies unchanged. La Campaña is wrapped in a **labelled container** — *"EL VIAJE DE ESTA IDEA POR LAS
6 FASES"* — the consistent embed-container standard.

## 2. The campaign trail (layout)

A winding trail of the **6 phases in fixed order** `research → product → design → architecture →
build → release` (`AC-02-010.1`), each a **room** on a `920×560` stage
(`party.roomSizes_px.campanaStage`) on the dark Party map (`partyStructural` fills + the **30px scene
grid**, `party.gridSizes_px.campana`). Each phase room is a fixed **`250×208`**
(`party.roomSizes_px.campanaRoom`) pixel-art zone (`research.png`, `review.png`, `frontend.png`,
`architecture.png`, `build-hall.png`, `release.png`) framed `radius md`, `1px {borders.bd2}`, with a
phase **badge** (its number/state) and label.

- **Connectors** run room→room; the **active phase's outgoing connector flows** — the deliverable
  **document travels along it to the next phase** (`slidein` keyframe; an active/`flow` connector
  uses `partyStructural.pathFlowLight` / `pathFlowDarkCampana`, an inactive one `pathTrackLight` /
  `pathTrackDarkCampana` with a `pathSeam` inset). This is the only "communication" depicted between
  phases: an **artifact across time** (`AC-02-010.6`), never live cross-phase chat.
- Above the stage: the topbar (h1 + a **"Fase activa: <name>"** live pip) and the prev/next phase
  navigation (a demo affordance — see §6). Below the stage: the **ficha** detail panel and the
  fidelity note. Mobile (`@media max-width:760px`): the ficha `detail` grid collapses to one column.

## 3. Phase states (derived from real project status)

The **active phase is derived from the real project state** (`AC-02-010.2`): card `status` / linked
`status.yaml` phase → `discovered→research`, `documented→product`, `design→design`,
`architecture→architecture`, `building→build`, `shipped→release`; absent/unknown → **research**
(index 0), without breaking. Each phase renders by its position relative to the active one
(`AC-02-010.3`):

- **done** (before active) — `badge.done` (`{status.ok}`), shows its **delivered deliverable**; a
  small idle bob (`idlebob`), still alive in calm.
- **current** (active) — `badge.active` + the **`roompulse`** accent glow breathing; its class(es)
  **roam the room and collaborate** — the lead walks (`walkbob`) and the team exchanges speech
  bubbles (intra-phase collaboration is faithful, e.g. designer↔copy).
- **locked** (after active) — `badge.locked` dimmed, sprites still (`.room.locked .spi
  { animation: none }`); a graceful **locked/empty state** (no document, locked marker) when a phase
  has no deliverable to show (`AC-02-010.7`).

## 4. Components used (all on the frozen tokens / PDD)

| On screen | Component (see `docs/design/components.md`) | Notes |
|---|---|---|
| each of the 6 phase rooms | `Room` | 250×208 pixel-art zone + badge + label |
| room→room connectors, the active one flowing | `StoneBridge` / connector | the deliverable doc travels along the active one |
| each phase's specialists | `AgentSprite` | 58px; `idle` / `walking` / `small` / `locked` |
| intra-phase collaboration captions | `SpeechBubble` | `sayin`; the active phase's team chatters |
| phase id / role on hover | `Tooltip` | role + name |
| the phase **ficha** | (feature-local card on `panel`) | description + LEE/ESCRIBE + the whole team |
| "Entrar a La Fragua" hand-off | `button` (PDD) | navigates the host to the Party tab |

The trail reuses the PDD's `panel`/`card` surfaces, `chip`, `button`, `tab`, the `pixel`/`mono`
families, the 3 shadows and the `2px accent` focus ring. No new visual language.

## 5. The phase ficha (LEE / ESCRIBE + the whole team)

Clicking a phase shows its **ficha** (`AC-02-010.4`) — a `panel` card below the trail with:

- a **description** of what the phase does;
- a two-column **LEE (de la fase previa) / ESCRIBE (para la siguiente)** block — what it reads from
  the previous phase's deliverable and writes for the next, making the document hand-off explicit
  (`research.md → PRD/FRDs → design-tokens+DESIGN.md+components.md+mocks → blueprint+Build Plan →
  código → auditoría+deploy`);
- the **whole team of that phase** — every specialist with its role and what it does, **not only the
  lead** (`AC-02-010.4`): research = `researcher`; product = `product-manager`; design = `designer` +
  `copywriter`; architecture = `architect`; build = `implementer` ×N + `reviewer` + `analytics`;
  release = `security-auditor` + `devops`. Each shows its sprite + role chip + one-line job.
- On the **build** phase ficha only, an **"Entrar a La Fragua"** action (§7).

The ficha reflects the **real engine phase model**: specialization lives **per phase**, not inside
the build; the team works in sequence and communicates by documents across time (the design phase's
ESCRIBE row already includes `components.md` and the per-FRD `mocks/fdd`, matching DR-057/058).

## 6. Demo-only controls (DR-061)

La Campaña has **no real controls** — it is read-only (`AC-02-010.6`): no mode selector, no
pause/reset (those are demo-only and live only in La Fragua's prototype). The only preview affordance
here is the **◀ Fase anterior / Fase siguiente ▶** navigation, used **only to step through the phases
in the standalone mockup**; in the real app the active phase is **derived from the project's status**
(§3), not chosen by buttons. Per DR-061, that walkthrough nav is a **demo-only** affordance and is
hidden in `embed` mode (the card detail derives the active phase from real state); it must not ship
as a real control. There is no other state-preview control, and **no real value is hidden inside a
demo block** — the active phase, the deliverables and the team are all real, derived data shown in
real UI surfaces.

## 7. The link to La Fragua

On the **Construcción** (build) phase, **"Entrar a La Fragua"** (`AC-02-010.5`) **navigates the host
app** to Portfolio → that project → the **Party** tab (FRD-06 / La Fragua) for that project —
**without an inner iframe reload** of the card detail. In the standalone mockup it cross-links to the
sibling shard `../../frd-06-party/mocks/la-fragua.html`; in the embedded app it is a host navigation,
the bridge from the per-idea journey (La Campaña) to the live build zoom (La Fragua).

## 8. Designed states (empty / loading / error)

- **Empty / locked** — a future phase with no deliverable renders a graceful **locked marker** (no
  document, dimmed badge), not a blank (`AC-02-010.7`). A `discovered` card (no project yet) → active
  phase = research, all later phases locked.
- **Loading** — the trail is server-rendered from the card status; no fake client skeleton over
  content the server already delivers. The ficha renders on first phase click.
- **Error / fallback** — an `in-pipeline` card whose project / `status.yaml` is missing or malformed
  → active phase falls back to **research** (index 0) and the view still renders (`AC-02-010.2`),
  never a crash; a `shipped` card → active phase = release (the build phase's "Entrar a La Fragua"
  still works).
- **Reduced motion** — `prefers-reduced-motion: reduce` disables the `roompulse`, `walkbob`,
  `idlebob`, `slidein` and speech motion (rooms static, the active phase still distinguished by its
  badge + accent ring, not by motion alone).

## 9. Accessibility & motion

- Expressive motion (the active phase's roaming sprites, the travelling deliverable, `roompulse`) is
  **reserved for the Party canvas** (the frequency test), `transform`/`opacity` only, honoring
  `prefers-reduced-motion`. The tabs, prev/next nav and phase rooms are keyboard-reachable with a
  visible `2px solid {accent.accent}` focus ring; the trail is operable without dragging.
- Phase state is conveyed by **badge icon + text** (done/current/locked) in **addition to** color,
  never color alone; WCAG AA contrast on both themes (pre-checked tokens); `tabular-nums` on any
  numerals. The active tab is marked with `tab.active` (accent fill) **and** its label, not color
  position alone.

## Traceability

Maps `frd.md` REQs → this design: `REQ-02-009` (three-tab detail) → §1; `REQ-02-010` (La Campaña) →
§2–§5, §7–§8 — `AC-02-010.1` §2, `.2` §3/§8, `.3` §3, `.4` §5, `.5` §7, `.6` §2/§6, `.7` §3/§8. The
board derivation / intake / filter / discard (REQ-02-001…008) are unchanged and out of this FDD's
scope.
