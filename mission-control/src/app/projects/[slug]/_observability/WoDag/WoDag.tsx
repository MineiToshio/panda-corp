"use client";

/**
 * WoDag — stub placeholder for WO-12-006.
 *
 * WO-12-005 (ObservabilidadTab) mounts this as the DAG lens of the Línea-de-tiempo↔DAG toggle.
 * The real implementation is delivered by WO-12-006 (`WoDag` with Dagre layout, chain-highlight,
 * jump-to-first-error, follow-active-step). This stub keeps the toggle wired while WO-12-006
 * is in-flight.
 *
 * WO-12-005 owns the tab shell + timeline lens.
 * WO-12-006 owns THIS component — replace the body when WO-12-006 lands.
 *
 * Traceability: AC-12-004.1/2/3/4 → WO-12-006
 */

import type { WorkOrder } from "@/lib/work-orders/work-orders";

export interface WoDagProps {
  workOrders: WorkOrder[];
  /** Slug of the current project (for useLiveSnapshot scoping in WO-12-006) */
  project?: string;
}

/**
 * WoDag stub — placeholder until WO-12-006 delivers the Dagre implementation.
 * Renders a minimal panel so the DAG tab lens has a visible, non-broken body.
 */
export function WoDag({ workOrders }: WoDagProps): React.JSX.Element {
  return (
    <div
      data-testid="wo-dag-stub"
      role="status"
      aria-label="Grafo de dependencias (pendiente WO-12-006)"
      style={{
        padding: "24px 16px",
        fontSize: "13px",
        color: "var(--color-text3)",
        textAlign: "center",
      }}
    >
      <i
        className="ti ti-binary-tree"
        aria-hidden="true"
        style={{
          fontSize: "24px",
          color: "var(--color-accent-text)",
          display: "block",
          marginBottom: "8px",
        }}
      />
      <div>Grafo DAG ({workOrders.length} work orders) — implementado en WO-12-006</div>
    </div>
  );
}
