---
id: "WO-20-002"
type: "work-order"
slug: "upgrade-notice-on-the-summary"
title: "WO-20-002 — Upgrade notice on the summary"
status: "ACTIVE"
parent: "FRD-20"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/overlay-freshness/**"
source_requirements:
  - "REQ-20-002"
dependsOn:
  - "WO-20-001"
last_updated: "2026-07-07"
---
# WO-20-002 — Upgrade notice on the summary

## Summary

Implements upgrade notice on the summary end to end, from the reader to the rendered state. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Log the invariant it relies on next to the code, not in a separate note.
- Reuse the existing reader instead of re-deriving the same value.
- Add the keyboard path and an accessible name for every new control.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-20-002.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-20-002.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** none beyond the props of the parent component.
