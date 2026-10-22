---
id: "WO-12-006"
type: "work-order"
slug: "freshness-badge"
title: "WO-12-006 — Freshness badge"
status: "ACTIVE"
parent: "FRD-12"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/observability-dataviz/**"
source_requirements:
  - "REQ-12-006"
dependsOn:
  - "WO-12-005"
last_updated: "2026-06-21"
---
# WO-12-006 — Freshness badge

## Summary

Introduces freshness badge with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-12-006.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-12-006.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** consumed only by its parent route; no other module imports it.
