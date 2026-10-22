---
id: "WO-02-003"
type: "work-order"
slug: "next-step-hint-per-column"
title: "WO-02-003 — Next-step hint per column"
status: "ACTIVE"
parent: "FRD-02"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/ideas-board/**"
source_requirements:
  - "REQ-02-003"
dependsOn:
  - "WO-02-001"
last_updated: "2026-06-16"
---
# WO-02-003 — Next-step hint per column

## Summary

Introduces next-step hint per column with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

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
