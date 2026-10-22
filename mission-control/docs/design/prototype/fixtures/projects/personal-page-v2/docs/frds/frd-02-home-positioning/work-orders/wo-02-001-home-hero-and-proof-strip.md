---
id: "WO-02-001"
type: "work-order"
slug: "home-hero-and-proof-strip"
title: "WO-02-001 — Home hero and proof strip"
status: "ACTIVE"
parent: "FRD-02"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/home/**"
source_requirements:
  - "REQ-02-001"
dependsOn:
  - "WO-01-004"
last_updated: "2026-06-30"
---
# WO-02-001 — Home hero and proof strip

## Summary

Adds home hero and proof strip, the piece home and positioning needs before its screens can rely on real data. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-02-001.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-02-001.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-02-001.3 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** none beyond the props of the parent component.
