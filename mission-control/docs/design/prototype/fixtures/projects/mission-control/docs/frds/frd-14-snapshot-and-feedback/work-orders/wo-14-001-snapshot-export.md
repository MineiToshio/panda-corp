---
id: "WO-14-001"
type: "work-order"
slug: "snapshot-export"
title: "WO-14-001 — Snapshot export"
status: "ACTIVE"
parent: "FRD-14"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/snapshot-and-feedback/**"
source_requirements:
  - "REQ-14-001"
dependsOn:
  - "WO-01-003"
last_updated: "2026-06-24"
---
# WO-14-001 — Snapshot export

## Summary

Builds snapshot export so the snapshot and feedback feature has one honest source for this behaviour. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Expose a typed result for every expected failure and render it as a designed state.
- Persist nothing new; the change only reads what the factory already writes.
- Keep the module under the size limits and document its exported functions.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-14-001.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-14-001.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-14-001.3 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** the shared resolver is the only new export.
