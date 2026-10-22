---
id: "WO-01-016"
type: "work-order"
slug: "catalog-smoke-and-visual-baselines"
title: "WO-01-016 — Catalog smoke and visual baselines"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "IN_REVIEW"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/catalog/**"
source_requirements:
  - "REQ-01-016"
dependsOn:
  - "WO-01-015"
last_updated: "2026-10-18"
---
# WO-01-016 — Catalog smoke and visual baselines

## Summary

Builds catalog smoke and visual baselines so the browse the catalog feature has one honest source for this behaviour. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Log the invariant it relies on next to the code, not in a separate note.
- Reuse the existing reader instead of re-deriving the same value.
- Add the keyboard path and an accessible name for every new control.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-01-016.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-01-016.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** consumed only by its parent route; no other module imports it.
