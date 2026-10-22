---
id: "WO-01-001"
type: "work-order"
slug: "catalog-read-model-and-seed-loader"
title: "WO-01-001 — Catalog read model and seed loader"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "IN_REVIEW"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/catalog/**"
source_requirements:
  - "REQ-01-001"
dependsOn: []
last_updated: "2026-10-18"
---
# WO-01-001 — Catalog read model and seed loader

## Summary

Builds catalog read model and seed loader so the browse the catalog feature has one honest source for this behaviour. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render catalog read model and seed loader with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-01-001.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-01-001.2 — WHEN catalog read model and seed loader has data, the screen SHALL show it using the shared tokens.
- AC-01-001.3 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** none beyond the props of the parent component.
