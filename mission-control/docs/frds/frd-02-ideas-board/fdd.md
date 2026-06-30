---
id: FDD-02
type: fdd
title: FDD-02 — Ideas board · La Campaña (card-detail design)
parent: frds/frd-02-ideas-board/frd.md
ui: true
visual_source: docs/design/prototype/party-pipeline.html
mock: docs/frds/frd-02-ideas-board/mocks/la-campana.html
status: ACTIVE
last_updated: '2026-06-22'
---
# FDD-02 — Ideas board · La Campaña (card-detail design)

The design of the board card-detail extension **on the frozen tokens**
(`docs/design/design-tokens.json`, root `DESIGN.md`), sharded from the owner-approved prototype.
Fidelity, not novelty: this describes La Campaña (the **Campaña** tab of the card detail) exactly as
the prototype renders it, mapped to the frozen design system and the FRD-02 acceptance criteria.
**Visual source:** `docs/design/prototype/party-pipeline.html`. **Mock (scoped slice):**
`mocks/la-campana.html` (self-contained; shared pixel-art assets referenced from
`docs/design/prototype/assets/`, not duplicated).

> This FDD covers the card detail (the three tabs + La Campaña + Documentos + Comandos). The board
> derivation, intake modal, category filter and discard (REQ-02-001…008) keep their behaviour and are
> out of scope here (the 2026-06-22 board-content fidelity pass — column labels, the category
> `<select>`, the intake modal, the legend — is recorded in `frd.md`, the blueprint and the decision
> log). The global PDD (palette, typography, surfaces, the app-wide RPG skin, the Party pixel-art
> spec) is not redefined here; La Campaña is assembled on top of it.

## 1. Placement — the three-tab card detail

Clicking a card opens its detail with **three horizontal tabs** — **Campaña · Documentos · Comandos**
— rendered by the **shared `Tabs` primitive** (`level="sub"`, the same `.stab` pattern as the
Portfolio project pane, `AC-02-009.1`), default **Campaña**. Each tab carries its **icon**
(`ti-map-2 · ti-files · ti-wand`) — the `Tabs` primitive already supports `icon`
(amendment, 2026-06-22). The active tab persists across re-renders of the detail (`AC-02-009.4`); a
document click anywhere switches to **Documentos** (`AC-02-009.3`).

**The tabs are bare pills above a bordered body panel** (amendment, 2026-06-22). The card-detail
**root is transparent layout only** (a flex column with a 14px gap, no outer border/background); the
tab pills sit on top, and **each tab's own content is the bordered container below them** — the
prototype `detailView` shape (bare `.stab` pills above, the body panel below). The Campaña body is
that bordered panel (see §2); Documentos and Comandos render their own bordered panels too. La
Campaña is wrapped in a **labelled container** — *"EL VIAJE DE ESTA IDEA POR LAS 6 FASES"* — the
consistent embed-container standard.

> **Superseded 2026-06-22:** the original FDD said "Documentos and Comandos keep their existing bodies
> unchanged." That is no longer true — both were reworked (§5b). Documentos is now a rail + reader and
> Comandos a `CmdRow` + project-command box.

## 2. The campaign trail (layout)

The Campaña body is **one bordered panel** below the bare tab pills (§1). Inside it, top → bottom:
the **labelled header** (`EL VIAJE DE ESTA IDEA POR LAS 6 FASES`), the **stage**, then the **ficha**.

A serpentine trail of the **6 phases in fixed order** `research → product → design → architecture →
build → release` (`AC-02-010.1`), each a **room** on a `920×560` serpentine
(`party.roomSizes_px.campanaStage`) on the dark Party map (`partyStructural` fills + the dot-grid).
Each phase room is a fixed **`250×208`** (`party.roomSizes_px.campanaRoom`) pixel-art zone
(`research.png`, `review.png`, `frontend.png`, `architecture.png`, `build-hall.png`, `release.png`)
framed `radius md`, `1px {borders.bd2}`, with a phase **badge** (its state) and label.

- **Header — left-aligned, light weight** (amendment, 2026-06-22): the `EL VIAJE…` caption is
  `justify-content: flex-start` (left, not centred), weight 400 (not bold), with the **`ti-map-2`
  accent icon** and a *"— clic en una sala para su ficha"* hint.
- **Full-width stage, rooms centred** (amendment, 2026-06-22): the stage backdrop is **`width: 100%`**
  (the radial-gradient dark canvas); the `920×560` serpentine lives in an **inner layer** centred with
  `margin: 0 auto` (so the rooms read centred in the full-width canvas, and the ficha below can match
  the full width without cramping the team cards).
- **Phase number** is its own **accent-tinted** span inside the room label (`Room labelNode`); the
  room label is **13px**.
- **Per-room deliverable** shows the phase **emoji + the short artifact name only** — `🔍 research.md`,
  `📋 PRD + FRDs`, `🎨 sistema + mocks`, `📐 blueprint + Build Plan`, `⚒️ el código`,
  `🚀 auditoría + deploy` (a `PHASE_META` map of `emo · deliver · col` feeds both rooms and
  connectors). The earlier `phase.writes` split (which leaked "— hallazgos") and the **"entrega ▸"
  label + arrow were dropped** (owner: "ya no le veo sentido"). Locked rooms hide the deliverable.
- **Connectors are the prototype's striped CSS "road"** (amendment, 2026-06-22): the inter-phase
  connectors render via **`StoneBridge variant="road"`** (a CSS striped doc-handoff road, tinted
  ok-green while flowing), **not** the Fragua stone PNG the campaign formerly reused. State by source
  phase vs the active phase: **done (✓)** before, **flowing (→)** the active phase's outgoing, **locked**
  after; the centred `.doc` chip carries the deliverable. This is the only "communication" depicted
  between phases — an **artifact across time** (`AC-02-010.6`), never live cross-phase chat.
- **Road under the rooms** (amendment, 2026-06-22): the road sits **below** the room images — rooms
  `z-index: 2`, the road `z-index: 1` — so the connectors never paint over the pixel-art (the doc
  chip, centred in the gap between rooms, stays visible). The cast layers above both (z-index 3).
- Below the stage: the **ficha** detail panel (§5), shown by default and pinned. Mobile
  (`@media max-width:760px`): the team-card row wraps; the Documentos grid (§5b) stacks under ~640px.

## 3. Phase states (derived from real project status)

The **active phase is derived from the real project state** (`AC-02-010.2`): card `status` / linked
`status.yaml` phase → `discovered→research`, `documented→product`, `design→design`,
`architecture→architecture`, `building→build`, `shipped→release`; absent/unknown → **research**
(index 0), without breaking. Each phase renders by its position relative to the active one
(`AC-02-010.3`):

- **done** (before active) — `badge.done` (`{status.ok}`, "✓ entregado"), shows its **delivered
  deliverable**; the cast **idle-bobs in place** (desynced), still alive in calm.
- **current** (active) — `badge.active` + the accent badge; **the badge text and the cast behaviour
  are gated on whether an agent is genuinely running** (amendment, 2026-06-22). The project's real
  `running` signal (`status.yaml running: true`, threaded card → `CardDetail` → `CampaignPipeline`)
  decides:
  - **running** → "● en curso"; the active room's cast **roams** (an rAF wander loop: each member
    walks to fresh targets, sometimes toward another to "collaborate", with the lead carrying an
    accent **halo** and a short **speech bubble** popping when two meet).
  - **not running** → **"fase actual"**; the cast **idle-bobs in place** (no roam, no halo, no
    speech) — "quietecito en el centro." The app only tracks a persistent `running` state for the
    build, so non-build phases (an idea merely *sitting* at research/product/…) read the truthful
    "fase actual" rather than a fake "en curso."

  `prefers-reduced-motion: reduce` (and jsdom/SSR, where there is no `matchMedia`) → no roam, static.
- **locked** (after active) — `badge.locked` dimmed ("🔒 en espera"), sprites static + dimmed
  (`grayscale`/lowered brightness). **A locked phase's ficha now shows its FULL information**
  (description, LEE/ESCRIBE, the whole team) — see §5 — superseding the earlier locked/empty
  placeholder (`AC-02-010.7`, rewritten 2026-06-22).

## 4. Components used (all on the frozen tokens / PDD)

| On screen | Component (see `docs/design/components.md`) | Notes |
|---|---|---|
| the three tabs | `Tabs` (`level="sub"`) | bare `.stab` pills with icons (`ti-map-2 · ti-files · ti-wand`) |
| each of the 6 phase rooms | `Room` | 250×208 pixel-art zone + badge; `labelNode` = accent phase number + name (13px) |
| room→room connectors, the active one flowing | `StoneBridge` (`variant="road"`) | the CSS striped doc-handoff **road** (not the stone PNG); the deliverable `.doc` chip travels along the active one (done ✓ / flow → / locked) |
| the active room's roaming cast | `RoamingCast` | rAF roam (walk/idle bob, lead halo, speech-on-meet) **only when running**; idle-bobs when done; static+dimmed when locked |
| each phase's specialists (in the ficha) | `AgentSprite` | 52px; rendered `state="idle"`; the **progress bar shows only in `work` state** (no empty bar on idle/campaign sprites) |
| the phase **ficha** | (feature-local card on `panel`) | header `{n · name} — {state}` + description + LEE/ESCRIBE + the whole team |
| "Entrar a La Fragua" hand-off | `button` (PDD) | navigates the host to the Party tab; shown on the build phase only, and only once build is reached |

The trail reuses the PDD's `panel`/`card` surfaces, `chip`, `button`, the shared `Tabs`, the
`pixel`/`mono` families, the 3 shadows and the `2px accent` focus ring. No new visual language. The
roam liveliness (`RoamingCast`) and the deliverable speech are reserved for the active running room.

## 5. The phase ficha (LEE / ESCRIBE + the whole team)

The **ficha is shown by default for the active phase and pinned** (amendment, 2026-06-22): the
selection initialises to the active phase (the prototype opens `sel=active`), so the team panel shows
immediately — not only after a click. Clicking another phase **switches** the ficha; clicking the
open one does **not** toggle it closed — the detail below the map is **always visible**.

A phase's **ficha** (`AC-02-010.4`) is a `panel` card below the trail with:

- a **header** `{n · name} — {state}` (e.g. "1 · Investigación — EN CURSO" / "— FASE ACTUAL" when not
  running / "— completada" / "— en espera"); the `{n · name}` is tinted in the phase's accent colour;
- a **description** of what the phase does;
- a two-column **LEE (de la fase previa) / ESCRIBE (para la siguiente)** block — what it reads from
  the previous phase's deliverable and writes for the next, making the document hand-off explicit
  (`research.md → PRD/FRDs → design-tokens+DESIGN.md+components.md+mocks → blueprint+Build Plan →
  código → auditoría+deploy`);
- the **whole team of that phase** — every specialist with its role and what it does, **not only the
  lead** (`AC-02-010.4`): research = `researcher`; product = `product-manager`; design = `designer` +
  `copywriter`; architecture = `architect`; build = `implementer` + `reviewer` + `analytics` +
  `security-auditor` (4 — DR-085 moved the hardening audit into build); release = `devops`. Each shows
  its sprite + role chip + one-line job. In the campaign rooms each team has its own **sprite
  formation** so the 52×52 figures never overlap: 1 = centred, 2 = a horizontal pair, 3 = a triangle,
  4 = two clear rows — a raised top pair (implementer, reviewer) above a front pair (analytics,
  security-auditor), spaced so neither row clips the other.
- On the **build** phase ficha only, an **"Entrar a La Fragua"** action (§7) — gated on the build
  phase being reached (`phaseState !== "locked"`).

**Info is readable regardless of progress; only the build *action* is gated** (amendment,
2026-06-22). A **locked (future, not-yet-reached) phase's ficha still renders its full info** —
description, LEE/ESCRIBE and the whole team — because the ficha is information *about* the phase, not
a reward for reaching it; the header label ("en espera") is what signals a future phase. The single
thing withheld until build is reached is the **"Entrar a La Fragua" action** (there is no live build
to enter yet). This supersedes the earlier locked/empty placeholder (`AC-02-010.7`, rewritten
2026-06-22).

The ficha reflects the **real engine phase model**: specialization lives **per phase**, not inside
the build; the team works in sequence and communicates by documents across time (the design phase's
ESCRIBE row already includes `components.md` and the per-FRD `mocks/fdd`, matching DR-057/058).

## 5b. Documentos & Comandos tabs (the other two tab bodies)

> **Reworked 2026-06-22** — these were previously described as "unchanged" (§1 supersession note).

- **Documentos = a rail (210px) + reader** (prototype `docsBody`). The left rail always lists
  **Resumen** first (the summary reader — the card body's summary + key points) plus **one item per
  project document** (PRD, architecture, each FRD, ADR, analytics, decision-log, progress, decisions,
  bugs — whatever the project exposes). Selecting an item shows it in the **reader** on the right and
  keeps the active tab on Documentos (`AC-02-009.3`). For a **board card**, the reader defers the full
  document read to the project workspace (it shows the summary in full, and for a project doc a short
  "open it in the project workspace" pointer — the deep read lives in Portfolio). Responsive: the
  `.card-detail-docs-grid` **stacks under ~640px**. A card with no documents still shows **Resumen**
  (zero project-document items, no crash — `AC-02-008.1`).
- **Comandos = the shared `CmdRow` + a project-command box.** The next step is a **"Siguiente paso ·
  avanzar"** section using the shared **`CmdRow`** (terminal glyph + copy) with the lifecycle command
  from `nextStep`. **Building / release cards** (project phase `implementation` /
  `release`) additionally render a **project-command box** (`workspaceCommands`) — the prototype
  `commandsBox` — so an in-flight project surfaces its day-to-day commands, each a `CmdRow`.

## 6. Demo-only controls (DR-061)

La Campaña has **no real controls** — it is read-only (`AC-02-010.6`): no mode selector, no
pause/reset (those are demo-only and live only in La Fragua's prototype). The standalone mockup's
**◀ Fase anterior / Fase siguiente ▶** walkthrough nav (a demo-only affordance to step through the
phases) is **not shipped in the embedded app**: the production `CampaignPipeline` derives the active
phase from the project's status (§3) and exposes no prev/next buttons. The owner navigates fichas by
**clicking a room** (which switches the pinned ficha, §5); the active phase itself is never chosen by
buttons. There is no state-preview control, and **no real value is hidden inside a demo block** — the
active phase, the deliverables and the team are all real, derived data shown in real UI surfaces.

## 7. The link to La Fragua

On the **Construcción** (build) phase, **"Entrar a La Fragua"** (`AC-02-010.5`) **navigates the host
app** to Portfolio → that project → the **Party** tab (FRD-06 / La Fragua) for that project —
**without an inner iframe reload** of the card detail. In the standalone mockup it cross-links to the
sibling shard `../../frd-06-party/mocks/la-fragua.html`; in the embedded app it is a host navigation,
the bridge from the per-idea journey (La Campaña) to the live build zoom (La Fragua).

## 8. Designed states (empty / loading / error)

- **Locked (future) phase** — the room is dimmed with an "en espera" badge and a lock overlay, **but
  its ficha still shows full info** (description, LEE/ESCRIBE, team) — not an empty placeholder
  (`AC-02-010.7`, rewritten 2026-06-22; see §5). A `discovered` card (no project yet) → active phase =
  research, all later phases locked.
- **Loading** — the trail is server-rendered from the card status; no fake client skeleton over
  content the server already delivers. The ficha shows **by default for the active phase** (pinned, §5),
  not only after a click.
- **Error / fallback** — an `in-pipeline` card whose project / `status.yaml` is missing or malformed
  → active phase falls back to **research** (index 0) and the view still renders (`AC-02-010.2`),
  never a crash; a `shipped` card → active phase = release (the build phase's "Entrar a La Fragua"
  still works).
- **Reduced motion** — `prefers-reduced-motion: reduce` (and jsdom/SSR, no `matchMedia`) disables the
  roam loop and the bob/halo/speech motion (rooms + cast static, the active phase still distinguished
  by its badge + accent ring, not by motion alone).

## 9. Accessibility & motion

- Expressive motion (the active running room's roaming cast, the travelling deliverable) is
  **reserved for the Party canvas** (the frequency test), `transform`/`opacity` only, honoring
  `prefers-reduced-motion`. The tabs and phase rooms are keyboard-reachable with a visible
  `2px solid {accent.accent}` focus ring; the trail is operable without dragging (each room carries a
  transparent overlay `<button>` since the `Room` `<section>` cannot be a button).
- Phase state is conveyed by **badge icon + text** (✓ entregado / ● en curso · fase actual / 🔒 en
  espera) in **addition to** color, never color alone; WCAG AA contrast on both themes (pre-checked
  tokens); `tabular-nums` on any numerals. The active tab is marked with `data-active`/`aria-selected`
  **and** its label + icon, not colour position alone.

## 10. Favourite highlight (REQ-02-012)

A board-card visual on the frozen tokens — the owner pins the ideas/projects they care about so they
stand out, in **any** column. Design (`docs/design/design-tokens.json`):

- **Star toggle** (`FavoriteButton`, `CMP-02-favorite-action`) — a 26px icon button floated in the
  card's **top-right corner** (an absolutely-positioned **sibling** of the card's click target, never
  a button nested inside a button — a11y). `ti-star` (outline, `text.t3`) when not a favourite,
  `ti-star-filled` (gold `accent.warn` = `#EBB25F`) when it is. The same control sits in the
  card-detail header beside Discard/Restore. Toggling is **optimistic** (`useOptimistic`): the star
  flips on click and auto-reverts on a failed write.
- **Card highlight** — a favourite card swaps its surface to a warm gold tint: background
  `accent.warnBg` (`#3A2E18` dark / `#FFEECD` light), border `accent.warn`, plus a soft
  `0 0 18px -7px {warn}` glow (the `glowwarn` token family). This is **distinct from the teal accent**
  reserved for "Recomendada" / "en construcción", so the two signals never read the same.
- **Not colour alone** (accessibility.md) — the highlight is reinforced by the filled-star **shape**
  + `aria-pressed` on the toggle and by the card `aria-label` ("Idea: … (favorita)"); a `data-favorite`
  marker is exposed for tests. Gold-on-tint contrast is AA on both themes (pre-checked tokens).
- **Orthogonal to the pipeline** — purely visual; it never changes the card status, the derived
  column, or any flow. Works identically on a `discovered` card and an `in-pipeline` / `shipped`
  project card.

## Traceability

Maps `frd.md` REQs → this design: `REQ-02-009` (three-tab detail) → §1, §5b (Documentos rail+reader,
Comandos `CmdRow` + project box); `REQ-02-010` (La Campaña) → §2–§5, §7–§8 — `AC-02-010.1` §2,
`.2` §3/§8, `.3` §2/§3 (deliverable icon+name; road connectors), `.4` §5 (ficha by default + pinned,
header), `.5` §7, `.6` §2/§6, `.7` §3/§5/§8 (locked phase shows full info; only the build action is
gated). The 2026-06-22 card-detail fidelity amendments in `frd.md` are reflected in §1–§5b. The board
derivation / intake / filter / discard (REQ-02-001…008) are unchanged and out of this FDD's scope —
**except** the board **column labels**, which now use La Campaña's numbered phase names
(`1 Investigación … 6 Release` + `Descartada`); that is a label-only change recorded in `frd.md` and
the blueprint, the two-axis derivation untouched. `REQ-02-012` (favourite highlight) → §10 — a
board-card visual added here.
