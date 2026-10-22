---
id: "WO-02-011"
type: "work-order"
slug: "phase-taken-from-the-project-status"
title: "WO-02-011 — Phase taken from the project status"
status: "ACTIVE"
parent: "FRD-02"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/ideas-board/**"
source_requirements:
  - "REQ-02-011"
dependsOn:
  - "WO-02-007"
last_updated: "2026-06-16"
---
# WO-02-011 — Phase taken from the project status

## Summary

Wires phase taken from the project status into ideas board without touching neighbouring features. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render phase taken from the project status with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-02-011.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-02-011.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-02-011.3 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** consumed only by its parent route; no other module imports it.
