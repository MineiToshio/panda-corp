---
id: "WO-04-005"
type: "work-order"
slug: "bookmarks-for-entries"
title: "WO-04-005 — Bookmarks for entries"
status: "ACTIVE"
parent: "FRD-04"
implementation_status: "PLANNED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/encyclopedia/**"
source_requirements:
  - "REQ-04-005"
dependsOn:
  - "WO-04-004"
last_updated: "2026-10-17"
---
# WO-04-005 — Bookmarks for entries

## Summary

Delivers bookmarks for entries as a small, testable slice of story encyclopedia. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render bookmarks for entries with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-04-005.1 — WHEN bookmarks for entries has data, the screen SHALL show it using the shared tokens.
- AC-04-005.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-04-005.3 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Planned:** starts once WO-04-004 is verified.
