---
id: "WO-23-002"
type: "work-order"
slug: "per-project-portada-writer"
title: "WO-23-002 — Per-project portada writer"
status: "ACTIVE"
parent: "FRD-23"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/materialized-stats-read-model/**"
source_requirements:
  - "REQ-23-002"
dependsOn:
  - "WO-23-001"
last_updated: "2026-07-07"
---
# WO-23-002 — Per-project portada writer

## Summary

Adds per-project portada writer, the piece materialized stats read model needs before its screens can rely on real data. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Render per-project portada writer with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-23-002.1 — WHEN per-project portada writer has data, the screen SHALL show it using the shared tokens.
- AC-23-002.2 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** consumed only by its parent route; no other module imports it.
