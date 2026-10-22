---
id: "WO-07-004"
type: "work-order"
slug: "standards-with-facets"
title: "WO-07-004 — Standards with facets"
status: "ACTIVE"
parent: "FRD-07"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/configuration/**"
source_requirements:
  - "REQ-07-004"
dependsOn:
  - "WO-07-003"
last_updated: "2026-06-19"
---
# WO-07-004 — Standards with facets

## Summary

Adds standards with facets, the piece configuration needs before its screens can rely on real data. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Render standards with facets with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-07-004.1 — WHEN standards with facets has data, the screen SHALL show it using the shared tokens.
- AC-07-004.2 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** consumed only by its parent route; no other module imports it.
