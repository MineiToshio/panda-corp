---
id: "WO-23-006"
type: "work-order"
slug: "composed-informe-reader"
title: "WO-23-006 — Composed Informe reader"
status: "ACTIVE"
parent: "FRD-23"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/materialized-stats-read-model/**"
source_requirements:
  - "REQ-23-006"
dependsOn:
  - "WO-23-005"
last_updated: "2026-07-07"
---
# WO-23-006 — Composed Informe reader

## Summary

Delivers composed Informe reader as a small, testable slice of materialized stats read model. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-23-006.1 — WHEN composed Informe reader has data, the screen SHALL show it using the shared tokens.
- AC-23-006.2 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** consumed only by its parent route; no other module imports it.
