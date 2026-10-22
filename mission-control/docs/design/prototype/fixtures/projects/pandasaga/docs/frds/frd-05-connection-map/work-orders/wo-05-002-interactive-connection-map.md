---
id: "WO-05-002"
type: "work-order"
slug: "interactive-connection-map"
title: "WO-05-002 — Interactive connection map"
status: "ACTIVE"
parent: "FRD-05"
implementation_status: "PLANNED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/connections/**"
source_requirements:
  - "REQ-05-002"
dependsOn:
  - "WO-05-001"
last_updated: "2026-10-17"
---
# WO-05-002 — Interactive connection map

## Summary

Adds interactive connection map, the piece connection map needs before its screens can rely on real data. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Render interactive connection map with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-05-002.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-05-002.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Planned:** starts once WO-05-001 is verified.
