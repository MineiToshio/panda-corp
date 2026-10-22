---
id: "WO-05-006"
type: "work-order"
slug: "export-history-page"
title: "WO-05-006 — Export history page"
status: "ACTIVE"
parent: "FRD-05"
implementation_status: "IN_REVIEW"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/export/**"
source_requirements:
  - "REQ-05-006"
dependsOn:
  - "WO-05-005"
last_updated: "2026-10-18"
---
# WO-05-006 — Export history page

## Summary

Adds export history page, the piece shareable checklist needs before its screens can rely on real data. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-05-006.1 — WHEN export history page has data, the screen SHALL show it using the shared tokens.
- AC-05-006.2 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** none beyond the props of the parent component.
