---
id: "WO-15-001"
type: "work-order"
slug: "installed-version-reader"
title: "WO-15-001 — Installed version reader"
status: "ACTIVE"
parent: "FRD-15"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/plugin-out-of-sync-warning/**"
source_requirements:
  - "REQ-15-001"
dependsOn:
  - "WO-01-006"
last_updated: "2026-06-26"
---
# WO-15-001 — Installed version reader

## Summary

Introduces installed version reader with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-15-001.1 — WHEN installed version reader has data, the screen SHALL show it using the shared tokens.
- AC-15-001.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-15-001.3 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** consumed only by its parent route; no other module imports it.
