---
id: "WO-11-002"
type: "work-order"
slug: "mode-switch-with-memory"
title: "WO-11-002 — Mode switch with memory"
status: "ACTIVE"
parent: "FRD-11"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/build-modes/**"
source_requirements:
  - "REQ-11-002"
dependsOn:
  - "WO-11-001"
last_updated: "2026-06-20"
---
# WO-11-002 — Mode switch with memory

## Summary

Implements mode switch with memory end to end, from the reader to the rendered state. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Log the invariant it relies on next to the code, not in a separate note.
- Reuse the existing reader instead of re-deriving the same value.
- Add the keyboard path and an accessible name for every new control.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-11-002.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-11-002.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** none beyond the props of the parent component.
