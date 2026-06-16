# FRD-12 — Observability & data-viz — work orders

Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`. The selectors
(pure metrics over the event tail) are the canonical home of all derived data; Party (FRD-06),
dashboard (FRD-18) and gamification consume them. TDD first: every selector gets fixture-based
RED→GREEN tests before any UI. **Dagre is added as a dependency inside WO-12-006 only.**

See `../blueprint.md` for components (`CMP-12-*`), interfaces (`IF-12-*`) and the REQ→CMP map.

## Work orders

| WO | Title | Kind | Depends on |
|---|---|---|---|
| WO-12-001 | Top-N cap helper + freshness selector | pure logic | FRD-01 `lib/events` types |
| WO-12-002 | KPI selector (≤5, incl. failed work orders) | pure logic | FRD-01 `lib/events`+`lib/status`+`lib/portfolio` |
| WO-12-003 | Events-per-minute selector (per-agent) | pure logic | FRD-01 `lib/events` |
| WO-12-004 | Timeline selector (WO → task → action, durations) | pure logic | FRD-01 `lib/events` |
| WO-12-005 | KPI header + freshness badge (UI) | RSC/client | WO-12-001, WO-12-002, FRD-13 tokens |
| WO-12-006 | Work-order DAG (Dagre) with path-focus + jump-to-error + follow-mode | client UI + dep | FRD-05 `lib/work-orders`, FRD-13 tokens |
| WO-12-007 | Timeline view + RPG↔timeline↔DAG toggle | client UI | WO-12-004, WO-12-006 |

## Order & parallelization

- **Wave 1 (parallel, pure):** WO-12-001, WO-12-002, WO-12-003, WO-12-004. All independent
  selectors over `lib/events` fixtures.
- **Wave 2:** WO-12-005 (needs 001+002). Unblocks FRD-06 WO-06-009/010 (which consume `IF-12-rate`
  + `CMP-12-freshness`).
- **Wave 3:** WO-12-006 (needs FRD-05 `lib/work-orders`; adds Dagre).
- **Wave 4:** WO-12-007 (needs 004 + 006) — the toggle that FRD-06 WO-06-010 consumes.

Cross-feature gates: FRD-01 readers before all selectors; FRD-05 `lib/work-orders` before WO-12-006;
FRD-13 tokens before all UI WOs.
