---
id: "WO-17-005"
type: "work-order"
slug: "self-suggestions"
title: "WO-17-005 — Self-suggestions"
status: "ACTIVE"
parent: "FRD-17"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/proposals-inbox/**"
source_requirements:
  - "REQ-17-005"
dependsOn:
  - "WO-17-004"
last_updated: "2026-07-01"
---
# WO-17-005 — Self-suggestions

## Summary

Adds self-suggestions, the piece proposals inbox needs before its screens can rely on real data. The change is additive and leaves the existing routes untouched.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-17-005.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-17-005.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-17-005.3 — WHEN self-suggestions has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** the shared resolver is the only new export.
