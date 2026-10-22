---
id: "WO-08-007"
type: "work-order"
slug: "front-matter-and-slug"
title: "WO-08-007 — Front matter and slug"
status: "ACTIVE"
parent: "FRD-08"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/writer/**"
source_requirements:
  - "REQ-08-007"
dependsOn:
  - "WO-08-006"
last_updated: "2026-07-01"
---
# WO-08-007 — Front matter and slug

## Summary

Adds front matter and slug, the piece blog writer skill needs before its screens can rely on real data. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-08-007.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-08-007.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-08-007.3 — WHEN front matter and slug has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** none beyond the props of the parent component.
