---
id: FRD-06
type: frd
title: FRD-06 — Party · La Fragua (live build view)
parent: product/prd.md
status: ACTIVE
implementation_status: PLANNED
last_updated: '2026-06-18'
---
# FRD-06 — Party · La Fragua (live build view)

A faithful, living-world view of the **build** as the real engine runs it. The build agent is
a generalist **`implementer`** — one running figure per work order — orchestrated FRD by FRD by a
deterministic script (Dynamic Workflows, DR-013), **not** a team of specialists chatting live. The
scene is always **the FRD currently in build**; rooms (Forja → Tribunal → Bóveda) replace the old
4-zone kanban, and all communication is by document, never live peer chat.

> Supersedes the previous fictitious model (researcher/backend/frontend/testing wandering 4 fixed
> zones with live handoffs). Source of truth: `prototype/party-redesign-spec.md` §2–3 and the visual
> contract `prototype/party-proposal.html` (La Fragua). The companion pipeline view (La Campaña) lives
> in FRD-02; the role/color set in FRD-13; the engine event enrichment in the plugin.

## Requirements & acceptance criteria (EARS)

Stable IDs (DR-049): `REQ-06-MMM` → `AC-06-MMM.K`. The EARS text is copied verbatim into the work
orders. The blueprint maps each REQ to a component/interface.

### REQ-06-001 — One sprite per running work order; the wave is the mode
- AC-06-001.1: WHILE a work order is a **running `implementer`** in the FRD, THE system SHALL render exactly **one sprite** for it in the Sala de Forja (one figure per running WO; role = `implementer`, full-stack).
- AC-06-001.2: THE system SHALL cap the number of concurrently-built (sprite-bearing) work orders at the **wave size of the run mode** (pro = 2, balanced = 4, powerful = 8, deep = 6), reading the mode from state.
- AC-06-001.3: WHILE the FRD has additional work orders not yet building (queued, blocked or pending dependencies), THE system SHALL render them as a single **"+N en cola"** count in the forge, NOT as sprites.

### REQ-06-002 — Per-FRD scene with a global project counter
- AC-06-002.1: THE system SHALL set the scene to the **single FRD currently in build** and SHALL display that FRD's **title** (not only its id) in the scene header / FRD tracker.
- AC-06-002.2: THE system SHALL display a **global project counter** of work orders done over total (e.g. `52 / 109 WO`) in the header, so the view conveys "FRD by FRD".
- AC-06-002.3: WHEN a sprite is hovered, THE system SHALL show a tooltip with that work order's **id and title**.

### REQ-06-003 — Linear rooms Forja → Tribunal → Bóveda
- AC-06-003.1: THE system SHALL render three rooms in a linear flow — **Sala de Forja** (left, active WOs), **Tribunal del Juez** (right, the review gate), **Bóveda** (bottom shelf, the FRD's verified trophies) — each with its label, and SHALL NOT render a 3-column kanban.
- AC-06-003.2: WHEN a work order transitions between rooms, THE system SHALL animate the move **inside / between rooms along the connecting path**, never leaving a figure stranded mid-path at rest.

### REQ-06-004 — The reviewer gate is one per FRD, three lenses
- AC-06-004.1: THE system SHALL render exactly **one `reviewer`** figure for the FRD, dimmed, WHILE not all of the FRD's work orders are `IN_REVIEW`.
- AC-06-004.2: WHEN **all** of the FRD's work orders reach `IN_REVIEW`, THE system SHALL activate the single `reviewer` (the gate opens) and SHALL indicate it reviews with **three lenses** (correctness, security, quality).
- AC-06-004.3: THE Tribunal SHALL provide at least **12 non-overlapping slots** (4×3) so up to 11 work orders of a FRD can be judged without sprites overlapping.

### REQ-06-005 — The Bóveda compacts so it never saturates
- AC-06-005.1: WHEN a work order reaches `VERIFIED`, THE system SHALL place it as a **trophy** on the Bóveda shelf for the current FRD.
- AC-06-005.2: IF the FRD's verified trophies exceed the shelf capacity (9), THEN THE system SHALL compact the overflow into a **"+N archivados"** indicator instead of rendering every trophy, so the scene scales to 100+ WO projects (the scene being per-FRD).

### REQ-06-006 — The parchment is the real Status Note hand-off
- AC-06-006.1: WHEN a work order closes and writes its `## Status Note`, THE system SHALL render a **parchment** travelling from that work order to a **dependent** work order's station (the Build Plan dependency), representing the document hand-off — asynchronous, via artifact, **not** a live chat.
- AC-06-006.2: THE system SHALL drive the parchment from a real hand-off **event** (`HandoffWritten`), and SHALL NOT depict any live peer-to-peer conversation between work orders.

### REQ-06-007 — Deep mode is a sequential relay within a work order
- AC-06-007.1: WHILE the run mode is **deep** AND a work order has a frontend, THE system SHALL render that work order as a **sequential 3-step relay** — `test-writer` (RED) → `backend-dev` → `frontend-dev` — with a 3-segment progress indicator and the currently-active sub-step highlighted, and SHALL label the relay **"Opus"**.
- AC-06-007.2: THE system SHALL render the relay steps **sequentially** (the prior step completed before the next becomes active), and SHALL NOT show the three roles working simultaneously.
- AC-06-007.3: WHEN `backend-dev` publishes the `docs/api.md` contract, THE system SHALL render a **contract hand-off** (📄) between the `backend-dev` and `frontend-dev` steps, driven by the `ContractPublished` event, with a matching feed line.
- AC-06-007.4: IF the run mode is deep AND the work order has **no** frontend, THEN THE system SHALL render it as a **single `implementer`** figure (no relay), matching the non-split modes.

### REQ-06-008 — Feeds off enriched real events, read-only, no Claude
- AC-06-008.1: THE system SHALL feed off `AgentWorking` events carrying `{role, wo, frd, phase, activity, mode}` and `SubagentStop`, read from `~/.claude/dashboard-events.ndjson` via `lib/events.ts`, **without calling Claude** (read-only).
- AC-06-008.2: WHEN an event omits the optional enriched fields (`frd`, `phase`, `activity`, `mode`), THE system SHALL still render gracefully (backward compatibility), falling back to defaults rather than throwing.

### REQ-06-009 — Read-only in production; controls are demo-only
- AC-06-009.1: IN production, THE system SHALL display the run **mode read from state** as data (no mode selector) and SHALL NOT expose any pause / reset / agent-control affordance.
- AC-06-009.2: THE mode selector and the pause / reset controls SHALL exist **only** in the prototype mockup (demo-only), driving the simulation, and SHALL NOT ship in the Mission Control view.

### REQ-06-010 — Empty state, reduced motion, multi-project color
- AC-06-010.1: IF there is no FRD currently in build (no active team / no events), THEN THE system SHALL show a graceful empty state, never a blank or crash.
- AC-06-010.2: WHEN `prefers-reduced-motion` is set, THE system SHALL disable ALL Party animation (sprites static, no RAF loop) while keeping the scene readable.
- AC-06-010.3: WHILE events from more than one project are present, THE system SHALL distinguish them with a **project-color (left border) + role-color (second border)**; events with no `project` field render with the role color only (legacy/global).

### REQ-06-011 — The bitácora (event feed)
- AC-06-011.1: THE system SHALL show a **bitácora del gremio** — a feed of the real build events (work starting, the `Status Note` hand-off, the deep contract, the gate opening), each row using the fixed bounded iconic vocabulary, the role color, and a `tabular-nums` timestamp, with **failure as a first-class state** (never hidden), auto-scroll to newest + a pin button, and an in-memory cap (≤200, drop oldest).

### REQ-06-012 — Achievement on work-order close
- AC-06-012.1: WHEN a work order closes (reaches `VERIFIED`), THE system SHALL fire an **achievement** toast ("¡Logro desbloqueado!") with the work-order id, using transform/opacity motion under 300 ms, with a reduced-motion variant that renders without animation.

## Edge cases
- A FRD with a single work order: forge shows 1 sprite, `+0 en cola`; the gate opens as soon as that one WO is `IN_REVIEW`.
- More running WOs than wave size cannot occur (the engine caps at the wave); the view must never render more sprites than the mode's wave even if the event stream is noisy/duplicated.
- Deep mode where **no** WO in the FRD has a frontend: every WO is a single `implementer`, no relays appear at all.
- A WO blocked (`BLOCKED`) mid-build: it is counted in "+N en cola" (not a forge sprite) and its failure surfaces in the feed as a first-class state.
- 100+ WO project: the global counter keeps climbing while each per-FRD scene stays small; the Bóveda compacts to "+N archivados" beyond 9.
- Events arriving out of order or with a stale/empty latest bucket: the view degrades to the empty/No-signal state rather than mis-rendering.
- A hand-off event whose dependent WO is not currently in the scene (already verified, or in a later FRD): the parchment animates to the forge edge / queue without targeting a missing sprite.
- Mode field absent from state: fall back to the default mode (`powerful`) for the wave/relay rendering without crashing.

## Out of scope (this FRD does NOT include)
- **La Campaña** (the 6-phase pipeline with the full specialist team) — that is FRD-02 (the board card detail).
- Any **fixed 4-zone** layout (library/forge/workshop/lab), the researcher/backend/frontend/testing **cast wandering** zones, **live handoffs** between specialists, or a **"researcher on demand"** — all removed (they do not reflect the engine).
- Defining the **role color tokens** themselves (owned by FRD-13) and the **events-per-minute / timeline-DAG** shared selectors (owned by FRD-12; consumed here).
- The **engine event enrichment** itself (the plugin change that emits `frd`/`phase`/`activity`/`mode`, `HandoffWritten`, `ContractPublished`) — a documented prerequisite owned by the plugin; this FRD only **consumes** those fields.
- Any **write / control** of the build: redirecting, pausing or commanding agents happens in the Claude Code app, never here (read-only invariant).
- Regenerating the reused old room art, or a dedicated `implementer` sprite (reuses `backend-dev.png`).
