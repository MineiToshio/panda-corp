---
id: FRD-05
type: frd
title: FRD-05 — Work orders (live view)
status: ACTIVE
implementation_status: PLANNED
last_updated: '2026-06-16'
---
# FRD-05 — Work orders (live view)

Read-only kanban of the work orders' state, with their FRD and reading the full document.

## Acceptance criteria (EARS)
- The kanban SHALL show columns **To do · In progress · Review/Testing · Done**, all the **same width** and **wide** (not tiny), with **horizontal scroll** when they don't fit; the text SHALL wrap onto several lines if it doesn't fit.
- EACH work order card SHALL indicate which **FRD** it belongs to; since work orders now live **per feature** under `docs/frds/frd-NN-<slug>/work-orders/` (DR-049), the kanban MAY group/filter the cards by their FRD (the FRD grouping is now the natural one).
- WHEN the owner clicks a work order, it SHALL show a **Summary** and a **Full document** tab that renders the entire work order (acceptance criteria, scope, definition of done, evidence).
- It SHALL show the project's progress (work orders done / total and %), aggregated across every feature's `work-orders/`.
- The kanban SHALL reflect the live state (written by the agents in each feature's `docs/frds/frd-NN-<slug>/work-orders/`); the owner does NOT edit it.

## Edge cases
- Project with no work orders yet → message indicating they are generated in `/pandacorp:blueprint`.
