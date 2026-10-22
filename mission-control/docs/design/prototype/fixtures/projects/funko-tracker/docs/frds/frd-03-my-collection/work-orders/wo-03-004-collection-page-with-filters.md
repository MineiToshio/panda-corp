---
id: "WO-03-004"
type: "work-order"
slug: "collection-page-with-filters"
title: "WO-03-004 — Collection page with filters"
status: "ACTIVE"
parent: "FRD-03"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/collection/**"
source_requirements:
  - "REQ-03-004"
dependsOn:
  - "WO-03-003"
last_updated: "2026-10-18"
---
# WO-03-004 — Collection page with filters

## Summary

Introduces collection page with filters with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-03-004.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-03-004.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** none beyond the props of the parent component.
