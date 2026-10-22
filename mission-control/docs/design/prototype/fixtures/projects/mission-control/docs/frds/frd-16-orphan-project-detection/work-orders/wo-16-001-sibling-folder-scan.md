---
id: "WO-16-001"
type: "work-order"
slug: "sibling-folder-scan"
title: "WO-16-001 — Sibling folder scan"
status: "ACTIVE"
parent: "FRD-16"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/orphan-project-detection/**"
source_requirements:
  - "REQ-16-001"
dependsOn:
  - "WO-01-009"
last_updated: "2026-06-30"
---
# WO-16-001 — Sibling folder scan

## Summary

Implements sibling folder scan end to end, from the reader to the rendered state. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render sibling folder scan with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-16-001.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-16-001.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-16-001.3 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** consumed only by its parent route; no other module imports it.
