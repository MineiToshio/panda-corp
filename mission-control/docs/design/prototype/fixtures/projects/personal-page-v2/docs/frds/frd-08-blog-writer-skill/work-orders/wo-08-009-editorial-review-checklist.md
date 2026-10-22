---
id: "WO-08-009"
type: "work-order"
slug: "editorial-review-checklist"
title: "WO-08-009 — Editorial review checklist"
status: "ACTIVE"
parent: "FRD-08"
implementation_status: "PLANNED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/writer/**"
source_requirements:
  - "REQ-08-009"
dependsOn:
  - "WO-08-008"
last_updated: "2026-06-30"
---
# WO-08-009 — Editorial review checklist

## Summary

Adds editorial review checklist, the piece blog writer skill needs before its screens can rely on real data. The change is additive and leaves the existing routes untouched.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render editorial review checklist with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-08-009.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-08-009.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-08-009.3 — WHEN editorial review checklist has data, the screen SHALL show it using the shared tokens.

## Status Note

**Planned:** starts once WO-08-008 is verified.
