---
id: "WO-01-009"
type: "work-order"
slug: "pagination-with-stable-urls"
title: "WO-01-009 — Pagination with stable URLs"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/catalog/**"
source_requirements:
  - "REQ-01-009"
dependsOn:
  - "WO-01-008"
last_updated: "2026-10-18"
---
# WO-01-009 — Pagination with stable URLs

## Summary

Wires pagination with stable URLs into browse the catalog without touching neighbouring features. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render pagination with stable URLs with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-01-009.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-01-009.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-01-009.3 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** consumed only by its parent route; no other module imports it.
