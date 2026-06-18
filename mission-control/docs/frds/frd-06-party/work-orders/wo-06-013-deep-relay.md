---
id: WO-06-013
type: work-order
slug: deep-relay
title: WO-06-013 — Deep-mode sequential relay (test-writer → backend-dev →📄→ frontend-dev)
status: DRAFT
parent: FRD-06
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-18'
---
# WO-06-013 — Deep-mode sequential relay

**Components/Interfaces:** `CMP-06-relay` (`DeepRelay`) · **Traces:** REQ-06-007
**Deploy unit:** Party tab (Client Component) · **Location:** `app/projects/[slug]/_party/DeepRelay.tsx` (+ `.test.tsx`)

> **NEW (2026-06-18, La Fragua redesign).** In **deep** mode a work order with a frontend is built by a
> **sequential 3-role relay** (each `await`ed in order), not a single `implementer`. This WO renders that
> relay inside the WO's forge station, per the visual contract `../../../prototype/party-proposal.html`
> (the `.relay` / `.rstep` / `.rcontract` markup and the 3-segment progress). The engine sub-step
> physics are driven from `activity`; this WO is the **render** of the relay.

## Acceptance criteria (verbatim EARS)
- AC-06-007.1: WHILE the run mode is **deep** AND a work order has a frontend, THE system SHALL render that work order as a **sequential 3-step relay** — `test-writer` (RED) → `backend-dev` → `frontend-dev` — with a 3-segment progress indicator and the currently-active sub-step highlighted, and SHALL label the relay **"Opus"**.
- AC-06-007.2: THE system SHALL render the relay steps **sequentially** (the prior step completed before the next becomes active), and SHALL NOT show the three roles working simultaneously.
- AC-06-007.3: WHEN `backend-dev` publishes the `docs/api.md` contract, THE system SHALL render a **contract hand-off** (📄) between the `backend-dev` and `frontend-dev` steps, driven by the `ContractPublished` event, with a matching feed line.
- AC-06-007.4: IF the run mode is deep AND the work order has **no** frontend, THEN THE system SHALL render it as a **single `implementer`** figure (no relay), matching the non-split modes.

## Scope
- `"use client"` `DeepRelay` consuming the WO's `RelayState` (`{ step: 'test'|'backend'|'frontend', contractPublished: boolean }`) from the engine snapshot:
  - Three role sub-sprites (`test-writer` / `backend-dev` / `frontend-dev`, reused art) in a row, the active one highlighted, completed ones marked ✓ (AC-06-007.1).
  - A **3-segment progress** indicator reflecting the active step; steps advance **sequentially** — only one active at a time (AC-06-007.2).
  - The **contract** (📄) between the backend and frontend steps, shown when `contractPublished` is true (AC-06-007.3).
  - The **"Opus"** label on the relay.
- `FraguaScene` (WO-06-006) renders `<DeepRelay>` for a running WO **iff** mode is `deep` AND the WO has a frontend; otherwise the single `implementer` sprite (AC-06-007.4). The "has a frontend" flag comes from the snapshot (derived from the WO's `activity` history / Build Plan).

## Dependencies
- WO-06-002 (layout — the deep wider forge slots), WO-06-004 (engine `RelayState` / `advanceRelay`), WO-06-006 (scene host), WO-06-012 (`activity` field), FRD-13 tokens.

## TDD / Definition of done
- Component tests (jsdom + RTL): a deep WO with a frontend renders three role sub-sprites + 3-segment progress + the "Opus" label; only one step is active at a time (sequential); the 📄 appears only when `contractPublished`; a deep WO without a frontend renders a single `implementer` (no relay). RAF mocked.
- Gate green (vitest + tsc + biome).

## Status Note
_(To be written by the implementer on build. This WO is newly PLANNED for the La Fragua redesign.)_
