---
id: "WO-01-006"
type: "work-order"
slug: "progress-bar-per-work"
title: "WO-01-006 — Progress bar per work"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "PLANNED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/reader/**"
source_requirements:
  - "REQ-01-006"
dependsOn:
  - "WO-01-005"
last_updated: "2026-10-17"
---
# WO-01-006 — Progress bar per work

## Summary

Introduces progress bar per work with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Render progress bar per work with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-01-006.1 — WHEN progress bar per work has data, the screen SHALL show it using the shared tokens.
- AC-01-006.2 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Planned:** starts once WO-01-005 is verified.
