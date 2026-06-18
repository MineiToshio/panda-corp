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

See `../blueprint.md` for components (`CMP-06-*`), interfaces (`IF-06-*`) and the REQ→CMP map.

## Work orders

| WO | Title | Status | Kind | Depends on |
|---|---|---|---|---|
| WO-06-012 | `lib/events.ts` consumes the enriched fields (frd/phase/activity/mode + hand-off/contract) | **PLANNED** (new) | data layer | FRD-01 `lib/events` |
| WO-06-001 | Iconic event vocabulary + view-model mapper (enriched, role-keyed, hand-off/contract/gate) | **PLANNED** (reopened) | pure logic | WO-06-012 |
| WO-06-002 | La Fragua layout (rooms + forge/tribunal/vault slots) | **PLANNED** (reopened) | pure logic | FRD-11 mode enum, FRD-13 token keys |
| WO-06-003 | Event → visual-action map (La Fragua decoupling boundary) | **PLANNED** (reopened) | pure logic | WO-06-001, WO-06-012 |
| WO-06-004 | La Fragua engine (RAF loop, wave cap, rooms, parchment, gate) | **PLANNED** (reopened) | client logic | WO-06-002, WO-06-003 |
| WO-06-005 | La Fragua tab + `FraguaSnapshot` (RSC, read-only) | **PLANNED** (reopened) | RSC | WO-06-001/002/006/007/008, WO-06-012 |
| WO-06-006 | La Fragua scene (rooms, WO sprites, +N en cola, gate, trophies, tracker) | **PLANNED** (reopened) | client UI | WO-06-004, WO-06-005, WO-06-002, WO-06-013, FRD-13 |
| WO-06-007 | Bitácora (event feed + Live/No-signal badge) | **PLANNED** (reopened) | client UI | WO-06-001, FRD-13 |
| WO-06-008 | Achievement toast (work-order-close celebration) | IN_REVIEW (kept) | client UI | WO-06-001 |
| WO-06-013 | Deep-mode sequential relay (`test-writer → backend-dev →📄→ frontend-dev`) | **PLANNED** (new) | client UI | WO-06-002/004/006/012, FRD-13 |
| WO-06-011 | Empty state + reduced-motion + multi-project borders | **PLANNED** (reopened) | UI + a11y | WO-06-006, WO-06-007, FRD-13 |
| WO-06-009 | ~~Activity pulse~~ — **DESCOPED** (REQ-06-015 removed) | PLANNED (descoped) | — | — |
| WO-06-010 | ~~RPG↔timeline toggle~~ — **DESCOPED** (REQ-06-016 removed; Live/No-signal folded into WO-06-007) | PLANNED (descoped) | — | — |

## Order & parallelization

- **Wave 1 (parallel, no UI):** WO-06-012 (`lib/events` fields), WO-06-002 (layout). Pure, fixtures only.
- **Wave 2:** WO-06-001 (needs 012), WO-06-003 (needs 001+012), then WO-06-004 (needs 002+003).
- **Wave 3:** WO-06-005 (snapshot/tab, needs 001/002/012) can start once the pure modules exist; WO-06-007 (feed) parallel.
- **Wave 4 (UI):** WO-06-006 (scene) needs 004+005+002; WO-06-013 (deep relay) needs 002/004/006/012; WO-06-008 (toast) parallel (kept, only a REQ remap).
- **Wave 5:** WO-06-011 (empty/reduced-motion/multi-project), last because it touches the rendered scene + feed.

**Descoped:** WO-06-009 (activity pulse) and WO-06-010 (RPG↔timeline toggle) are removed from FRD-06's
acceptance set (their REQs are gone). Their shipped components are not mounted by the faithful `PartyTab`;
remove them from the Party feature (or relocate to FRD-12 if observability still wants them — owner
decision). The **Live / No-signal** badge survives, folded into the bitácora (WO-06-007).

Critical cross-feature gates: WO-06-012 before WO-06-001/003/005/013; FRD-13 tokens before all UI WOs.
The **plugin** must emit the enriched fields for *real* (non-demo) data — a documented prerequisite, not
a code dependency of these WOs (they tolerate the fields' absence).
