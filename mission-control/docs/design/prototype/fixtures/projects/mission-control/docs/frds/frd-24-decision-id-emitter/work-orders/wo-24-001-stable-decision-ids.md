---
id: "WO-24-001"
type: "work-order"
slug: "stable-decision-ids"
title: "WO-24-001 — Stable decision ids"
status: "ACTIVE"
parent: "FRD-24"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/decision-id-emitter/**"
source_requirements:
  - "REQ-24-001"
dependsOn:
  - "WO-01-003"
last_updated: "2026-09-03"
---
# WO-24-001 — Stable decision ids

## Summary

Adds stable decision ids, the piece decision id emitter needs before its screens can rely on real data. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-24-001.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-24-001.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-24-001.3 — WHEN stable decision ids has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** consumed only by its parent route; no other module imports it.
