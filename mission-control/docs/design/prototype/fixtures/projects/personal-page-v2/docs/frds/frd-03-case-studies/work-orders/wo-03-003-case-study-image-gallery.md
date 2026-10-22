---
id: "WO-03-003"
type: "work-order"
slug: "case-study-image-gallery"
title: "WO-03-003 — Case study image gallery"
status: "ACTIVE"
parent: "FRD-03"
implementation_status: "PLANNED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/projects/**"
source_requirements:
  - "REQ-03-003"
dependsOn:
  - "WO-03-002"
last_updated: "2026-06-30"
---
# WO-03-003 — Case study image gallery

## Summary

Builds case study image gallery so the projects and case studies feature has one honest source for this behaviour. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Log the invariant it relies on next to the code, not in a separate note.
- Reuse the existing reader instead of re-deriving the same value.
- Add the keyboard path and an accessible name for every new control.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-03-003.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-03-003.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-03-003.3 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Planned:** starts once WO-03-002 is verified.
