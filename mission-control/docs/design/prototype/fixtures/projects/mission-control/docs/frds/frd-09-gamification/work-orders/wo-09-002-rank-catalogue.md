---
id: "WO-09-002"
type: "work-order"
slug: "rank-catalogue"
title: "WO-09-002 — Rank catalogue"
status: "ACTIVE"
parent: "FRD-09"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/gamification/**"
source_requirements:
  - "REQ-09-002"
dependsOn:
  - "WO-09-001"
last_updated: "2026-06-19"
---
# WO-09-002 — Rank catalogue

## Summary

Adds rank catalogue, the piece gamification needs before its screens can rely on real data. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-09-002.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-09-002.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** consumed only by its parent route; no other module imports it.
