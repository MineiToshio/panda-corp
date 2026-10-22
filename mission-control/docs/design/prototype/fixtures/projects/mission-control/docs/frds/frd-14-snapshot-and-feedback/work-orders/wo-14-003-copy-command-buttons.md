---
id: "WO-14-003"
type: "work-order"
slug: "copy-command-buttons"
title: "WO-14-003 — Copy command buttons"
status: "ACTIVE"
parent: "FRD-14"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/snapshot-and-feedback/**"
source_requirements:
  - "REQ-14-003"
dependsOn:
  - "WO-14-002"
last_updated: "2026-06-24"
---
# WO-14-003 — Copy command buttons

## Summary

Implements copy command buttons end to end, from the reader to the rendered state. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Log the invariant it relies on next to the code, not in a separate note.
- Reuse the existing reader instead of re-deriving the same value.
- Add the keyboard path and an accessible name for every new control.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-14-003.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-14-003.2 — WHEN copy command buttons has data, the screen SHALL show it using the shared tokens.
- AC-14-003.3 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** the shared resolver is the only new export.
