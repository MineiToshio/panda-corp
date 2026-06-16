# FRD-06 — Party — work orders

Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`. Each WO targets
exactly one deploy unit (a tab of the project workspace) and is testable in isolation. TDD first:
pure logic (engine, mappers, roster, positions) gets RED→GREEN tests with fixtures before any UI;
interactive pieces (feed, toast) get component tests.

See `../blueprint.md` for components (`CMP-06-*`), interfaces (`IF-06-*`) and the REQ→CMP map.

## Work orders

| WO | Title | Kind | Depends on |
|---|---|---|---|
| WO-06-001 | Iconic event vocabulary + event view-model mapper | pure logic | FRD-01 `lib/events` types |
| WO-06-002 | Roster + station positions (pure layout) | pure logic | FRD-11 mode enum, FRD-01 `lib/status` |
| WO-06-003 | Event → visual-state map (the decoupling boundary) | pure logic | WO-06-001 |
| WO-06-004 | Party engine (RAF loop + animation queue) | client logic | WO-06-002, WO-06-003 |
| WO-06-005 | Party tab server snapshot (RSC) | RSC | WO-06-001..003, FRD-01 `lib/events`+`lib/tasks` |
| WO-06-006 | Party scene render (zones, stations, sprites) | client UI | WO-06-004, WO-06-005, FRD-13 tokens |
| WO-06-007 | Event feed (vocabulary, failure-first, auto-scroll + pin, cap) | client UI | WO-06-001, FRD-13 tokens |
| WO-06-008 | Achievement toast (work-order-close celebration) | client UI | WO-06-001, FRD-13 motion tokens |
| WO-06-009 | Activity pulse (per-agent bars) | client UI | FRD-12 `IF-12-rate`, FRD-13 tokens |
| WO-06-010 | RPG ↔ timeline/DAG toggle + Live/No-signal badge | client UI | FRD-12 `CMP-12-toggle`+`CMP-12-freshness`, WO-06-006 |
| WO-06-011 | Empty state + reduced-motion + multi-project borders | UI + a11y | WO-06-006, WO-06-007, FRD-13 |

## Order & parallelization

- **Wave 1 (parallel, no UI):** WO-06-001, WO-06-002. Pure functions, fixtures only.
- **Wave 2:** WO-06-003 (needs 001), then WO-06-004 (needs 002+003). WO-06-005 can start in
  parallel with 003/004 once `lib/events`+`lib/tasks` exist.
- **Wave 3 (parallel UI):** WO-06-006, WO-06-007, WO-06-008 — each independent given waves 1–2 and
  FRD-13 tokens.
- **Wave 4 (need FRD-12):** WO-06-009, WO-06-010.
- **Wave 5:** WO-06-011 (polish: empty/reduced-motion/multi-project), last because it touches the
  rendered scene + feed.

Critical cross-feature gates: FRD-01 (`lib/events`,`lib/tasks`) before WO-06-005; FRD-13 tokens
before all UI WOs; FRD-12 selectors before WO-06-009/010.
