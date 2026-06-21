/**
 * WO-12-005 preview route — visual fidelity check (DR-056).
 * Renders ObservabilidadTab + TimelineView with sample data so the implementer
 * can compare against prototype observabilidadBody() + bTimeline() (~L1214/~L1156).
 *
 * This file exists only for the in-loop fidelity check. Not shipped behavior.
 */

"use client";

import { ObservabilidadTab } from "@/app/projects/[slug]/_observability/ObservabilidadTab/ObservabilidadTab";
import type { WorkOrder } from "@/lib/work-orders/work-orders";

// Mirror of prototype BWO data — same WOs used in bTimeline() and bDag()
const SAMPLE_WOS: WorkOrder[] = [
  {
    id: "WO-02-001",
    title: "Esquema de datos + seeds",
    frd: "FRD-01",
    state: "done",
    relPath: "docs/frds/frd-01/work-orders/wo-02-001.md",
  },
  {
    id: "WO-02-002",
    title: "CRUD de grupos",
    frd: "FRD-01",
    state: "fail",
    relPath: "docs/frds/frd-01/work-orders/wo-02-002.md",
  },
  {
    id: "WO-02-003",
    title: "Registrar gasto",
    frd: "FRD-02",
    state: "in_progress",
    relPath: "docs/frds/frd-02/work-orders/wo-02-003.md",
  },
  {
    id: "WO-02-004",
    title: "Cálculo de deudas",
    frd: "FRD-03",
    state: "todo",
    relPath: "docs/frds/frd-03/work-orders/wo-02-004.md",
  },
  {
    id: "WO-02-005",
    title: "Pantalla de liquidación",
    frd: "FRD-03",
    state: "todo",
    relPath: "docs/frds/frd-03/work-orders/wo-02-005.md",
  },
];

export default function PreviewPage() {
  return (
    <div
      style={{
        background: "var(--color-base)",
        minHeight: "100dvh",
        padding: "20px",
        color: "var(--color-text)",
        fontFamily: "inherit",
      }}
    >
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div
          style={{
            fontSize: "11px",
            color: "var(--color-text3)",
            marginBottom: "16px",
            borderBottom: "0.5px solid var(--color-border)",
            paddingBottom: "8px",
          }}
        >
          WO-12-005 visual fidelity preview · compare against prototype observabilidadBody() ~L1214
        </div>

        <ObservabilidadTab workOrders={SAMPLE_WOS} project="preview-project" />
      </div>
    </div>
  );
}
