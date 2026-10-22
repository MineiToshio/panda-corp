---
id: "WO-01-011"
type: "work-order"
slug: "session-and-device-list"
title: "WO-01-011 — Session and device list"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "PLANNED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/reader/**"
source_requirements:
  - "REQ-01-011"
dependsOn:
  - "WO-01-010"
last_updated: "2026-10-17"
---
# WO-01-011 — Session and device list

## Summary

Delivers session and device list as a small, testable slice of reader account and progress. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-01-011.1 — WHEN session and device list has data, the screen SHALL show it using the shared tokens.
- AC-01-011.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-01-011.3 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Planned:** starts once WO-01-010 is verified.
