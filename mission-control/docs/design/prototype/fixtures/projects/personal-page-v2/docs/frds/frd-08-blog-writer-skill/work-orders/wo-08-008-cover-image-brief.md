---
id: "WO-08-008"
type: "work-order"
slug: "cover-image-brief"
title: "WO-08-008 — Cover image brief"
status: "ACTIVE"
parent: "FRD-08"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/writer/**"
source_requirements:
  - "REQ-08-008"
dependsOn:
  - "WO-08-007"
last_updated: "2026-07-01"
---
# WO-08-008 — Cover image brief

## Summary

Wires cover image brief into blog writer skill without touching neighbouring features. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Log the invariant it relies on next to the code, not in a separate note.
- Reuse the existing reader instead of re-deriving the same value.
- Add the keyboard path and an accessible name for every new control.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-08-008.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-08-008.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** consumed only by its parent route; no other module imports it.
