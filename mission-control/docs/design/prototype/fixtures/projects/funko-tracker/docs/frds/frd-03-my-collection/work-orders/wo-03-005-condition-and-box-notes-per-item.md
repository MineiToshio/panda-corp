---
id: "WO-03-005"
type: "work-order"
slug: "condition-and-box-notes-per-item"
title: "WO-03-005 — Condition and box notes per item"
status: "ACTIVE"
parent: "FRD-03"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/app/collection/**"
source_requirements:
  - "REQ-03-005"
dependsOn:
  - "WO-03-004"
last_updated: "2026-10-18"
---
# WO-03-005 — Condition and box notes per item

## Summary

Builds condition and box notes per item so the account and private collection feature has one honest source for this behaviour. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Add the keyboard path and an accessible name for every new control.
- Cover the happy path and one malformed input with unit tests written first.
- Log the invariant it relies on next to the code, not in a separate note.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-03-005.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-03-005.2 — WHEN condition and box notes per item has data, the screen SHALL show it using the shared tokens.
- AC-03-005.3 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** the shared resolver is the only new export.
