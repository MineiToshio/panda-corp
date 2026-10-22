---
id: "WO-04-001"
type: "work-order"
slug: "goal-model-per-series"
title: "WO-04-001 — Goal model per series"
status: "ACTIVE"
parent: "FRD-04"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/goals/**"
source_requirements:
  - "REQ-04-001"
dependsOn:
  - "WO-03-002"
last_updated: "2026-10-18"
---
# WO-04-001 — Goal model per series

## Summary

Introduces goal model per series with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-04-001.1 — WHEN goal model per series has data, the screen SHALL show it using the shared tokens.
- AC-04-001.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-04-001.3 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** consumed only by its parent route; no other module imports it.
