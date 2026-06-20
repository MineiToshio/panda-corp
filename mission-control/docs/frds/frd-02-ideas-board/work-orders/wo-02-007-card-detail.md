---
id: WO-02-007
type: work-order
slug: card-detail
title: 'WO-02-007 — La Campaña card detail (3 tabs + 6-phase pipeline)'
status: DRAFT
parent: FRD-02
implementation_status: PLANNED
artifacts:
  - 'src/app/board/_components/CardDetail/**'
  - 'src/components/modules/CampaignPipeline/**'
source_requirements: [REQ-02-004, REQ-02-008, REQ-02-009, REQ-02-010]
last_updated: '2026-06-20'
---
# WO-02-007 — La Campaña card detail

## Goal

Re-paint the board **card detail** to match the approved prototype: a three-tab container
(**Campaña · Documentos · Comandos**, default Campaña) hosting **La Campaña** — the 6-phase pipeline
trail with per-phase fichas. The `lib/campaign.ts` `phaseFromStatus` derivation is VERIFIED and
consumed as-is; this WO is presentational.

## Scope (components from `docs/design/components.md`)

- **`CardDetail`** (`src/app/board/_components/CardDetail/CardDetail.tsx`) — the tabbed shell using
  the shared **`Tabs`** primitive (the ONE tab pattern, DR-062 — `.stab` level), three tabs
  Campaña · Documentos · Comandos, default Campaña, active tab persisted across re-renders. Documentos
  renders the existing doc navigator (summary + key points + idea docs); Comandos renders the
  next-step / iterate command panel via `CmdRow` + `Button`. Clicking a doc entry switches to
  Documentos. Reuse `Panel`, `DocHeading`, `CmdRow`, `Button` — no bespoke switcher.
- **`CampaignPipeline`** (`src/components/modules/CampaignPipeline/CampaignPipeline.tsx`) — the
  **6-room pixel-art trail** faithful to `mocks/la-campana.html`, **NOT a flat row list**. It MUST be
  built from the **shared Party canvas primitives** (`src/components/modules/party/`, foundation
  WO-13-009): a dark stage + 30px grid hosting six **`Room`** zones in fixed order
  (`research → product → design → architecture → build → release`, each its phase art
  `research.png`…`release.png`) connected by **`StoneBridge`** with the deliverable flowing on the
  active leg; the active room glows (`roompulse`); each phase's **ficha** shows description + LEE/ESCRIBE
  + the whole team as **`AgentSprite`** figures (with `SpeechBubble` where the mock has captions),
  wrapped in the labelled container ("EL VIAJE DE ESTA IDEA POR LAS 6 FASES"). Rooms render
  done / current / locked by position vs the active phase (`phaseFromStatus`, VERIFIED). The build
  phase's "Entrar a La Fragua" raises an `onEnterForge(slug)` host-navigation callback (Portfolio →
  project → Party tab, FRD-06) — no inner reload. **Reuse the shared `Room`/`StoneBridge`/`AgentSprite`/
  `SpeechBubble` — do NOT approximate the trail with `KanbanColumn`/`ItemSlot` or a text list** (that
  flat fallback is the exact fidelity defect this re-anchor fixes).

reuse → adapt → create-only-if-new: `CardDetail` re-paints onto the cohesion `Tabs`; `CampaignPipeline`
**composes the shared Party canvas primitives** (WO-13-009) — it forges no canvas markup of its own and
is verified ≥2 viewports against `mocks/la-campana.html` before close.

## Acceptance criteria (anchored in FRD-02 EARS)

- AC-02-009.1/.2 — Card detail renders **three tabs** (Campaña · Documentos · Comandos) with the same
  tab pattern as the Portfolio project pane; default Campaña; Documentos/Comandos keep the existing
  doc-navigator / next-step behavior.
- AC-02-009.3 — Clicking a document entry switches the active tab to **Documentos** and shows it.
- AC-02-009.4 — The active tab persists across re-renders of the open card.
- AC-02-010.1/.2/.3 — La Campaña renders the 6 phases in fixed order; the active phase is derived from
  `phaseFromStatus` (VERIFIED), with a safe fallback to `research`; phases before = done, active =
  current (glowing), after = locked.
- AC-02-010.4/.8 — Clicking a phase shows its ficha: description, LEE/ESCRIBE deliverable chain and the
  **whole team** per phase; fichas reflect the current factory (Design → Claude Design + components.md;
  Architecture → foundation + artifacts; Build → v2 flow).
- AC-02-010.5 — "Entrar a La Fragua" host-navigates to Portfolio → project → Party tab, no inner
  reload.
- AC-02-010.6/.7 — Read-only (no Claude, no write, no build trigger); locked future phases render a
  graceful empty state.
- Matches `prototype/party-pipeline.html` embedded in the board card detail; light + dark; the Preview
  Smoke Gate is green.

## Dependencies

- Foundation (FRD-13): **WO-13-006** (`Tabs`), **WO-13-007** (`Panel`/`CmdRow`/`Button`/`DocHeading`),
  and — **critically — WO-13-009** (the shared Party canvas: `Room`/`StoneBridge`/`AgentSprite`/
  `SpeechBubble`, from `src/components/modules/party/`) which the 6-room trail is built from. The whole
  FRD-13 foundation (incl. WO-13-009) **must be VERIFIED before this WO builds**.
- Read layer (VERIFIED, consumed as-is): WO-02-011 (`lib/campaign.ts` `phaseFromStatus`),
  WO-02-003 (`lib/next-step.ts`), FRD-01 doc readers.
- Intra-FRD: WO-02-005 (board surface — the card detail opens from a board card).
- Cross-FRD: **frd-13** (foundation, incl. the Party canvas WO-13-009 — VERIFIED first),
  **frd-06** (the Party tab is the "Entrar a La Fragua" target).

## Visual reference

`docs/frds/frd-02-ideas-board/mocks/la-campana.html` (La Campaña) + `docs/design/prototype/index.html`
(the board card detail with the `.stab` tab row).
