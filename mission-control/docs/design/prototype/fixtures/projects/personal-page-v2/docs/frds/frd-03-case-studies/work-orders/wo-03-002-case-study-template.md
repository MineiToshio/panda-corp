---
id: "WO-03-002"
type: "work-order"
slug: "case-study-template"
title: "WO-03-002 — Case study template"
status: "ACTIVE"
parent: "FRD-03"
implementation_status: "PLANNED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/projects/**"
source_requirements:
  - "REQ-03-002"
dependsOn:
  - "WO-03-001"
last_updated: "2026-06-30"
---
# WO-03-002 — Case study template

## Summary

Adds case study template, the piece projects and case studies needs before its screens can rely on real data. The change is additive and leaves the existing routes untouched.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render case study template with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-03-002.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-03-002.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Planned:** starts once WO-03-001 is verified.
