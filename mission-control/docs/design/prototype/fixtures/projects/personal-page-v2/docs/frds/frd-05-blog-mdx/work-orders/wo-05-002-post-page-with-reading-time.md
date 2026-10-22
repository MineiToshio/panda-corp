---
id: "WO-05-002"
type: "work-order"
slug: "post-page-with-reading-time"
title: "WO-05-002 — Post page with reading time"
status: "ACTIVE"
parent: "FRD-05"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/blog/**"
source_requirements:
  - "REQ-05-002"
dependsOn:
  - "WO-05-001"
last_updated: "2026-07-01"
---
# WO-05-002 — Post page with reading time

## Summary

Adds post page with reading time, the piece blog in MDX needs before its screens can rely on real data. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Render post page with reading time with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-05-002.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-05-002.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** consumed only by its parent route; no other module imports it.
