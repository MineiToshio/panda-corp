---
id: "WO-05-003"
type: "work-order"
slug: "export-modes-for-all-owned-and-missing"
title: "WO-05-003 — Export modes for all, owned and missing"
status: "ACTIVE"
parent: "FRD-05"
implementation_status: "IN_REVIEW"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/app/export/**"
source_requirements:
  - "REQ-05-003"
dependsOn:
  - "WO-05-002"
last_updated: "2026-10-18"
---
# WO-05-003 — Export modes for all, owned and missing

## Summary

Wires export modes for all, owned and missing into shareable checklist without touching neighbouring features. It removes a manual step the owner was doing by hand during the last iteration.

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
