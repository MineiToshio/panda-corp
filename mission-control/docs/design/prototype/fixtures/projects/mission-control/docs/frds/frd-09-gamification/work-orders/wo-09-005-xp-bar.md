---
id: "WO-09-005"
type: "work-order"
slug: "xp-bar"
title: "WO-09-005 — XP bar"
status: "ACTIVE"
parent: "FRD-09"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/gamification/**"
source_requirements:
  - "REQ-09-005"
dependsOn:
  - "WO-09-004"
last_updated: "2026-06-19"
---
# WO-09-005 — XP bar

## Summary

Wires xP bar into gamification without touching neighbouring features. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Log the invariant it relies on next to the code, not in a separate note.
- Reuse the existing reader instead of re-deriving the same value.
- Add the keyboard path and an accessible name for every new control.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-09-005.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-09-005.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-09-005.3 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** none beyond the props of the parent component.
