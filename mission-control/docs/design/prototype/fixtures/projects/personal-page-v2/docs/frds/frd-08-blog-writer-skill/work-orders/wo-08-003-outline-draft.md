---
id: "WO-08-003"
type: "work-order"
slug: "outline-draft"
title: "WO-08-003 — Outline draft"
status: "ACTIVE"
parent: "FRD-08"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/writer/**"
source_requirements:
  - "REQ-08-003"
dependsOn:
  - "WO-08-002"
last_updated: "2026-07-01"
---
# WO-08-003 — Outline draft

## Summary

Introduces outline draft with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Render outline draft with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-08-003.1 — WHEN outline draft has data, the screen SHALL show it using the shared tokens.
- AC-08-003.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-08-003.3 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** consumed only by its parent route; no other module imports it.
