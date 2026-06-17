---
id: WO-12-006
type: work-order
slug: workorder-dag
title: >-
  WO-12-006 — Work-order DAG (Dagre) with path-focus + jump-to-error +
  follow-mode
status: DRAFT
parent: FRD-12
implementation_status: PLANNED
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
