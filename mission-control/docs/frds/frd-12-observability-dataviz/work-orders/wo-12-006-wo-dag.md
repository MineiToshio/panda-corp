---
id: WO-12-006
type: work-order
slug: wo-dag
title: 'WO-12-006 — Work-order DAG view (Dagre, live, re-paint to mock)'
status: DRAFT
parent: FRD-12
implementation_status: PLANNED
artifacts:
  - 'src/app/projects/[slug]/_observability/WoDag/**'
source_requirements: [REQ-12-004, REQ-12-005, REQ-12-006]
last_updated: '2026-06-19'
---
# WO-12-006 — Work-order DAG view (Dagre, live, re-paint to mock)

The DAG lens of the Observabilidad tab, re-painted to the prototype on the FRD-13 foundation. The pure
`dag.ts` module (`toDag`/`dagChain`/`firstError`) and the `dagre` dependency are **VERIFIED and out of
scope** (consume them, never re-plan them). **Real-time**: the graph derives from `useLiveSnapshot`
(WO-01-009) — event-driven, not polling.

## Goal

Render the work-order **dependency graph** exactly as the prototype `bDag()` renders it: a Dagre-laid-out
SVG graph with bezier edges, chain-highlight (upstream + downstream), jump-to-first-error and
follow-active-step, live off the real event stream.

## Scope

- **`WoDag`** (`"use client"`) — the `bDag` render: nodes are rounded `card` rects (title slice +
  `WO-id · FRD` mono + a **state dot**); **bezier edges** from each dependency to its dependent, laid out
  with **Dagre** (~39KB, consume the VERIFIED `dagre` dependency; **not** ELK.js).
  - **Chain-highlight** (`bDagChain`): hovering/selecting a node highlights its full dependency chain
    (upstream + downstream) with `accent` edges + thicker stroke and **dims** the rest (`opacity:.32`);
    a hint line + "limpiar".
  - **Jump to first error**: a `danger`-bordered button selects the first `fail` WO and highlights its
    chain.
  - **Follow the active step**: a labelled toggle; when ON, the running WO gets an accent drop-shadow +
    a "▶ paso activo" caption.
  - Node colors per state/role (FRD-13); state by **icon + dot + WO id**, not color alone.
  `src/app/projects/[slug]/_observability/WoDag/**`.
- **Live**: derive the active node + WO set from `useLiveSnapshot` (WO-01-009, SSE) so the graph and the
  follow-active step update LIVE — event-driven, **not** polling.
- **Out of scope:** the pure `dag.ts` (`toDag`/`dagChain`/`firstError`) and the `dagre` dependency
  (VERIFIED); the SSE transport / `useLiveSnapshot` (WO-01-009); the tab shell + timeline (WO-12-005);
  the FRD-04 Tabbar.

## Acceptance criteria

- **AC-12-004.1** The DAG renders the work-order dependency graph via **Dagre** (~39KB), not ELK.js.
- **AC-12-004.2** Hovering/selecting a node highlights only its dependency chain (upstream + downstream)
  and dims the rest.
- **AC-12-004.3** A "saltar al primer error" affordance selects/highlights the first failed WO and its
  chain.
- **AC-12-004.4** A "seguir al paso activo" follow-mode toggle marks/centers the WO currently executing.
- **AC-12-005.1/.2 (live)** While the build runs the DAG updates live/event-driven; with no new event it
  stays consistent with the freshness indicator, never fabricating progress.
- **Fidelity** Matches the prototype `bDag()`/`bDagChain()` on the frozen tokens (in-loop visual-fidelity
  gate); tokens only; reuses the FRD-13 primitives; state by icon + shape + text, not color alone; motion
  `transform`/`opacity` only, honoring `prefers-reduced-motion`.

## Dependencies

- **Intra (VERIFIED, consume):** the pure `dag.ts` (`toDag`/`dagChain`/`firstError`) + the `dagre`
  dependency (already added).
- **Foundation (FRD-13):** WO-13-007 (Panel/Chip/Button), per-state/role color & motion tokens.
- **Live (FRD-01):** WO-01-009 (`useLiveSnapshot` + SSE transport — `foundation:true`).
- **Cross-FRD:** `frd-13` (foundation primitives + tokens), `frd-04` (the workspace Tabbar / the
  Observabilidad toggle this mounts under, WO-12-005), `frd-01` (live snapshot). Reads WO dependency data
  from FRD-05 `lib/work-orders` (already VERIFIED).

## Visual reference

`docs/design/prototype/index.html` — render fns `bDag()` (~L1169), `bDagChain()` (~L1154). See
`../fdd.md` §1b. Fidelity, not novelty.
