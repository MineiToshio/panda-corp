---
id: "WO-02-002"
type: "work-order"
slug: "variant-switcher-on-the-sheet"
title: "WO-02-002 — Variant switcher on the sheet"
status: "ACTIVE"
parent: "FRD-02"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/figure/**"
source_requirements:
  - "REQ-02-002"
dependsOn:
  - "WO-02-001"
last_updated: "2026-10-18"
---
# WO-02-002 — Variant switcher on the sheet

## Summary

Builds variant switcher on the sheet so the figure detail sheet feature has one honest source for this behaviour. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render variant switcher on the sheet with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-02-002.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-02-002.2 — WHEN variant switcher on the sheet has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** consumed only by its parent route; no other module imports it.
