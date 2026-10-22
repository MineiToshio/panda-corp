---
id: "WO-03-001"
type: "work-order"
slug: "project-index-from-content-files"
title: "WO-03-001 — Project index from content files"
status: "ACTIVE"
parent: "FRD-03"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/app/projects/**"
source_requirements:
  - "REQ-03-001"
dependsOn:
  - "WO-01-004"
last_updated: "2026-06-30"
---
# WO-03-001 — Project index from content files

## Summary

Wires project index from content files into projects and case studies without touching neighbouring features. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Expose a typed result for every expected failure and render it as a designed state.
- Persist nothing new; the change only reads what the factory already writes.
- Keep the module under the size limits and document its exported functions.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-03-001.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-03-001.2 — WHEN project index from content files has data, the screen SHALL show it using the shared tokens.
- AC-03-001.3 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** consumed only by its parent route; no other module imports it.
