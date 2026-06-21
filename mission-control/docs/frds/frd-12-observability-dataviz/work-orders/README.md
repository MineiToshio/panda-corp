# FRD-12 — Observability & data-viz — work orders

Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`. The selectors
(pure metrics over the event tail) are the canonical home of all derived data; Party (FRD-06),
dashboard (FRD-18) and gamification consume them. TDD first: every selector gets fixture-based
RED→GREEN tests before any UI. **Dagre is added as a dependency inside WO-12-006 only.**

See `../blueprint.md` for components (`CMP-12-*`), interfaces (`IF-12-*`) and the REQ→CMP map.

## Work orders

| WO | Title | Status | Kind | Depends on |
|---|---|---|---|---|
| WO-12-001 | Top-N cap helper + freshness selector | VERIFIED | pure logic | FRD-01 `lib/events` types |
| WO-12-002 | KPI selector (≤5, incl. failed work orders) | VERIFIED | pure logic | FRD-01 `lib/events`+`lib/status`+`lib/portfolio` |
| WO-12-003 | Events-per-minute selector (per-agent) | VERIFIED | pure logic | FRD-01 `lib/events` |
| WO-12-004 | Timeline selector (WO → task → action, durations) | VERIFIED | pure logic | FRD-01 `lib/events` |
| WO-12-005 | Observabilidad tab + Timeline view (live, re-paint) | **PLANNED** (reopened — gate REJECT) | client UI | WO-12-004, WO-12-006, FRD-13, FRD-04, FRD-01 (live) |
| WO-12-006 | Work-order DAG view (Dagre, live, re-paint) | IN_REVIEW | client UI | `dag.ts`+`dagre` (VERIFIED), FRD-13, FRD-04, FRD-01 (live) |

## Gate review 2026-06-20 (FRD-12 — REJECTED)

Reviewer (opus) FRD gate over WO-12-005 + WO-12-006. **WO-12-005 reopened to PLANNED**; WO-12-006
left IN_REVIEW (the shared gate failed inside WO-12-005's file before WO-12-006 could be independently
validated — re-gated on the next run, not reopened). Blocking findings, all in WO-12-005:

1. **RED — knip dead-code (hard gate).** `GanttTask` is an exported interface that nothing imports
   (`src/app/projects/[slug]/_observability/TimelineView/TimelineView.tsx:30`). `pnpm knip` exits 1, so
   `verify.sh --since d18c825` fails at the dead-code step (before tests/smoke/visual). The "tests pass"
   claim was false (generator ≠ verifier). Fix: drop the `export` (it's only used inline inside
   `GanttWorkOrder.tasks`) or actually consume the named type.
2. **DR-062 / DR-057 — bespoke toggle + hand-rolled panels instead of the shared primitives.**
   `ObservabilidadTab.tsx` hand-rolls the Línea-de-tiempo↔DAG toggle as inline-styled `<button>`s in a
   raw `role="tablist"` `<div>` (L263–296), and frames everything in raw `<div>` strips with inline
   styles (L223–311) — when the WO, the blueprint and `docs/design/components.md` (L42, L207) all mandate
   the ONE `Tabs`/`SubTabs` pattern, the `Panel` primitive and `SectionHead`. The sibling `TabBar`
   (`_components/tabbar.tsx`) correctly delegates to `SubTabs`; this surface diverges → the exact
   bespoke-switcher defect this gate rejects. The inventory was pre-marked "real (WO-12-005)" but the code
   does NOT consume the primitives it claims. Fix: build the toggle from `SubTabs` (testIdPrefix to keep
   `tab-timeline`/`tab-dag` ids), wrap the strip in `Panel` + `SectionHead`, drop the inline-styled divs.

Non-blocking (fix while reopening): WO-12-006 `WoDag.tsx` is 685 lines, over the ~500 hard limit
(`clean-code.md`) — split it before its own gate.

## Phase 2 re-plan (presentational)

The **pure selector layer is VERIFIED and untouched** — `topn`/`freshness` (WO-12-001), `kpis`
(WO-12-002), `rate` (WO-12-003), `timeline` (WO-12-004) — and so are the pure `dag.ts` module
(`toDag`/`dagChain`/`firstError`) and the `dagre` dependency. The gap was the **project Observabilidad
tab** presentation. The former UI work orders (the old KPI-header WO-12-005, the DAG component WO-12-006,
the toggle WO-12-007) are **collapsed into two coarse WOs** that re-paint the project tab to the approved
prototype, on the FRD-13 foundation and **live off `useLiveSnapshot`** (WO-01-009, event-driven):

- **WO-12-005** — `ObservabilidadTab` (sibling of Party; local `SectionHead` + the **Línea de tiempo ↔
  DAG** `Tabs` toggle over the same WOs) + `TimelineView` (Gantt-style duration bars + jump-to-first-
  error).
- **WO-12-006** — `WoDag` (Dagre dependency graph; chain-highlight, jump-to-first-error,
  follow-active-step).

The global dashboard **KpiHeader** / **FreshnessBadge** (`src/app/_observability/…`, an FRD-18 dashboard
surface) remain **real/VERIFIED** and are NOT re-planned here; the legacy `RpgTimelineToggle` is
superseded by the `ObservabilidadTab` 2-view toggle.

## Order & parallelization

- WO-12-001/002/003/004 (selectors) + `dag.ts`/`dagre` are already VERIFIED — never rebuilt.
- **WO-12-005** (tab shell + timeline) hosts **WO-12-006** (`WoDag`) as its DAG lens; WO-12-006 can be
  built in parallel and mounted into the toggle.
- Across FRDs both are **disjoint** from FRD-05 (`_components/{wo-*}/**`) and FRD-06 (`_party/**`): their
  artifacts live only under `src/app/projects/[slug]/_observability/{ObservabilidadTab,TimelineView,WoDag}/**`,
  so the three workspace tabs re-paint in parallel with no file collision.

Cross-feature gates: FRD-13 tokens + WO-01-009 (`useLiveSnapshot`) before both UI WOs; the VERIFIED
selectors + `dag.ts`/`dagre` are consumed, not rebuilt.
