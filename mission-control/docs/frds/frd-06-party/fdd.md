---
id: FDD-06
type: fdd
title: FDD-06 — Party · La Fragua (feature design)
parent: frds/frd-06-party/frd.md
ui: true
visual_source: docs/design/prototype/party-proposal.html
mock: docs/frds/frd-06-party/mocks/la-fragua.html
status: ACTIVE
last_updated: '2026-06-19'
---
# FDD-06 — Party · La Fragua (feature design)

The feature's design **on the frozen tokens** (`docs/design/design-tokens.json`, root `DESIGN.md`),
sharded from the owner-approved prototype. This document is fidelity, not novelty: it describes the
approved La Fragua build view exactly as the prototype renders it, mapped to the frozen design system
and the FRD's acceptance criteria. **Visual source:** `docs/design/prototype/party-proposal.html`.
**Mock (scoped slice):** `mocks/la-fragua.html` (self-contained; shared pixel-art assets referenced
from `docs/design/prototype/assets/`, not duplicated).

> The design contract (palette, typography, surfaces, the app-wide RPG skin, the Party pixel-art
> spec) is the global PDD — it is NOT redefined here. This FDD only assembles La Fragua's screen on
> top of it. Where a value is named below it comes from a token, never a hardcoded literal.

## 1. Scene & layout

La Fragua is **one living map**, not a 3-column kanban. The scene is always the **single FRD
currently in build** (`AC-06-002.1`); the whole project shows as a counter, not as more rooms.

- **Stage** — a `920×560` (`party.roomSizes_px.fraguaStage`) bounded canvas, `max-width:100%`,
  `radius lg`, `1px {borders.bd}`, on the dark Party map background (`partyStructural.sceneFillRadialC`
  over `sceneBase`) with the **30px scene grid** (`party.gridSizes_px.fragua`,
  `partyStructural.gridLine` `.5px` lines, ~`.45` opacity). `image-rendering: pixelated`.
- **Three rooms, linear flow** (`REQ-06-003`): **Sala de Forja** (left, active WOs) →
  **Tribunal del Juez** (right, same size) → **Bóveda** (wide bottom shelf, verified trophies).
  Forge and Tribunal are the two `432×372` upper rooms; the Bóveda is the full-width `888×106`
  bottom shelf. Each room is a `radius md`, `1px {borders.bd2}` framed pixel-art zone
  (`backend.png` forge, `tribunal.png` tribunal, `boveda.png` vault floor) with a top-left
  **pixel label** chip and a top-right **count** chip (both on a `partyStructural.scrim.label_0_8`
  dark scrim).
- **Stone bridges** connect the rooms — `bridge-h.png` (forge→tribunal, horizontal) and
  `bridge-v.png` (tribunal→vault, vertical) — sitting **above** the room backgrounds, **below** the
  sprites that cross them. Movement between rooms always happens **along the connecting path inside
  the map**, never leaving a sprite stranded mid-path (`AC-06-003.2`).
- Above the stage, top → bottom: **topbar** (h1 + live pip), **mission bar** (`.quest`),
  the **DEMO controls block**, **KPIs** (4-up), the **flow strip**, the **scene title**, then the
  stage. Below: the **bitácora** feed and the fidelity legend. Mobile: the KPIs collapse to 2-up and
  the flow strip's sub-labels hide (`@media max-width:760px`); the stage scales with the viewport.

## 2. Components used (all on the frozen tokens / PDD)

| On screen | Component (see `docs/design/components.md`) | Notes |
|---|---|---|
| Forge / Tribunal / Bóveda zones | `Room` | pixel-art zone + label + count chips |
| forge→tribunal, tribunal→vault connectors | `StoneBridge` | `bridge-h.png` / `bridge-v.png`, z between room & sprite |
| 1 running WO = 1 figure | `AgentSprite` | 52px `implementer`; halo, progress, tag, hover tooltip |
| the single FRD reviewer | `JudgeSprite` | dim until the gate opens, then paces the Tribunal |
| WO chatter / relay captions | `SpeechBubble` | `say-on`, `sayin` keyframe, even columns talk higher |
| WO id+title on hover | `Tooltip` (`.wotip`) | the title doesn't fit under the sprite |
| always-visible pipeline + active beat | `FlowStrip` | 8 beats, lights the active one(s), hover tooltips |
| factory-off treatment | `PowerOffOverlay` | desaturates the map, tidies sprites into rooms |
| effort + project WO progress | `MissionBar` (`.quest`) | effort shown as **read-only data** |
| preview-only mode/power/reset | `DemoControls` | dashed border + `SOLO DEMO` tag (DR-061) |
| Status Note hand-off | `Parchment` | travels from a closed WO to its dependent |
| event log | `Feed` (bitácora) | role icon + `tabular-nums` timestamp, failure first-class |

Primitives reuse the PDD's `panel` / `card` surfaces, `chip`, `button`, `tab`, the `pixel` and
`mono` families, the 3 elevation shadows and the `2px accent` focus ring. No new visual language.

## 3. The flow strip (always visible, lights the active beat)

`FlowStrip` is a single always-visible row of the **whole build pipeline** as 8 beats —
**Fundación → Oleada → Fidelidad → Status Note → Tribunal → Commit → Bóveda → Integración** — each a
pixel icon + label + sub-label, separated by `→` arrows, on a `panel` surface. Inactive beats sit at
`.45` opacity; the beat(s) happening **now** light up (full opacity, `card` fill, `accent` border) —
driven by real WO state (`paintFlow`: foundation building, feature wave, fidelity loop, note written,
judging, committing, vaulting, FRD done). **Hover any beat → a tooltip** (`card2` surface,
`{borders.bd2}`, `shadowPop`) explaining that step of the engine. It hides in `embed` mode (the host
app supplies the chrome). This is the "you are here" for the whole build, so the per-FRD scene reads
in context.

## 4. The factory-off treatment (derived, not a button)

The powered-down state is **derived from real state** — no running build / no agents — never from a
control (`AC-06-010.1`). `PowerOffOverlay` adds `body.off`, which:
- desaturates + dims the rooms (`grayscale(.85) brightness(.46)`) and the sprites / bridges /
  parchments more strongly (`grayscale(.92) brightness(.42)`), matching the dark map;
- hides all speech bubbles and tidies the agents idle into their rooms (no wandering);
- shows a centered overlay: **"⏻ Fábrica apagada"** with the sub-line *"sin build en curso · en
  Mission Control la fábrica se enciende al lanzar `/pandacorp:implement`"* — the copy states the
  factory is started by **launching the skill**, never "press play" (it is not a control).
- the live pip switches to `.off` (neutral `{borders.bd2}`, no glow/animation).

## 5. The mission bar — effort as read-only data (DR-061)

`MissionBar` (`.quest`) is a real UI surface (not demo): a `panel` strip with the **🗺️ Misión**
label, the **FRD pips** (done / current / pending, the current one pulsing in `accent`), the
**global project WO counter** (`52 / 109 WO`, `AC-06-002.2`, `tabular-nums`), and — separated by a
`{borders.bd2}` divider — **⚙️ esfuerzo · <effort>** shown as **read-only data**. The effort
(pro / equilibrado / potente / profundo) is a real value the app surfaces, so per DR-061 it lives
here in a real surface, **not only inside the demo block**. In production there is no selector: the
effort is read from state (`AC-06-009.1`).

## 6. The DEMO-only controls block (DR-061)

The mode/effort **picker** and the **⏸ Apagar la fábrica** / **↺ Reiniciar misión** buttons exist
**only to preview states** and are wrapped in the canonical DR-061 block:
- a **dashed `{borders.bd2}` border** container (`.controls.demo`), a **`🔧 SOLO DEMO`** tag in the
  warning color (`{status.warn}` on `{status.warnBg}`, `mono` 10px), and a **one-line note**:
  *"Estos controles no existen en Mission Control real (que es de solo lectura): el build se lanza
  con `/pandacorp:implement` y el esfuerzo se fija ahí. Aquí sirven para previsualizar los estados."*
- **In production these do NOT ship** (`AC-06-009.2`): no mode selector, no pause/reset, no
  agent-control affordance. The block makes that explicit so the owner never reads a demo affordance
  as real control of the factory.
- The one real value among them — the effort — is surfaced separately as read-only data in the
  mission bar (§5), per the DR-061 rule.

## 7. Sprites, speech & the judge

- **`AgentSprite`** — 52px pixel `implementer` (`party.spriteSizes_px.fragua`), one per running WO
  (`AC-06-001.1`). States (`party.stateMachine.fragua`): `work` (halo + `cat7` progress bar),
  `carry` (a warn scroll icon — carrying its Status Note), `vault` (smaller 42px + 🏅 medal +
  ok-colored tag), `split` (deep relay), `say-on` (speech). Wave size = effort (`AC-06-001.2`); the
  rest of the FRD's WOs are a single **"+N en cola"** count, never sprites (`AC-06-001.3`). The
  **foundation WO** (`AC` via DR-057) forges alone, centered, in `cat5`.
- **Hover → `Tooltip`** with the WO id + title (`AC-06-002.3`); `SpeechBubble` shows the WO's live
  caption (RED→GREEN, reuse-from-inventory, render→mock→fix, self-test ✓…). Even columns raise the
  bubble (`b-hi`) so adjacent bubbles don't overlap. Hover suppresses the bubble in favor of the
  tooltip.
- **`JudgeSprite`** — exactly one `reviewer` per FRD (`REQ-06-004`), **dim** until all WOs reach
  `IN_REVIEW`; then the gate opens (the Tribunal goes `hot`) and it **paces the Tribunal**, judging
  each WO with the **four lenses** (correctness · security · quality · runtime/visual) plus the
  **visual judge** (capture vs mock + baseline blessing). The Tribunal has **12 non-overlapping
  slots** (4×3) so up to 11 WOs never overlap (`AC-06-004.3`).
- **Deep mode** renders a WO with a frontend as a **sequential 3-step relay** inside one sprite —
  `test-writer` (RED) → `backend-dev` (publishes `docs/api/<wo>.md`) →📄 contract→ `frontend-dev` —
  with a 3-segment progress bar, the active step highlighted, labeled **Opus** (`REQ-06-007`). A
  no-frontend WO stays a single `implementer`.
- **`Parchment`** (📜) is the **real Status Note hand-off** (`REQ-06-006`): when a WO closes it
  writes the note and a parchment travels to a dependent WO's station (Build Plan dependency) — a
  document hand-off, never live peer chat.

## 8. Designed states (empty / loading / error)

- **Empty / no-signal** (`AC-06-010.1`) — no FRD in build → the **factory-off** treatment (§4) is the
  empty state: dimmed map + "Fábrica apagada" overlay, never a blank screen or crash.
- **Loading** — the scene streams from the server-rendered map; the feed seeds with
  *"Arrancando la forja…"* until the first real event arrives (no fake client skeleton over content
  the server already delivers).
- **Error / failure** — failure is a **first-class** feed state (`REQ-06-011`), never hidden: a
  `BLOCKED` WO is counted in "+N en cola" (not a forge sprite) and surfaces in the bitácora with the
  danger color and its icon. Out-of-order / stale events degrade to the empty state rather than
  mis-rendering (`frd.md` edge cases).
- **Reduced motion** (`AC-06-010.2`) — `prefers-reduced-motion: reduce` disables **all** Party
  animation (sprites static, halos/bobs/emotes off, no RAF loop) while keeping the scene readable;
  the achievement toast (`REQ-06-012`) renders without animation.

## 9. Accessibility & motion

- Everyday chrome (mission bar, KPIs, feed, flow strip) uses sober motion; the **expressive motion**
  (sprite bob, halos, emotes, parchment travel) is **reserved for the Party canvas** (the frequency
  test) and is `transform`/`opacity` only, honoring `prefers-reduced-motion` at the app shell.
- WCAG AA contrast on both themes (the tokens are pre-checked); state is conveyed by **icon + text**
  in addition to color (the feed's bounded iconic vocabulary, the `vault` medal, the `BLOCKED`
  danger row), never color alone. `tabular-nums` on every counter/timestamp. Focus ring
  `2px solid {accent.accent}`; the flow-strip beats and demo controls are keyboard-reachable; the
  `lockchip`/reveal mechanic (PDD) is `focus-within`-reachable.

## Traceability

Maps `frd.md` REQs → this design: `REQ-06-001/002/003` → §1, §7; `REQ-06-004` → §7 (judge);
`REQ-06-005` → §1 (Bóveda compaction), §7 (`vault` state); `REQ-06-006/007` → §7;
`REQ-06-008` → read-only feed (§8); `REQ-06-009` → §5–§6 (DR-061); `REQ-06-010` → §8;
`REQ-06-011` → §7 (feed) / §8; `REQ-06-012` → §8 (reduced-motion toast).
