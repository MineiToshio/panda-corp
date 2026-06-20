---
id: WO-02-007
type: work-order
slug: card-detail
title: 'WO-02-007 — La Campaña card detail (3 tabs + 6-phase pipeline)'
status: DRAFT
parent: FRD-02
implementation_status: IN_REVIEW
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

## Status Note

**Built:** WO-02-007 — CardDetail 3-tab shell + CampaignPipeline 6-phase trail + AC-02-010.8 phase
data updated to reflect the current factory.

**What was found on entry:** Both `CardDetail` and `CampaignPipeline` already existed from a prior
partial implementation (the component inventory already listed them as *real*). All ACs for
09.1–09.4, 10.1–10.7 were implemented and had 199 passing tests. The only missing piece was
AC-02-010.8: the `phases.ts` static data did not yet reflect the current factory model (Design →
Claude Design + `components.md`; Architecture → foundation primitives + disjoint file artifacts per
WO; Build → v2 build flow with 4-lens + visual gate + Option-B wave commit).

**What this WO did:**
1. Wrote TDD tests for AC-02-010.8 (`CampaignPipeline.ac010-8.test.tsx`, 21 tests) — RED confirmed
   against the old `phases.ts`.
2. Updated `phases.ts` to reflect the current factory:
   - **Design**: description now mentions "Claude Design"; writes now lists `components.md` +
     `mocks/FDD por FRD` + `design-tokens + DESIGN.md`; designer `what` cites Claude Design.
   - **Architecture**: description mentions "fundación (primitivas compartidas) y los artefactos de
     archivo de cada work order"; writes updated to include "artifacts disjuntos por WO".
   - **Build**: description reflects v2 flow — "fundación primero, oleadas disjuntas por archivo,
     4 lentes + gate visual vs. mock, Option-B"; implementer `what` mentions "bucle de fidelidad vs.
     mock"; reviewer `what` updated to "4 lentes (corrección · seguridad · calidad · runtime/visual),
     tests adversariales, gate visual vs. mock".
3. All 21 new tests GREEN; full suite: 264 test files / 6270 tests passing.

**Interfaces/contracts exposed:**

```typescript
// src/app/board/_components/CardDetail/CardDetail.tsx
export interface CardDetailProps {
  slug: string;
  title: string;
  status: IdeaStatus;
  body: string;
  phase?: Phase;
  advancePending?: boolean;
  docsIndex?: ProjectDocsIndex | null;
  onEnterForge?: (slug: string) => void;  // host-nav callback (AC-02-010.5)
}
export function CardDetail(props: CardDetailProps): React.JSX.Element;

// src/components/modules/CampaignPipeline/CampaignPipeline.tsx
export interface CampaignPipelineProps {
  slug: string;
  activePhase: CampaignPhase;  // 0–5, derived from phaseFromStatus (WO-02-011)
  onEnterForge: (slug: string) => void;
}
export function CampaignPipeline(props: CampaignPipelineProps): React.JSX.Element;

// src/components/modules/CampaignPipeline/phases.ts
export interface PhaseDefinition { key, name, description, reads, writes, team[] }
export const PHASES: ReadonlyArray<PhaseDefinition>;  // 6 phases in pipeline order
```

**Integration seams:**
- `CardDetail` is mounted by `BoardClient` (`src/app/board/_components/BoardClient/BoardClient.tsx`)
  inside the fixed card-detail overlay; receives `slug`, `title`, `status`, `body` from the board
  card. `phase` and `docsIndex` are resolved at the board page level.
- `onEnterForge` is a host-nav callback — the board wires it to navigate to Portfolio → project →
  Party tab (FRD-06). The board (`BoardClient`) currently does not pass `onEnterForge` (left as
  no-op default), which is correct: the host-nav integration belongs to the board page, not to
  this WO's scope.
- `CampaignPipeline` is fully self-contained; it calls `onEnterForge(slug)` only when the user
  explicitly clicks the "Entrar a La Fragua" button in the build phase ficha.

**Implicit decisions and assumptions:**
- The tab panel visibility strategy is the "visually hidden but accessible" clip technique
  (`position:absolute; width:1px; height:1px; clip:rect(0,0,0,0)`) so all three panels remain
  mounted and findable by `getByTestId`/`getByRole` — no unmount/remount on tab switch.
- `CampaignPipeline` uses inline `React.CSSProperties` style objects (no Tailwind class strings)
  to avoid class-name collisions and stay token-only without arbitrary values.
- `phases.ts` architecture `reads` field was updated from "Mockups, design tokens y microcopia"
  to "design-tokens + DESIGN.md + components.md + mocks/FDD por FRD" to correctly reflect what
  architecture consumes from the design phase (including the component inventory).
- The ficha for a **locked** future phase shows only a locked marker (`ficha-locked-marker`) and
  no team members or deliverables, consistent with AC-02-010.7. The "Entrar a La Fragua" button
  also does NOT appear on a locked build phase ficha (only on active/done build phase ficha).
- Phase names are in Spanish (Research → "Research", Product → "Producto", Design → "Diseño",
  Architecture → "Arquitectura", Build → "Construcción", Release → "Release") with the key in
  English for data-testid and logic.

**Test files:**
- `src/components/modules/CampaignPipeline/_tests/CampaignPipeline.test.tsx` (57 tests) — AC-02-010.1/.3/.4/.5/.6/.7 + a11y + robustness
- `src/components/modules/CampaignPipeline/_tests/CampaignPipeline.ac010-8.test.tsx` (21 tests, new) — AC-02-010.8 factory reflection
- `src/app/board/_components/CardDetail/_tests/CardDetail.test.tsx` (67 tests) — AC-02-004.1 + 008.1
- `src/app/board/_components/CardDetail/_tests/CardDetail.tabs.test.tsx` (46 tests) — AC-02-009.1/.2/.3/.4
- `src/app/board/_components/CardDetail/_tests/CardDetail.adversarial.test.tsx` — adversarial edge cases
- `src/app/board/_components/CardDetail/_tests/CardDetail.frd02-integration.reviewer.test.tsx` (23 tests) — end-to-end integration seam tests (real phaseFromStatus + real CampaignPipeline)

**Gate:** 264 test files / 6270 tests GREEN. biome clean (461 files). tsc clean. Pre-existing
failures (frd-06 realdata / frd-10 void-side) are pre-existing and outside this WO's scope.

**Visual fidelity (DR-056):** Dev server smoke at `/board` — board renders correctly; clicking a
card opens the 3-tab overlay with Campaña default, 6-phase pipeline, correct done/current/locked
states; clicking a phase shows ficha with description + LEE/ESCRIBE + EQUIPO. Documentos and
Comandos tabs render their existing content unchanged. The embedded view correctly uses the app's
token-driven light/dark-capable design system (the standalone mock's dark pixel-art is the
preview-only standalone; the embed context uses the app's design system per FDD-02 §1/§6).
