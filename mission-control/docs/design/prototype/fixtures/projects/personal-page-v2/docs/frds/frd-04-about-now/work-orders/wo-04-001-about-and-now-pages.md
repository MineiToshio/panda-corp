---
id: "WO-04-001"
type: "work-order"
slug: "about-and-now-pages"
title: "WO-04-001 — About and now pages"
status: "ACTIVE"
parent: "FRD-04"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/about/**"
source_requirements:
  - "REQ-04-001"
dependsOn: []
last_updated: "2026-07-01"
---
# WO-04-001 — About and now pages

## Summary

Introduces about and now pages with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-04-001.1 — WHEN about and now pages has data, the screen SHALL show it using the shared tokens.
- AC-04-001.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-04-001.3 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** consumed only by its parent route; no other module imports it.
