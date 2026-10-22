---
id: "WO-02-003"
type: "work-order"
slug: "chapter-bounded-visibility-filter"
title: "WO-02-003 — Chapter-bounded visibility filter"
status: "ACTIVE"
parent: "FRD-02"
implementation_status: "PLANNED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/catalog/**"
source_requirements:
  - "REQ-02-003"
dependsOn:
  - "WO-02-002"
last_updated: "2026-10-17"
---
# WO-02-003 — Chapter-bounded visibility filter

## Summary

Introduces chapter-bounded visibility filter with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-02-003.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-02-003.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-02-003.3 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Planned:** starts once WO-02-002 is verified.
