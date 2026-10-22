---
id: "WO-14-002"
type: "work-order"
slug: "feedback-channel-links"
title: "WO-14-002 — Feedback channel links"
status: "ACTIVE"
parent: "FRD-14"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/snapshot-and-feedback/**"
source_requirements:
  - "REQ-14-002"
dependsOn:
  - "WO-14-001"
last_updated: "2026-06-24"
---
# WO-14-002 — Feedback channel links

## Summary

Delivers feedback channel links as a small, testable slice of snapshot and feedback. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render feedback channel links with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-14-002.1 — WHEN feedback channel links has data, the screen SHALL show it using the shared tokens.
- AC-14-002.2 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** the shared resolver is the only new export.
