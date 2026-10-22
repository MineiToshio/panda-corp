---
id: "WO-03-008"
type: "work-order"
slug: "collection-counters-per-franchise"
title: "WO-03-008 — Collection counters per franchise"
status: "ACTIVE"
parent: "FRD-03"
implementation_status: "IN_REVIEW"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/collection/**"
source_requirements:
  - "REQ-03-008"
dependsOn:
  - "WO-03-007"
last_updated: "2026-10-18"
---
# WO-03-008 — Collection counters per franchise

## Summary

Delivers collection counters per franchise as a small, testable slice of account and private collection. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Render collection counters per franchise with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-03-008.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-03-008.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** the shared resolver is the only new export.
