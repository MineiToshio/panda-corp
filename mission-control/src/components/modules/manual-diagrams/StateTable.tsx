/**
 * manual-diagrams/StateTable.tsx : FRD-08 ("Estado y archivos · el modelo de datos")
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
    file: ".pandacorp/run/build/state.json",
    stores: "caché de unidades en vuelo; no sustituye al frontmatter",
    writer: "el CLI cercado por lease y epoch",
  },
  {
    file: ".pandacorp/run/build/admission.json",
    stores: "paso 1/2/3/5/8, motivo y espera por disco",
    writer: "el controlador de admisión",
  },
  {
    file: ".pandacorp/inbox/decisions.pending.md",
    stores: "espejo local de preguntas cuando el inbox está versionado",
    writer: "el CLI",
  },
  {
    file: "~/.pandacorp/host/perf/journal.jsonl",
    stores: "rendimiento retrospectivo local, fuera de git",
    writer: "el CLI",
  },
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
    stores: "estado durable de cada WO por feature; main avanza al aterrizar",
    writer: "el CLI y los skills autorizados",
  },
  {
    file: ".pandacorp/inbox/decisions.md",
    stores: "decisiones pendientes + recomendación",
    writer: "implement / decide",
  },
  {
    file: ".pandacorp/inbox/changes/",
    stores: "tarjetas de alcance y borradores; sin drenaje automático",
    writer: "la sesión / implement",
  },
  {
    file: ".pandacorp/comms/progress.md",
    stores: "bitácora append-only",
    writer: "el CLI y los skills autorizados",
  },
  {
    file: "~/.claude/dashboard-events.ndjson",
    stores: "observaciones del transporte Claude; Codex usa su propio archivo",
    writer: "el CLI y los hooks disponibles",
  },
] as const;

const TH_STYLE: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: "1px solid var(--line)",
  color: "var(--text-2)",
  fontWeight: 500,
};

const TD_BASE: React.CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid var(--line)",
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
                color: "var(--text)",
              }}
            >
              {row.file}
            </td>
            <td style={{ ...TD_BASE, color: "var(--text-2)" }}>{row.stores}</td>
            <td style={{ ...TD_BASE, color: "var(--text-3)" }}>{row.writer}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
