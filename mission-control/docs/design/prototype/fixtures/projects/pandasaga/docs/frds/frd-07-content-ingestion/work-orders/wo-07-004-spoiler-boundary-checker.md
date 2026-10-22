---
id: "WO-07-004"
type: "work-order"
slug: "spoiler-boundary-checker"
title: "WO-07-004 — Spoiler boundary checker"
status: "ACTIVE"
parent: "FRD-07"
implementation_status: "PLANNED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/ingestion/**"
source_requirements:
  - "REQ-07-004"
dependsOn:
  - "WO-07-003"
last_updated: "2026-10-17"
---
# WO-07-004 — Spoiler boundary checker

## Summary

Adds spoiler boundary checker, the piece content ingestion needs before its screens can rely on real data. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Render spoiler boundary checker with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-07-004.1 — WHEN spoiler boundary checker has data, the screen SHALL show it using the shared tokens.
- AC-07-004.2 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Planned:** starts once WO-07-003 is verified.
