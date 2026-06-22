/**
 * manual-diagrams/StateTable.tsx — FRD-08 ("Estado y archivos · el modelo de datos")
 *
 * The state/files table: file path (mono) · what it stores · who writes it.
 * Wrapped by the caller in a Panel with overflow-x:auto.
 *
 * Faithful recreation of the prototype `docPage(9)` table (index.html L1085-1086).
 *
 * Tokens only · light+dark first-class.
 *
 * Traceability: CMP-08-diagrams (state-table).
 */

import type React from "react";

type Row = { readonly file: string; readonly stores: string; readonly writer: string };

const ROWS: readonly Row[] = [
  {
    file: "factory/ideas/<slug>.md",
    stores: "frontmatter: status, project_type, score, evidence",
    writer: "los skills",
  },
  {
    file: ".pandacorp/status.yaml",
    stores: "phase, running, advance_pending, work_orders, last_green_sha, safe_to_test, *_pending",
    writer: "el gate / los skills",
  },
  {
    file: ".pandacorp/comms/iteration.md",
    stores:
      "bitácora de iteración en sitio: qué se probó/rechazó y por qué (para retomar tras perder el chat)",
    writer: "los skills de fase",
  },
  {
    file: "docs/frds/frd-NN-<slug>/work-orders/",
    stores: "estado de cada WO (todo→done), por feature",
    writer: "los agentes",
  },
  {
    file: ".pandacorp/inbox/decisions.md",
    stores: "decisiones pendientes + recomendación",
    writer: "implement / decide",
  },
  {
    file: ".pandacorp/inbox/bugs/",
    stores: "bandeja de bugs reportados",
    writer: "bug / implement",
  },
  {
    file: ".pandacorp/comms/progress.md",
    stores: "bitácora append-only",
    writer: "los agentes",
  },
  {
    file: "~/.claude/dashboard-events.ndjson",
    stores: "eventos en vivo (Party)",
    writer: "subagentes + SubagentStop",
  },
] as const;

const TH_STYLE: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: "1px solid var(--color-border)",
  color: "var(--color-text2)",
  fontWeight: 500,
};

const TD_BASE: React.CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid var(--color-border)",
};

export function StateTable(): React.JSX.Element {
  return (
    <table
      data-testid="manual-diagram-state-table"
      style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}
    >
      <thead>
        <tr>
          <th style={TH_STYLE}>Archivo</th>
          <th style={TH_STYLE}>Qué guarda</th>
          <th style={TH_STYLE}>Lo escribe</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => (
          <tr key={row.file}>
            <td
              style={{
                ...TD_BASE,
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "11px",
                color: "var(--color-text)",
              }}
            >
              {row.file}
            </td>
            <td style={{ ...TD_BASE, color: "var(--color-text2)" }}>{row.stores}</td>
            <td style={{ ...TD_BASE, color: "var(--color-text3)" }}>{row.writer}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
