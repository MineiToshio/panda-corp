# FRD-06 — Party · La Fragua — work orders

Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`. Each WO targets exactly
one deploy unit (a tab of the project workspace, or a pure module) and is testable in isolation. TDD
first: pure logic (snapshot, mappers, layout, engine) gets RED→GREEN tests with fixtures before any UI;
interactive pieces (scene, feed, relay, toast) get component tests.

> **La Fragua redesign (2026-06-18).** FRD-06 was rewritten from the fictitious 4-zone cast to the
> faithful **La Fragua** build view (one sprite per running `implementer` WO, wave = mode, rooms
> Forja → Tribunal → Bóveda, one reviewer gate per FRD, the parchment = the real `Status Note`, deep =
> a sequential relay). Most WOs were **reopened (PLANNED)** to rebuild against the new model; the still-
> correct infra was re-pointed. Visual contract: `../../../prototype/party-proposal.html`.

> **Compliance reorg (2026-06-18) — paths.** The repo was migrated to the engineering rules
> (`docs/rules/`): components now live under `components/core/`, `components/modules/`, or a route's
> `_components/`; every tested module is a folder `Name/Name.tsx` with tests in `_tests/`; `src/lib/` is
> grouped by domain (`lib/<name>/<name>.ts`); the `_party/` modules are folderized (`PartyScene/PartyScene.tsx`,
> `engine/engine.ts`, `event-vm/event-vm.ts`, `state-map/state-map.ts`, `PartyTab/PartyTab.tsx`,
> `EventFeed/EventFeed.tsx`, `PartyEmptyState/PartyEmptyState.tsx`). **Older WO prose may cite pre-reorg
> paths (e.g. `_party/PartyScene.tsx`, `_party/FraguaScene.tsx`) — the canonical location is the current
> on-disk path; locate files by name, and create NEW files following these conventions.** `verify.sh` now
> enforces a structure-guard (no loose tests), `max-lines` (≤500) and a circular-dependency gate (madge).

See `../blueprint.md` for components (`CMP-06-*`), interfaces (`IF-06-*`) and the REQ→CMP map.

## Work orders

| WO | Title | Status | Kind | Depends on |
|---|---|---|---|---|
| WO-06-012 | `lib/events.ts` consumes the enriched fields (frd/phase/activity/mode + hand-off/contract) | VERIFIED | data layer | WO-01-007 |
| WO-06-001 | Iconic event vocabulary + view-model mapper (enriched, role-keyed, hand-off/contract/gate) | VERIFIED | pure logic | WO-06-012 |
| WO-06-002 | La Fragua layout (rooms + forge/tribunal/vault slots) | VERIFIED | pure logic | WO-11-001, WO-13-001 |
| WO-06-003 | Event → visual-action map (La Fragua decoupling boundary) | VERIFIED | pure logic | WO-06-001, WO-06-012 |
| WO-06-004 | La Fragua engine (RAF loop, wave cap, rooms, parchment, gate) | VERIFIED | client logic | WO-06-002, WO-06-003 |
| WO-06-005 | `toFraguaSnapshot` (RSC snapshot, read-only) | VERIFIED | pure logic | WO-06-001, WO-06-002, WO-06-003, WO-06-012, WO-01-007, WO-11-001 |
| WO-06-006 | **Party foundation (FND-4)** — pixel-RPG canvas primitives | VERIFIED (delivered by WO-13-009) | client UI | WO-06-001/002/003/004/005, FRD-13, FRD-01 (live) |
| WO-06-007 | La Fragua scene re-paint (FraguaScene + PartyScene/PartyTab shell) | VERIFIED | client UI | WO-06-005, WO-06-004, WO-06-002, WO-06-001, WO-06-003, WO-01-009, WO-13-006, WO-13-007, WO-13-008, WO-13-009, WO-04-004, WO-11-001 |

## Phase 2 re-plan (presentational)

The whole **pure / logic layer is VERIFIED and untouched** — `lib/events` (WO-06-012), `event-vm`
(WO-06-001), `layout` (WO-06-002), `state-map` (WO-06-003), `engine` (WO-06-004) and the `toFraguaSnapshot`
snapshot (WO-06-005). The gap was the **canvas presentation**. The former UI work orders (the old scene
WO-06-006, the feed WO-06-007, the toast WO-06-008, the empty/reduced-motion WO-06-011 and the deep relay
WO-06-013) are **collapsed into two coarse WOs**:

- **WO-06-006 — Party foundation (FND-4, `foundation:true`)** — the pixel-RPG canvas primitives
  (`Room`, `StoneBridge`, `FlowStrip`, `AgentSprite`, `JudgeSprite`, `SpeechBubble`, `Tooltip`,
  `Parchment`, `MissionBar`, `DemoControls`, `PowerOffOverlay`) that the scene reuses (DR-057).
- **WO-06-007 — La Fragua scene re-paint** — `FraguaScene` + the `PartyScene`/`PartyTab` shell, composed
  from the FND-4 primitives, faithful to `mocks/la-fragua.html`, **live off `useLiveSnapshot`**
  (WO-01-009). The existing **real** `EventFeed`, `AchievementToast` and `DeepRelay` are **REUSED**, not
  recreated.

WO-06-009 (activity pulse) and WO-06-010 (RPG↔timeline toggle) remain **descoped** (their REQs are gone;
the Live/No-signal badge lives in the reused `EventFeed`).

## Order & parallelization

- WO-06-012/001/002/003/004/005 (the pure/logic layer) are already VERIFIED — never rebuilt.
- **WO-06-006** (Party foundation) is the foundation wave: it forges the canvas primitives first.
- **WO-06-007** (scene re-paint) depends on WO-06-006 (it composes those primitives) and reuses the
  real `EventFeed`/`AchievementToast`/`DeepRelay`.
- Across FRDs these two WOs are **disjoint** from FRD-05 (`_components/{wo-*}/**`) and FRD-12
  (`_observability/**`): they live only under `src/app/projects/[slug]/_party/**`, so the three workspace
  tabs re-paint in parallel with no file collision.

Critical cross-feature gates: FRD-13 tokens + WO-01-009 (`useLiveSnapshot`) before both UI WOs. The
**plugin** must emit the enriched fields for *real* (non-demo) data — a documented prerequisite, not a
code dependency (the views tolerate the fields' absence).
