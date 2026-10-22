---
id: "WO-01-007"
type: "work-order"
slug: "decision-inbox-parser"
title: "WO-01-007 — Decision inbox parser"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/data-reading/**"
source_requirements:
  - "REQ-01-007"
dependsOn:
  - "WO-01-006"
last_updated: "2026-06-16"
---
# WO-01-007 — Decision inbox parser

## Summary

Builds decision inbox parser so the data reading feature has one honest source for this behaviour. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Expose a typed result for every expected failure and render it as a designed state.
- Persist nothing new; the change only reads what the factory already writes.
- Keep the module under the size limits and document its exported functions.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-01-007.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-01-007.2 — WHEN decision inbox parser has data, the screen SHALL show it using the shared tokens.
- AC-01-007.3 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** the shared resolver is the only new export.
