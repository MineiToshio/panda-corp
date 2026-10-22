---
id: "WO-01-014"
type: "work-order"
slug: "keyboard-navigation-across-the-grid"
title: "WO-01-014 — Keyboard navigation across the grid"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/app/catalog/**"
source_requirements:
  - "REQ-01-014"
dependsOn:
  - "WO-01-013"
last_updated: "2026-10-18"
---
# WO-01-014 — Keyboard navigation across the grid

## Summary

Wires keyboard navigation across the grid into browse the catalog without touching neighbouring features. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Expose a typed result for every expected failure and render it as a designed state.
- Persist nothing new; the change only reads what the factory already writes.
- Keep the module under the size limits and document its exported functions.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-01-014.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-01-014.2 — WHEN keyboard navigation across the grid has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** the shared resolver is the only new export.
