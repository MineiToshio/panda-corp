---
id: "WO-23-004"
type: "work-order"
slug: "aggregate-index"
title: "WO-23-004 — Aggregate index"
status: "ACTIVE"
parent: "FRD-23"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/materialized-stats-read-model/**"
source_requirements:
  - "REQ-23-004"
dependsOn:
  - "WO-23-003"
last_updated: "2026-07-07"
---
# WO-23-004 — Aggregate index

## Summary

Adds aggregate index, the piece materialized stats read model needs before its screens can rely on real data. The change is additive and leaves the existing routes untouched.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-23-004.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-23-004.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** the shared resolver is the only new export.
