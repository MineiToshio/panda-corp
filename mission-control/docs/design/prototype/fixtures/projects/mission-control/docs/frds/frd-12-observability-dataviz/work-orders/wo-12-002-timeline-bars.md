---
id: "WO-12-002"
type: "work-order"
slug: "timeline-bars"
title: "WO-12-002 — Timeline bars"
status: "ACTIVE"
parent: "FRD-12"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/observability-dataviz/**"
source_requirements:
  - "REQ-12-002"
dependsOn:
  - "WO-12-001"
last_updated: "2026-06-21"
---
# WO-12-002 — Timeline bars

## Summary

Introduces timeline bars with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Render timeline bars with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-12-002.1 — WHEN timeline bars has data, the screen SHALL show it using the shared tokens.
- AC-12-002.2 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** consumed only by its parent route; no other module imports it.
