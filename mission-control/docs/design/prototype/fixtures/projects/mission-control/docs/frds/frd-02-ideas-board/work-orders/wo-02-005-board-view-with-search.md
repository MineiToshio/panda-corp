---
id: "WO-02-005"
type: "work-order"
slug: "board-view-with-search"
title: "WO-02-005 — Board view with search"
status: "ACTIVE"
parent: "FRD-02"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/ideas-board/**"
source_requirements:
  - "REQ-02-005"
dependsOn:
  - "WO-02-004"
last_updated: "2026-06-16"
---
# WO-02-005 — Board view with search

## Summary

Introduces board view with search with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Render board view with search with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-02-005.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-02-005.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-02-005.3 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** the shared resolver is the only new export.
