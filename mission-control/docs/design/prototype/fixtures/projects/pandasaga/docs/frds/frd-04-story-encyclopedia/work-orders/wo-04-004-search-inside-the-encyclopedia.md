---
id: "WO-04-004"
type: "work-order"
slug: "search-inside-the-encyclopedia"
title: "WO-04-004 — Search inside the encyclopedia"
status: "ACTIVE"
parent: "FRD-04"
implementation_status: "PLANNED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/encyclopedia/**"
source_requirements:
  - "REQ-04-004"
dependsOn:
  - "WO-04-003"
last_updated: "2026-10-17"
---
# WO-04-004 — Search inside the encyclopedia

## Summary

Implements search inside the encyclopedia end to end, from the reader to the rendered state. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Log the invariant it relies on next to the code, not in a separate note.
- Reuse the existing reader instead of re-deriving the same value.
- Add the keyboard path and an accessible name for every new control.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-04-004.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-04-004.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Planned:** starts once WO-04-003 is verified.
