---
id: "WO-12-003"
type: "work-order"
slug: "dependency-graph-layout"
title: "WO-12-003 — Dependency graph layout"
status: "ACTIVE"
parent: "FRD-12"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/observability-dataviz/**"
source_requirements:
  - "REQ-12-003"
dependsOn:
  - "WO-12-002"
last_updated: "2026-06-21"
---
# WO-12-003 — Dependency graph layout

## Summary

Implements dependency graph layout end to end, from the reader to the rendered state. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Expose a typed result for every expected failure and render it as a designed state.
- Persist nothing new; the change only reads what the factory already writes.
- Keep the module under the size limits and document its exported functions.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-12-003.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-12-003.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-12-003.3 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** the shared resolver is the only new export.
