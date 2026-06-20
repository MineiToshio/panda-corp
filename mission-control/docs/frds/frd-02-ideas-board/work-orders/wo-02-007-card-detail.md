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
last_updated: '2026-06-19'
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
  6-phase trail (`research → product → design → architecture → build → release`) wrapped in a
  labelled container ("EL VIAJE DE ESTA IDEA POR LAS 6 FASES"). Each phase is a room rendered
  done / current / locked by position vs the active phase; clicking a phase opens its **ficha**
  (description + LEE/ESCRIBE + the whole team). The build phase's "Entrar a La Fragua" action raises
  an `onEnterForge(slug)` host-navigation callback (Portfolio → project → Party tab, FRD-06) — no
  inner reload. Reuse the `ItemSlot`/`Shield`/`TierBadge`/`KanbanColumn` foundation primitives and
  `Button` for the phase rooms / fichas; create no new shared pill.

reuse → adapt → create-only-if-new: `CardDetail` and `CampaignPipeline` are existing inventory rows
re-painted onto foundation primitives; the host-navigation callback is glue, not a new component.

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
  **WO-13-008** (`Shield`/`TierBadge`/`ItemSlot`/`KanbanColumn` — the phase rooms).
- Read layer (VERIFIED, consumed as-is): WO-02-011 (`lib/campaign.ts` `phaseFromStatus`),
  WO-02-003 (`lib/next-step.ts`), FRD-01 doc readers.
- Intra-FRD: WO-02-005 (board surface — the card detail opens from a board card).
- Cross-FRD: **frd-13** (foundation), **frd-06** (the Party tab is the "Entrar a La Fragua" target).

## Visual reference

`docs/frds/frd-02-ideas-board/mocks/la-campana.html` (La Campaña) + `docs/design/prototype/index.html`
(the board card detail with the `.stab` tab row).
