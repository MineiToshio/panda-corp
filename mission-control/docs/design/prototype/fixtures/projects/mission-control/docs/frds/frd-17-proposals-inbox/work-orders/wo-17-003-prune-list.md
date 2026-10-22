---
id: "WO-17-003"
type: "work-order"
slug: "prune-list"
title: "WO-17-003 — Prune list"
status: "ACTIVE"
parent: "FRD-17"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/proposals-inbox/**"
source_requirements:
  - "REQ-17-003"
dependsOn:
  - "WO-17-002"
last_updated: "2026-07-01"
---
# WO-17-003 — Prune list

## Summary

Delivers prune list as a small, testable slice of proposals inbox. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Render prune list with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-17-003.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-17-003.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-17-003.3 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** the shared resolver is the only new export.
