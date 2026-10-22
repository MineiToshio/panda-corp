---
id: "WO-01-007"
type: "work-order"
slug: "continue-reading-shelf"
title: "WO-01-007 — Continue-reading shelf"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "PLANNED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/app/reader/**"
source_requirements:
  - "REQ-01-007"
dependsOn:
  - "WO-01-006"
last_updated: "2026-10-17"
---
# WO-01-007 — Continue-reading shelf

## Summary

Builds continue-reading shelf so the reader account and progress feature has one honest source for this behaviour. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Expose a typed result for every expected failure and render it as a designed state.
- Persist nothing new; the change only reads what the factory already writes.
- Keep the module under the size limits and document its exported functions.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-01-007.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-01-007.2 — WHEN continue-reading shelf has data, the screen SHALL show it using the shared tokens.
- AC-01-007.3 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Planned:** starts once WO-01-006 is verified.
