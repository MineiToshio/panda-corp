---
id: "WO-10-002"
type: "work-order"
slug: "secret-achievements"
title: "WO-10-002 — Secret achievements"
status: "ACTIVE"
parent: "FRD-10"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/achievements-hall/**"
source_requirements:
  - "REQ-10-002"
dependsOn:
  - "WO-10-001"
last_updated: "2026-06-20"
---
# WO-10-002 — Secret achievements

## Summary

Adds secret achievements, the piece achievements hall needs before its screens can rely on real data. The change is additive and leaves the existing routes untouched.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-10-002.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-10-002.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** consumed only by its parent route; no other module imports it.
