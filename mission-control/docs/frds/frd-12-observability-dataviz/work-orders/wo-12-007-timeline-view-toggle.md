---
id: WO-12-007
type: work-order
slug: timeline-view-toggle
title: WO-12-007 — Timeline view + RPG↔timeline↔DAG toggle
status: DRAFT
parent: FRD-12
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-17'
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

## Status Note

**Built:** WO-12-007 implements `RpgTimelineToggle` (CMP-12-toggle) — the three-view panel switcher (RPG ↔ Timeline ↔ DAG) over the same data snapshot. `TimelineView` (CMP-12-timeline) was already delivered by WO-12-004 UI and is consumed here unchanged.

**Files delivered:**
- `app/_observability/RpgTimelineToggle.tsx` — `"use client"`, `localStorage` persistence (`"mc:view-mode"`), RPG slot injection (no hard import of FRD-06 to avoid cycle), `TimelineView` and `WorkOrderDag` as the other two panels. Zero hardcoded colors; Spanish aria-labels; `tabular-nums`; `aria-selected` on `role="tab"` buttons (correct ARIA semantics — `aria-pressed` is invalid on `role="tab"`, Biome enforces this).
- `app/_observability/RpgTimelineToggle.test.tsx` — 39 tests (RED→GREEN), 11 groups covering: tab button rendering, default-RPG view, switch to timeline, switch to DAG, switch back to RPG, localStorage persistence (read on mount + write on click, fallback on corrupt/SecurityError), RPG slot rendering, same-snapshot invariant, zero-hardcoded-color assertion, a11y (single `aria-selected=true` at a time, panel role), valid modes parameterized.

**Interfaces/contracts exposed:**
```tsx
// RpgTimelineToggle.tsx
export interface RpgTimelineToggleProps {
  timelineRows: TimelineRow[];                         // from IF-12-timeline
  workOrders: (WorkOrder & { dependsOn?: string[] })[]; // for WorkOrderDag
  rpgSlot: React.ReactNode;                            // FRD-06 scene as slot
  executingId?: string;                                // forwarded to WorkOrderDag
}
export function RpgTimelineToggle(props: RpgTimelineToggleProps): React.JSX.Element
```

**data-testid map:**
- `rpg-timeline-toggle` — root container
- `rpg-timeline-toggle-btn-rpg` — RPG tab button (`aria-selected`, `role="tab"`)
- `rpg-timeline-toggle-btn-timeline` — Timeline tab button
- `rpg-timeline-toggle-btn-dag` — DAG tab button
- `rpg-timeline-toggle-panel` — active panel (`role="tabpanel"`)

**localStorage key:** `"mc:view-mode"` — values `"rpg"` | `"timeline"` | `"dag"`; falls back to `"rpg"` on any error or invalid value (prototype-pollution guard, SecurityError guard, empty-string guard).

**Integration seams:**
- FRD-06 WO-06-010 passes the Party scene as `rpgSlot` and the current events/work-orders as the other props.
- `TimelineView` imported from `"@/app/_observability/TimelineView"` (already VERIFIED from WO-12-004).
- `WorkOrderDag` imported from `"@/app/_observability/dag/WorkOrderDag"` (already IN_REVIEW from WO-12-006).

**Test files:** `app/_observability/RpgTimelineToggle.test.tsx`

**Gate:** `verify.sh` GREEN — biome + tsc + vitest (112 files, 3257 tests pass, 2 expected-fail, 5 skipped).
