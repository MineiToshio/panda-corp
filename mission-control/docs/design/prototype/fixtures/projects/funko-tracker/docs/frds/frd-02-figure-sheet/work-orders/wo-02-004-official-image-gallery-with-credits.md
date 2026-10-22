---
id: "WO-02-004"
type: "work-order"
slug: "official-image-gallery-with-credits"
title: "WO-02-004 — Official image gallery with credits"
status: "ACTIVE"
parent: "FRD-02"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/app/figure/**"
source_requirements:
  - "REQ-02-004"
dependsOn:
  - "WO-02-003"
last_updated: "2026-10-18"
---
# WO-02-004 — Official image gallery with credits

## Summary

Wires official image gallery with credits into figure detail sheet without touching neighbouring features. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Expose a typed result for every expected failure and render it as a designed state.
- Persist nothing new; the change only reads what the factory already writes.
- Keep the module under the size limits and document its exported functions.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-02-004.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-02-004.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** the shared resolver is the only new export.
