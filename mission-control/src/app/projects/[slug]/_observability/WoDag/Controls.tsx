/**
 * Controls — the WoDag controls bar: jump-to-first-error, follow-active toggle,
 * and the selection hint (with a "limpiar" clear link when a WO is pinned).
 * Tokens only; meaning by border + icon + text, never color alone.
 */

const BTN_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  padding: "4px 10px",
  borderRadius: "var(--radius-sm, 4px)",
  background: "transparent",
  fontSize: "12px",
  cursor: "pointer",
};

export interface ControlsProps {
  firstErrorId: string | null;
  followActive: boolean;
  /** The currently PINNED WO (null when nothing is pinned). */
  activeNodeId: string | null;
  onJumpError: () => void;
  onFollowToggle: () => void;
  onClearChain: () => void;
}

/** The controls bar above the DAG canvas. */
export function Controls({
  firstErrorId,
  followActive,
  activeNodeId,
  onJumpError,
  onFollowToggle,
  onClearChain,
}: ControlsProps): React.JSX.Element {
  return (
    <div
      data-testid="dag-controls"
      style={{
        display: "flex",
        gap: "8px",
        alignItems: "center",
        flexWrap: "wrap",
        marginBottom: "10px",
      }}
    >
      {firstErrorId !== null && (
        <button
          type="button"
          data-testid="dag-jump-error"
          onClick={onJumpError}
          style={{
            ...BTN_STYLE,
            border: "1px solid var(--color-danger)",
            color: "var(--color-danger)",
          }}
        >
          <i className="ti ti-alert-triangle" aria-hidden="true" style={{ fontSize: "13px" }} />
          Saltar al primer error
        </button>
      )}

      <button
        type="button"
        data-testid="dag-follow-toggle"
        onClick={onFollowToggle}
        style={{
          ...BTN_STYLE,
          border: followActive
            ? "1px solid var(--color-accent)"
            : "0.5px solid var(--color-border)",
          color: followActive ? "var(--color-accent-text)" : "var(--color-text3)",
        }}
      >
        <i
          className={`ti ${followActive ? "ti-eye" : "ti-eye-off"}`}
          aria-hidden="true"
          style={{ fontSize: "13px" }}
        />
        Seguir al paso activo: {followActive ? "ON" : "OFF"}
      </button>

      <span
        style={{
          fontSize: "11px",
          color: "var(--color-text3)",
          flex: 1,
          minWidth: "160px",
          textAlign: "right",
        }}
      >
        {activeNodeId !== null ? (
          <span data-testid="dag-chain-hint">
            <i
              className="ti ti-affiliate"
              aria-hidden="true"
              style={{ fontSize: "12px", verticalAlign: "-1px" }}
            />{" "}
            Resaltando la cadena de <strong>{activeNodeId}</strong> y sus FRDs vecinas.{" "}
            <button
              type="button"
              data-testid="dag-chain-clear"
              onClick={onClearChain}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-accent-text)",
                cursor: "pointer",
                padding: 0,
                fontSize: "inherit",
                textDecoration: "underline",
              }}
            >
              limpiar
            </button>
          </span>
        ) : (
          <span data-testid="dag-default-hint">
            Haz clic en una tarjeta para fijar su cadena de dependencias y atenuar el resto.
          </span>
        )}
      </span>
    </div>
  );
}
