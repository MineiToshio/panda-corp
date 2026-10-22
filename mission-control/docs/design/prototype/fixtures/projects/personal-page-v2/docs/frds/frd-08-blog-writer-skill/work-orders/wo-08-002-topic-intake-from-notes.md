---
id: "WO-08-002"
type: "work-order"
slug: "topic-intake-from-notes"
title: "WO-08-002 — Topic intake from notes"
status: "ACTIVE"
parent: "FRD-08"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/app/writer/**"
source_requirements:
  - "REQ-08-002"
dependsOn:
  - "WO-08-001"
last_updated: "2026-07-01"
---
# WO-08-002 — Topic intake from notes

## Summary

Builds topic intake from notes so the blog writer skill feature has one honest source for this behaviour. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Expose a typed result for every expected failure and render it as a designed state.
- Persist nothing new; the change only reads what the factory already writes.
- Keep the module under the size limits and document its exported functions.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-08-002.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-08-002.2 — WHEN topic intake from notes has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** the shared resolver is the only new export.
