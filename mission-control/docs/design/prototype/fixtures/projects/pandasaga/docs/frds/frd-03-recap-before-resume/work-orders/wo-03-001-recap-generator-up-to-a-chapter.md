---
id: "WO-03-001"
type: "work-order"
slug: "recap-generator-up-to-a-chapter"
title: "WO-03-001 — Recap generator up to a chapter"
status: "ACTIVE"
parent: "FRD-03"
implementation_status: "PLANNED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/app/recap/**"
source_requirements:
  - "REQ-03-001"
dependsOn:
  - "WO-02-003"
last_updated: "2026-10-17"
---
# WO-03-001 — Recap generator up to a chapter

## Summary

Wires recap generator up to a chapter into recap before resuming without touching neighbouring features. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Expose a typed result for every expected failure and render it as a designed state.
- Persist nothing new; the change only reads what the factory already writes.
- Keep the module under the size limits and document its exported functions.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-03-001.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-03-001.2 — WHEN recap generator up to a chapter has data, the screen SHALL show it using the shared tokens.
- AC-03-001.3 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Planned:** starts once WO-02-003 is verified.
