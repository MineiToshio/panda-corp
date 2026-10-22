---
id: "WO-04-002"
type: "work-order"
slug: "summary-tab"
title: "WO-04-002 — Summary tab"
status: "ACTIVE"
parent: "FRD-04"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/project-workspace/**"
source_requirements:
  - "REQ-04-002"
dependsOn:
  - "WO-04-001"
last_updated: "2026-06-17"
---
# WO-04-002 — Summary tab

## Summary

Implements summary tab end to end, from the reader to the rendered state. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Add the keyboard path and an accessible name for every new control.
- Cover the happy path and one malformed input with unit tests written first.
- Log the invariant it relies on next to the code, not in a separate note.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-04-002.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-04-002.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** the shared resolver is the only new export.
