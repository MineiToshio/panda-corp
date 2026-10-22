---
id: "WO-06-006"
type: "work-order"
slug: "reduced-motion-variant"
title: "WO-06-006 — Reduced-motion variant"
status: "ACTIVE"
parent: "FRD-06"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/party/**"
source_requirements:
  - "REQ-06-006"
dependsOn:
  - "WO-06-005"
last_updated: "2026-06-18"
---
# WO-06-006 — Reduced-motion variant

## Summary

Builds reduced-motion variant so the party feature has one honest source for this behaviour. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render reduced-motion variant with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-06-006.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-06-006.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** consumed only by its parent route; no other module imports it.
