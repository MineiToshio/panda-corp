---
id: "WO-20-001"
type: "work-order"
slug: "factory-overlay-version-reader"
title: "WO-20-001 — Factory overlay version reader"
status: "ACTIVE"
parent: "FRD-20"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/overlay-freshness/**"
source_requirements:
  - "REQ-20-001"
dependsOn:
  - "WO-01-001"
last_updated: "2026-07-07"
---
# WO-20-001 — Factory overlay version reader

## Summary

Introduces factory overlay version reader with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Render factory overlay version reader with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-20-001.1 — WHEN factory overlay version reader has data, the screen SHALL show it using the shared tokens.
- AC-20-001.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-20-001.3 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** consumed only by its parent route; no other module imports it.
