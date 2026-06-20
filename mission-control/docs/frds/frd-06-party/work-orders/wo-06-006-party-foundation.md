---
id: WO-06-006
type: work-order
slug: party-foundation
title: 'WO-06-006 — Party foundation (FND-4): pixel-RPG canvas primitives'
status: DRAFT
parent: FRD-06
implementation_status: PLANNED
foundation: true
artifacts:
  - 'src/app/projects/[slug]/_party/Room/**'
  - 'src/app/projects/[slug]/_party/StoneBridge/**'
  - 'src/app/projects/[slug]/_party/FlowStrip/**'
  - 'src/app/projects/[slug]/_party/AgentSprite/**'
  - 'src/app/projects/[slug]/_party/JudgeSprite/**'
  - 'src/app/projects/[slug]/_party/SpeechBubble/**'
  - 'src/app/projects/[slug]/_party/Tooltip/**'
  - 'src/app/projects/[slug]/_party/Parchment/**'
  - 'src/app/projects/[slug]/_party/MissionBar/**'
  - 'src/app/projects/[slug]/_party/DemoControls/**'
  - 'src/app/projects/[slug]/_party/PowerOffOverlay/**'
source_requirements: [REQ-06-001, REQ-06-003, REQ-06-006, REQ-06-010, REQ-06-012, REQ-06-013, REQ-06-017]
last_updated: '2026-06-19'
---
# WO-06-006 — Party foundation (FND-4): pixel-RPG canvas primitives

**Foundation work order (DR-057).** This is the Party **canvas foundation** (FND-4): the shared
pixel-RPG primitives that the La Fragua scene re-paint (WO-06-007) reuses. It forges these primitives
**first** so the scene composes them rather than re-implementing canvas markup — the foundation-first
discipline this very FRD depicts. **Faithful to the mock**, on the frozen tokens / Party PDD; the pure
geometry/logic (`layout`, `engine`, `state-map`, `event-vm`, `fragua-snapshot`) is **VERIFIED and out
of scope** (consume it, never re-plan it).

## Goal

Build the FND-4 Party-canvas primitives listed in `docs/design/components.md` §3 (Party set), each a
folderized component on the frozen tokens, faithful to `mocks/la-fragua.html`, so WO-06-007 assembles
the living map from them — no canvas markup duplicated in the scene.

## Scope

The Party-canvas primitives (one folder each, `Name/Name.tsx` + `_tests/`):

- **`Room`** — a pixel-art zone (Forja `backend.png` / Tribunal `tribunal.png` / Bóveda `boveda.png`)
  with a top-left pixel **label** chip + a top-right **count** chip on a dark scrim (REQ-06-003).
- **`StoneBridge`** — the `bridge-h.png` (forge→tribunal) / `bridge-v.png` (tribunal→vault) connectors,
  z-ordered above the room backgrounds and below the crossing sprites; **presentational** (REQ-06-017).
- **`FlowStrip`** — the always-visible 8-beat pipeline row
  **Fundación → Oleada → Fidelidad → Status Note → Tribunal → Commit → Bóveda → Integración** with `→`
  arrows; inactive beats at `.45` opacity, the active beat(s) lit (`card` fill + `accent` border); each
  beat has a hover **tooltip** (the active beat is data-driven by the scene) (REQ-06-010).
- **`AgentSprite`** — the 52px pixel `implementer` figure: halo + `cat7` progress bar, WO-id tag, states
  (`work` / `carry` / `vault` 42px+🏅 / `say-on`), one per running WO (REQ-06-001).
- **`JudgeSprite`** — the single per-FRD `reviewer` figure: dim until the gate opens, then paces the
  Tribunal (REQ-06-004 surface; gate logic comes from the snapshot).
- **`SpeechBubble`** — the WO caption bubble (`say-on`/`sayin` keyframe, even columns raised); suppressed
  on hover in favor of the tooltip; **presentational** (REQ-06-017).
- **`Tooltip`** (`.wotip`) — the WO id+title hover tooltip and the flow-strip beat tooltip
  (REQ-06-002.3 / REQ-06-010.3).
- **`Parchment`** — the 📜 Status-Note hand-off element that travels from a closed WO to its dependent
  WO's station; **presentational** decoration of the real `HandoffWritten` event (REQ-06-006).
- **`MissionBar`** (`.quest`) — the real Misión strip: 🗺️ label + FRD pips + global WO counter
  (`tabular-nums`) + **⚙️ esfuerzo · <effort>** shown as **read-only data** (DR-061, REQ-06-012.3) — a
  real surface, never a control.
- **`DemoControls`** — the canonical **DR-061 SOLO DEMO** wrapper: dashed border + `🔧 SOLO DEMO` tag +
  the one-line note that the mode/effort picker and power/reset do **not** exist in real read-only MC.
  In production these controls do **not** ship; the wrapper makes the demo-only boundary explicit.
- **`PowerOffOverlay`** — the factory-off treatment: desaturates the map + tidies sprites into rooms +
  the "⏻ Fábrica apagada" overlay (copy: started by launching `/pandacorp:implement`). **Derived from
  real state**, never toggled by a control (REQ-06-013).

- **Out of scope:** the pure modules `layout.ts` / `engine.ts` / `state-map.ts` / `event-vm.ts` /
  `fragua-snapshot.ts` (WO-06-001/002/003/004/005 — VERIFIED); the scene assembly + RAF binding + tab
  shell (WO-06-007); the SSE transport / `useLiveSnapshot` (WO-01-009); the FRD-04 Tabbar; the existing
  **real** `EventFeed` / `AchievementToast` / `DeepRelay` (REUSE, do not recreate).

## Acceptance criteria

- Each primitive renders faithfully to `mocks/la-fragua.html` on the frozen tokens — zero hardcoded
  values; `image-rendering: pixelated` on the pixel art; `tabular-nums` on every counter/timestamp.
- `Room`/`StoneBridge`/`SpeechBubble`/`Tooltip`/`Parchment` are **presentational** and imply no engine
  behavior (REQ-06-017).
- `MissionBar` surfaces the effort as **read-only data** (no selector); `DemoControls` carries the
  `SOLO DEMO` tag and the read-only note (DR-061).
- `PowerOffOverlay` is **derived from real state** (a prop), never a control; its copy says the factory
  is started by launching `/pandacorp:implement`, never "press play".
- Reduced motion: every primitive's motion is `transform`/`opacity` only and respects
  `prefers-reduced-motion` (the RAF binding lives in WO-06-007); a static render stays readable.
- a11y: state conveyed by icon + text (not color alone); focusable controls keyboard-reachable; WCAG AA
  contrast on both themes.
- Each primitive appended to `docs/design/components.md` §3 with its row (DR-057), if not already listed.

## Dependencies

- **Intra (VERIFIED, consume):** WO-06-002 (`layout` — room rects, slots, paths, `roleColor`),
  WO-06-001 (`event-vm`), WO-06-003 (`state-map`), WO-06-004 (`engine`), WO-06-005 (`fragua-snapshot`).
- **Foundation (FRD-13):** WO-13-006 (PageTitle/SectionHead/Tabs), WO-13-007 (Chip/Panel/Button/
  ProgressBar/Toast), WO-13-008 (Shield/TierBadge/ItemSlot) — and the per-role color + motion tokens.
- **Live (FRD-01):** WO-01-009 (`useLiveSnapshot` + SSE transport — `foundation:true`); the canvas
  primitives are stateless renderers, the scene (WO-06-007) feeds them the live snapshot.
- **Cross-FRD:** `frd-13` (foundation primitives + tokens), `frd-04` (the Tabbar the scene mounts into),
  `frd-01` (live snapshot).

## Visual reference

`docs/frds/frd-06-party/mocks/la-fragua.html` (visual source `docs/design/prototype/party-proposal.html`,
embedded in `prototype/index.html`). Shared pixel-art assets in `docs/design/prototype/assets/`. See
`../fdd.md` §1–§9 and `docs/design/components.md` §3. Fidelity, not novelty.
