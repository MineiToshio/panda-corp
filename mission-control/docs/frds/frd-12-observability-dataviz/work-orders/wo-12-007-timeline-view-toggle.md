---
id: WO-12-007
type: work-order
slug: timeline-view-toggle
title: WO-12-007 — Timeline view + RPG↔timeline↔DAG toggle
status: DRAFT
parent: FRD-12
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-12-007 — Timeline view + RPG↔timeline↔DAG toggle

**Components/Interfaces:** `CMP-12-timeline`, `CMP-12-toggle` · **Traces:** REQ-12-003
**Deploy unit:** project workspace (timeline/DAG surface) · **Location:** `app/_observability/TimelineView.tsx`, `RpgTimelineToggle.tsx` (+ `.test.tsx`)

## Acceptance criteria (verbatim EARS)
- AC-12-003.1: INSIDE a project, it SHALL offer an **RPG ↔ timeline/tree toggle** over the same data: work orders → tasks → actions, with duration and parent-child relationship.

## Scope
- `TimelineView` (RSC): render `IF-12-timeline` rows as a WO→task→action tree with durations and parent-child indentation; `tabular-nums` for durations/timestamps.
- `RpgTimelineToggle` (client): switch between RPG (FRD-06 scene), timeline (`CMP-12-timeline`) and DAG (`CMP-12-dag`) over the **same** snapshot — no separate fetch. Persist the choice in `localStorage` (architecture §4.8). **Consumed by FRD-06 WO-06-010.**

## Dependencies
- WO-12-004 (timeline selector), WO-12-006 (DAG). FRD-06 scene is injected as a slot (no hard import to avoid a cycle).
- FRD-13 tokens.

## TDD / Definition of done
- Component tests: timeline renders the nested rows with durations; the toggle switches among the three views over the same data and persists the choice (localStorage mocked); the RPG slot is rendered when selected.
- Gate green.
