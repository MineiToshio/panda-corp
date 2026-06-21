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
| WO-12-005 | Observabilidad tab + Timeline view (live, re-paint) | VERIFIED | client UI | WO-12-004, WO-12-006, FRD-13, FRD-04, FRD-01 (live) |
| WO-12-006 | Work-order DAG view (Dagre, live, re-paint) | VERIFIED | client UI | `dag.ts`+`dagre` (VERIFIED), FRD-13, FRD-04, FRD-01 (live) |

## Gate review 2026-06-21 (FRD-12 — PASS, DR-072 split gate)

Reviewer (opus) FRD gate over WO-12-005 + WO-12-006, exercised TOGETHER (real integration —
the existing ObservabilidadTab suite stubs WoDag; this gate mounts the REAL Dagre graph).
**Both WOs → VERIFIED** (reopen_count 0). The FRD rollup recomputes to VERIFIED (all six WOs
VERIFIED) → frd.md + blueprint.md flipped to VERIFIED.

The two prior blocking findings are RESOLVED:
1. knip dead-code (`GanttTask` exported but unused) — fixed (commit c84d102: dropped the `export`).
   FRD-12 files are knip-clean. (The global `verify.sh --since` still exits 1 at knip on the
   NON-FRD-12 `WoProgress` dead export in `src/app/(dashboard)/_lib/card.ts:63`, FRD-18 area,
   dead since before last green — tracked, NOT an FRD-12 regression. `last_green_sha` stays pending.)
2. DR-057/DR-062 bespoke toggle — fixed: the Línea-de-tiempo↔DAG switcher now uses the shared
   `SubTabs` primitive (one `role=tablist`, two tabs); no forked switcher. Confirmed by grep
   (the only `role="tablist"` in `_observability/` is in the reviewer test's querySelector) and
   by the adversarial gate test.

CORRECTION lenses all green:
- AC-12-002.1/.2/.3 — Observabilidad sibling of Party; exactly the 2-view toggle (no RPG view).
- AC-12-003.1/.2 — timeline WO→task nested duration bars + jump-to-first-error (live 30m bar
  derived from event timestamps proves the `deriveGanttOrders → toTimeline` live seam runs).
- AC-12-004.1/.2/.3/.4 — Dagre layout, chain-highlight+dim, jump-to-error, follow-active; real
  edges (WO-B→WO-A, WO-B→WO-C) render as paths; mutation-confirmed.
- AC-12-005.1/.2 — live event-driven via `useLiveSnapshot`; null/empty snapshot = no fabricated
  progress (a todo WO keeps its todo icon).
- Cross-view consistency — the same failed WO is the first error in BOTH lenses over one dataset.

Adversarial + mutation (DR-015/016): `src/app/projects/[slug]/_observability/_tests/frd-12-gate-opus.reviewer.test.tsx`
(11 green, WoDag NOT mocked). Mutation-confirmed: forcing the static fallback → live-duration
test RED; jump-error→null → cross-view test RED; live fail→done mapping → fail-bar test RED.
FRD-12 vitest 69 green (58 impl + 11 adversarial). biome/tsc on FRD-12 clean; global tsc 0 errors.

Runtime/visual (DR-055/072): the Observabilidad surface lives in the `/projects/[slug]` workspace
route which 404s LIVE (FRD-03/04 portfolio slug+phase data bug — on the punch-list, NOT FRD-12),
so the smoke ran on the preview route `/preview-wo12005` (mounts the real ObservabilidadTab +
TimelineView + DAG). PRODUCTION build clean; headless browser at 2 viewports → HTTP 200,
0 console/pageerror/failedReq; timeline renders 5 WO duration bars + first-error note + axis;
toggling DAG renders the real Dagre SVG with 5 nodes. Recognizably the designed surface — NO
gross structural mismatch. Blessed smoke (inicio/tablero/logros) + visual Layer A still green
(no regression). `workspace` stays `blessed:false` until FRD-03/04 fix the 404.

Visual/quality nits → `.pandacorp/comms/visual-punch-list.md` (advisory, do NOT block, DR-072):
header/body framed with inline `<div>` instead of shared `Panel`/`SectionHead` (the duplicate-
primitive part — the forked toggle — is already fixed, so this is a skin/reuse nit, not a new
duplicate); WoDag.tsx 685 lines (over ~500, NOT enforced by verify.sh); px arbitrary values;
preview `SAMPLE_ORDERS` lacks `dependsOn` so the DAG preview shows no edges (real edges proven in
tests); temp preview route still committed.

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
