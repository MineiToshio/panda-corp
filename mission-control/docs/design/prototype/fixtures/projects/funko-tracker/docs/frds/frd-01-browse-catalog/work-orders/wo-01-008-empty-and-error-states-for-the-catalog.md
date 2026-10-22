---
id: "WO-01-008"
type: "work-order"
slug: "empty-and-error-states-for-the-catalog"
title: "WO-01-008 — Empty and error states for the catalog"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/catalog/**"
source_requirements:
  - "REQ-01-008"
dependsOn:
  - "WO-01-007"
last_updated: "2026-10-18"
---
# WO-01-008 — Empty and error states for the catalog

## Summary

Introduces empty and error states for the catalog with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-01-008.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-01-008.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** the shared resolver is the only new export.
