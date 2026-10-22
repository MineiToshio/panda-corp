---
id: "WO-06-003"
type: "work-order"
slug: "live-event-mapping"
title: "WO-06-003 — Live event mapping"
status: "ACTIVE"
parent: "FRD-06"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/party/**"
source_requirements:
  - "REQ-06-003"
dependsOn:
  - "WO-06-002"
last_updated: "2026-06-18"
---
# WO-06-003 — Live event mapping

## Summary

Introduces live event mapping with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render live event mapping with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-06-003.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-06-003.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-06-003.3 — WHEN live event mapping has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** the shared resolver is the only new export.
