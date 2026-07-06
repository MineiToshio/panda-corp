/**
 * manual-diagrams/WorkflowShapeDiagram.tsx — FRD-08 Workflows overview ("La forma que se repite")
 *
 * The fan-out → gate silhouette shared by every Dynamic Workflow: many subagents work in parallel
 * (fan-out row), then a review gate funnels the result before it's let through (the newspaper
 * analogy — many reporters write sections in parallel, but everything passes the editor's desk
 * before printing; a "split" gate is four specialists instead of one editor).
 *
 * Tokens only · light+dark first-class · meaning never by color alone (labels carry the meaning).
 *
 * Traceability: CMP-08-diagrams (Workflows overview, content spec proposal 31).
 */

import type React from "react";
import { DownArrow } from "./atoms";

// ---------------------------------------------------------------------------
// Fan-out row — N parallel worker chips
// ---------------------------------------------------------------------------

const WORKERS: readonly string[] = ["Reportero A", "Reportero B", "Reportero C", "Reportero D"];

const GATE_LENSES: readonly string[] = ["Hechos", "Legal", "Estilo", "Maqueta"];

function WorkerChip({ label }: { label: string }): React.JSX.Element {
  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        background: "var(--color-panel)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: "8px",
        padding: "9px 6px",
        textAlign: "center",
        fontSize: "11.5px",
        color: "var(--color-text2)",
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
        background: "var(--color-warn-bg)",
        border: `0.5px solid var(--color-warn)`,
        borderRadius: "8px",
        padding: "7px 6px",
        textAlign: "center",
        fontSize: "10.5px",
        color: "var(--color-warn)",
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
          background: "var(--color-card)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "10px",
          padding: "10px 12px",
        }}
      >
        <i
          className="ti ti-hand-stop"
          aria-hidden="true"
          style={{ fontSize: "16px", color: "var(--color-warn)", flex: "0 0 auto" }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--color-text)" }}>
            La compuerta — el jefe de redacción
          </div>
          <div style={{ fontSize: "11.5px", color: "var(--color-text2)", marginTop: "4px" }}>
            Verifica antes de dejar pasar. En "split" son varios especialistas a la vez:
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
          background: "var(--color-ok-bg)",
          border: "0.5px solid var(--color-ok)",
          borderRadius: "8px",
          padding: "8px 12px",
          textAlign: "center",
          fontSize: "12px",
          color: "var(--color-ok)",
        }}
      >
        Solo lo confirmado se imprime
      </div>
    </div>
  );
}
