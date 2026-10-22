---
id: "WO-01-003"
type: "work-order"
slug: "merge-guest-progress-into-an-account"
title: "WO-01-003 — Merge guest progress into an account"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "PLANNED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/app/reader/**"
source_requirements:
  - "REQ-01-003"
dependsOn:
  - "WO-01-002"
last_updated: "2026-10-17"
---
# WO-01-003 — Merge guest progress into an account

## Summary

Implements merge guest progress into an account end to end, from the reader to the rendered state. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Add the keyboard path and an accessible name for every new control.
- Cover the happy path and one malformed input with unit tests written first.
- Log the invariant it relies on next to the code, not in a separate note.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-01-003.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-01-003.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-01-003.3 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Planned:** starts once WO-01-002 is verified.
