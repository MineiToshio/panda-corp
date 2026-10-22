---
id: "WO-01-015"
type: "work-order"
slug: "phone-layout-for-the-series-grid"
title: "WO-01-015 — Phone layout for the series grid"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/catalog/**"
source_requirements:
  - "REQ-01-015"
dependsOn:
  - "WO-01-014"
last_updated: "2026-10-18"
---
# WO-01-015 — Phone layout for the series grid

## Summary

Adds phone layout for the series grid, the piece browse the catalog needs before its screens can rely on real data. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Render phone layout for the series grid with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-01-015.1 — WHEN phone layout for the series grid has data, the screen SHALL show it using the shared tokens.
- AC-01-015.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-01-015.3 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** the shared resolver is the only new export.
