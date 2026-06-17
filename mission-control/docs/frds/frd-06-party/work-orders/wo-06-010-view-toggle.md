---
id: WO-06-010
type: work-order
slug: view-toggle
title: WO-06-010 — RPG ↔ timeline/DAG toggle + Live/No-signal badge
status: DRAFT
parent: FRD-06
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
# WO-06-010 — RPG ↔ timeline/DAG toggle + Live/No-signal badge

**Components/Interfaces:** `CMP-06-view-toggle` · **Traces:** REQ-06-016
**Deploy unit:** Party tab (Client Component) · **Location:** `app/projects/[slug]/_party/RpgViewToggle.tsx` (+ `.test.tsx`)

## Acceptance criteria (verbatim EARS)
- AC-06-016.1: It SHALL offer an honest **RPG ↔ timeline/tree toggle** over the same data (work orders → tasks → actions), and a **Live / No signal** indicator with the timestamp of the last event.

## Scope
- A toggle control that swaps the Party scene for FRD-12's timeline/DAG view (`CMP-12-toggle`) over the **same** snapshot data — no separate fetch.
- Host the **Live / No-signal** badge: consume FRD-12's freshness component (`CMP-12-freshness`) showing the last-event timestamp (`tabular-nums`); state shown by **icon + label**, never color alone (FRD-13).
- Persist the chosen view in `localStorage` (consistent with the client-local UI state, architecture §4.8).

## Dependencies
- **FRD-12 `CMP-12-toggle` + `CMP-12-freshness`** — cross-feature, hard.
- WO-06-006 (the Party scene it toggles away from).

## TDD / Definition of done
- Component tests: toggling switches the rendered view and back; the Live/No-signal badge shows the timestamp; with a stale `lastEventAt` it shows "Sin señal" with its icon (not color-only); the choice persists across remount (localStorage mocked).
- Gate green.

## Status Note

**Built:** WO-06-010 implements `RpgViewToggle` (CMP-06-view-toggle) — the Party-specific host that wraps FRD-12's `RpgTimelineToggle` (CMP-12-toggle) and `FreshnessBadge` (CMP-12-freshness) into a single component. The toggle switches RPG ↔ Timeline ↔ DAG over the same data snapshot (no separate fetch); the badge shows Live/No-signal with the last-event timestamp.

**Files delivered:**
- `app/projects/[slug]/_party/RpgViewToggle.tsx` — `"use client"`, wraps `RpgTimelineToggle` (CMP-12-toggle) + `FreshnessBadge` (CMP-12-freshness). Zero hardcoded colors. Spanish aria-labels. State shown by icon + label, never color alone (FRD-13). `data-testid` on all significant elements.
- `app/projects/[slug]/_party/RpgViewToggle.test.tsx` — 34 tests (RED→GREEN), 9 groups covering: root container render, FreshnessBadge live state, FreshnessBadge stale/no-signal state, RpgTimelineToggle delegation (default RPG view), view switching (timeline/DAG/back), localStorage persistence (read on mount + write on click + fallback), FRD-13 no-color-only constraint (icon+label always present + role=status), design tokens (no hex colors), props contract (empty inputs, null rpgSlot, single aria-selected=true at a time).

**Interfaces/contracts exposed:**
```tsx
// RpgViewToggle.tsx
export interface RpgViewToggleProps {
  timelineRows: TimelineRow[];                         // from IF-12-timeline (toTimeline)
  workOrders: (WorkOrder & { dependsOn?: string[] })[]; // for WorkOrderDag inside toggle
  rpgSlot: React.ReactNode;                            // FRD-06 Party scene as slot (no hard cycle)
  live: boolean;                                       // from freshness(events, now).live
  lastEventAt: string | null;                          // from freshness(events, now).lastAt
  executingId?: string;                                // forwarded to WorkOrderDag
}
export function RpgViewToggle(props: RpgViewToggleProps): React.JSX.Element
```

**data-testid map:**
- `rpg-view-toggle` — root container
- `rpg-view-toggle-header` — header row (badge area)
- `rpg-view-toggle-badge` — wraps FreshnessBadge
- Delegated from CMP-12-toggle: `rpg-timeline-toggle`, `rpg-timeline-toggle-btn-{rpg|timeline|dag}`, `rpg-timeline-toggle-panel`
- Delegated from CMP-12-freshness: `freshness-badge` (`role="status"`), `freshness-icon` (`aria-hidden="true"`), `freshness-live-label`, `freshness-no-signal-label`, `freshness-timestamp` (`fontVariantNumeric: tabular-nums`)

**localStorage key:** `"mc:view-mode"` — managed by the inner `RpgTimelineToggle` (WO-12-007); values `"rpg"` | `"timeline"` | `"dag"`; falls back to `"rpg"` on any error or invalid value.

**Integration seams:**
- The caller (e.g. PartyTab or a future RSC wrapper) computes `freshness(events, now)` and passes `live` + `lastEventAt` as props.
- The Party scene is passed as `rpgSlot` — no hard import of FRD-06 into FRD-12 (avoids circular dependency, mirrors WO-12-007 pattern).
- `timelineRows` and `workOrders` come from the same RSC snapshot (no separate fetch — AC-06-016.1).
- Import: `import { RpgViewToggle } from "@/app/projects/[slug]/_party/RpgViewToggle"`.

**Test files:** `app/projects/[slug]/_party/RpgViewToggle.test.tsx`

**Gate:** tsc clean, biome clean, 34/34 new tests GREEN. Pre-existing `PartyScene.test.tsx` failures (`window.matchMedia` — WO-06-006 issue, unrelated to this WO) remain unchanged.
