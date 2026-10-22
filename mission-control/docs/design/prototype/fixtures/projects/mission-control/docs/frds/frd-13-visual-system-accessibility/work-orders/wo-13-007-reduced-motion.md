---
id: "WO-13-007"
type: "work-order"
slug: "reduced-motion"
title: "WO-13-007 — Reduced motion"
status: "ACTIVE"
parent: "FRD-13"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/visual-system-accessibility/**"
source_requirements:
  - "REQ-13-007"
dependsOn:
  - "WO-13-006"
last_updated: "2026-06-21"
---
# WO-13-007 — Reduced motion

## Summary

Adds reduced motion, the piece visual system and accessibility needs before its screens can rely on real data. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Render reduced motion with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-13-007.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-13-007.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-13-007.3 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** none beyond the props of the parent component.
