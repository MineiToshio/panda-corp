---
id: "WO-06-001"
type: "work-order"
slug: "chapter-list-per-release"
title: "WO-06-001 — Chapter list per release"
status: "ACTIVE"
parent: "FRD-06"
implementation_status: "PLANNED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/chapters/**"
source_requirements:
  - "REQ-06-001"
dependsOn:
  - "WO-01-005"
last_updated: "2026-10-17"
---
# WO-06-001 — Chapter list per release

## Summary

Adds chapter list per release, the piece chapter explorer needs before its screens can rely on real data. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Render chapter list per release with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-06-001.1 — WHEN chapter list per release has data, the screen SHALL show it using the shared tokens.
- AC-06-001.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-06-001.3 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Planned:** starts once WO-01-005 is verified.
