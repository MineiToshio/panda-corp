---
id: "WO-09-006"
type: "work-order"
slug: "durable-outcome-merge"
title: "WO-09-006 — Durable outcome merge"
status: "ACTIVE"
parent: "FRD-09"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/gamification/**"
source_requirements:
  - "REQ-09-006"
dependsOn:
  - "WO-09-005"
last_updated: "2026-06-19"
---
# WO-09-006 — Durable outcome merge

## Summary

Delivers durable outcome merge as a small, testable slice of gamification. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Render durable outcome merge with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-09-006.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-09-006.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** none beyond the props of the parent component.
