---
id: "WO-01-005"
type: "work-order"
slug: "project-path-existence-check"
title: "WO-01-005 — Project path existence check"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/data-reading/**"
source_requirements:
  - "REQ-01-005"
dependsOn:
  - "WO-01-004"
last_updated: "2026-06-16"
---
# WO-01-005 — Project path existence check

## Summary

Builds project path existence check so the data reading feature has one honest source for this behaviour. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Log the invariant it relies on next to the code, not in a separate note.
- Reuse the existing reader instead of re-deriving the same value.
- Add the keyboard path and an accessible name for every new control.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-01-005.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-01-005.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-01-005.3 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** none beyond the props of the parent component.
