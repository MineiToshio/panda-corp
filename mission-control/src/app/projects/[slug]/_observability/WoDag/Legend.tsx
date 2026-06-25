/**
 * Legend — the WoDag header line (icon + one-line explainer + state legend).
 * Tokens only; the state legend conveys meaning by dot + text, not color alone.
 */

import type { WorkOrderState } from "@/lib/work-orders/work-orders";

const STATE_LEGEND: ReadonlyArray<{ state: WorkOrderState; color: string; label: string }> = [
  { state: "done", color: "var(--color-ok)", label: "hecho" },
  { state: "review", color: "var(--color-info)", label: "revisión" },
  { state: "in_progress", color: "var(--color-accent)", label: "en curso" },
  { state: "fail", color: "var(--color-danger)", label: "falló" },
  { state: "todo", color: "var(--color-border-strong)", label: "pendiente" },
];

/** The WoDag legend / header. */
export function Legend(): React.JSX.Element {
  return (
    <div
      data-testid="dag-legend"
      style={{
        fontSize: "12px",
        color: "var(--color-text2)",
        marginBottom: "10px",
        display: "flex",
        gap: "12px",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <span>
        <i
          className="ti ti-binary-tree"
          aria-hidden="true"
          style={{
            fontSize: "14px",
            verticalAlign: "-2px",
            color: "var(--color-accent-text)",
            marginRight: "6px",
          }}
        />
        Mapa de dependencias: cajas = FRDs, tarjetas = work orders. Selecciona una tarjeta para
        seguir su cadena.
      </span>
      <span style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {STATE_LEGEND.map(({ state, color, label }) => (
          <span key={state} style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
            <i
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: "9px",
                height: "9px",
                borderRadius: "2px",
                background: color,
              }}
            />
            {label}
          </span>
        ))}
      </span>
    </div>
  );
}
