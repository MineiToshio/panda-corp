---
id: "WO-10-003"
type: "work-order"
slug: "mission-chains"
title: "WO-10-003 — Mission chains"
status: "ACTIVE"
parent: "FRD-10"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/achievements-hall/**"
source_requirements:
  - "REQ-10-003"
dependsOn:
  - "WO-10-002"
last_updated: "2026-06-20"
---
# WO-10-003 — Mission chains

## Summary

Builds mission chains so the achievements hall feature has one honest source for this behaviour. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render mission chains with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-10-003.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-10-003.2 — WHEN mission chains has data, the screen SHALL show it using the shared tokens.
- AC-10-003.3 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** consumed only by its parent route; no other module imports it.
