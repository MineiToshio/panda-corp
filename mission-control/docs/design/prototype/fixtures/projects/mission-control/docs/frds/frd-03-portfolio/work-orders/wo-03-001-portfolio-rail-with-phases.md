---
id: "WO-03-001"
type: "work-order"
slug: "portfolio-rail-with-phases"
title: "WO-03-001 — Portfolio rail with phases"
status: "ACTIVE"
parent: "FRD-03"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/portfolio/**"
source_requirements:
  - "REQ-03-001"
dependsOn:
  - "WO-01-010"
last_updated: "2026-06-17"
---
# WO-03-001 — Portfolio rail with phases

## Summary

Wires portfolio rail with phases into portfolio without touching neighbouring features. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Expose a typed result for every expected failure and render it as a designed state.
- Persist nothing new; the change only reads what the factory already writes.
- Keep the module under the size limits and document its exported functions.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-03-001.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-03-001.2 — WHEN portfolio rail with phases has data, the screen SHALL show it using the shared tokens.
- AC-03-001.3 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** consumed only by its parent route; no other module imports it.
