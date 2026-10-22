---
id: "WO-12-001"
type: "work-order"
slug: "build-timeline-reader"
title: "WO-12-001 — Build timeline reader"
status: "ACTIVE"
parent: "FRD-12"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/observability-dataviz/**"
source_requirements:
  - "REQ-12-001"
dependsOn:
  - "WO-01-007"
last_updated: "2026-06-21"
---
# WO-12-001 — Build timeline reader

## Summary

Wires build timeline reader into observability and dataviz without touching neighbouring features. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Log the invariant it relies on next to the code, not in a separate note.
- Reuse the existing reader instead of re-deriving the same value.
- Add the keyboard path and an accessible name for every new control.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-12-001.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-12-001.2 — WHEN build timeline reader has data, the screen SHALL show it using the shared tokens.
- AC-12-001.3 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** consumed only by its parent route; no other module imports it.
