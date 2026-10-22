---
id: "WO-01-013"
type: "work-order"
slug: "franchise-header-with-counts"
title: "WO-01-013 — Franchise header with counts"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/catalog/**"
source_requirements:
  - "REQ-01-013"
dependsOn:
  - "WO-01-012"
last_updated: "2026-10-18"
---
# WO-01-013 — Franchise header with counts

## Summary

Adds franchise header with counts, the piece browse the catalog needs before its screens can rely on real data. The change is additive and leaves the existing routes untouched.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-01-013.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-01-013.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-01-013.3 — WHEN franchise header with counts has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** the shared resolver is the only new export.
