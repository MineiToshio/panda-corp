---
id: "WO-04-003"
type: "work-order"
slug: "characters-places-and-factions-index"
title: "WO-04-003 — Characters, places and factions index"
status: "ACTIVE"
parent: "FRD-04"
implementation_status: "PLANNED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/encyclopedia/**"
source_requirements:
  - "REQ-04-003"
dependsOn:
  - "WO-04-002"
last_updated: "2026-10-17"
---
# WO-04-003 — Characters, places and factions index

## Summary

Introduces characters, places and factions index with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-04-003.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-04-003.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-04-003.3 — WHEN characters, places and factions index has data, the screen SHALL show it using the shared tokens.

## Status Note

**Planned:** starts once WO-04-002 is verified.
