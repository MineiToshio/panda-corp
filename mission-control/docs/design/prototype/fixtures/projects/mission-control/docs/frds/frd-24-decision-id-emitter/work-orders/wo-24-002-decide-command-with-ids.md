---
id: "WO-24-002"
type: "work-order"
slug: "decide-command-with-ids"
title: "WO-24-002 — Decide command with ids"
status: "ACTIVE"
parent: "FRD-24"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/decision-id-emitter/**"
source_requirements:
  - "REQ-24-002"
dependsOn:
  - "WO-24-001"
last_updated: "2026-09-03"
---
# WO-24-002 — Decide command with ids

## Summary

Implements decide command with ids end to end, from the reader to the rendered state. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render decide command with ids with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-24-002.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-24-002.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** none beyond the props of the parent component.
