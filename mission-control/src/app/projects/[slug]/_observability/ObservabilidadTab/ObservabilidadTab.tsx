"use client";

/**
 * WO-12-005 — ObservabilidadTab (CMP-12-toggle shell)
 *
 * The Observabilidad project tab — sibling of Party (AC-12-002.1):
 *   - A thin Panel strip: eye-search icon + "OBSERVABILIDAD · 2 vistas sobre los MISMOS
 *     work orders" eyebrow + the 2-view SubTabs toggle (Línea de tiempo ↔ DAG)
 *   - A muted hint pointing operators to Party for live agents (AC-12-002.2)
 *   - Hosts TimelineView (this WO) and WoDag (WO-12-006)
 *
 * Timeline v2: the timeline is no longer derived from the live event stream — it is
 * read server-side from the durable `.pandacorp/track.jsonl` (BuildTimeline, passed in
 * as the `timeline` prop). For LIVE updates (AC-12-005) we mount WoLiveRefresh: on each
 * SSE event it calls router.refresh(), so the server re-reads the track as the engine
 * appends to it — the timeline updates live from the same durable source. The fake
 * equal-width 20-min placeholder is gone.
 *
 * Design rules (FRD-13): tokens only, icon+text state, tabular-nums, data-testid.
 *
 * Traceability:
 *   CMP-12-toggle → REQ-12-002/003/005 → AC-12-002.1/2/3, AC-12-003.1/2, AC-12-005.1/2
 */

import { useState } from "react";
import { SubTabs } from "@/components/core/Tabs/Tabs";
import type { BuildTimeline } from "@/lib/build-track/build-track";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { WoLiveRefresh } from "../../_components/tab-work-orders/wo-live-refresh";
import { TimelineView } from "../TimelineView/TimelineView";
import { WoDag } from "../WoDag/WoDag";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ObservabilidadTabProps {
  /** Static work orders from lib/work-orders (server-read list) — feeds the DAG. */
  workOrders: WorkOrder[];
  /** Durable build timeline, read server-side from `.pandacorp/track.jsonl`. */
  timeline: BuildTimeline;
  /** Project slug — scopes the live-refresh subscription. */
  project: string;
}

type ObsView = "timeline" | "dag";

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
 * Live: WoLiveRefresh triggers a server re-read of the track on each SSE event.
 */
export function ObservabilidadTab({
  workOrders: staticOrders,
  timeline,
  project,
}: ObservabilidadTabProps): React.JSX.Element {
  // View state: "timeline" (default) or "dag" (AC-12-002.3)
  const [view, setView] = useState<ObsView>("timeline");

  return (
    <div data-testid="obs-shell" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Live updater (AC-12-005): re-reads track.jsonl on each SSE event. */}
      <WoLiveRefresh project={project} />

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
            <TimelineView timeline={timeline} />
          </div>
        ) : (
          <WoDag workOrders={staticOrders} project={project} />
        )}
      </div>
    </div>
  );
}
