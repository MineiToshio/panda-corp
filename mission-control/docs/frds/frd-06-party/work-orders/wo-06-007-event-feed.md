---
id: WO-06-007
type: work-order
slug: event-feed
title: 'WO-06-007 — Event feed (vocabulary, failure-first, auto-scroll + pin, cap)'
status: DRAFT
parent: FRD-06
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-06-007 — Event feed (vocabulary, failure-first, auto-scroll + pin, cap)

**Components/Interfaces:** `CMP-06-feed` · **Traces:** REQ-06-006, REQ-06-012, REQ-06-013, REQ-06-014, REQ-06-011
**Deploy unit:** Party tab (Client Component) · **Location:** `app/projects/[slug]/_party/EventFeed.tsx` (+ `.test.tsx`)

## Acceptance criteria (verbatim EARS)
- AC-06-006.1: The view SHALL show a **log** of the workflow events (subagent actions and handoffs between stages).
- AC-06-012.1: The events SHALL use a fixed, bounded iconic vocabulary; tool = extra icon.
- AC-06-013.1: Failure SHALL be a first-class state ... distinct from "completed". Never hidden in a log.
- AC-06-014.1: The feed SHALL **auto-scroll to the new** with a "pin" button when the operator scrolls up, and a **cap of 100–200 events** in memory (discards the oldest).
- AC-06-011.1: Each agent SHALL have a fixed color reused across the UI; multi-project → project-color + agent-color borders.

## Scope
- Renders the event list from `EventVM[]` (WO-06-001): icon + tool icon, agent-color marker, Spanish label, `tabular-nums` timestamp.
- **Failure rows** visually distinct (danger token + ❌ + label) and never filtered.
- **Auto-scroll** to newest; when the user scrolls up, stop auto-scroll and show a **pin/"jump to latest"** button (`data-testid`); clicking re-pins.
- **Cap** at 100–200 in the rendered set (drop oldest) — assert it does not grow unbounded.
- Multi-project: project-color left border + agent-color second border when `projectColorKey` present.
- `aria-live="polite"` for new rows (announce without stealing focus, FRD-13).

## Dependencies
- WO-06-001 (`EventVM`, icon map), FRD-13 tokens (colors, tabular-nums, a11y).

## TDD / Definition of done
- Component tests: renders rows with the right icons; a failure event renders the danger treatment and is present (not hidden); adding >cap events keeps the list capped (oldest gone); scrolling up reveals the pin button and pauses auto-scroll; clicking it re-enables; a `project`-tagged event shows both borders.
- Gate green.
