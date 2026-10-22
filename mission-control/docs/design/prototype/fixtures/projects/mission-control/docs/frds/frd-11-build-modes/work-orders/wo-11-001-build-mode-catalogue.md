---
id: "WO-11-001"
type: "work-order"
slug: "build-mode-catalogue"
title: "WO-11-001 — Build mode catalogue"
status: "ACTIVE"
parent: "FRD-11"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/build-modes/**"
source_requirements:
  - "REQ-11-001"
dependsOn:
  - "WO-01-004"
last_updated: "2026-06-20"
---
# WO-11-001 — Build mode catalogue

## Summary

Introduces build mode catalogue with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Render build mode catalogue with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-11-001.1 — WHEN build mode catalogue has data, the screen SHALL show it using the shared tokens.
- AC-11-001.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-11-001.3 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** consumed only by its parent route; no other module imports it.
