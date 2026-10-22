---
id: "WO-04-003"
type: "work-order"
slug: "documents-tab-with-index"
title: "WO-04-003 — Documents tab with index"
status: "ACTIVE"
parent: "FRD-04"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/project-workspace/**"
source_requirements:
  - "REQ-04-003"
dependsOn:
  - "WO-04-002"
last_updated: "2026-06-17"
---
# WO-04-003 — Documents tab with index

## Summary

Introduces documents tab with index with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-04-003.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-04-003.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-04-003.3 — WHEN documents tab with index has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** none beyond the props of the parent component.
