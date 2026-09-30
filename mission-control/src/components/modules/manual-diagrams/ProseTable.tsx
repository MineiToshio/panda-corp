/**
 * manual-diagrams/ProseTable.tsx — FRD-08 Manual reference table
 *
 * A generic header + rows table for the Manual's prose pages (engine args, routes,
 * state fields). Same look as StateTable (11-12px, hairline rows, muted columns);
 * the columns listed in `monoColumns` (default: the first) are mono because they
 * name a file, route, argument or value. Wrapped in a horizontally scrollable
 * section so a wide table never overflows the reader on a phone. Cells are plain
 * strings: the table is reference data, never layout. Tokens only · light+dark
 * first-class.
 *
 * Traceability: CMP-08-diagrams (prose-table).
 */

import type React from "react";
import { Panel } from "@/components/core/Panel/Panel";

export interface ProseTableProps {
  /** Accessible name of the table (what the rows enumerate). */
  label: string;
  /** Column headers; every row has the same number of cells. */
  columns: readonly string[];
  /** Rows of plain-string cells; the first cell of each row is its unique key. */
  rows: readonly (readonly string[])[];
  /** Indexes of the columns rendered in mono (default: only the first). */
  monoColumns?: readonly number[];
}

const TH_STYLE: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: "1px solid var(--color-border)",
  color: "var(--color-text2)",
  fontWeight: 500,
  whiteSpace: "nowrap",
};

const TD_STYLE: React.CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid var(--color-border)",
  verticalAlign: "top",
  color: "var(--color-text2)",
  lineHeight: 1.5,
};

const MONO_TD_STYLE: React.CSSProperties = {
  ...TD_STYLE,
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "11px",
  color: "var(--color-text)",
};

const DEFAULT_MONO_COLUMNS: readonly number[] = [0];

/** Render one reference table inside a Panel with horizontal scroll. */
export function ProseTable({
  label,
  columns,
  rows,
  monoColumns = DEFAULT_MONO_COLUMNS,
}: ProseTableProps): React.JSX.Element {
  return (
    <Panel>
      <section aria-label={label} style={{ overflowX: "auto", margin: "-2px" }}>
        <table
          data-testid="manual-prose-table"
          style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}
        >
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col" style={TH_STYLE}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, cellIndex) => (
                  <td
                    // biome-ignore lint/suspicious/noArrayIndexKey: static authored cells, stable column order
                    key={cellIndex}
                    style={monoColumns.includes(cellIndex) ? MONO_TD_STYLE : TD_STYLE}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Panel>
  );
}
