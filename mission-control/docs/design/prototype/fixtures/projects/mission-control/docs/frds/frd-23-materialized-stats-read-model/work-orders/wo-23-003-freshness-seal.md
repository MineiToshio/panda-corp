---
id: "WO-23-003"
type: "work-order"
slug: "freshness-seal"
title: "WO-23-003 — Freshness seal"
status: "ACTIVE"
parent: "FRD-23"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/materialized-stats-read-model/**"
source_requirements:
  - "REQ-23-003"
dependsOn:
  - "WO-23-002"
last_updated: "2026-07-07"
---
# WO-23-003 — Freshness seal

## Summary

Wires freshness seal into materialized stats read model without touching neighbouring features. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Expose a typed result for every expected failure and render it as a designed state.
- Persist nothing new; the change only reads what the factory already writes.
- Keep the module under the size limits and document its exported functions.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-23-003.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-23-003.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-23-003.3 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** the shared resolver is the only new export.
