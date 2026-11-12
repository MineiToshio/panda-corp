import { Icon } from "@/components/core/Icon/Icon";
/**
 * manual-diagrams/WorkflowShapeDiagram.tsx : FRD-08 Workflows overview ("La forma que se repite")
 *
 * The fan-out → gate silhouette shared by every ejecutor determinista: many subagents work in parallel
 * (fan-out row), then a review gate funnels the result before it's let through (the newspaper
 * analogy : many reporters write sections in parallel, but everything passes the editor's desk
 * before printing; a "split" gate is four specialists instead of one editor).
 *
 * Tokens only · light+dark first-class · meaning never by color alone (labels carry the meaning).
 *
 * Traceability: CMP-08-diagrams (Workflows overview, content spec proposal 31).
 */

import type React from "react";
import { DownArrow } from "./atoms";

// ---------------------------------------------------------------------------
// Fan-out row : N parallel worker chips
// ---------------------------------------------------------------------------

const WORKERS: readonly string[] = ["Unidad lista A", "Unidad lista B"];

const GATE_LENSES: readonly string[] = ["Hechos", "Legal", "Estilo", "Maqueta"];

function WorkerChip({ label }: { label: string }): React.JSX.Element {
  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        background: "var(--surface)",
        border: "1px solid var(--line-strong)",
        borderRadius: "var(--r-sm)",
        padding: "9px 6px",
        textAlign: "center",
        fontSize: "11.5px",
        color: "var(--text-2)",
      }}
    >
      {label}
    </div>
  );
}

function GateLensChip({ label }: { label: string }): React.JSX.Element {
  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        background: "color-mix(in srgb, var(--amber) var(--tint), transparent)",
        border: `0.5px solid var(--amber)`,
        borderRadius: "var(--r-sm)",
        padding: "7px 6px",
        textAlign: "center",
        fontSize: "10.5px",
        color: "var(--amber)",
      }}
    >
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkflowShapeDiagram(): React.JSX.Element {
  return (
    <div data-testid="manual-diagram-workflow-shape">
      {/* Fan-out: many subagents working at once */}
      <div style={{ display: "flex", gap: "8px" }}>
        {WORKERS.map((label) => (
          <WorkerChip key={label} label={label} />
        ))}
      </div>
      <DownArrow />

      {/* The gate: one editor, or (split) four specialists in parallel */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "var(--surface-2)",
          border: "1px solid var(--line-strong)",
          borderRadius: "var(--r-md)",
          padding: "10px 12px",
        }}
      >
        <span
          aria-hidden="true"
          style={{ fontSize: "16px", color: "var(--amber)", flex: "0 0 auto" }}
        >
          <Icon name="users" size="sm" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text)" }}>
            Revisión independiente · otra compañía
          </div>
          <div style={{ fontSize: "11.5px", color: "var(--text-2)", marginTop: "4px" }}>
            Un único revisor contrasta el contrato y la evidencia con estas lentes:
          </div>
          <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
            {GATE_LENSES.map((label) => (
              <GateLensChip key={label} label={label} />
            ))}
          </div>
        </div>
      </div>
      <DownArrow />

      {/* What survives the gate */}
      <div
        style={{
          background: "color-mix(in srgb, var(--green) var(--tint), transparent)",
          border: "0.5px solid var(--green)",
          borderRadius: "var(--r-sm)",
          padding: "8px 12px",
          textAlign: "center",
          fontSize: "12px",
          color: "var(--green)",
        }}
      >
        Integración verificada → merge-queue → main
      </div>
    </div>
  );
}
