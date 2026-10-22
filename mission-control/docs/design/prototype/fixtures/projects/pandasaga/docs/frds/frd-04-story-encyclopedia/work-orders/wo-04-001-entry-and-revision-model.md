---
id: "WO-04-001"
type: "work-order"
slug: "entry-and-revision-model"
title: "WO-04-001 — Entry and revision model"
status: "ACTIVE"
parent: "FRD-04"
implementation_status: "PLANNED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/encyclopedia/**"
source_requirements:
  - "REQ-04-001"
dependsOn:
  - "WO-02-003"
last_updated: "2026-10-17"
---
# WO-04-001 — Entry and revision model

## Summary

Introduces entry and revision model with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-04-001.1 — WHEN entry and revision model has data, the screen SHALL show it using the shared tokens.
- AC-04-001.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-04-001.3 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Planned:** starts once WO-02-003 is verified.
