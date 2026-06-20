---
id: WO-06-007
type: work-order
slug: fragua-scene
title: 'WO-06-007 — La Fragua scene re-paint (FraguaScene + PartyScene/PartyTab shell)'
status: DRAFT
parent: FRD-06
implementation_status: PLANNED
artifacts:
  - 'src/app/projects/[slug]/_party/FraguaScene/**'
  - 'src/app/projects/[slug]/_party/PartyScene/**'
  - 'src/app/projects/[slug]/_party/PartyTab/**'
source_requirements: [REQ-06-001, REQ-06-002, REQ-06-003, REQ-06-004, REQ-06-005, REQ-06-006, REQ-06-007, REQ-06-008, REQ-06-009, REQ-06-010, REQ-06-011, REQ-06-012, REQ-06-013]
last_updated: '2026-06-19'
---
# WO-06-007 — La Fragua scene re-paint (FraguaScene + PartyScene/PartyTab shell)

The scene re-paint: it composes the FND-4 Party primitives (WO-06-006) into the faithful **La Fragua**
living map and the Party tab shell, **live off the real event stream** via `useLiveSnapshot` (WO-01-009)
— the scene is derived from the snapshot, **not** polling. The pure modules (`layout`/`engine`/
`state-map`/`event-vm`/`fragua-snapshot`) are **VERIFIED and out of scope** (consume them). The existing
**real** `EventFeed`, `AchievementToast` and `DeepRelay` are **REUSED, not recreated**.

## Goal

Render the La Fragua tab exactly as `mocks/la-fragua.html` renders it: the bounded stage with the three
rooms (Forja → Tribunal → Bóveda) joined by stone bridges, one sprite per running WO (≤ wave) + the
"+N en cola" badge, the single reviewer gate, the trophy shelf with "+N archivados", the parchment
hand-off, the deep relay, the always-visible flow strip lighting the active beat, the mission bar
(effort as read-only data), the bitácora and the derived factory-off state — all driven by the live
snapshot.

## Scope

- **`FraguaScene`** (`"use client"`) — the living map: mounts the VERIFIED `createFraguaEngine`
  (WO-06-004), binds the RAF loop (`runId` self-stop, tab-hidden pause), and renders, composed from the
  FND-4 primitives (WO-06-006): the three `Room`s + `StoneBridge`s; one `AgentSprite` per running WO
  (≤ wave) with hover `Tooltip` (id+title); the **"+N en cola"** badge; the `JudgeSprite` gate
  (dim→active when all WOs `IN_REVIEW`, the four lenses + visual judge); the trophy shelf +
  "+N archivados"; the `Parchment`; the `FlowStrip` lit on the active beat; the FRD tracker + global
  counter. Deep-mode WOs with a frontend delegate to the existing **`DeepRelay`** (REUSE);
  `src/app/projects/[slug]/_party/FraguaScene/**`.
- **`PartyScene`** — the scene shell that frames the stage with `MissionBar`, the `FlowStrip`, the
  `DemoControls` (SOLO DEMO) block and the scene title above, and the bitácora below; wires the
  `PowerOffOverlay` from the derived factory-off state. `src/app/projects/[slug]/_party/PartyScene/**`.
- **`PartyTab`** (RSC shell) — the read-only tab entry: subscribes to the Party slice of
  **`useLiveSnapshot`** (WO-01-009, SSE) so the scene re-derives live; passes the `FraguaSnapshot`
  (VERIFIED `toFraguaSnapshot`, WO-06-005) + the mapped feed (`toEventVM`) to `PartyScene`; renders the
  existing **`EventFeed`** + **`AchievementToast`** (REUSE); `active=false` → the factory-off / empty
  treatment. **No** mode selector, **no** pause/reset (read-only, DR-061). No `fs` reaches the client.
  `src/app/projects/[slug]/_party/PartyTab/**`.
- **Live**: the scene is derived from the real event stream via `useLiveSnapshot` — event-driven, **not**
  polling.
- **Out of scope:** the FND-4 primitives (WO-06-006); the pure modules (WO-06-001/002/003/004/005 —
  VERIFIED); the SSE transport / `useLiveSnapshot` (WO-01-009); `EventFeed`/`AchievementToast`/
  `DeepRelay` internals (REUSE the real components); the FRD-04 Tabbar.

## Acceptance criteria

- **AC-06-001/002/003** Three rooms in linear flow (not a kanban) with labels + counts; one sprite per
  running WO ≤ wave; "+N en cola" for the rest; the FRD title + global `done/total` counter; hover
  tooltip = WO id+title.
- **AC-06-004** Exactly one reviewer per FRD, dim until all WOs `IN_REVIEW`, then active with the four
  lenses + the visual judge; ≥12 non-overlapping tribunal slots.
- **AC-06-005** `VERIFIED` WOs become trophies on the per-FRD Bóveda shelf; >9 compact to
  "+N archivados".
- **AC-06-006** The parchment travels from a closed WO to its dependent WO's station on `HandoffWritten`
  (artifact hand-off, never live chat).
- **AC-06-007** Deep-mode WO with a frontend renders the sequential `DeepRelay` (Opus); no-frontend deep
  WO renders a single `implementer`.
- **AC-06-010** The flow strip is always visible and lights the active beat(s) from real state; beats
  have hover tooltips.
- **AC-06-008 (live)** Feeds off the enriched real event stream via `useLiveSnapshot`, read-only, no
  Claude; tolerant of missing optional fields; updates LIVE with no reload.
- **AC-06-009/012 (read-only, DR-061)** No mode selector and no pause/reset/agent-control in production;
  the effort is shown as read-only data in the `MissionBar`; demo controls only inside `DemoControls`.
- **AC-06-013** Factory-off is derived from real state, never a control; never a blank screen or crash;
  resaturates automatically when events resume.
- **AC-06-014** Reduced motion disables ALL Party animation (no RAF loop) while staying readable;
  multi-project rows carry the project-color + role-color borders.
- **Fidelity** Matches `mocks/la-fragua.html` (in-loop visual-fidelity gate), composed from the FND-4
  primitives; tokens only; reuses the existing `EventFeed`/`AchievementToast`/`DeepRelay`.

## Dependencies

- **Foundation (intra):** WO-06-006 (the FND-4 Party-canvas primitives).
- **VERIFIED (consume):** WO-06-002 (`layout`), WO-06-001 (`event-vm`), WO-06-003 (`state-map`),
  WO-06-004 (`engine`), WO-06-005 (`fragua-snapshot` + the `PartyTab` snapshot contract), WO-06-012
  (`lib/events` enriched fields).
- **REUSE (real, do not recreate):** `EventFeed`, `AchievementToast`, `DeepRelay`.
- **Foundation (FRD-13):** WO-13-006/007/008 + the per-role color & motion tokens.
- **Live (FRD-01):** WO-01-009 (`useLiveSnapshot` + SSE transport — `foundation:true`).
- **Cross-FRD:** `frd-13` (foundation primitives + tokens), `frd-04` (the workspace Tabbar this mounts
  into), `frd-01` (live — `useLiveSnapshot`).

## Visual reference

`docs/frds/frd-06-party/mocks/la-fragua.html` (visual source `docs/design/prototype/party-proposal.html`,
embedded in `prototype/index.html`). See `../fdd.md` §1–§9. Fidelity, not novelty.
