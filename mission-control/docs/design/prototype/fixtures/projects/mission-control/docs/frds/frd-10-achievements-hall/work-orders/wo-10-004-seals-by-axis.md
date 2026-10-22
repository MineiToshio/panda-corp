---
id: "WO-10-004"
type: "work-order"
slug: "seals-by-axis"
title: "WO-10-004 — Seals by axis"
status: "ACTIVE"
parent: "FRD-10"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/achievements-hall/**"
source_requirements:
  - "REQ-10-004"
dependsOn:
  - "WO-10-003"
last_updated: "2026-06-20"
---
# WO-10-004 — Seals by axis

## Summary

Introduces seals by axis with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Render seals by axis with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-10-004.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-10-004.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** consumed only by its parent route; no other module imports it.
