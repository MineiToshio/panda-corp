---
id: "WO-09-001"
type: "work-order"
slug: "guild-level-from-outcomes"
title: "WO-09-001 — Guild level from outcomes"
status: "ACTIVE"
parent: "FRD-09"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/gamification/**"
source_requirements:
  - "REQ-09-001"
dependsOn:
  - "WO-01-008"
last_updated: "2026-06-19"
---
# WO-09-001 — Guild level from outcomes

## Summary

Implements guild level from outcomes end to end, from the reader to the rendered state. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render guild level from outcomes with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-09-001.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-09-001.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-09-001.3 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** consumed only by its parent route; no other module imports it.
