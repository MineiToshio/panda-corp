---
id: "WO-02-007"
type: "work-order"
slug: "card-detail-with-tabs"
title: "WO-02-007 — Card detail with tabs"
status: "ACTIVE"
parent: "FRD-02"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/ideas-board/**"
source_requirements:
  - "REQ-02-007"
dependsOn:
  - "WO-02-005"
last_updated: "2026-06-16"
---
# WO-02-007 — Card detail with tabs

## Summary

Delivers card detail with tabs as a small, testable slice of ideas board. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render card detail with tabs with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-02-007.1 — WHEN card detail with tabs has data, the screen SHALL show it using the shared tokens.
- AC-02-007.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-02-007.3 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** consumed only by its parent route; no other module imports it.
