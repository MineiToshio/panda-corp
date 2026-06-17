"use client";

/**
 * WO-06-010 — RpgViewToggle (CMP-06-view-toggle)
 *
 * Party-specific host that wraps:
 *   - CMP-12-toggle (RpgTimelineToggle) — the three-panel switcher
 *     (RPG ↔ Timeline ↔ DAG) over the same Party snapshot.
 *   - CMP-12-freshness (FreshnessBadge) — the Live / No-signal indicator
 *     with the last-event timestamp in tabular-nums.
 *
 * The chosen view is persisted in localStorage (key "mc:view-mode") via the
 * inner RpgTimelineToggle — this component only passes props through.
 *
 * State is always shown by icon + label, NEVER color alone (FRD-13 rule).
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every significant element.
 *   - Spanish aria-labels.
 *   - tabular-nums on the timestamp via FreshnessBadge.
 *
 * Props:
 *   timelineRows    — TimelineRow[] for the Timeline panel.
 *   workOrders      — WorkOrder[] (with optional dependsOn) for the DAG panel.
 *   rpgSlot         — React.ReactNode: the Party RPG scene (FRD-06 scene),
 *                     injected as a slot to avoid a hard import cycle.
 *   live            — boolean: true = "En vivo", false = "Sin señal".
 *   lastEventAt     — string | null: ISO 8601 timestamp of last event, or null.
 *   executingId?    — forwarded to WorkOrderDag inside RpgTimelineToggle.
 *
 * Traceability:
 *   CMP-06-view-toggle → REQ-06-016, AC-06-016.1 → WO-06-010
 *   CMP-12-toggle (RpgTimelineToggle) → WO-12-007
 *   CMP-12-freshness (FreshnessBadge) → WO-12-005
 *   Architecture §4.8 — localStorage persistence ("mc:view-mode").
 */

import type React from "react";
import { FreshnessBadge } from "@/app/_observability/FreshnessBadge";
import { RpgTimelineToggle } from "@/app/_observability/RpgTimelineToggle";
import type { TimelineRow } from "@/app/_observability/selectors/timeline";
import type { WorkOrder } from "@/lib/work-orders";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WorkOrderWithDeps = WorkOrder & { dependsOn?: string[] };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RpgViewToggleProps {
  /** Timeline rows from toTimeline (IF-12-timeline). Passed to TimelineView. */
  timelineRows: TimelineRow[];
  /** Work orders (with optional dependsOn) for the DAG view. */
  workOrders: WorkOrderWithDeps[];
  /**
   * The RPG scene, injected as a slot.
   * Rendered when the "rpg" view is active (no hard import of FRD-06 to avoid cycle).
   */
  rpgSlot: React.ReactNode;
  /**
   * True when the last event is within the freshness threshold ("En vivo").
   * Derived from freshness(events, now) by the parent Server Component.
   */
  live: boolean;
  /**
   * ISO 8601 timestamp of the last event, or null when no events exist.
   * Passed directly to FreshnessBadge (CMP-12-freshness).
   */
  lastEventAt: string | null;
  /** Optional id of the currently-executing work order. Forwarded to WorkOrderDag. */
  executingId?: string;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded color values
// ---------------------------------------------------------------------------

const CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

const HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * RpgViewToggle — CMP-06-view-toggle
 *
 * Hosts the Live/No-signal badge (FreshnessBadge) alongside the three-panel
 * toggle (RpgTimelineToggle). The RPG scene is passed as a slot so FRD-06
 * and FRD-12 have no circular import dependency.
 *
 * This component is "use client" because FreshnessBadge and RpgTimelineToggle
 * are both client components (localStorage, useState).
 */
export function RpgViewToggle({
  timelineRows,
  workOrders,
  rpgSlot,
  live,
  lastEventAt,
  executingId,
}: RpgViewToggleProps): React.JSX.Element {
  return (
    <div data-testid="rpg-view-toggle" style={CONTAINER_STYLE}>
      {/* Header: freshness badge + (tab buttons are inside RpgTimelineToggle's tab bar) */}
      <div data-testid="rpg-view-toggle-header" style={HEADER_STYLE}>
        {/* Live / No-signal badge (CMP-12-freshness) */}
        <div data-testid="rpg-view-toggle-badge">
          <FreshnessBadge live={live} lastAt={lastEventAt} />
        </div>
      </div>

      {/* Three-panel toggle: RPG ↔ Timeline ↔ DAG (CMP-12-toggle) */}
      <RpgTimelineToggle
        timelineRows={timelineRows}
        workOrders={workOrders}
        rpgSlot={rpgSlot}
        executingId={executingId}
      />
    </div>
  );
}
