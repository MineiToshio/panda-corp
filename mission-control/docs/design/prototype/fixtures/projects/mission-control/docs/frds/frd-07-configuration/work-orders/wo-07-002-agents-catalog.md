---
id: "WO-07-002"
type: "work-order"
slug: "agents-catalog"
title: "WO-07-002 — Agents catalog"
status: "ACTIVE"
parent: "FRD-07"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/configuration/**"
source_requirements:
  - "REQ-07-002"
dependsOn:
  - "WO-07-001"
last_updated: "2026-06-19"
---
# WO-07-002 — Agents catalog

## Summary

Introduces agents catalog with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-07-002.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-07-002.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** the shared resolver is the only new export.
