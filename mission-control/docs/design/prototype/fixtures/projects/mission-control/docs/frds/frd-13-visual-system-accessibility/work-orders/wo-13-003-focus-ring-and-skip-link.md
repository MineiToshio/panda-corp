---
id: "WO-13-003"
type: "work-order"
slug: "focus-ring-and-skip-link"
title: "WO-13-003 — Focus ring and skip link"
status: "ACTIVE"
parent: "FRD-13"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/visual-system-accessibility/**"
source_requirements:
  - "REQ-13-003"
dependsOn:
  - "WO-13-002"
last_updated: "2026-06-21"
---
# WO-13-003 — Focus ring and skip link

## Summary

Delivers focus ring and skip link as a small, testable slice of visual system and accessibility. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-13-003.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-13-003.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-13-003.3 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** the shared resolver is the only new export.
