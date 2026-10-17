---
id: WO-02-007
type: work-order
slug: card-detail
title: 'WO-02-007 — La Campaña card detail (tabbed + 6-phase pipeline)'
status: DRAFT
parent: FRD-02
implementation_status: VERIFIED
artifacts:
  - 'src/app/board/_components/CardDetail/**'
  - 'src/components/modules/CampaignPipeline/**'
source_requirements: [REQ-02-004, REQ-02-008, REQ-02-009, REQ-02-010, REQ-02-013, REQ-02-015]
dependsOn: [WO-02-003, WO-02-011, WO-01-006, WO-13-006, WO-13-007, WO-13-009, WO-13-001, WO-13-002, WO-13-003, WO-06-005]
last_updated: '2026-10-13'
---
# WO-02-007 — La Campaña card detail

## Goal

Re-paint the board **card detail** to match the approved prototype: a tabbed container hosting **La Campaña** — the 6-phase pipeline
trail with per-phase fichas. The `lib/campaign.ts` `phaseFromStatus` derivation is VERIFIED and
consumed as-is; this WO is presentational.

> **Reconciled from code 2026-07-05.** The container originally shipped as three tabs (Campaña · Documentos · Comandos, default Campaña); it since became up to **5 tabs** — **Propuesta · Spec? · Arquitectura? · Documentos · Campaña** (default tab by the project's stage since 2026-10-13, AC-02-009.1), with Comandos folded into La Campaña's ficha and Spec/Arquitectura added (REQ-02-009/011/013). See `CardDetail.tsx`.

## Scope (components from `docs/design/components.md`)

- **`CardDetail`** (`src/app/board/_components/CardDetail/CardDetail.tsx`) — the tabbed shell using
  the shared **`Tabs`** primitive (DR-062), up to five tabs:
  Propuesta · Spec? · Arquitectura? · Documentos · Campaña. Initial selection follows the project phase, falling back to available earlier stages; later choices persist. Documentos
  renders the doc navigator; runnable commands live in La Campaña's ficha. Clicking a doc entry switches to
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

- AC-02-009.1/.2 — WHEN a card opens, THE detail SHALL render the phase-aware Propuesta · Spec? · Arquitectura? · Documentos · Campaña tabs using shared Tabs; only initial selection derives from phase.
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
  full informational ficha, with the build action gated until reached.
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

## Status Note — VERIFIED (2026-10-13, close-out `board-card-default-tab-by-phase`, `/pandacorp:change --now`)

**What changed:** (1) The card detail's initial tab follows the project's stage (AC-02-009.1): research →
Propuesta, product/design → Spec, architecture onward (incl. shipped) → Arquitectura, falling back
Arquitectura → Spec → Propuesta when a digest is absent — pure `defaultTabForPhase` helper as a lazy
`useState` initializer, so the owner's later pick still persists (AC-02-009.4). (2) The board reads a
card's project (status, scoped docs, FRD count, Spec/Arquitectura digests) for ANY project-linked card —
in-pipeline, shipped or discarded — via the new `src/app/board/_utils/readCardProject.ts`; before, only
in-pipeline cards got them, so launched projects (e.g. personal-page-v2) showed no Spec/Arquitectura/docs.
**Evidence:** `verify.sh --since 5c594bde --report-all` green, scope `since`, at `558823cd`; independent
opus reviewer re-ran the gate on both increments, no blocking findings; adversarial suites
`src/app/board/_tests/frd-02.stage-default-tab.reviewer.test.tsx` and
`src/app/board/_utils/_tests/readCardProject.reviewer.test.ts`. Rigor `critical` by classifier false
positives (S5 'Auth' in a fixture string — BL-0231; S8 test-tmpdir `rmSync`; S3 size of the extraction);
closed with the owner's explicit `--force-critical`. *Reconciled-from-code close-out.*

## Status Note — reopened (2026-06-29, ambient roam — La Campaña liveliness)

**What changed:** Decoupled La Campaña's cast roam from the build's `running` flag (`RoamingCast.tsx`).
The active phase's cast now **always roams** as ambient liveliness — for ANY phase (research → release),
not just the build (only `/pandacorp:implement` sets `running:true`, so before this only the build room
ever animated, leaving design/spec/blueprint rooms frozen). The honest split is preserved: the lead
**halo** and the **speech-on-meet** bubbles still render only when an agent is `running` (gated in the
JSX + in `arrive()`), and the ficha/badge label ("fase actual" vs "● en curso") is unchanged — so the
wander is ambient but no live-work activity is fabricated. Done rooms idle-bob; locked rooms static;
`prefers-reduced-motion` renders all static (unchanged). Canonical: FRD-02 REQ-02-010 AC amendment
(2026-06-29); decision-log. No skill/plugin/hook change — MC-only.

## Status Note — IN_REVIEW (2026-06-20, pass 2 — DR-062 tab fix)

**What was fixed (pass 2):** Applied the concrete DR-062 cohesion fix from the reviewer finding.
`CardDetail.tsx` now uses the shared `Tabs` primitive (`src/components/core/Tabs/Tabs.tsx`,
WO-13-006) with `level="sub"` and `testIdPrefix="card-detail-tab-"` instead of the bespoke
`<div role="tablist">` + `tabButtonStyle`. The bespoke `TAB_ROW_STYLE` / `tabButtonStyle`
constants were removed from `CardDetail.styles.ts` (now has a comment marking their removal).
The shared `Tabs` primitive provides the canonical ArrowLeft/ArrowRight keyboard contract
(`CardDetail.cohesion.reviewer.test.tsx` second test now passes — previously it failed against
the bespoke row). The `docs/design/components.md` entry for `CardDetail` is now truthful
("uses `Tabs`"). All three `role="tabpanel"` bodies and the clip strategy remain unchanged.

**What was built (pass 1):** `CampaignPipeline` rebuilt from a flat `<ol>/<li>` list into a
faithful 6-room pixel-art trail composing the shared Party canvas primitives (WO-13-009:
`Room`, `StoneBridge`, `AgentSprite`). The stage is a 920×560 dark canvas with 30px dot-grid
(added to `globals.css` via `[data-party-stage]::before`) hosting 6 absolutely-positioned
`Room` zones in the serpentine layout from `la-campana.html` (top row L→R rooms 0–2, bottom
row R→L rooms 3–5), connected by 5 `StoneBridge` connectors (4 horizontal + 1 vertical). Each
room has a transparent `<button>` overlay for click/keyboard with `data-testid` and
`data-phase-state`; the phase ficha (`FichaContent`) renders below the stage on click, showing
description + LEE + ESCRIBE + the whole team as `AgentSprite` figures. The build phase's
"Entrar a La Fragua" fires `onEnterForge(slug)`.

**Interfaces/contracts exposed:**
- `CardDetailProps` — `{ slug, title, status, body, phase?, advancePending?, docsIndex?, onEnterForge? }` (unchanged)
- `CampaignPipelineProps` — `{ slug: string; activePhase: CampaignPhase; onEnterForge: (slug: string) => void }` (unchanged)
- Tab testids: `data-testid="card-detail-tab-campana"`, `"card-detail-tab-docs"`, `"card-detail-tab-comandos"` (via shared `Tabs` `testIdPrefix="card-detail-tab-"`)
- `data-testid="tabs-root"` with `data-level="sub"` — confirms the shared primitive is active
- Stage testid: `data-testid="campaign-stage"` wraps all 6 rooms and 5 bridges
- Room click targets: `data-testid="campaign-phase-{key}"`, `data-phase-state="done|current|locked"`
- Ficha: `data-testid="campaign-phase-ficha"`, children: `ficha-description`, `ficha-lee`, `ficha-escribe`, `ficha-team`, `ficha-team-member`, `ficha-enter-forge`, `ficha-locked-marker`

**Integration seams:**
- `CardDetail.tsx` wires `handleTabChange` (narrows `string` → `TabKey` via `TABS.find`) into the shared `Tabs` `onChange`; panel visibility uses the clip strategy (PANEL_HIDDEN_STYLE) — all three panels are always mounted
- `CardDetail.tsx` calls `CampaignPipeline` via `activePhase={phaseFromStatus(card)}` and `onEnterForge` callback
- `globals.css` has `[data-party-stage]::before` (30px dot-grid), `@keyframes roompulse`, focus-ring `::after` for keyboard users; transitions only `transform` (compositable)

**Implicit decisions and conventions (consumer must inherit):**
1. `TAB_TEST_ID_PREFIX = "card-detail-tab-"` — the `testIdPrefix` prop on `Tabs` so test ids are screen-specific while still using the ONE shared primitive (DR-062).
2. `handleTabChange` narrows `string → TabKey` via `TABS.find` — no unsafe `as` cast; unknown ids are silently dropped (no crash).
3. `PANEL_HIDDEN_STYLE` (clip technique) keeps all panels mounted so `getByTestId` in off-tab panels works; inactive panels are not removed from the DOM.
4. `PhaseRoom` is module-local (not exported); `CampaignPipeline` root renders stage + bridges + ficha wrapper only.
5. Room zone mapping: `[research, spec, design, architecture, build, release]` (spec=review.png, design=frontend.png per WO-13-009).
6. Room positions (left, top): `[18,46],[335,46],[652,46],[652,306],[335,306],[18,306]` (faithful to la-campana.html).
7. Bridge `flow` prop = `bridge.fromIdx === activePhase - 1` (connector leading INTO the active room carries the deliverable).
8. AgentSprite home positions per team size: 1→`[[97,84]]`, 2→`[[52,82],[144,82]]`, 3→`[[34,80],[97,94],[160,80]]`.
9. Stage `@keyframes roompulse` and `::before` dot-grid live in `globals.css` (pseudo-elements and keyframes cannot be expressed in React inline styles).

**Test files covering this WO:**
- `src/app/board/_components/CardDetail/_tests/CardDetail.cohesion.reviewer.test.tsx` — 2 reviewer tests (DR-062: both the shared `Tabs` primitive contract AND CardDetail's tab row now pass the ArrowRight focus-cycling check — the blocking finding is resolved)
- `src/app/board/_components/CardDetail/_tests/CardDetail.tabs.test.tsx` — 34 tests (AC-02-009.1–.4: 3-tab structure, default, activation, doc-entry switch, persistence, CampaignPipeline wiring)
- `src/app/board/_components/CardDetail/_tests/CardDetail.test.tsx` — 52 tests (AC-02-004.1/008.1: next-step, copy, docs navigator, lifecycle statuses, phases, read-only, tokens, a11y)
- `src/app/board/_components/CardDetail/_tests/CardDetail.frd02-integration.reviewer.test.tsx` — 8 reviewer integration tests (phase-state invariant, Entrar La Fragua, read-only, tab coexistence)
- `src/app/board/_components/CardDetail/_tests/CardDetail.adversarial.test.tsx` — adversarial tests
- `src/components/modules/CampaignPipeline/_tests/CampaignPipeline.test.tsx` — 59 tests (AC-02-010.1/3/4/5/6/7, accessibility, design tokens, robustness)
- `src/components/modules/CampaignPipeline/_tests/CampaignPipeline.pixel-trail.test.tsx` — 30 tests (6 rooms, zones+states, 5 bridges, agent sprites, stage container, room labels)

**Gate results (2026-06-20, pass 2):**
- `vitest run` (full suite) — 6532 passed | 2 expected fail | 278 test files
- `tsc --noEmit` — 0 errors
- `biome check src/` — 0 errors, 0 warnings (488 files)
- Visual fidelity (DR-056) — Playwright fidelity check: `campaign-stage`×1, `campaign-phase-*`×6, `tabs-root[data-level=sub]`×1, `card-detail-tab-campana` aria-selected=true role=tab. Zero console errors. Screenshot matches `mocks/la-campana.html` layout.
- Preview smoke gate — board route HTTP 200; sentinel smoke + visual harness tests pass.

## Reviewer verdict — PASS, VERIFIED (FRD-02 gate, 2026-06-20, pass 2)

Independent FRD gate (Opus 4.8, different model family from the implementers). WO-02-005 + WO-02-007
reviewed TOGETHER through the real `BoardShell` seam.

- **DR-062 reopen resolved.** `CardDetail.tsx` now composes the shared `Tabs` primitive
  (`tabs-root[data-level="sub"]`, `card-detail-tab-*` ids via `testIdPrefix`); the bespoke
  `tabButtonStyle`/`TAB_ROW_STYLE` are gone; ArrowLeft/ArrowRight focus-cycling restored. Confirmed
  at the board seam, not just in CardDetail.
- **Adversarial integration (DR-015/016)** — added `src/app/board/_tests/frd-02.shell-integration.reviewer.test.tsx`
  (9 tests): shared-Tabs at the seam, ArrowRight cycling, doc-click landing + tab persistence after
  navigating to Comandos, `shipped`→release coherence + "Entrar a La Fragua" still fires,
  malformed `in-pipeline`→research fallback + locked-phase graceful ficha, read-only invariants
  (no draggable, board stays mounted behind intake, discard never auto-invoked). **Mutation-verified:**
  `level="sub"→"top"` and `FALLBACK 0→5` each killed a test — not decorative.
- **Layer B mock-judge** — `/board` card-detail Campaña vs `mocks/la-campana.html`: 6 serpentine
  pixel-art rooms + 5 stone-bridge connectors, active room glow, sprites, badges, deliverable chips,
  "EL VIAJE DE ESTA IDEA POR LAS 6 FASES" label, ficha (Descripción/LEE/ESCRIBE/EQUIPO). No nameable
  structural divergence (the page following the host light theme while the stage keeps its intrinsic
  dark pixel-art canvas is correct, not a divergence). Screenshots in `docs/reviews/smoke/`.
- **Layer A bless** — `/board` had no baseline (genuinely new UI surface); blessed here:
  `e2e/routes.ts` `tablero.blessed: true`, baselines `e2e/visual.spec.ts-snapshots/tablero-{desktop,mobile}*.png`
  committed; the visual gate now locks the surface as a real regression gate (re-verified green).
- **Gate** — biome/tsc/knip/madge clean; vitest 6532 pass / 2 expected-fail; smoke (2 viewports) green,
  zero console errors.

One non-blocking note (not a defect): in `CampaignPipeline.tsx` the team-member sprite in `FichaContent`
uses `member.role as ValidAgentRole`, while the room sprites use the `isValidAgentRole` guard — the cast
is safe (the static `PHASES` roles are all valid) but for consistency a future touch should route both
through the guard. Tolerated under the rule of three; not gate-blocking.

## Shared logical model extension — 2026-10-16

This coarse capability now also owns `src/lib/architecture/data-model/**`, shared `src/lib/architecture/read-artifacts.ts`, `src/components/modules/DataModelViewer/**`, board artifact propagation and the `ArchitectureDigest` data-model body. Preserve the complete existing Architecture surface, with **Modelo de datos**, and expose it for a present structured artifact even without the narrative digest. FRD-04 WO-04-004 reuses these modules for workspace mounting.

- WHEN a version-1 model is read/rendered, THE implementation SHALL satisfy AC-02-015.1–.11: bounded validated JSON, explicit states, all attributes/keys and endpoint cardinalities, native pointer pan, zoom/fit/reset, keyboard/buttons, search, selection, expanded dialog and compact Prisma-like **Esquema**.
- WHEN the viewer opens at any viewport width, THE default SHALL be compact **Diagrama** with content-sized cards displaying full text, 24px attribute rows and 12px field text.
- WHEN other Architecture content is available, THE extension SHALL preserve stack/services/environment/ADRs/work-order plan/per-FRD panels and live readers.

Use native DOM/SVG with exact-pinned elkjs@0.12.0, shared text/port geometry and a cancellable algorithm worker (ADR-0007). The owner supersedes the inset whole-viewer expansion and lower inspector: full-window diagram only, minimal floating controls, readable central starting view and no duplicate relationship buttons. Exact artifact/interface contract: [ADR-0006](../../../adr/ADR-0006-shared-logical-data-model-viewer.md). Original visual oracle: `docs/design/prototype/data-model-viewer/index.html` (round 2), amended by the owner’s explicit readability/full-window correction in ADR-0007 and AC-02-015.2–.11. The rejected fixed-width, whole-viewer dialog and inspector details no longer define acceptance. MC's own model declares no persistence; illustrative relational fixtures never stand in for real MC data.

**Evidence boundary:** existing implementation_status and historical reviewer notes cover the previous delivery, not these new criteria. This extension requires current independent valid/malformed fixture checks, edge-case/cardinality tests and board/workspace browser review; this documentation update does not record them as passed or write build state. Factory producer/backfill remains a separate dependency.

## Delivery verification — 2026-10-16

Reconciled from code and current checks by `/pandacorp:sync` on 2026-10-16, under the owner's explicit direct-implementation instruction. This note covers the extension, separately from the historical delivery above. Shared reader/viewer and both surfaces are implemented. The canonical isolated-worktree `verify.sh --since da0d3a8404fae6f82e66f2870e7e69cb0bdcef21 --report-all` passed all 11 subgates (433 unit/integration tests and 42 shell/smoke browser cases). The additional feature E2E suite passed four desktop/mobile cases, including actual pointer pan, compact schema, tab order and modal focus. An independent reviewer passed 1,897 affected regression tests and authored adversarial cases; the graph adapter now isolates opaque authored IDs from Dagre's object-key internals.

Evidence: [delivery report](../../../reviews/logical-data-model-viewer/delivery.md), [independent review](../../../reviews/logical-data-model-viewer/review.md). Existing machine-status fields are preserved; this scoped manual change does not launch or impersonate a build-engine run. Factory artifact production and reviewed project backfill remain separate from the implemented consumer.

### Readability correction, current extension

Own the shared content-sized geometry, ELK adapter/worker lifecycle, orthogonal distinct-route handling, readable initial camera and diagram-only 100vw/100dvh presentation. Validate full actual attribute/type cells and real PandaSaga geometry at desktop/mobile widths; preserve all 39 entities/95 relations and source truth. Prior machine status and historical delivery notes are unchanged; current scoped verification lives in `docs/reviews/readable-fullscreen-model/delivery.md`.
