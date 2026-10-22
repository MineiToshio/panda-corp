---
id: "WO-06-005"
type: "work-order"
slug: "idle-and-empty-states"
title: "WO-06-005 — Idle and empty states"
status: "ACTIVE"
parent: "FRD-06"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/party/**"
source_requirements:
  - "REQ-06-005"
dependsOn:
  - "WO-06-004"
last_updated: "2026-06-18"
---
# WO-06-005 — Idle and empty states

## Summary

Delivers idle and empty states as a small, testable slice of party. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-06-005.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-06-005.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-06-005.3 — WHEN idle and empty states has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** consumed only by its parent route; no other module imports it.
