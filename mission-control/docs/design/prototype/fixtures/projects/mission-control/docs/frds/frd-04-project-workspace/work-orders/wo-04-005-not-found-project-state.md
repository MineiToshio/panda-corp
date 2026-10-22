---
id: "WO-04-005"
type: "work-order"
slug: "not-found-project-state"
title: "WO-04-005 — Not-found project state"
status: "ACTIVE"
parent: "FRD-04"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/project-workspace/**"
source_requirements:
  - "REQ-04-005"
dependsOn:
  - "WO-04-004"
last_updated: "2026-06-17"
---
# WO-04-005 — Not-found project state

## Summary

Delivers not-found project state as a small, testable slice of project workspace. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render not-found project state with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-04-005.1 — WHEN not-found project state has data, the screen SHALL show it using the shared tokens.
- AC-04-005.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-04-005.3 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** the shared resolver is the only new export.
