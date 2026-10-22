---
id: "WO-13-004"
type: "work-order"
slug: "dialog-focus-trap"
title: "WO-13-004 — Dialog focus trap"
status: "ACTIVE"
parent: "FRD-13"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/visual-system-accessibility/**"
source_requirements:
  - "REQ-13-004"
dependsOn:
  - "WO-13-003"
last_updated: "2026-06-21"
---
# WO-13-004 — Dialog focus trap

## Summary

Implements dialog focus trap end to end, from the reader to the rendered state. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Log the invariant it relies on next to the code, not in a separate note.
- Reuse the existing reader instead of re-deriving the same value.
- Add the keyboard path and an accessible name for every new control.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-13-004.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-13-004.2 — WHEN dialog focus trap has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** the shared resolver is the only new export.
