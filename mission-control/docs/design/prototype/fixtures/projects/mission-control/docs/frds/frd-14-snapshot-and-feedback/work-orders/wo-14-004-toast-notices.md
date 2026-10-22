---
id: "WO-14-004"
type: "work-order"
slug: "toast-notices"
title: "WO-14-004 — Toast notices"
status: "ACTIVE"
parent: "FRD-14"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/snapshot-and-feedback/**"
source_requirements:
  - "REQ-14-004"
dependsOn:
  - "WO-14-003"
last_updated: "2026-06-24"
---
# WO-14-004 — Toast notices

## Summary

Introduces toast notices with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-14-004.1 — WHEN toast notices has data, the screen SHALL show it using the shared tokens.
- AC-14-004.2 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** none beyond the props of the parent component.
