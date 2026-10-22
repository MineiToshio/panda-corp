---
id: "WO-12-004"
type: "work-order"
slug: "graph-focus-and-trace"
title: "WO-12-004 — Graph focus and trace"
status: "ACTIVE"
parent: "FRD-12"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/observability-dataviz/**"
source_requirements:
  - "REQ-12-004"
dependsOn:
  - "WO-12-003"
last_updated: "2026-06-21"
---
# WO-12-004 — Graph focus and trace

## Summary

Introduces graph focus and trace with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-12-004.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-12-004.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** the shared resolver is the only new export.
