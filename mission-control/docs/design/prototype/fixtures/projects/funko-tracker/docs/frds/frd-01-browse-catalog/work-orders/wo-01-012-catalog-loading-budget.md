---
id: "WO-01-012"
type: "work-order"
slug: "catalog-loading-budget"
title: "WO-01-012 — Catalog loading budget"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/catalog/**"
source_requirements:
  - "REQ-01-012"
dependsOn:
  - "WO-01-011"
last_updated: "2026-10-18"
---
# WO-01-012 — Catalog loading budget

## Summary

Wires catalog loading budget into browse the catalog without touching neighbouring features. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render catalog loading budget with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-01-012.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-01-012.2 — WHEN catalog loading budget has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** consumed only by its parent route; no other module imports it.
