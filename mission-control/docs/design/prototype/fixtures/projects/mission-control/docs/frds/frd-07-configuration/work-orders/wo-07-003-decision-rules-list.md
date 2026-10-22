---
id: "WO-07-003"
type: "work-order"
slug: "decision-rules-list"
title: "WO-07-003 — Decision rules list"
status: "ACTIVE"
parent: "FRD-07"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/configuration/**"
source_requirements:
  - "REQ-07-003"
dependsOn:
  - "WO-07-002"
last_updated: "2026-06-19"
---
# WO-07-003 — Decision rules list

## Summary

Builds decision rules list so the configuration feature has one honest source for this behaviour. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render decision rules list with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-07-003.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-07-003.2 — WHEN decision rules list has data, the screen SHALL show it using the shared tokens.
- AC-07-003.3 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** none beyond the props of the parent component.
