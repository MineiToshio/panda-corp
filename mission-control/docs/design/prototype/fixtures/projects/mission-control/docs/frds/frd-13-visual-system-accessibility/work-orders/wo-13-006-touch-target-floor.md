---
id: "WO-13-006"
type: "work-order"
slug: "touch-target-floor"
title: "WO-13-006 — Touch target floor"
status: "ACTIVE"
parent: "FRD-13"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/visual-system-accessibility/**"
source_requirements:
  - "REQ-13-006"
dependsOn:
  - "WO-13-005"
last_updated: "2026-06-21"
---
# WO-13-006 — Touch target floor

## Summary

Builds touch target floor so the visual system and accessibility feature has one honest source for this behaviour. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Expose a typed result for every expected failure and render it as a designed state.
- Persist nothing new; the change only reads what the factory already writes.
- Keep the module under the size limits and document its exported functions.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-13-006.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-13-006.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** none beyond the props of the parent component.
