/**
 * WO-12-005 preview route — visual fidelity check (DR-056).
 * Renders ObservabilidadTab with sample data so the implementer
 * can compare against the prototype observabilidadBody() + bTimeline() mock.
 *
 * NOT shipping code — exists only for the in-loop fidelity check.
 */

"use client";

import { ObservabilidadTab } from "@/app/projects/[slug]/_observability/ObservabilidadTab/ObservabilidadTab";
import type { WorkOrder } from "@/lib/work-orders/work-orders";

// Sample work orders matching prototype BWO data
const SAMPLE_ORDERS: WorkOrder[] = [
  {
    id: "WO-02-001",
    title: "Esquema de datos",
    frd: "frd-02-data-reading",
    state: "done",
    relPath: "docs/frds/frd-02/work-orders/wo-02-001.md",
  },
  {
    id: "WO-02-002",
    title: "CRUD de grupos",
    frd: "frd-02-data-reading",
    state: "fail",
    relPath: "docs/frds/frd-02/work-orders/wo-02-002.md",
  },
  {
    id: "WO-02-003",
    title: "Registrar gasto",
    frd: "frd-02-data-reading",
    state: "in_progress",
    relPath: "docs/frds/frd-02/work-orders/wo-02-003.md",
  },
  {
    id: "WO-02-004",
    title: "Cálculo de deudas",
    frd: "frd-03-calculations",
    state: "todo",
    relPath: "docs/frds/frd-03/work-orders/wo-02-004.md",
  },
  {
    id: "WO-02-005",
    title: "Exportar CSV",
    frd: "frd-04-export",
    state: "review",
    relPath: "docs/frds/frd-04/work-orders/wo-02-005.md",
  },
];

export default function PreviewPage() {
  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "900px",
        margin: "0 auto",
        background: "var(--color-surface)",
        minHeight: "100dvh",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          color: "var(--color-text3)",
          letterSpacing: ".08em",
          marginBottom: "24px",
        }}
      >
        WO-12-005 — VISUAL FIDELITY CHECK · Comparar con observabilidadBody() + bTimeline()
      </p>

      <ObservabilidadTab workOrders={SAMPLE_ORDERS} project="preview-project" />
    </div>
  );
}
