---
id: WO-06-009
type: work-order
slug: activity-pulse
title: WO-06-009 — Activity pulse (per-agent bars)
status: DRAFT
parent: FRD-06
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-06-009 — Activity pulse (per-agent bars)

**Components/Interfaces:** `CMP-06-pulse` · **Traces:** REQ-06-015
**Deploy unit:** Party tab (Client Component) · **Location:** `app/projects/[slug]/_party/ActivityPulse.tsx` (+ `.test.tsx`)

## Acceptance criteria (verbatim EARS)
- AC-06-015.1: It SHALL show an **activity pulse** (bars per minute, color per agent) that indicates at a glance whether the factory is alive or stalled.

## Scope
- Render bars of events-per-minute, colored per agent, from FRD-12's shared selector `IF-12-rate` (do **not** re-derive the rate here — consume FRD-12's pure selector to avoid duplication).
- "Alive vs stalled" affordance: when the latest bucket is empty/old, the pulse visibly flattens (paired with the Live/No-signal badge in WO-06-010, not color-only).
- Per-agent color from `IF-06-agent-color` (FRD-13 tokens).

## Dependencies
- **FRD-12 `IF-12-rate`** (events-per-minute selector) — cross-feature, hard. Must exist first.
- WO-06-002 (`agentColor`), FRD-13 tokens.

## TDD / Definition of done
- Component tests: given a fixture rate series, renders one bar group per active agent with the right colors and `tabular-nums` counts; an empty recent bucket renders the flattened/stalled state.
- Gate green.
