---
id: "WO-23-005"
type: "work-order"
slug: "factory-wide-store"
title: "WO-23-005 — Factory-wide store"
status: "ACTIVE"
parent: "FRD-23"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/materialized-stats-read-model/**"
source_requirements:
  - "REQ-23-005"
dependsOn:
  - "WO-23-004"
last_updated: "2026-07-07"
---
# WO-23-005 — Factory-wide store

## Summary

Wires factory-wide store into materialized stats read model without touching neighbouring features. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render factory-wide store with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-23-005.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-23-005.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-23-005.3 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** the shared resolver is the only new export.
