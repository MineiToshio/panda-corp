---
id: "WO-09-003"
type: "work-order"
slug: "ledger-snapshot"
title: "WO-09-003 — Ledger snapshot"
status: "ACTIVE"
parent: "FRD-09"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/gamification/**"
source_requirements:
  - "REQ-09-003"
dependsOn:
  - "WO-09-002"
last_updated: "2026-06-19"
---
# WO-09-003 — Ledger snapshot

## Summary

Builds ledger snapshot so the gamification feature has one honest source for this behaviour. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Add the keyboard path and an accessible name for every new control.
- Cover the happy path and one malformed input with unit tests written first.
- Log the invariant it relies on next to the code, not in a separate note.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-09-003.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-09-003.2 — WHEN ledger snapshot has data, the screen SHALL show it using the shared tokens.
- AC-09-003.3 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** the shared resolver is the only new export.
