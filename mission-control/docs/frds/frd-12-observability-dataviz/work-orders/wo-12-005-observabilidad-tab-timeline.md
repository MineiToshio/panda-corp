---
id: WO-12-005
type: work-order
slug: observabilidad-tab-timeline
title: 'WO-12-005 — Observabilidad tab + Timeline view (live, re-paint to mock)'
status: DRAFT
parent: FRD-12
implementation_status: PLANNED
artifacts:
  - 'src/app/projects/[slug]/_observability/ObservabilidadTab/**'
  - 'src/app/projects/[slug]/_observability/TimelineView/**'
source_requirements: [REQ-12-002, REQ-12-003, REQ-12-005]
last_updated: '2026-06-19'
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
