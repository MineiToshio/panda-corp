---
id: "WO-02-012"
type: "work-order"
slug: "favourite-flag-on-cards"
title: "WO-02-012 — Favourite flag on cards"
status: "ACTIVE"
parent: "FRD-02"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/ideas-board/**"
source_requirements:
  - "REQ-02-012"
dependsOn:
  - "WO-02-011"
last_updated: "2026-06-16"
---
# WO-02-012 — Favourite flag on cards

## Summary

Delivers favourite flag on cards as a small, testable slice of ideas board. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-02-012.1 — WHEN favourite flag on cards has data, the screen SHALL show it using the shared tokens.
- AC-02-012.2 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** consumed only by its parent route; no other module imports it.
