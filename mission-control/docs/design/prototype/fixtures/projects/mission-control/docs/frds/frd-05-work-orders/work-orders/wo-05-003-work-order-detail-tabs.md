---
id: "WO-05-003"
type: "work-order"
slug: "work-order-detail-tabs"
title: "WO-05-003 — Work-order detail tabs"
status: "ACTIVE"
parent: "FRD-05"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/work-orders/**"
source_requirements:
  - "REQ-05-003"
dependsOn:
  - "WO-05-002"
last_updated: "2026-06-18"
---
# WO-05-003 — Work-order detail tabs

## Summary

Wires work-order detail tabs into work orders without touching neighbouring features. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Expose a typed result for every expected failure and render it as a designed state.
- Persist nothing new; the change only reads what the factory already writes.
- Keep the module under the size limits and document its exported functions.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-05-003.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-05-003.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-05-003.3 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** none beyond the props of the parent component.
