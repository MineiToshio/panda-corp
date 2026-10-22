---
id: "WO-01-002"
type: "work-order"
slug: "email-account-with-magic-link"
title: "WO-01-002 — Email account with magic link"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "PLANNED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/reader/**"
source_requirements:
  - "REQ-01-002"
dependsOn:
  - "WO-01-001"
last_updated: "2026-10-17"
---
# WO-01-002 — Email account with magic link

## Summary

Adds email account with magic link, the piece reader account and progress needs before its screens can rely on real data. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-01-002.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-01-002.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Planned:** starts once WO-01-001 is verified.
