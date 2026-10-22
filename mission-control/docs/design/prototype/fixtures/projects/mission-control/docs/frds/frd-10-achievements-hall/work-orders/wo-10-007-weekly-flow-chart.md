---
id: "WO-10-007"
type: "work-order"
slug: "weekly-flow-chart"
title: "WO-10-007 — Weekly flow chart"
status: "ACTIVE"
parent: "FRD-10"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/achievements-hall/**"
source_requirements:
  - "REQ-10-007"
dependsOn:
  - "WO-10-006"
last_updated: "2026-06-20"
---
# WO-10-007 — Weekly flow chart

## Summary

Implements weekly flow chart end to end, from the reader to the rendered state. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Log the invariant it relies on next to the code, not in a separate note.
- Reuse the existing reader instead of re-deriving the same value.
- Add the keyboard path and an accessible name for every new control.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-10-007.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-10-007.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-10-007.3 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** the shared resolver is the only new export.
