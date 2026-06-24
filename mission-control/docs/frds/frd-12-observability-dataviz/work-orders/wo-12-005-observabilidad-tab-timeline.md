---
id: WO-12-005
type: work-order
slug: observabilidad-tab-timeline
title: 'WO-12-005 — Observabilidad tab + Timeline view (live, re-paint to mock)'
status: DRAFT
parent: FRD-12
implementation_status: VERIFIED
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/_observability/ObservabilidadTab/**'
  - 'src/app/projects/[slug]/_observability/TimelineView/**'
source_requirements: [REQ-12-002, REQ-12-003, REQ-12-005]
dependsOn: [WO-12-004, WO-12-006]
last_updated: '2026-06-21'
---
# WO-12-005 — Observabilidad tab + Timeline view (live, re-paint to mock)

The Observabilidad project tab shell (sibling of Party) and the Línea-de-tiempo view, re-painted to the
approved prototype on the FRD-13 foundation primitives. The selectors (`topn`/`kpis`/`rate`/`timeline`)
and `dag.ts` are **VERIFIED and out of scope** (consume them, never re-plan them). **Real-time**: both
views derive from `useLiveSnapshot` (WO-01-009) — event-driven, not polling.

## Goal

Render the **Observabilidad** tab exactly as the prototype `observabilidadBody()` renders it: a local
`SectionHead` strip with the **Línea de tiempo ↔ DAG** `Tabs` toggle over the SAME work orders, plus the
`TimelineView` (WO→tasks→actions Gantt-style duration bars), live off the real event stream.

## Scope

- **`ObservabilidadTab`** — the project-workspace sub-tab, **sibling of Party** (not nested in it,
  REQ-12-002). A thin `Panel` strip: an `eye-search` icon + the eyebrow "OBSERVABILIDAD · 2 vistas sobre
  los MISMOS work orders" + the **2-view toggle** built from the **one `Tabs`/`.stab` pattern** —
  **Línea de tiempo** ↔ **DAG** (it hosts `TimelineView` and the `WoDag` from WO-12-006). A muted line
  points to Party for the live agents. The toggle changes the lens, never the data.
  `src/app/projects/[slug]/_observability/ObservabilidadTab/**`.
- **`TimelineView`** — the `bTimeline` render: a `Panel` with a one-line legend, a **time axis**
  (0 → total/2 → total min), one **row per work order** (150px label column: state icon in the WO state
  color + title + `WO-id · FRD` mono; horizontal **duration bar** positioned by `start`/`dur`), **nested
  task bars** (fainter sub-bars), and a **"saltar al primer error"** affordance locating the first failed
  WO (danger line). `tabular-nums` on durations/axis.
  `src/app/projects/[slug]/_observability/TimelineView/**`.
- **Live**: subscribe to the Observabilidad slice of `useLiveSnapshot` (WO-01-009, SSE) so the timeline
  updates LIVE as events arrive — event-driven, **not** polling; stays consistent with the freshness
  indicator (no fabricated progress).
- **Out of scope:** the pure selectors `topn`/`kpis`/`rate`/`timeline` (WO-12-001/002/003/004 — VERIFIED)
  and `dag.ts` (VERIFIED pure part of WO-12-006); the `WoDag` re-paint (WO-12-006); the SSE transport /
  `useLiveSnapshot` (WO-01-009); the FRD-04 Tabbar; the global dashboard KpiHeader/FreshnessBadge
  surfaces (FRD-18, real).

## Acceptance criteria

- **AC-12-002.1/.2/.3** The Observabilidad tab is a sibling of Party (not nested); Party stays
  live-agents-only; the tab offers exactly the **Línea de tiempo ↔ DAG** toggle over the same WO data
  (no RPG view here).
- **AC-12-003.1** The timeline renders work orders → tasks → actions as nested bars sized to duration,
  child bars nested under the parent WO bar.
- **AC-12-003.2** A "saltar al primer error" affordance locates the first failed WO.
- **AC-12-005.1/.2 (live)** While the build runs the timeline updates live/event-driven; with no new
  event it stays consistent with the freshness indicator, never fabricating progress.
- **Fidelity** Matches the prototype `observabilidadBody()`/`bTimeline()` on the frozen tokens (in-loop
  visual-fidelity gate); the toggle and header reuse the one `Tabs`/`SectionHead`/`Panel` patterns
  (DR-062); tokens only; state by icon + text, not color alone.

## Dependencies

- **Intra (VERIFIED, consume):** WO-12-004 (`timeline` selector), WO-12-001 (`freshness`).
- **Foundation (FRD-13):** WO-13-006 (PageTitle/SectionHead/Tabs), WO-13-007 (Panel/Chip/Banner).
- **Live (FRD-01):** WO-01-009 (`useLiveSnapshot` + SSE transport — `foundation:true`).
- **Intra (sibling):** WO-12-006 (`WoDag`) — mounted as the DAG lens of the toggle.
- **Cross-FRD:** `frd-13` (foundation primitives), `frd-04` (the workspace Tabbar this mounts into),
  `frd-01` (live snapshot).

## Visual reference

`docs/design/prototype/index.html` — render fns `observabilidadBody()` (~L1214), `bTimeline()` (~L1156),
`projectPane()` tab bar (~L895). See `../fdd.md` §1/§1a. Fidelity, not novelty.

## Status Note

### What was built

**`ObservabilidadTab`** (`src/app/projects/[slug]/_observability/ObservabilidadTab/ObservabilidadTab.tsx`)
The Observabilidad project sub-tab (sibling of Party, AC-12-002.1). Renders:
- A header panel strip: `ti-eye-search` icon + "OBSERVABILIDAD · 2 vistas sobre los MISMOS work orders"
  eyebrow + **shared `SubTabs` toggle** (Línea de tiempo / DAG) — the one `.stab` pattern (DR-062), NOT
  a bespoke pill-button; wrapped in `data-testid="obs-toggle"` div for test stability
- A Party hint line pointing operators to the Party tab (AC-12-002.2)
- Below: either `TimelineView` (default) or `WoDag` stub depending on active view (AC-12-002.3)
- Live: subscribes to `useLiveSnapshot({ project })` and derives `GanttWorkOrder[]` from events via the
  VERIFIED `toTimeline()` selector (WO-12-004). Falls back to `deriveStaticGantt()` (equal 20-min slots)
  when no live events have arrived yet.

**`TimelineView`** (`src/app/projects/[slug]/_observability/TimelineView/TimelineView.tsx`)
Gantt-style re-paint of prototype `bTimeline()` (~L1156):
- Grid layout `150px 1fr` — label column (state icon + WO title + `WO-id · FRD` mono sub-label) + bar track
- WO bar: positioned by `left = start/total * 100%`, `width = dur/total * 100%`; minimum 34px; color from
  `WO_COLOR_VAR` map (`var(--color-ok)` / `var(--color-danger)` / `var(--color-accent)` etc.); duration
  label ("20m") inside the bar
- Nested task sub-bars (55% opacity, 11px height) positioned sequentially from the WO's start offset
- Time axis: "0 min · {total/2} · {total} min" (tabular-nums throughout)
- First-error note: `ti-alert-triangle` in `var(--color-danger)`, bold WO id + title (AC-12-003.2)
- Empty state: `data-testid="timeline-gantt-empty"` when no work orders
- State icons map: `WOICON` (`ti-circle-check` / `ti-alert-triangle` / `ti-loader-2` / `ti-circle`)

**`WoDag` stub** (`src/app/projects/[slug]/_observability/WoDag/WoDag.tsx`)
Placeholder for WO-12-006. Renders a `ti-binary-tree` icon + count text inside the DAG lens.
WO-12-006 replaces this body with the real Dagre implementation.

**Mounted into FRD-04:** `src/app/projects/[slug]/page.tsx` `case "observabilidad"` reads
`listWorkOrders(projectPath)` and renders `<ObservabilidadTab workOrders={...} project={slug} />`.

### Interfaces / contracts exposed

```typescript
// GanttTask — task sub-bar data
export interface GanttTask {
  title: string;
  dur: number;    // duration in minutes
  state: "done" | "fail" | "in_progress" | "review" | "todo";
}

// GanttWorkOrder — one row in the Gantt
export interface GanttWorkOrder {
  id: string;
  title: string;
  frd: string;
  state: "done" | "fail" | "in_progress" | "review" | "todo";
  start: number;  // offset from build start, in minutes
  dur: number;    // duration in minutes
  tasks: GanttTask[];
}

// TimelineView props
export interface TimelineViewProps {
  workOrders: GanttWorkOrder[];
  total: number;  // total build duration in minutes (denominator for bar widths)
}

// ObservabilidadTab props
export interface ObservabilidadTabProps {
  workOrders: WorkOrder[];  // static WO list from lib/work-orders
  project: string;          // project slug — scopes useLiveSnapshot
}
```

### Integration seams

- **Consumer (FRD-04 page.tsx):** passes `listWorkOrders(projectPath)` + slug; no other integration needed
- **Upstream live data (WO-01-009):** `useLiveSnapshot({ project })` → `{ snapshot: EventsSnapshot | null, ... }`
- **Selector (WO-12-004):** `toTimeline(events: Event[]): TimelineRow[]` — consumed by `deriveGanttOrders()`
- **WO-12-006 integration point:** replace `WoDag` body (`src/app/projects/[slug]/_observability/WoDag/WoDag.tsx`)
  — the `ObservabilidadTab` already mounts it; WO-12-006 only needs to implement the real Dagre layout there
- **Preview route:** `src/app/preview-wo12005/page.tsx` (fidelity-check dev-only page, not shipped behavior)

### Implicit decisions and assumptions

- **Gantt units are minutes** — `toTimeline()` returns ISO timestamps; `deriveGanttOrders()` converts them to
  minute offsets relative to the first WO's start. The `total` prop is also in minutes.
- **Static fallback: 20 min/slot** — when no live snapshot has events, each WO gets `dur=20`, sequentially
  stacked from `start=0`. No tasks are created in the static fallback (tasks come from live events only).
- **Toggle uses shared `SubTabs` (DR-062)** — the Línea de tiempo ↔ DAG switcher is `<SubTabs>` from
  `src/components/core/Tabs/Tabs.tsx` (the one `.stab` pattern), wrapped in a `div[data-testid="obs-toggle"]`
  so existing tests remain stable. No bespoke pill buttons.
- **Toggle state is local** — `useState<"timeline" | "dag">("timeline")`; not URL-driven (the URL tab param
  is "observabilidad", the sub-lens is ephemeral).
- **`WoDag` receives `staticOrders` (WorkOrder[])**, not `GanttWorkOrder[]` — the DAG implementation
  (WO-12-006) will use the raw WO list with its own layout logic.
- **State color map:** `done → var(--color-ok)`, `fail → var(--color-danger)`,
  `in_progress → var(--color-accent)`, `review → var(--color-border-strong)`,
  `todo → var(--color-info)` — mirrors the prototype's `WOCOL` object.
- **Key stability for task sub-bars:** `key=\`${wo.id}-task-${currentOffset}-${task.title}\`` uses the
  cumulative minute offset + title (no stable id exists on tasks from `toTimeline()`).
- **`"use client"` boundary:** both `ObservabilidadTab` and `TimelineView` are client components
  (ObservabilidadTab has `useState` + `useLiveSnapshot`; TimelineView has `tabular-nums` inline styles
  but is pure-presentational — could become a Server Component if needed).
- **bBadge() omitted:** the prototype's `observabilidadBody()` appends `bBadge()` (a live-signal badge) after
  the eyebrow text. This badge is a FRD-15 / FRD-01 concern (plugin drift / freshness); AC-12-002 does not
  require it in the tab header, so it was omitted to stay within WO-12-005 scope.

### Test files

- `src/app/projects/[slug]/_observability/TimelineView/_tests/TimelineView.test.tsx` — 14 tests:
  row per WO, duration bars, WO-id/FRD meta, nested task bars, task opacity, first-error note, time axis,
  legend, state icons, tabular-nums, empty state, no-hex colors, Tabler icon classes
- `src/app/projects/[slug]/_observability/ObservabilidadTab/_tests/ObservabilidadTab.test.tsx` — 15 tests:
  toggle renders, 2 options, eyebrow text, Party hint, default timeline view, DAG switch, back to timeline,
  null snapshot no-error, timeline receives WOs, first-error note, empty state, panel wrapper
