---
id: "WO-15-004"
type: "work-order"
slug: "update-command-copy"
title: "WO-15-004 — Update command copy"
status: "ACTIVE"
parent: "FRD-15"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/plugin-out-of-sync-warning/**"
source_requirements:
  - "REQ-15-004"
dependsOn:
  - "WO-15-003"
last_updated: "2026-06-26"
---
# WO-15-004 — Update command copy

## Summary

Wires update command copy into plugin out-of-sync warning without touching neighbouring features. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Expose a typed result for every expected failure and render it as a designed state.
- Persist nothing new; the change only reads what the factory already writes.
- Keep the module under the size limits and document its exported functions.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-15-004.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-15-004.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** consumed only by its parent route; no other module imports it.
