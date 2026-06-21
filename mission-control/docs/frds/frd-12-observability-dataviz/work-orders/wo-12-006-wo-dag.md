---
id: WO-12-006
type: work-order
slug: wo-dag
title: 'WO-12-006 — Work-order DAG view (Dagre, live, re-paint to mock)'
status: DRAFT
parent: FRD-12
implementation_status: VERIFIED
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/_observability/WoDag/**'
source_requirements: [REQ-12-004, REQ-12-005, REQ-12-006]
last_updated: '2026-06-21'
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

## Status Note

### What was built

**`WoDag`** (`src/app/projects/[slug]/_observability/WoDag/WoDag.tsx`) — full Dagre SVG DAG replacing
the WO-12-005 stub. Client component (`"use client"`). Renders:

- **Dagre layout** (`@dagrejs/dagre` `Graph` + `layout`): `rankdir: "LR"`, `nodesep: 34`,
  `ranksep: 34`; node dimensions `NW=156 NH=58`; `PAD_X=PAD_Y=14`; edges use the `points` array
  from the laid-out graph.
- **SVG structure**: `<defs>` with `<marker>` arrowhead (id `arrow`); one `<path>` per edge (cubic
  bezier or straight 3-pt fallback); one `<g role="button">` per node containing `<rect>` (rounded,
  state-colored border), `<foreignObject>` (Tabler icon `<span class="ti …">`), `<text>` title (14px
  bold, truncated at ≈19 chars), `<text>` meta (`WO-id · FRD`, 11px mono), `<circle>` state dot,
  and conditionally a `<text>` "▶ paso activo" caption.
- **Chain-highlight** (AC-12-004.2): clicking/selecting a node calls `dagChain(id, nodes, edges)`;
  chain edges render in `var(--color-accent)` with `strokeWidth=2.5`; non-chain nodes/edges get
  `opacity: 0.32`; the controls bar shows "Resaltando la cadena de **{id}**..." + "limpiar" link.
- **Jump to first error** (AC-12-004.3): "Saltar al primer error" button (danger-bordered) calls
  `firstError(nodes, edges)` and sets `activeNodeId` to the first failed WO in topological order.
- **Follow active step** (AC-12-004.4): "Seguir al paso activo: ON/OFF" toggle; when ON, the
  running (`in_progress`) WO node gets `filter: drop-shadow(0 0 7px var(--color-accent))` + "▶ paso
  activo" caption below the meta line.
- **Live** (AC-12-005.1/2): `useLiveSnapshot({ project })` → merges `snapshot.events` work-order
  state into `effectiveOrders`; null snapshot = no fabricated progress (falls back to static WOs).
- **Empty state**: `data-testid="dag-empty"` when `nodes.length === 0`.
- **Legend row**: `ti-binary-tree` icon + description text above the controls bar.
- **Fidelity**: in-loop DR-056 check run (3 cycles): layout, edge arrows, node cards, chain-
  highlight, follow-active and all control states confirmed to match prototype `bDag()`/`bDagChain()`.
  Screenshots saved to `docs/reviews/smoke/wo-dag-desktop.png` + `wo-dag-proto.png`.

### Interfaces / contracts exposed

```typescript
// WoDag props
export interface WoDagProps {
  workOrders: WorkOrder[];   // static WO list; may carry extra dependsOn?: string[] at runtime
  project?: string;          // project slug — scopes useLiveSnapshot
}

// Internal layout types (not exported)
interface LayoutNode extends DagNode { x: number; y: number; width: number; height: number; }
interface LayoutEdge extends DagEdge { points: Array<{ x: number; y: number }>; }
interface DagLayout { nodes: LayoutNode[]; edges: LayoutEdge[]; width: number; height: number; }

// Consumed from dag.ts (VERIFIED, not re-exported):
//   toDag(workOrders: WorkOrderWithDeps[]): DagGraph
//   dagChain(id: string, nodes: DagNode[], edges: DagEdge[]): DagChainResult
//   firstError(nodes: DagNode[], edges: DagEdge[]): string | null
//   type DagNode = { id: string; title: string; state: WorkOrderState; colorToken?: string }
//   type DagEdge = { from: string; to: string }
//   type DagChainResult = { up: Set<string>; down: Set<string> }
```

### Integration seams

- **Mounted by WO-12-005** (`ObservabilidadTab`) when `view === "dag"`:
  `<WoDag workOrders={staticOrders} project={project} />` — no changes needed to the shell.
- **`dependsOn` field**: `WorkOrder` from `lib/work-orders` has no `dependsOn`; the component casts
  to `WorkOrderWithDeps = WorkOrder & { dependsOn?: string[] }` at the call site. The field is only
  populated when the real project's WO markdown frontmatter carries `depends_on: [...]` (parsed by
  the WO loader in FRD-05). The preview route (`src/app/preview-wo12005/page.tsx`) adds `dependsOn`
  inline on the sample WOs for visual testing.
- **`frdById` map**: built locally from `effectiveOrders` as `Record<string, string>` — FRD string
  is not on `DagNode`, only on the raw WO.
- **Live transport**: `useLiveSnapshot({ project })` from `src/hooks/useLiveSnapshot.ts` (WO-01-009).

### Implicit decisions and assumptions

- **`followActive` default is OFF** — the prototype initializes `dagFollow:true` (demo-only state),
  but OFF is the correct UX default (operator opts in to auto-following).
- **`dependsOn` vs `depends_on`**: the component uses camelCase `dependsOn` (JS convention); the WO
  loader (FRD-05) must map frontmatter `depends_on` to `dependsOn` when parsing. Not in scope here.
- **Node title truncation**: the SVG `<text>` clips at ≈19 characters (the prototype also clips
  "Pantalla de liquidación" → "Pantalla de liquid"); this is display-only, never data-loss.
- **Bezier path**: when Dagre provides 3+ points, the first is M, subsequent pairs are used as
  control points for a cubic bezier `C cp1 cp2 ep`; with exactly 2 points a straight `L` is drawn.
- **State color tokens**: `done → var(--color-ok)`, `fail → var(--color-danger)`,
  `in_progress → var(--color-accent)`, `review → var(--color-info)`,
  `todo → var(--color-border-strong)`.
- **SVG `<g role="button">` (Biome suppression)**: `lint/a11y/useSemanticElements` suppressed with
  `biome-ignore` comment — SVG `<g>` cannot be a native `<button>`; `role="button"` + `tabIndex={0}`
  + `onKeyDown` (Enter/Space) is the correct ARIA pattern for interactive SVG nodes.
- **Cognitive complexity**: `computeEdgeStyle()` pure function and `DagNodeGroup` subcomponent were
  extracted to keep Biome's `noExcessiveCognitiveComplexity` (max 15) satisfied.
- **`prefers-reduced-motion`**: transitions on node glow filter use `@media (prefers-reduced-motion:
  reduce)` to disable the drop-shadow animation.

### Test files

- `src/app/projects/[slug]/_observability/WoDag/_tests/WoDag.test.tsx` — 31 tests covering:
  - AC-12-004.1: Dagre layout renders nodes with correct testids, meta lines
  - AC-12-004.2: chain-highlight via click, `aria-pressed`/`data-active`, opacity for dimmed nodes,
    hint text with WO id, "limpiar" clear button
  - AC-12-004.3: "Saltar al primer error" button present, selects first fail node
  - AC-12-004.4: follow toggle ON/OFF text, "▶ paso activo" caption for in_progress node
  - AC-12-005.1/2: null snapshot = no fabricated state; snapshot events merge into effective orders
  - No hardcoded hex colors (all via CSS custom properties)
  - Empty state when no WOs
  - Legend renders
  - Controls bar (`dag-controls`) present
