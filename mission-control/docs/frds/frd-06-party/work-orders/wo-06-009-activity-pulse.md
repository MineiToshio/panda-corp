---
id: WO-06-009
type: work-order
slug: activity-pulse
title: WO-06-009 — Activity pulse (per-agent bars)
status: DRAFT
parent: FRD-06
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
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

## Status Note

**Built:** `ActivityPulse` client component (`CMP-06-pulse`) satisfying AC-06-015.1 (REQ-06-015).

**Files delivered:**
- `app/projects/[slug]/_party/ActivityPulse.tsx` — `"use client"` component; accepts `buckets: Bucket[]` (from `IF-12-rate`); renders per-minute stacked bars colored per agent via `AGENT_COLOR` CSS vars; stalled indicator when most-recent bucket is empty or no buckets.
- `app/projects/[slug]/_party/ActivityPulse.test.tsx` — 22 tests (RED→GREEN) covering all acceptance criteria.

**Interfaces / contracts exposed:**
```ts
// CMP-06-pulse — ActivityPulse
export interface ActivityPulseProps {
  buckets: Bucket[];  // from eventsPerMinute(events, window, now) — IF-12-rate
}
export function ActivityPulse(props: ActivityPulseProps): React.JSX.Element
```

**Integration seams:**
- Consumes `Bucket[]` from `app/_observability/selectors/rate.ts` (`IF-12-rate`, WO-12-003 VERIFIED) — caller is responsible for calling `eventsPerMinute` and passing the result.
- Agent color via `AGENT_COLOR` from `app/_design/tokens.ts` (`IF-13-agent-colors`, WO-13-001 VERIFIED).
- The stalled indicator is text + icon (not color-only) — FRD-13 rule satisfied.
- `data-testid` surface: `activity-pulse` (root), `activity-pulse-chart`, `activity-pulse-stalled`, `activity-pulse-bar-{agentRole}` (one per agent per bucket), `activity-pulse-label`.

**Test coverage:** `app/projects/[slug]/_party/ActivityPulse.test.tsx` — 22 tests, all GREEN.

**Gate:** 140 test files, 3821 tests passed, biome clean, tsc clean (pre-existing `layout.test.ts` Role error is outside WO scope).
