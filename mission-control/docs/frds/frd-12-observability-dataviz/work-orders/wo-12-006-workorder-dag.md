---
id: WO-12-006
type: work-order
slug: workorder-dag
title: >-
  WO-12-006 — Work-order DAG (Dagre) with path-focus + jump-to-error +
  follow-mode
status: DRAFT
parent: FRD-12
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-12-006 — Work-order DAG (Dagre) with path-focus + jump-to-error + follow-mode

**Components/Interfaces:** `CMP-12-dag`, `IF-12-dag` · **Traces:** REQ-12-005, REQ-12-006
**Deploy unit:** project workspace (timeline/DAG surface) · **Location:** `app/_observability/dag/` (`dag.ts` pure, `WorkOrderDag.tsx` client, + tests)

## Acceptance criteria (verbatim EARS)
- AC-12-005.1: IF the **work order DAG** is drawn, pointing at a node SHALL **highlight only its dependency chain** (upstream/downstream) and dim the rest; it SHALL offer "jump to the first error" and a *follow-mode* that centers the step in execution.
- AC-12-006.1: The graph render SHALL use a cheap layout engine (**Dagre**, ~39KB) and NOT ELK.js, unless there is a real need for orthogonal routing.

## Scope
- **Introduce the `dagre` dependency here** (`@dagrejs/dagre`, ~39KB) — add to `package.json` in this WO only (NOT global, NOT ELK.js). Record the choice already noted in architecture §2; if it disappoints, capture a `library-verdict` lesson in `.pandacorp/run/lessons.md`.
- `IF-12-dag` (pure): `toDag(workOrders) → {nodes, edges}` from `lib/work-orders` (FRD-05) dependency data; `dagChain(id) → {up, down}` (upstream/downstream sets for path-focus); `firstError(workOrders) → id|null`.
- `WorkOrderDag` (client): lay out nodes with Dagre; on node hover/focus → highlight `dagChain`, dim the rest; **"jump to first error"** button centers/selects `firstError`; **follow-mode** centers the currently-executing step. Node colors per-agent (FRD-13); state by icon+label.

## Dependencies
- **FRD-05 `lib/work-orders`** (dependency graph) — cross-feature, hard.
- FRD-13 tokens (node colors, motion <300ms, icon+label state, focus ring).
- `dagre` (added in this WO).

## TDD / Definition of done
- Pure tests (`IF-12-dag`): `toDag` builds the right nodes/edges from fixtures; `dagChain` returns correct upstream/downstream; `firstError` finds the earliest failed node or null. Component tests: hovering a node dims non-chain nodes; "jump to first error" selects the failed node; follow-mode centers the executing node; render does not import ELK. Dagre layout is exercised (mock or real).
- Gate green.

## Status Note

**Built:** WO-12-006 implements the Work-Order DAG view end-to-end. `@dagrejs/dagre` (3.0.0, ~39KB) added as a production dependency. No ELK.js.

**Files delivered:**
- `app/_observability/dag/dag.ts` — pure module (`IF-12-dag`): `toDag`, `dagChain`, `firstError`; no I/O, no Dagre call. Exports `DagNode`, `DagEdge`, `DagGraph`, `DagChainResult`.
- `app/_observability/dag/WorkOrderDag.tsx` — `"use client"` component (`CMP-12-dag`): Dagre LR layout, hover path-focus (`data-dimmed`), jump-to-error button (`data-testid="wo-dag-jump-error"`), follow-mode toggle (`data-testid="wo-dag-follow-toggle"`), empty state (`data-testid="wo-dag-empty"`).
- `app/_observability/dag/dag.test.ts` — 28 pure-function tests (toDag, dagChain, firstError, ELK exclusion, DagNode/DagEdge shape; regression anchors B1', I2, I3, SHA-hygiene).
- `app/_observability/dag/WorkOrderDag.test.tsx` — 26 component tests (empty state, node rendering, path-focus hover/leave, jump-to-error, follow-mode, no hardcoded colors, ELK import guard, accessibility).

**Interfaces/contracts exposed:**
```ts
// dag.ts
export function toDag(workOrders: (WorkOrder & { dependsOn?: string[] })[]): DagGraph
export function dagChain(id: string, nodes: DagNode[], edges: DagEdge[]): DagChainResult
export function firstError(nodes: DagNode[], edges: DagEdge[]): string | null

// WorkOrderDag.tsx
export interface WorkOrderDagProps { workOrders: WorkOrderWithDeps[]; executingId?: string }
export function WorkOrderDag(props: WorkOrderDagProps): JSX.Element
```

**data-testid map for integration:**
- `wo-dag` — DAG container (only when nodes > 0)
- `wo-dag-empty` — empty state
- `wo-dag-node-{id}` — each node button; `data-dimmed="true"` when dimmed; `data-selected="true"` when selected
- `wo-dag-edge-{from}-{to}` — each SVG path edge
- `wo-dag-jump-error` — "Saltar al primer error" button
- `wo-dag-follow-toggle` — follow-mode toggle (`aria-pressed`)

**Integration seams:**
- Consumes `WorkOrder` + optional `dependsOn?: string[]` from `lib/work-orders` (FRD-05). The `dependsOn` extension is declared inline at the call site — `lib/work-orders.ts` was not modified.
- Node color tokens reference CSS custom properties (`--color-accent`, `--color-error`, `--color-success`, `--color-text-muted`, `--color-surface`, `--hairline`, `--radius`, `--spacing`) — resolves via FRD-13 globals.css.
- `WorkOrderDag` is ready for consumption by `RpgTimelineToggle` (WO-12-007, `CMP-12-toggle`).

**Test files:** `app/_observability/dag/dag.test.ts`, `app/_observability/dag/WorkOrderDag.test.tsx`

**Gate:** `verify.sh` GREEN — biome + tsc + vitest (111 files, 3218 tests pass, 2 expected-fail, 5 skipped).
