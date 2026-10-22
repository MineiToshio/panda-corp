---
id: "WO-06-002"
type: "work-order"
slug: "chapter-page-with-what-changed"
title: "WO-06-002 — Chapter page with what changed"
status: "ACTIVE"
parent: "FRD-06"
implementation_status: "PLANNED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/chapters/**"
source_requirements:
  - "REQ-06-002"
dependsOn:
  - "WO-06-001"
last_updated: "2026-10-17"
---
# WO-06-002 — Chapter page with what changed

## Summary

Builds chapter page with what changed so the chapter explorer feature has one honest source for this behaviour. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Log the invariant it relies on next to the code, not in a separate note.
- Reuse the existing reader instead of re-deriving the same value.
- Add the keyboard path and an accessible name for every new control.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-06-002.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-06-002.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Planned:** starts once WO-06-001 is verified.
