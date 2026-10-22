---
id: "WO-05-001"
type: "work-order"
slug: "connection-graph-data"
title: "WO-05-001 — Connection graph data"
status: "ACTIVE"
parent: "FRD-05"
implementation_status: "PLANNED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/connections/**"
source_requirements:
  - "REQ-05-001"
dependsOn:
  - "WO-04-001"
last_updated: "2026-10-17"
---
# WO-05-001 — Connection graph data

## Summary

Implements connection graph data end to end, from the reader to the rendered state. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Log the invariant it relies on next to the code, not in a separate note.
- Reuse the existing reader instead of re-deriving the same value.
- Add the keyboard path and an accessible name for every new control.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-05-001.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-05-001.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-05-001.3 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Planned:** starts once WO-04-001 is verified.
