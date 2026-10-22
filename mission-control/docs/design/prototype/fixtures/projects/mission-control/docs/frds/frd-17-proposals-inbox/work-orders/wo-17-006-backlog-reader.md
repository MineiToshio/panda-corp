---
id: "WO-17-006"
type: "work-order"
slug: "backlog-reader"
title: "WO-17-006 — Backlog reader"
status: "ACTIVE"
parent: "FRD-17"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/proposals-inbox/**"
source_requirements:
  - "REQ-17-006"
dependsOn:
  - "WO-17-005"
last_updated: "2026-07-01"
---
# WO-17-006 — Backlog reader

## Summary

Builds backlog reader so the proposals inbox feature has one honest source for this behaviour. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Add the keyboard path and an accessible name for every new control.
- Cover the happy path and one malformed input with unit tests written first.
- Log the invariant it relies on next to the code, not in a separate note.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-17-006.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-17-006.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** consumed only by its parent route; no other module imports it.
