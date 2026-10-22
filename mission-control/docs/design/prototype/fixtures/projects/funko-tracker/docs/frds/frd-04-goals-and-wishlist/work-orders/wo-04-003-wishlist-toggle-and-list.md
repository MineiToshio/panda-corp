---
id: "WO-04-003"
type: "work-order"
slug: "wishlist-toggle-and-list"
title: "WO-04-003 — Wishlist toggle and list"
status: "ACTIVE"
parent: "FRD-04"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/goals/**"
source_requirements:
  - "REQ-04-003"
dependsOn:
  - "WO-04-002"
last_updated: "2026-10-18"
---
# WO-04-003 — Wishlist toggle and list

## Summary

Introduces wishlist toggle and list with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-04-003.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-04-003.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-04-003.3 — WHEN wishlist toggle and list has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** none beyond the props of the parent component.
