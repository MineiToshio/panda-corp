---
id: "WO-23-001"
type: "work-order"
slug: "stats-schema"
title: "WO-23-001 — Stats schema"
status: "ACTIVE"
parent: "FRD-23"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/materialized-stats-read-model/**"
source_requirements:
  - "REQ-23-001"
dependsOn:
  - "WO-01-010"
last_updated: "2026-07-07"
---
# WO-23-001 — Stats schema

## Summary

Builds stats schema so the materialized stats read model feature has one honest source for this behaviour. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Log the invariant it relies on next to the code, not in a separate note.
- Reuse the existing reader instead of re-deriving the same value.
- Add the keyboard path and an accessible name for every new control.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-23-001.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-23-001.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-23-001.3 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** consumed only by its parent route; no other module imports it.
