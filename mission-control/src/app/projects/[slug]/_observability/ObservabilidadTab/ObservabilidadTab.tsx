"use client";

/**
 * WO-12-005 — ObservabilidadTab (CMP-12-toggle shell)
 *
 * The Observabilidad project tab — sibling of Party (AC-12-002.1):
 *   - A thin Panel strip: eye-search icon + "OBSERVABILIDAD · 2 vistas sobre los MISMOS
 *     work orders" eyebrow + the 2-view SubTabs toggle (Línea de tiempo ↔ DAG)
 *   - A muted hint pointing operators to Party for live agents (AC-12-002.2)
 *   - Hosts TimelineView (this WO) and WoDag stub (WO-12-006)
 *   - Live: subscribes to useLiveSnapshot (WO-01-009); derives GanttWorkOrder[] from
 *     the event stream via toTimeline(); falls back to the static WorkOrder[] list for
 *     Gantt positioning when no live data has arrived yet
 *
 * Prototype: observabilidadBody() (~L1214) + bTimeline() (~L1156)
 * Design rules (FRD-13): tokens only, icon+text state, tabular-nums, data-testid.
 *
 * Traceability:
 *   CMP-12-toggle → REQ-12-002/003/005 → AC-12-002.1/2/3, AC-12-003.1/2, AC-12-005.1/2
 */

import { useState } from "react";
import { toTimeline } from "@/app/_observability/selectors/timeline/timeline";
import { SubTabs } from "@/components/core/Tabs/Tabs";
import { useLiveSnapshot } from "@/hooks/useLiveSnapshot";
import type { EventsSnapshot } from "@/lib/events/events";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import type { GanttWorkOrder } from "../TimelineView/TimelineView";
import { TimelineView } from "../TimelineView/TimelineView";
import { WoDag } from "../WoDag/WoDag";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ObservabilidadTabProps {
  /** Static work orders from lib/work-orders (server-read list). */
  workOrders: WorkOrder[];
  /** Project slug — scopes the useLiveSnapshot subscription. */
  project: string;
}

type ObsView = "timeline" | "dag";

// ---------------------------------------------------------------------------
// State → WO state mapping from event status
// ---------------------------------------------------------------------------

type WoStateGantt = GanttWorkOrder["state"];

function timelineStatusToState(status: "ok" | "fail" | "running"): WoStateGantt {
  if (status === "ok") return "done";
  if (status === "fail") return "fail";
  return "in_progress";
}

function workOrderStateToGantt(state: WorkOrder["state"]): WoStateGantt {
  if (state === "done") return "done";
  if (state === "fail") return "fail";
  if (state === "in_progress") return "in_progress";
  if (state === "review") return "review";
  return "todo";
}

// ---------------------------------------------------------------------------
// Derive GanttWorkOrder[] from live snapshot events
// ---------------------------------------------------------------------------

/**
 * Convert a live EventsSnapshot into GanttWorkOrder[] for TimelineView.
 * Uses toTimeline (VERIFIED WO-12-004) to extract WO→task rows, then
 * computes minute-offset start/dur from the ISO timestamps.
 *
 * Falls back to static WorkOrder[] when the snapshot has no events.
 */
function deriveGanttOrders(
  snapshot: EventsSnapshot | null,
  staticOrders: WorkOrder[],
): { workOrders: GanttWorkOrder[]; total: number } {
  // With no live snapshot, derive a static Gantt from the WorkOrder list
  // (no real start/dur data — render with equal spacing as placeholder)
  if (snapshot === null || snapshot.events.length === 0) {
    return deriveStaticGantt(staticOrders);
  }

  // Run the VERIFIED toTimeline selector over the live events
  const rows = toTimeline(snapshot.events);

  // Find the global build start (min start across all WO rows)
  const woRows = rows.filter((r) => r.kind === "wo");
  if (woRows.length === 0) {
    return deriveStaticGantt(staticOrders);
  }

  const buildStartMs = woRows.reduce((min, r) => {
    const t = Date.parse(r.start);
    return Number.isFinite(t) && t < min ? t : min;
  }, Number.POSITIVE_INFINITY);

  if (!Number.isFinite(buildStartMs)) {
    return deriveStaticGantt(staticOrders);
  }

  // Map each WO row to GanttWorkOrder (start/dur in minutes)
  const taskRows = rows.filter((r) => r.kind === "task");

  let maxEnd = buildStartMs;

  const ganttOrders: GanttWorkOrder[] = woRows.map((woRow) => {
    const woStartMs = Date.parse(woRow.start);
    const start = Number.isFinite(woStartMs) ? Math.round((woStartMs - buildStartMs) / 60_000) : 0;

    const woEndMs = woRow.end !== null ? Date.parse(woRow.end) : null;
    const dur =
      woEndMs !== null && Number.isFinite(woEndMs)
        ? Math.max(1, Math.round((woEndMs - (woStartMs || buildStartMs)) / 60_000))
        : 1;

    const endMs = (Number.isFinite(woStartMs) ? woStartMs : buildStartMs) + dur * 60_000;
    if (endMs > maxEnd) maxEnd = endMs;

    // Build nested tasks from task rows that belong to this WO
    const woTaskRows = taskRows.filter((t) => t.parentId === woRow.id);
    const tasks = woTaskRows.map((taskRow) => {
      const taskEndMs = taskRow.end !== null ? Date.parse(taskRow.end) : null;
      const taskDur =
        taskEndMs !== null && taskRow.duration !== null && Number.isFinite(taskRow.duration)
          ? Math.max(1, Math.round(taskRow.duration / 60_000))
          : 1;
      return {
        title: taskRow.label,
        dur: taskDur,
        state: timelineStatusToState(taskRow.status),
      };
    });

    // Match to static WorkOrder for frd label
    const staticWo = staticOrders.find((o) => o.id === woRow.label);

    return {
      id: woRow.label,
      title: staticWo?.title ?? woRow.label,
      frd: staticWo?.frd ?? "–",
      state: timelineStatusToState(woRow.status),
      start,
      dur,
      tasks,
    };
  });

  const totalMs = maxEnd - buildStartMs;
  const total = Math.max(1, Math.round(totalMs / 60_000));

  return { workOrders: ganttOrders, total };
}

/**
 * Static Gantt fallback: spread work orders in order with equal spacing
 * so the timeline renders something meaningful before events arrive.
 */
function deriveStaticGantt(staticOrders: WorkOrder[]): {
  workOrders: GanttWorkOrder[];
  total: number;
} {
  const SLOT_MINS = 20; // estimated per-WO slot
  let offset = 0;

  const workOrders: GanttWorkOrder[] = staticOrders.map((wo) => {
    const dur = SLOT_MINS;
    const g: GanttWorkOrder = {
      id: wo.id,
      title: wo.title,
      frd: wo.frd,
      state: workOrderStateToGantt(wo.state),
      start: offset,
      dur,
      tasks: [],
    };
    offset += dur;
    return g;
  });

  return { workOrders, total: Math.max(offset, 1) };
}

// ---------------------------------------------------------------------------
// Tab definitions (shared SubTabs pattern — DR-062)
// ---------------------------------------------------------------------------

const OBS_TABS = [
  { id: "timeline", label: "Línea de tiempo", icon: "ti-timeline" },
  { id: "dag", label: "DAG", icon: "ti-binary-tree" },
];

// ---------------------------------------------------------------------------
// ObservabilidadTab
// ---------------------------------------------------------------------------

/**
 * ObservabilidadTab — the Observabilidad project sub-tab (sibling of Party).
 *
 * Prototype: observabilidadBody() (~L1214).
 * Live: subscribes to useLiveSnapshot; derives GanttWorkOrder[] from events.
 */
export function ObservabilidadTab({
  workOrders: staticOrders,
  project,
}: ObservabilidadTabProps): React.JSX.Element {
  // View state: "timeline" (default) or "dag" (AC-12-002.3)
  const [view, setView] = useState<ObsView>("timeline");

  // Live subscription (AC-12-005.1/.2) — WO-01-009
  const { snapshot } = useLiveSnapshot({ project });

  // Derive Gantt data from live events or static fallback
  const { workOrders: ganttOrders, total } = deriveGanttOrders(
    snapshot as EventsSnapshot | null,
    staticOrders,
  );

  return (
    <div data-testid="obs-shell" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* ── Header strip (prototype: panel + eyebrow + toggle) ── */}
      <div
        style={{
          background: "var(--color-panel)",
          border: "0.5px solid var(--color-border)",
          borderRadius: "var(--radius-md, 8px)",
          padding: "10px 12px",
          marginBottom: "0",
        }}
      >
        {/* Eyebrow row: icon + label + toggle */}
        <div
          data-testid="obs-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          {/* Left: eye-search icon + eyebrow text */}
          <div
            style={{
              fontSize: "11px",
              color: "var(--color-text3)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <i
              data-testid="obs-header-icon"
              className="ti ti-eye-search"
              aria-hidden="true"
              style={{ fontSize: "14px", color: "var(--color-accent-text)" }}
            />
            <span>OBSERVABILIDAD · 2 vistas sobre los MISMOS work orders</span>
          </div>

          {/* Right: Línea de tiempo ↔ DAG toggle — shared SubTabs pattern (DR-062) */}
          <div data-testid="obs-toggle">
            <SubTabs
              tabs={OBS_TABS}
              active={view}
              onChange={(id) => setView(id as ObsView)}
              ariaLabel="Vista de observabilidad"
            />
          </div>
        </div>

        {/* Party hint line (AC-12-002.2) */}
        <div
          data-testid="obs-party-hint"
          style={{
            fontSize: "11px",
            color: "var(--color-text3)",
            marginTop: "6px",
          }}
        >
          ¿Buscas a los agentes en vivo? Están en la pestaña{" "}
          <strong style={{ fontWeight: 500 }}>Party</strong>.
        </div>
      </div>

      {/* ── Active view body ── */}
      <div
        style={{
          background: "var(--color-panel)",
          border: "0.5px solid var(--color-border)",
          borderRadius: "var(--radius-md, 8px)",
          padding: "12px 14px",
        }}
      >
        {view === "timeline" ? (
          <div data-testid="obs-view-timeline">
            <TimelineView workOrders={ganttOrders} total={total} />
          </div>
        ) : (
          <WoDag workOrders={staticOrders} project={project} />
        )}
      </div>
    </div>
  );
}
