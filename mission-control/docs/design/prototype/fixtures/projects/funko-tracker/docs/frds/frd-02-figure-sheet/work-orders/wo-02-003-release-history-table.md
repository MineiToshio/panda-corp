---
id: "WO-02-003"
type: "work-order"
slug: "release-history-table"
title: "WO-02-003 — Release history table"
status: "ACTIVE"
parent: "FRD-02"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/figure/**"
source_requirements:
  - "REQ-02-003"
dependsOn:
  - "WO-02-002"
last_updated: "2026-10-18"
---
# WO-02-003 — Release history table

## Summary

Introduces release history table with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-02-003.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-02-003.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-02-003.3 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** the shared resolver is the only new export.
