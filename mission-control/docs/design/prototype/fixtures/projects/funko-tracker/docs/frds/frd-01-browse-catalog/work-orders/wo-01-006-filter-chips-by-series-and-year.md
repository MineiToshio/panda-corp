---
id: "WO-01-006"
type: "work-order"
slug: "filter-chips-by-series-and-year"
title: "WO-01-006 — Filter chips by series and year"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/catalog/**"
source_requirements:
  - "REQ-01-006"
dependsOn:
  - "WO-01-005"
last_updated: "2026-10-18"
---
# WO-01-006 — Filter chips by series and year

## Summary

Introduces filter chips by series and year with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Render filter chips by series and year with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-01-006.1 — WHEN filter chips by series and year has data, the screen SHALL show it using the shared tokens.
- AC-01-006.2 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** consumed only by its parent route; no other module imports it.
