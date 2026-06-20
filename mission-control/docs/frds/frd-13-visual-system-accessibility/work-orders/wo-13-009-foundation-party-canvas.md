---
id: WO-13-009
type: work-order
slug: foundation-party-canvas
title: 'WO-13-009 — Foundation (FND-4): shared pixel-RPG Party canvas primitives'
status: DRAFT
parent: FRD-13
implementation_status: PLANNED
foundation: true
artifacts:
  - 'src/components/modules/party/Room/**'
  - 'src/components/modules/party/StoneBridge/**'
  - 'src/components/modules/party/FlowStrip/**'
  - 'src/components/modules/party/AgentSprite/**'
  - 'src/components/modules/party/JudgeSprite/**'
  - 'src/components/modules/party/SpeechBubble/**'
  - 'src/components/modules/party/Tooltip/**'
  - 'src/components/modules/party/Parchment/**'
  - 'src/components/modules/party/MissionBar/**'
  - 'src/components/modules/party/DemoControls/**'
  - 'src/components/modules/party/PowerOffOverlay/**'
source_requirements: [REQ-06-001, REQ-06-003, REQ-06-006, REQ-06-010, REQ-06-012, REQ-06-013, REQ-06-017]
last_updated: '2026-06-20'
---
# WO-13-009 — Foundation (FND-4): shared pixel-RPG Party canvas primitives (DR-057)

> **GLOBAL FOUNDATION WO (DR-057).** These pixel-RPG canvas primitives are a **shared visual set**
> reused by **TWO** surfaces — **La Campaña** (FRD-02, the board card-detail 6-room trail) and **La
> Fragua** (FRD-06, the live build map). They were previously mis-scoped inside FRD-06's `_party/`
> (route-local), so La Campaña — which builds in an earlier wave — could not reuse them and fell back
> to a flat list (the fidelity failure that triggered this re-anchor). They now live in the **shared**
> `src/components/modules/party/` and are built+VERIFIED in the **global foundation (FRD-13)** BEFORE
> any surface fans out. Both surfaces compose them; neither re-implements canvas markup.
> Source-of-truth: [`docs/design/components.md`](../../../design/components.md) §3.

## Goal
The shared Party-canvas primitives (one folder each, `Name/Name.tsx` + `_tests/`) on the frozen tokens
+ Party PDD, faithful to the mocks, in `src/components/modules/party/` — so La Campaña and La Fragua
assemble the room trail / living map from them. Presentational/stateless renderers (props in, pixels
out); the geometry/engine/snapshot logic stays in its VERIFIED modules and is fed by each scene.

## Scope (shared `src/components/modules/party/<Name>/`; tokens only; `image-rendering: pixelated`)
- **`Room`** — pixel-art zone (Forja/Tribunal/Bóveda for La Fragua; the 6 Campaña phase rooms for La
  Campaña — `research.png`…`release.png`) + top-left pixel **label** chip + top-right **count** chip on
  a dark scrim. The single room primitive both trails reuse (REQ-06-003).
- **`StoneBridge`** — `bridge-h.png` / `bridge-v.png` room→room connectors, above room backgrounds,
  below crossing sprites; presentational; the active one flows the deliverable (REQ-06-017).
- **`FlowStrip`** — the always-visible 8-beat pipeline row with `→` arrows; inactive beats `.45`
  opacity, active beat(s) lit; per-beat hover tooltip (REQ-06-010).
- **`AgentSprite`** — 52px pixel implementer figure: halo + progress + WO-id tag, states
  (`work`/`carry`/`vault`/`say-on`); one per running WO (REQ-06-001). Reused on the Campaña ficha too.
- **`JudgeSprite`** — the per-FRD reviewer figure, dim until the gate opens then pacing the Tribunal.
- **`SpeechBubble`** — WO caption bubble (`say-on`/`sayin`); presentational (REQ-06-017).
- **`Tooltip`** (`.wotip`) — WO id+title / flow-beat hover tooltip (REQ-06-002.3 / REQ-06-010.3).
- **`Parchment`** — the 📜 Status-Note hand-off element travelling closed-WO → dependent station;
  presentational decoration of the real `HandoffWritten` event (REQ-06-006).
- **`MissionBar`** (`.quest`) — the Misión strip: label + FRD pips + global WO counter (`tabular-nums`)
  + **⚙️ esfuerzo · <effort>** as **read-only data** (DR-061, REQ-06-012.3) — a surface, not a control.
- **`DemoControls`** — the canonical **DR-061 SOLO DEMO** wrapper (dashed border + `🔧 SOLO DEMO` tag +
  one-line note); demo-only, never ships in read-only MC.
- **`PowerOffOverlay`** — factory-off treatment (desaturate + tidy sprites + "⏻ Fábrica apagada",
  started by `/pandacorp:implement`); **derived from real state**, never a control (REQ-06-013).

## Acceptance criteria
- Each renders faithfully to the mocks (`frd-06-party/mocks/la-fragua.html`, `frd-02-ideas-board/mocks/la-campana.html`)
  on frozen tokens — zero hardcoded values; `image-rendering: pixelated` on pixel art; `tabular-nums`
  on counters/timestamps; light+dark, WCAG AA; `prefers-reduced-motion` respected (static render stays
  readable; RAF binding lives in each scene, not here).
- Presentational primitives imply no engine behavior; `MissionBar` effort is read-only; `DemoControls`
  carries the SOLO DEMO tag; `PowerOffOverlay` is a derived prop, never a toggle.
- **Appended to `docs/design/components.md` §3 with the shared `src/components/modules/party/` path** so
  La Campaña (FRD-02) and La Fragua (FRD-06) reuse them (DR-057), not fork.

## Dependencies
- **Foundation siblings (FRD-13):** WO-13-006 (PageTitle/SectionHead/Tabs), WO-13-007 (Chip/Panel/Button/
  ProgressBar/Toast/CmdRow), WO-13-008 (Shield/TierBadge/ItemSlot) + the per-role color + motion tokens.
- These primitives are **stateless** — the geometry (`_party/layout`), engine and `fragua-snapshot`
  (FRD-06, VERIFIED) and `useLiveSnapshot` (WO-01-009) are wired by each scene (La Fragua WO-06-007,
  La Campaña WO-02-007), NOT here.

## Visual reference
`docs/frds/frd-06-party/mocks/la-fragua.html` + `docs/frds/frd-02-ideas-board/mocks/la-campana.html`;
shared pixel assets in `docs/design/prototype/assets/`; `docs/design/components.md` §3. Fidelity, not novelty.
