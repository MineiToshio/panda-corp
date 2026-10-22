---
id: "WO-10-005"
type: "work-order"
slug: "stats-panel"
title: "WO-10-005 — Stats panel"
status: "ACTIVE"
parent: "FRD-10"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/achievements-hall/**"
source_requirements:
  - "REQ-10-005"
dependsOn:
  - "WO-10-004"
last_updated: "2026-06-20"
---
# WO-10-005 — Stats panel

## Summary

Builds stats panel so the achievements hall feature has one honest source for this behaviour. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Expose a typed result for every expected failure and render it as a designed state.
- Persist nothing new; the change only reads what the factory already writes.
- Keep the module under the size limits and document its exported functions.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-10-005.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-10-005.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-10-005.3 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** none beyond the props of the parent component.
