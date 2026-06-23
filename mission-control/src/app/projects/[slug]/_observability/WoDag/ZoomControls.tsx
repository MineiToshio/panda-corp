/**
 * ZoomControls — floating zoom toolbar pinned to the DAG canvas corner.
 *
 * Sits absolutely inside the (position:relative) scroll viewport so it stays
 * put while the graph pans underneath. Buttons cover the keyboard/no-wheel path
 * (a11y): zoom out, the % readout (click → reset to 100%), zoom in, fit.
 */

interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFit: () => void;
}

const BAR_STYLE: React.CSSProperties = {
  position: "absolute",
  top: "8px",
  right: "8px",
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  gap: "2px",
  background: "var(--color-panel)",
  border: "0.5px solid var(--color-border)",
  borderRadius: "var(--radius-sm, 4px)",
  padding: "2px",
  boxShadow: "var(--shadow-1, none)",
};

const BTN_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "26px",
  height: "26px",
  border: "none",
  borderRadius: "var(--radius-sm, 4px)",
  background: "transparent",
  color: "var(--color-text2)",
  cursor: "pointer",
  fontSize: "15px",
  lineHeight: 1,
};

const LEVEL_STYLE: React.CSSProperties = {
  minWidth: "44px",
  height: "26px",
  padding: "0 4px",
  border: "none",
  borderRadius: "var(--radius-sm, 4px)",
  background: "transparent",
  color: "var(--color-text2)",
  cursor: "pointer",
  fontSize: "11px",
  fontVariantNumeric: "tabular-nums",
};

/** The floating zoom toolbar (out · level/reset · in · fit). */
export function ZoomControls({
  scale,
  onZoomIn,
  onZoomOut,
  onReset,
  onFit,
}: ZoomControlsProps): React.JSX.Element {
  const pct = `${Math.round(scale * 100)}%`;

  return (
    <div data-testid="dag-zoom" style={BAR_STYLE}>
      <button
        type="button"
        data-testid="dag-zoom-out"
        aria-label="Alejar"
        onClick={onZoomOut}
        style={BTN_STYLE}
      >
        <i className="ti ti-zoom-out" aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid="dag-zoom-level"
        aria-label={`Zoom ${pct} — restablecer a 100%`}
        title="Restablecer a 100%"
        onClick={onReset}
        style={LEVEL_STYLE}
      >
        {pct}
      </button>
      <button
        type="button"
        data-testid="dag-zoom-in"
        aria-label="Acercar"
        onClick={onZoomIn}
        style={BTN_STYLE}
      >
        <i className="ti ti-zoom-in" aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid="dag-zoom-fit"
        aria-label="Ajustar el grafo a la vista"
        title="Ajustar a la vista"
        onClick={onFit}
        style={BTN_STYLE}
      >
        <i className="ti ti-zoom-scan" aria-hidden="true" />
      </button>
    </div>
  );
}
