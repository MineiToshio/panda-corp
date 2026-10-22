---
id: "WO-03-006"
type: "work-order"
slug: "account-deletion-and-data-export"
title: "WO-03-006 — Account deletion and data export"
status: "ACTIVE"
parent: "FRD-03"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/collection/**"
source_requirements:
  - "REQ-03-006"
dependsOn:
  - "WO-03-005"
last_updated: "2026-10-18"
---
# WO-03-006 — Account deletion and data export

## Summary

Adds account deletion and data export, the piece account and private collection needs before its screens can rely on real data. The change is additive and leaves the existing routes untouched.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-03-006.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-03-006.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** consumed only by its parent route; no other module imports it.
