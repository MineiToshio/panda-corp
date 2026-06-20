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

## Reviewer finding — REOPENED to PLANNED (FRD-02 gate, 2026-06-20)

**Blocking (DR-062 cohesion / AC-02-009.1):** `CardDetail.tsx` does NOT use the shared `Tabs`
primitive. It rolls a **bespoke per-screen tab switcher** — `<div role="tablist">` + the local
`tabButtonStyle` in `CardDetail.styles.ts` (underline/border-bottom style) — instead of composing
`src/components/core/Tabs/Tabs.tsx` (the canonical `.stab` pill pattern, WO-13-006). This violates:
- **AC-02-009.1** — "the SAME tab pattern as the Portfolio project pane (the `stab` selector row)".
- **WO-02-007 scope** — "the shared `Tabs` primitive (the ONE tab pattern, DR-062 — `.stab` level)".
- **DR-062** — a one-off tab look is rejected the same as a duplicate component; the app must feel
  like ONE application.
- It also **drops the canonical keyboard a11y contract**: the shared `Tabs` cycles focus with
  ArrowLeft/ArrowRight; the bespoke row does not (proved by
  `CardDetail.cohesion.reviewer.test.tsx` — first test passes against `Tabs`, second fails against
  CardDetail). The pixel-art pipeline (the rest of the WO) renders faithfully and is otherwise sound.
- **Inventory lie:** `docs/design/components.md` L86 claims CardDetail "uses `Tabs`" — false until fixed.

**Concrete fix (file:line):**
- `src/app/board/_components/CardDetail/CardDetail.tsx:173–190` — replace the hand-rolled
  `<div role="tablist">…{TABS.map(button tabButtonStyle)}` with `<Tabs level="sub" tabs={…}
  active={activeTab} onChange={setActiveTab} ariaLabel="Pestañas del detalle de idea" />`
  (id ↔ `TabKey`). Keep the three `role="tabpanel"` bodies and the clip strategy as-is; they pass.
- Delete the now-unused `TAB_ROW_STYLE` / `tabButtonStyle` from `CardDetail.styles.ts` (knip would
  flag them once unimported).
- The doc-entry click → Documentos (AC-02-009.3) and active-tab persistence (AC-02-009.4) keep
  working since the panel state is unchanged.

**Not blocking (consumed as-is, verified working):** the 6-room pixel-art trail (Room/StoneBridge/
AgentSprite composition), phase done/current/locked derivation, fichas (LEE/ESCRIBE/team),
"Entrar a La Fragua" onEnterForge bubbling, read-only invariant — all green in the integration suite
and the runtime smoke (route 200, 6 rooms + 5 bridges + 3 tabs rendered, zero console errors).

## Status Note — IN_REVIEW (2026-06-20)

**What was built:** Rebuilt `CampaignPipeline` from a flat `<ol>/<li>` list into a faithful
6-room pixel-art trail composing the shared Party canvas primitives (WO-13-009: `Room`,
`StoneBridge`, `AgentSprite`). The stage is a 920×560 dark canvas with 30px dot-grid (added
to `globals.css` via `[data-party-stage]::before`) hosting 6 absolutely-positioned `Room`
zones in the serpentine layout from `la-campana.html` (top row L→R rooms 0–2, bottom row
R→L rooms 3–5), connected by 5 `StoneBridge` connectors (4 horizontal + 1 vertical). Each
room has a transparent `<button>` overlay for click/keyboard with `data-testid` and
`data-phase-state`; the phase ficha (`FichaContent`) renders below the stage on click,
showing description + LEE + ESCRIBE + the whole team as `AgentSprite` figures. The build
phase's "Entrar a La Fragua" fires `onEnterForge(slug)`. `CardDetail.tsx` was not modified —
it was already the correct tabbed shell; only `CampaignPipeline.tsx` was rebuilt.

**Interfaces/contracts exposed:**
- `CampaignPipelineProps` — `{ slug: string; activePhase: CampaignPhase; onEnterForge: (slug: string) => void }` (unchanged public API)
- Stage testid: `data-testid="campaign-stage"` wraps all 6 rooms and 5 bridges
- Room click targets: `data-testid="campaign-phase-{key}"` (button overlay), `data-phase-state="done|current|locked"`
- Ficha: `data-testid="campaign-phase-ficha"`, with children `ficha-description`, `ficha-lee`, `ficha-escribe`, `ficha-team`, `ficha-team-member`, `ficha-enter-forge`, `ficha-locked-marker`

**Integration seams:**
- `CardDetail.tsx` calls `CampaignPipeline` via `activePhase={phaseFromStatus(card)}` and `onEnterForge` callback — unchanged
- `globals.css` now has `[data-party-stage]::before` (30px dot-grid), `[data-party-stage] [data-testid="room-root"]:hover` (transform lift), `@keyframes roompulse` (active room pulse), and focus-ring `::after` for keyboard users
- `globals.css` transitions only `transform` (compositable; AC-13-005.1 enforced)

**Implicit decisions and conventions (consumer must inherit):**
1. `PhaseRoom` is a module-local sub-component (not exported); it holds the Room + sprites + badge + button. The `CampaignPipeline` root only renders the stage, bridges, and ficha wrapper.
2. Room zone mapping: `research→research`, `product→spec`, `design→design`, `architecture→architecture`, `build→build`, `release→release` (spec=review.png, design=frontend.png per WO-13-009 convention).
3. Room positions (left, top): `[18,46],[335,46],[652,46],[652,306],[335,306],[18,306]` (faithful to la-campana.html).
4. Bridge `flow` prop = `bridge.fromIdx === activePhase - 1` (the connector leading INTO the active room flows the deliverable).
5. AgentSprite positions per team size: 1→`[[97,84]]`, 2→`[[52,82],[144,82]]`, 3→`[[34,80],[97,94],[160,80]]`.
6. `_PHASE_KEYS` constant in the pixel-trail test file has underscore prefix (biome unused-var idiom); no biome-ignore comment needed.
7. Stage `@keyframes roompulse` and `::before` dot-grid live in `globals.css` (not inline) because pseudo-elements and keyframes cannot be expressed in React inline styles.

**Test files covering this WO:**
- `src/components/modules/CampaignPipeline/_tests/CampaignPipeline.test.tsx` — 59 existing tests (AC-02-010.1/3/4/5/6/7, accessibility, design tokens, robustness)
- `src/components/modules/CampaignPipeline/_tests/CampaignPipeline.pixel-trail.test.tsx` — 30 new tests (WO-02-007 pixel-trail: 6 rooms, correct zones+states, 5 bridges, agent sprites, stage container, room labels)
- `src/app/board/_components/CardDetail/_tests/CardDetail.test.tsx` — 114 integration tests (3-tab shell, Campaña/Documentos/Comandos, AC-02-009.1–.4)

**Gate results (2026-06-20):**
- `vitest run` (full suite) — 6530 passed | 2 expected fail | 277 test files
- `tsc --noEmit` — 0 errors
- `biome check src/` — 0 errors, 0 warnings (487 files)
- Visual fidelity (DR-056) — 3 cycles against `mocks/la-campana.html`: Stage + 6 rooms + 5 bridges + active glow + sprites + ficha all match. Zero console errors in browser.
- Preview smoke gate — route `http://localhost:3099/board` (card detail) returns HTTP 200, CampaignPipeline renders with `campaign-stage`, `room-root`×6, `stone-bridge-root`×5, `agent-sprite-root`×10.
