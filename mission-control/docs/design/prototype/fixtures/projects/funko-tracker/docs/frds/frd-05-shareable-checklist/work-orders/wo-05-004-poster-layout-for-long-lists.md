---
id: "WO-05-004"
type: "work-order"
slug: "poster-layout-for-long-lists"
title: "WO-05-004 — Poster layout for long lists"
status: "ACTIVE"
parent: "FRD-05"
implementation_status: "IN_REVIEW"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/export/**"
source_requirements:
  - "REQ-05-004"
dependsOn:
  - "WO-05-003"
last_updated: "2026-10-18"
---
# WO-05-004 — Poster layout for long lists

## Summary

Adds poster layout for long lists, the piece shareable checklist needs before its screens can rely on real data. The change is additive and leaves the existing routes untouched.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-05-004.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-05-004.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** the shared resolver is the only new export.
