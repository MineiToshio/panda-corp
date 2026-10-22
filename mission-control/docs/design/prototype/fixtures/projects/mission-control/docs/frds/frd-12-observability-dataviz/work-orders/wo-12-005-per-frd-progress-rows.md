---
id: "WO-12-005"
type: "work-order"
slug: "per-frd-progress-rows"
title: "WO-12-005 — Per-FRD progress rows"
status: "ACTIVE"
parent: "FRD-12"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/observability-dataviz/**"
source_requirements:
  - "REQ-12-005"
dependsOn:
  - "WO-12-004"
last_updated: "2026-06-21"
---
# WO-12-005 — Per-FRD progress rows

## Summary

Implements per-FRD progress rows end to end, from the reader to the rendered state. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render per-FRD progress rows with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-12-005.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-12-005.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-12-005.3 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** consumed only by its parent route; no other module imports it.
