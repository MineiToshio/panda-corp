---
id: FRD-12-blueprint
type: blueprint
parent: FRD-12
status: ACTIVE
implementation_status: PLANNED
last_updated: '2026-06-17'
---
# FRD-12 — Observability and data visualization — feature blueprint

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **feature blueprint** for FRD-12, built on top of the platform architecture
> (`../../product/architecture.md`). Read §5 (the event contract — this feature owns the *honest*
> read of it), §6 (`lib/events`), §4.7 (`~/.claude/dashboard-events.ndjson`) and §11 (header KPIs
> + RPG↔timeline/DAG surface). It does not restate the stack or the data model.

## 0. Requirement IDs (assigned here)

| ID | Requirement (EARS, abridged) |
|---|---|
| REQ-12-001 | Header shows ≤5 critical KPIs (active projects, agents working, XP of day, builds queued, **failed work orders**); detail in collapsible sections. |
| REQ-12-002 | Live / No-signal indicator with the timestamp of the last event (data freshness). |
| REQ-12-003 | Inside a project: RPG ↔ timeline/tree toggle over the same data (work orders → tasks → actions, with duration + parent-child). |
| REQ-12-004 | Any grouping/ranking limited to **top-5**. |
| REQ-12-005 | If the work-order DAG is drawn, pointing at a node highlights only its dependency chain (upstream/downstream) and dims the rest; offers "jump to first error" + follow-mode that centers the executing step. |
| REQ-12-006 | The graph render uses **Dagre** (~39KB), NOT ELK.js (unless real orthogonal-routing need). |
| REQ-12-007 | Honest metrics (done vs failed, time per work order, events per minute) derived from the same event file, no extra instrumentation. |

## 1. Architecture fit

FRD-12 is the **honest data layer over the events**: a set of **pure selectors** over the capped
event tail (read by `lib/events`, §6) plus a small set of UI components (header KPIs, freshness
badge, the timeline/DAG view). The selectors are the canonical home of all derived metrics — Party
(FRD-06), the dashboard (FRD-18) and gamification (FRD-09/10) consume them, so the derivation lives
**once** here.

- **Selectors:** pure functions `(events) → metric`, TDD'd with fixtures. They live in the feature
  folder (`app/_observability/` shared, or a colocated `_metrics/`), NOT in `lib/` — they are
  derivations over `lib/events` output, not a new data source.
- **KPIs / freshness:** Server Components (read on the server via `lib/events` + `lib/status` +
  `lib/portfolio`).
- **Timeline:** a Server Component (pure layout from event durations).
- **DAG:** a Client Component — Dagre computes layout, interaction (hover path-focus, follow-mode)
  needs the client. **Dagre is introduced as a dependency in WO-12-006 only**, not globally.

## 2. Components (`CMP-12-*`) and interfaces (`IF-12-*`)

| ID | Kind | Name | Responsibility | Uses | Traces |
|---|---|---|---|---|---|
| IF-12-kpis | interface | `deriveKpis(events, projects) → Kpi[]` | Pure: the ≤5 KPIs incl. failed-work-orders. | `lib/events`, `lib/status` types | REQ-12-001 |
| IF-12-freshness | interface | `freshness(events, now) → { lastAt, live }` | Pure: last-event timestamp + live/stale flag (threshold constant). | `lib/events` | REQ-12-002 |
| IF-12-rate | interface | `eventsPerMinute(events, window) → Bucket[]` | Pure: events-per-minute buckets, optionally per agent. **Consumed by FRD-06 pulse + FRD-18.** | `lib/events` | REQ-12-007 |
| IF-12-timeline | interface | `toTimeline(events) → TimelineRow[]` | Pure: events → work-order → task → action rows with duration + parent-child. | `lib/events` | REQ-12-003 |
| IF-12-dag | interface | `toDag(workOrders) → { nodes, edges }` + `dagChain(id) → {up,down}` | Pure: build the WO dependency graph; compute upstream/downstream chain for path-focus; locate first error. | `lib/work-orders` (FRD-05) | REQ-12-005 |
| IF-12-topn | interface | `topN(items, n=5) → Item[]` | Pure: bounded ranking helper (the top-5 cap). | — | REQ-12-004 |
| CMP-12-kpi-header | RSC | `KpiHeader` | Renders the ≤5 KPIs + collapsible detail; `tabular-nums`. | `IF-12-kpis` | REQ-12-001, REQ-12-004 |
| CMP-12-freshness | RSC/client | `FreshnessBadge` | Live / No-signal badge with timestamp; icon+label (not color-only). **Consumed by FRD-06.** | `IF-12-freshness` | REQ-12-002 |
| CMP-12-timeline | RSC | `TimelineView` | The timeline/tree render of the same data. | `IF-12-timeline` | REQ-12-003 |
| CMP-12-dag | client | `WorkOrderDag` | Dagre-laid-out DAG; hover → path-focus (dim rest); "jump to first error"; follow-mode centering the executing step. | `IF-12-dag`, **Dagre**, FRD-13 tokens | REQ-12-005, REQ-12-006 |
| CMP-12-toggle | client | `RpgTimelineToggle` | Switches RPG (FRD-06) ↔ timeline ↔ DAG over the same snapshot. **Consumed by FRD-06.** | `CMP-12-timeline`, `CMP-12-dag` | REQ-12-003 |

### New `lib/` modules
None. FRD-12 derives over existing readers (`lib/events`, `lib/status`, `lib/portfolio`,
`lib/work-orders`). The selectors are feature-level pure functions, not a data-layer module.

### New external dependency (introduced here, NOT global)
- **`dagre`** (`@dagrejs/dagre`, ~39KB) — added to `package.json` **in WO-12-006**, used only by
  `CMP-12-dag`. Explicitly NOT ELK.js (REQ-12-006; architecture §2 records the choice). No factory
  memory verdict exists for Dagre yet; if it disappoints, capture a `library-verdict` lesson.

## 3. Contracts
- All selectors take the **already-parsed, capped** `DashboardEvent[]` from `lib/events` (cap
  100–200, architecture §3/§4.7) — no re-reading the file, no extra instrumentation (REQ-12-007).
- `IF-12-topn` is applied to every ranking/grouping (REQ-12-004) — a single enforced cap.
- `IF-12-dag` reads work-order dependencies from `lib/work-orders` (FRD-05). Path-focus is pure
  (`dagChain`); the dim/highlight + follow-mode are client interaction over that pure result.
- Freshness threshold (live vs no-signal) is a centralized constant (`lib/constants` or feature
  constant), not magic.

## 4. App surface (§11)
- **Header KPIs + freshness badge:** the global header / dashboard (`app/`), and reused inside the
  project workspace.
- **Timeline / DAG + toggle:** `app/projects/[slug]` → the same surface as the Party tab (FRD-06),
  swapped by `CMP-12-toggle`.

## 5. Cross-feature dependencies
- **FRD-01 `lib/events`** — the parsed capped tail (hard).
- **FRD-05 `lib/work-orders`** — DAG nodes/edges (hard for WO-12-006).
- **FRD-01 `lib/status` / `lib/portfolio`** — KPI inputs (active projects, builds queued).
- **FRD-13 tokens** — DAG node colors (per-agent), motion (<300ms), state by icon+label, freshness
  badge (not color-only). Hard for the UI WOs.
- **FRD-06 consumes** `IF-12-rate`, `CMP-12-freshness`, `CMP-12-toggle` → build those before the
  corresponding FRD-06 WOs (06-009/010).

## 6. Traceability (REQ → CMP/IF)
Every REQ-12-MMM maps to a CMP-12-* / IF-12-* in §2. No requirement is unbuildable. REQ-12-006 is
satisfied by the Dagre choice in WO-12-006 (and recorded in architecture §2).

## 7. Build Plan (Phase 2)

Phase 2 re-paints the project **Observabilidad** tab presentation to the approved prototype. The
**pure selector layer is VERIFIED** — `topn`/`freshness` (WO-12-001), `kpis` (WO-12-002), `rate`
(WO-12-003), `timeline` (WO-12-004) — as are the pure `dag.ts` (`toDag`/`dagChain`/`firstError`) and the
`dagre` dependency; none are re-planned. The two coarse UI WOs consume them. The global dashboard
`KpiHeader`/`FreshnessBadge` (FRD-18 surface) stay real/VERIFIED and are out of this Phase-2 re-paint.

**Coarse DAG:**

```
selectors + dag.ts + dagre (VERIFIED) ─┐
foundation + live (WO-01-009) ─────────┼─▶ WO-12-006  (WoDag: Dagre graph, chain-highlight, jump-to-error, follow-active)
                                        └─▶ WO-12-005  (ObservabilidadTab + TimelineView)  ──mounts WoDag as DAG lens──┘
```

- **WO-12-005** — `ObservabilidadTab` (sibling of Party; local `SectionHead` strip + the **Línea de
  tiempo ↔ DAG** `Tabs` toggle over the SAME work orders) + `TimelineView` (WO→tasks→actions duration
  bars + time axis + jump-to-first-error). **Live** via `useLiveSnapshot` (WO-01-009), not polling.
- **WO-12-006** — `WoDag` (the dependency graph: Dagre, bezier edges, chain-highlight upstream+downstream,
  jump-to-first-error, follow-active-step), mounted as the DAG lens of WO-12-005's toggle. **Live** via
  `useLiveSnapshot`, not polling.

**Parallelism.** WO-12-006 can be built in parallel with WO-12-005 and is mounted into its toggle. Across
FRDs both are **disjoint** from FRD-05 (`_components/{wo-*}/**`) and FRD-06 (`_party/**`): artifacts live
only under `src/app/projects/[slug]/_observability/**`, so the three workspace tabs re-paint in parallel
with no file collision.

**Disjoint artifacts:**
- WO-12-005: `src/app/projects/[slug]/_observability/ObservabilidadTab/**`, `…/TimelineView/**`.
- WO-12-006: `src/app/projects/[slug]/_observability/WoDag/**`.

**Cross-FRD deps:** `frd-13` (foundation primitives + per-state/role color & motion tokens),
`frd-04` (the workspace Tabbar the tab mounts into), `frd-01` (live — `useLiveSnapshot` + SSE transport,
WO-01-009). Reads WO dependency data from FRD-05 `lib/work-orders` (VERIFIED).
