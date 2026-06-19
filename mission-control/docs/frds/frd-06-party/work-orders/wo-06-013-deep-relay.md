---
id: WO-06-013
type: work-order
slug: deep-relay
title: WO-06-013 — Deep-mode sequential relay (test-writer → backend-dev →📄→ frontend-dev)
status: DRAFT
parent: FRD-06
implementation_status: VERIFIED
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

**Built (repair pass, 2026-06-18):** `DeepRelay` (`CMP-06-relay`) — the deep-mode sequential
relay render, plus its host wiring inside `FraguaScene` (`CMP-06-scene`).

**Files delivered:**
- `app/projects/[slug]/_party/DeepRelay/DeepRelay.tsx` — `"use client"` pure render component
  (driven by props; no RAF, no engine mount, no I/O). Observation-only (AC-06-009.1): no control
  affordance. Zero hardcoded colors — role colors via `roleColor(role)` (IF-06-role-color) CSS token
  vars only.
- `app/projects/[slug]/_party/DeepRelay/_tests/DeepRelay.test.tsx` — 13 tests RED→GREEN across the
  four ACs + observation-only + no-hardcoded-color guards.
- `app/projects/[slug]/_party/FraguaScene/_tests/FraguaScene.deeprelay.test.tsx` — 3 host-integration
  tests (deep+frontend → relay; deep+no-frontend → single implementer; non-deep → chip).
- Edited `FraguaScene.tsx` to render `<DeepRelay>` for each running WO when `snapshot.mode === "deep"`
  (chip otherwise), passing `hasFrontend = relay !== undefined`.

**Interfaces/contracts exposed:**
```ts
export interface DeepRelayProps {
  wo: string;            // work-order id (e.g. "WO-06-013")
  relay: RelayState;     // { step: "test"|"backend"|"frontend"; contractPublished: boolean }
  hasFrontend: boolean;  // false → single implementer figure, no relay (AC-06-007.4)
}
export function DeepRelay(props: DeepRelayProps): React.JSX.Element
```

**Acceptance coverage:**
- AC-06-007.1 — three role sub-steps (`test-writer → backend-dev → frontend-dev`) + 3-segment
  progress + "Opus" label + active sub-step highlighted (`data-active`).
- AC-06-007.2 — sequential: exactly one `data-active="true"` at a time; prior steps `data-done="true"`;
  progress segments fill up to and including the active step (`data-filled`).
- AC-06-007.3 — contract hand-off (📄, `relay-contract`) between the backend and frontend steps, shown
  only when `relay.contractPublished` is true (driven by the `ContractPublished` event via the snapshot).
- AC-06-007.4 — `hasFrontend=false` → single `implementer` figure (`deep-relay-single-{wo}`,
  `data-role="implementer"`), no relay.

**Integration seams:**
- `FraguaScene` is the relay host (blueprint: `CMP-06-relay` "used by the scene"). It renders
  `<DeepRelay>` per running WO iff `mode === "deep"`. The `RelayState` reaches the component via the
  `FraguaSnapshot.running[].relay` field (engine `advanceRelay`/`publishContract` already populate the
  engine sprite; the snapshot relay-derivation from live engine state is the remaining seam owned by the
  full RAF scene, WO-06-006). `hasFrontend` is derived from the presence of `relay` on the running WO.
- `data-testid`s: `deep-relay-{wo}`, `deep-relay-single-{wo}`, `relay-label`, `relay-step-{role}`
  (`data-active`/`data-done`/`data-role`), `relay-progress-segment-{step}` (`data-filled`),
  `relay-contract`.

**Test files covering this WO:**
- `app/projects/[slug]/_party/DeepRelay/_tests/DeepRelay.test.tsx` (13)
- `app/projects/[slug]/_party/FraguaScene/_tests/FraguaScene.deeprelay.test.tsx` (3)

**Gate:** `bash .pandacorp/verify.sh` green — 212 test files, 5457 passed + 2 expected-fail + 5 skipped;
`tsc --noEmit` clean; `biome check` 0 errors (pre-existing complexity warnings only).
